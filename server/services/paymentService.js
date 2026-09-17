const crypto = require("crypto");

const Order = require("../models/Order");
const Reservation = require("../models/Reservation");

const {
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  PAYMENT_METHODS,
  RESERVATION_STATUSES,
  PAYMENT_PENDING_GRACE_MINUTES,
} = require("../utils/constants");

const {
  validateReservations,
} = require("./orderService");

const {
  convertReservation,
  removeReservation,
  markReservationPaymentPending,
} = require("./reservationService");

/*
|--------------------------------------------------------------------------
| Generate Mock Payment ID
|--------------------------------------------------------------------------
*/

const generatePaymentId = () => {
  return `mock_pay_${crypto.randomBytes(16).toString("hex")}`;
};

/*
|--------------------------------------------------------------------------
| Generate Mock Client Secret
|--------------------------------------------------------------------------
|
| This is only for development.
|
*/

const generateClientSecret = () => {
  return `mock_secret_${crypto.randomBytes(24).toString("hex")}`;
};

/*
|--------------------------------------------------------------------------
| Serialize Payment
|--------------------------------------------------------------------------
*/

const serializePayment = (order) => {
  if (!order) {
    return null;
  }

  return {
    orderNumber:
      order.orderNumber,

    paymentId:
      order.paymentId || null,

    provider:
      order.paymentProvider || null,

    paymentMethod:
      order.paymentMethod,

    paymentStatus:
      order.paymentStatus,

    orderStatus:
      order.status,

    amount:
      order.totalAmount,

    currency: "INR",

    updatedAt:
      order.paymentUpdatedAt ||
      order.updatedAt,
  };
};

/*
|--------------------------------------------------------------------------
| Find User's Order
|--------------------------------------------------------------------------
*/

const getOrderForPayment = async (
  orderNumber,
  userId
) => {
  const order =
    await Order.findOne({
      orderNumber,
      userId,
    });

  if (!order) {
    const error = new Error(
      "Order not found"
    );

    error.statusCode = 404;

    throw error;
  }

  return order;
};

/*
|--------------------------------------------------------------------------
| Start Payment
|--------------------------------------------------------------------------
*/

const startPayment = async ({
  orderNumber,
  userId,
  paymentMethod,
  idempotencyKey,
}) => {
  const order =
    await getOrderForPayment(
      orderNumber,
      userId
    );

  /*
  |--------------------------------------------------------------------------
  | Same idempotency key + existing payment
  |--------------------------------------------------------------------------
  */

  if (
    order.idempotencyKey ===
      idempotencyKey &&
    order.paymentId
  ) {
    return {
      reused: true,

      payment:
        serializePayment(order),

      clientSecret:
        generateClientSecret(),
    };
  }

  /*
  |--------------------------------------------------------------------------
  | Different attempt on an existing payment
  |--------------------------------------------------------------------------
  */

  if (order.paymentId) {
    const error = new Error(
      "A payment attempt already exists for this order"
    );

    error.statusCode = 409;

    throw error;
  }

  /*
  |--------------------------------------------------------------------------
  | Order must be awaiting payment
  |--------------------------------------------------------------------------
  */

  if (
    order.paymentStatus !==
      PAYMENT_STATUSES.PENDING ||
    order.status !==
      ORDER_STATUSES.PENDING_PAYMENT
  ) {
    const error = new Error(
      "This order is not available for payment"
    );

    error.statusCode = 409;

    throw error;
  }

  /*
  |--------------------------------------------------------------------------
  | Validate payment method
  |--------------------------------------------------------------------------
  */

  if (
    !Object.values(
      PAYMENT_METHODS
    ).includes(paymentMethod)
  ) {
    const error = new Error(
      "Unsupported payment method"
    );

    error.statusCode = 400;

    throw error;
  }

  /*
  |--------------------------------------------------------------------------
  | Revalidate reservations
  |--------------------------------------------------------------------------
  */

  const validation =
    await validateReservations(
      order.reservationIds,
      userId
    );

  if (!validation.valid) {
    const error = new Error(
      validation.message ||
        "Your reservation has expired"
    );

    error.statusCode = 409;
    error.code =
      "RESERVATION_EXPIRED";

    throw error;
  }

  /*
  |--------------------------------------------------------------------------
  | Prevent conflicting idempotency key
  |--------------------------------------------------------------------------
  */

  if (
    order.idempotencyKey &&
    order.idempotencyKey !==
      idempotencyKey
  ) {
    const error = new Error(
      "A different payment attempt already exists for this order"
    );

    error.statusCode = 409;

    throw error;
  }

  /*
  |--------------------------------------------------------------------------
  | Create payment
  |--------------------------------------------------------------------------
  */

  const paymentId =
    generatePaymentId();

  const clientSecret =
    generateClientSecret();

  order.paymentId =
    paymentId;

  order.paymentProvider =
    "mock";

  order.paymentMethod =
    paymentMethod;

  order.paymentStatus =
    PAYMENT_STATUSES.PROCESSING;

  order.idempotencyKey =
    idempotencyKey;

  order.paymentUpdatedAt =
    new Date();

  await order.save();

  /*
  |--------------------------------------------------------------------------
  | Server-controlled payment grace period
  |--------------------------------------------------------------------------
  */

  const paymentPendingExpiresAt =
    new Date(
      Date.now() +
        PAYMENT_PENDING_GRACE_MINUTES *
          60 *
          1000
    );

  /*
  |--------------------------------------------------------------------------
  | Move every reservation to PAYMENT_PENDING
  |--------------------------------------------------------------------------
  */

  for (
    const reservationId of
      order.reservationIds
  ) {
    await markReservationPaymentPending(
      reservationId,
      userId,
      paymentPendingExpiresAt
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Reload order
  |--------------------------------------------------------------------------
  */

  const updatedOrder =
    await Order.findById(
      order._id
    );

  return {
    reused: false,

    payment:
      serializePayment(
        updatedOrder
      ),

    clientSecret,

    paymentId,

    paymentPendingExpiresAt,
  };
};

/*
|--------------------------------------------------------------------------
| Mark Payment Successful
|--------------------------------------------------------------------------
*/

const markPaymentSuccessful =
  async (paymentId) => {
    const order =
      await Order.findOne({
        paymentId,
      });

    if (!order) {
      const error = new Error(
        "Payment not found"
      );

      error.statusCode = 404;

      throw error;
    }

    /*
    |--------------------------------------------------------------------------
    | Idempotent success
    |--------------------------------------------------------------------------
    */

    if (
      order.paymentStatus ===
        PAYMENT_STATUSES.PAID &&
      order.status ===
        ORDER_STATUSES.CONFIRMED
    ) {
      return serializePayment(
        order
      );
    }

    /*
    |--------------------------------------------------------------------------
    | Cannot resurrect failed/refunded payment
    |--------------------------------------------------------------------------
    */

    if (
      order.paymentStatus ===
        PAYMENT_STATUSES.FAILED ||
      order.paymentStatus ===
        PAYMENT_STATUSES.REFUNDED
    ) {
      const error = new Error(
        "Payment is no longer processable"
      );

      error.statusCode = 409;

      throw error;
    }

    /*
    |--------------------------------------------------------------------------
    | Confirm reservations still exist.
    |--------------------------------------------------------------------------
    */

    const reservations =
      await Reservation.find({
        _id: {
          $in:
            order.reservationIds,
        },

        userId:
          order.userId,

        status: {
          $in: [
            RESERVATION_STATUSES.ACTIVE,

            RESERVATION_STATUSES.PAYMENT_PENDING,
          ],
        },
      });

    if (
      reservations.length !==
      order.reservationIds.length
    ) {
      order.paymentStatus =
        PAYMENT_STATUSES.FAILED;

      order.paymentUpdatedAt =
        new Date();

      order.status =
        ORDER_STATUSES.CANCELLED;

      await order.save();

      const error = new Error(
        "Reservation expired before payment was confirmed"
      );

      error.statusCode = 409;
      error.code =
        "RESERVATION_EXPIRED";

      throw error;
    }

    /*
    |--------------------------------------------------------------------------
    | Convert reservations
    |--------------------------------------------------------------------------
    */

    for (
      const reservationId of
        order.reservationIds
    ) {
      await convertReservation(
        reservationId,
        order._id
      );
    }

    /*
    |--------------------------------------------------------------------------
    | Mark order paid and confirmed
    |--------------------------------------------------------------------------
    */

    order.paymentStatus =
      PAYMENT_STATUSES.PAID;

    order.paymentUpdatedAt =
      new Date();

    order.status =
      ORDER_STATUSES.CONFIRMED;

    await order.save();

    return serializePayment(
      order
    );
  };

/*
|--------------------------------------------------------------------------
| Mark Payment Failed
|--------------------------------------------------------------------------
*/

const markPaymentFailed =
  async (paymentId) => {
    const order =
      await Order.findOne({
        paymentId,
      });

    if (!order) {
      const error = new Error(
        "Payment not found"
      );

      error.statusCode = 404;

      throw error;
    }

    /*
    |--------------------------------------------------------------------------
    | Idempotent failure
    |--------------------------------------------------------------------------
    */

    if (
      order.paymentStatus ===
        PAYMENT_STATUSES.FAILED &&
      order.status ===
        ORDER_STATUSES.CANCELLED
    ) {
      return serializePayment(
        order
      );
    }

    /*
    |--------------------------------------------------------------------------
    | Never change successful payment to failed
    |--------------------------------------------------------------------------
    */

    if (
      order.paymentStatus ===
      PAYMENT_STATUSES.PAID
    ) {
      const error = new Error(
        "A successful payment cannot be marked as failed"
      );

      error.statusCode = 409;

      throw error;
    }

    /*
    |--------------------------------------------------------------------------
    | Release reservations
    |--------------------------------------------------------------------------
    */

    for (
      const reservationId of
        order.reservationIds
    ) {
      try {
        await removeReservation(
          reservationId,
          order.userId
        );
      } catch (error) {
        /*
        |--------------------------------------------------------------------------
        | If it was already expired, that's okay.
        |--------------------------------------------------------------------------
        */

        if (
          error.code !==
          "RESERVATION_NOT_FOUND"
        ) {
          console.error(
            `Failed to release reservation ${reservationId}:`,
            error.message
          );
        }
      }
    }

    /*
    |--------------------------------------------------------------------------
    | Mark payment failed
    |--------------------------------------------------------------------------
    */

    order.paymentStatus =
      PAYMENT_STATUSES.FAILED;

    order.paymentUpdatedAt =
      new Date();

    order.status =
      ORDER_STATUSES.CANCELLED;

    await order.save();

    return serializePayment(
      order
    );
  };

/*
|--------------------------------------------------------------------------
| Mark Payment Pending
|--------------------------------------------------------------------------
*/

const markPaymentPending =
  async (paymentId) => {
    const order =
      await Order.findOne({
        paymentId,
      });

    if (!order) {
      const error = new Error(
        "Payment not found"
      );

      error.statusCode = 404;

      throw error;
    }

    /*
    |--------------------------------------------------------------------------
    | Already paid
    |--------------------------------------------------------------------------
    */

    if (
      order.paymentStatus ===
      PAYMENT_STATUSES.PAID
    ) {
      return serializePayment(
        order
      );
    }

    /*
    |--------------------------------------------------------------------------
    | Already failed
    |--------------------------------------------------------------------------
    */

    if (
      order.paymentStatus ===
      PAYMENT_STATUSES.FAILED
    ) {
      const error = new Error(
        "Payment has already failed"
      );

      error.statusCode = 409;

      throw error;
    }

    order.paymentStatus =
      PAYMENT_STATUSES.PROCESSING;

    order.paymentUpdatedAt =
      new Date();

    await order.save();

    return serializePayment(
      order
    );
  };

/*
|--------------------------------------------------------------------------
| Get Payment Status
|--------------------------------------------------------------------------
*/

const getPaymentStatus = async ({
  orderNumber,
  userId,
}) => {
  const order =
    await getOrderForPayment(
      orderNumber,
      userId
    );

  return serializePayment(
    order
  );
};

/*
|--------------------------------------------------------------------------
| Development Mock Payment
|--------------------------------------------------------------------------
*/

const simulateMockPayment =
  async ({
    paymentId,
    result,
  }) => {
    /*
    |--------------------------------------------------------------------------
    | Never expose mock payment simulation in production.
    |--------------------------------------------------------------------------
    */

    if (
      process.env.NODE_ENV ===
      "production"
    ) {
      const error = new Error(
        "Mock payment simulation is disabled in production"
      );

      error.statusCode = 403;

      throw error;
    }

    if (result === "success") {
      return markPaymentSuccessful(
        paymentId
      );
    }

    if (result === "failed") {
      return markPaymentFailed(
        paymentId
      );
    }

    return markPaymentPending(
      paymentId
    );
  };

module.exports = {
  startPayment,

  markPaymentSuccessful,

  markPaymentFailed,

  markPaymentPending,

  getPaymentStatus,

  simulateMockPayment,
};