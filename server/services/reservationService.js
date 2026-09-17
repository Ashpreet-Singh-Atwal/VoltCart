const mongoose = require("mongoose");

const Reservation = require("../models/Reservation");
const Product = require("../models/Product");

const {
  RESERVATION_STATUSES,
  RESERVATION_DURATION_MINUTES,
} = require("../utils/constants");

const {
  reserveStock,
  releaseStock,
  convertReservedStock,
} = require("./inventoryService");

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

const getReservationExpiry = () => {
  return new Date(
    Date.now() +
      RESERVATION_DURATION_MINUTES *
        60 *
        1000
  );
};

/*
|--------------------------------------------------------------------------
| Serialize Reservation
|--------------------------------------------------------------------------
*/

const serializeReservation = (
  reservation
) => {
  if (!reservation) {
    return null;
  }

  const now = Date.now();

  let effectiveExpiresAt =
    reservation.expiresAt;

  /*
  |--------------------------------------------------------------------------
  | Payment-pending reservations use the
  | server-controlled payment grace expiry.
  |--------------------------------------------------------------------------
  */

  if (
    reservation.status ===
      RESERVATION_STATUSES.PAYMENT_PENDING &&
    reservation.paymentPendingExpiresAt
  ) {
    effectiveExpiresAt =
      reservation.paymentPendingExpiresAt;
  }

  const expiresAtTime = new Date(
    effectiveExpiresAt
  ).getTime();

  return {
    id: reservation._id,

    userId: reservation.userId,

    status: reservation.status,

    items: reservation.items.map(
      (item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })
    ),

    expiresAt: effectiveExpiresAt,

    expiresInSeconds: Math.max(
      Math.floor(
        (expiresAtTime - now) / 1000
      ),
      0
    ),

    paymentPendingAt:
      reservation.paymentPendingAt,

    paymentPendingExpiresAt:
      reservation.paymentPendingExpiresAt,

    convertedAt:
      reservation.convertedAt,

    cancelledAt:
      reservation.cancelledAt,

    orderId: reservation.orderId,

    createdAt: reservation.createdAt,

    updatedAt: reservation.updatedAt,
  };
};

/*
|--------------------------------------------------------------------------
| Check Normal Reservation Expiry
|--------------------------------------------------------------------------
*/

const isReservationExpired = (
  reservation
) => {
  /*
  |--------------------------------------------------------------------------
  | Active reservation
  |--------------------------------------------------------------------------
  */

  if (
    reservation.status ===
    RESERVATION_STATUSES.ACTIVE
  ) {
    return (
      new Date(
        reservation.expiresAt
      ).getTime() <= Date.now()
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Payment-pending reservation
  |--------------------------------------------------------------------------
  */

  if (
    reservation.status ===
    RESERVATION_STATUSES.PAYMENT_PENDING
  ) {
    if (
      !reservation.paymentPendingExpiresAt
    ) {
      return true;
    }

    return (
      new Date(
        reservation.paymentPendingExpiresAt
      ).getTime() <= Date.now()
    );
  }

  return false;
};

/*
|--------------------------------------------------------------------------
| Find Active Reservation
|--------------------------------------------------------------------------
*/

const findActiveReservation = async (
  userId,
  productId
) => {
  if (
    !isValidObjectId(userId) ||
    !isValidObjectId(productId)
  ) {
    return null;
  }

  /*
  |--------------------------------------------------------------------------
  | First clean up expired reservations
  |--------------------------------------------------------------------------
  */

  await expireDueReservationsForUser(
    userId
  );

  const reservation =
    await Reservation.findOne({
      userId,

      status: {
        $in: [
          RESERVATION_STATUSES.ACTIVE,
          RESERVATION_STATUSES.PAYMENT_PENDING,
        ],
      },

      "items.productId": productId,
    });

  return reservation;
};

/*
|--------------------------------------------------------------------------
| Expire One Reservation
|--------------------------------------------------------------------------
*/

const expireReservation = async (
  reservationId
) => {
  if (!isValidObjectId(reservationId)) {
    const error = new Error(
      "Invalid reservation ID"
    );

    error.statusCode = 400;

    throw error;
  }

  const reservation =
    await Reservation.findById(
      reservationId
    );

  if (!reservation) {
    const error = new Error(
      "Reservation not found"
    );

    error.statusCode = 404;
    error.code = "RESERVATION_NOT_FOUND";

    throw error;
  }

  /*
  |--------------------------------------------------------------------------
  | Already finalized
  |--------------------------------------------------------------------------
  */

  if (
    reservation.status !==
      RESERVATION_STATUSES.ACTIVE &&
    reservation.status !==
      RESERVATION_STATUSES.PAYMENT_PENDING
  ) {
    return serializeReservation(
      reservation
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Check whether it has actually expired
  |--------------------------------------------------------------------------
  */

  if (!isReservationExpired(reservation)) {
    return serializeReservation(
      reservation
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Release reserved inventory
  |--------------------------------------------------------------------------
  */

  for (const item of reservation.items) {
    await releaseStock(
      item.productId,
      item.quantity
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Mark reservation expired
  |--------------------------------------------------------------------------
  */

  reservation.status =
    RESERVATION_STATUSES.EXPIRED;

  reservation.cancelledAt = new Date();

  await reservation.save();

  return serializeReservation(
    reservation
  );
};

/*
|--------------------------------------------------------------------------
| Expire Due Reservations For User
|--------------------------------------------------------------------------
*/

const expireDueReservationsForUser =
  async (userId) => {
    const reservations =
      await Reservation.find({
        userId,

        status: {
          $in: [
            RESERVATION_STATUSES.ACTIVE,
            RESERVATION_STATUSES.PAYMENT_PENDING,
          ],
        },
      });

    const expired = [];

    for (const reservation of reservations) {
      if (
        isReservationExpired(
          reservation
        )
      ) {
        const result =
          await expireReservation(
            reservation._id
          );

        expired.push(result);
      }
    }

    return expired;
  };

/*
|--------------------------------------------------------------------------
| Expire All Due Reservations
|--------------------------------------------------------------------------
|
| Called periodically from server.js.
|
*/

const expireDueReservations =
  async () => {
    const reservations =
      await Reservation.find({
        status: {
          $in: [
            RESERVATION_STATUSES.ACTIVE,
            RESERVATION_STATUSES.PAYMENT_PENDING,
          ],
        },
      });

    let expiredCount = 0;

    for (const reservation of reservations) {
      if (
        isReservationExpired(
          reservation
        )
      ) {
        try {
          await expireReservation(
            reservation._id
          );

          expiredCount += 1;
        } catch (error) {
          console.error(
            `Failed to expire reservation ${reservation._id}:`,
            error.message
          );
        }
      }
    }

    return expiredCount;
  };

/*
|--------------------------------------------------------------------------
| Create Reservation
|--------------------------------------------------------------------------
*/

const createReservation = async ({
  userId,
  productId,
  quantity,
}) => {
  if (!isValidObjectId(userId)) {
    const error = new Error(
      "Invalid user ID"
    );

    error.statusCode = 400;

    throw error;
  }

  if (!isValidObjectId(productId)) {
    const error = new Error(
      "Invalid product ID"
    );

    error.statusCode = 400;

    throw error;
  }

  if (
    !Number.isInteger(quantity) ||
    quantity < 1
  ) {
    const error = new Error(
      "Quantity must be at least 1"
    );

    error.statusCode = 400;

    throw error;
  }

  /*
  |--------------------------------------------------------------------------
  | Clean expired reservations first
  |--------------------------------------------------------------------------
  */

  await expireDueReservationsForUser(
    userId
  );

  /*
  |--------------------------------------------------------------------------
  | Prevent duplicate active reservation
  |--------------------------------------------------------------------------
  */

  const existingReservation =
    await Reservation.findOne({
      userId,

      status:
        RESERVATION_STATUSES.ACTIVE,

      "items.productId": productId,
    });

  if (existingReservation) {
    const error = new Error(
      "Product is already reserved in your cart"
    );

    error.statusCode = 409;
    error.code =
      "PRODUCT_ALREADY_RESERVED";

    throw error;
  }

  /*
  |--------------------------------------------------------------------------
  | Get product
  |--------------------------------------------------------------------------
  */

  const product =
    await Product.findOne({
      _id: productId,
      isActive: true,
    });

  if (!product) {
    const error = new Error(
      "Product not found"
    );

    error.statusCode = 404;

    throw error;
  }

  /*
  |--------------------------------------------------------------------------
  | Reserve stock atomically
  |--------------------------------------------------------------------------
  */

  const stockResult =
    await reserveStock(
      productId,
      quantity
    );

  if (!stockResult.success) {
    const error = new Error(
      stockResult.message ||
        "Requested quantity is no longer available"
    );

    error.statusCode = 409;
    error.code = "INSUFFICIENT_STOCK";

    throw error;
  }

  /*
  |--------------------------------------------------------------------------
  | Create reservation
  |--------------------------------------------------------------------------
  */

  const expiresAt =
    getReservationExpiry();

  try {
    const reservation =
      await Reservation.create({
        userId,

        items: [
          {
            productId,
            quantity,
            unitPrice: product.price,
          },
        ],

        status:
          RESERVATION_STATUSES.ACTIVE,

        expiresAt,

        paymentPendingAt: null,

        paymentPendingExpiresAt: null,
      });

    return serializeReservation(
      reservation
    );
  } catch (error) {
    /*
    |--------------------------------------------------------------------------
    | Roll inventory back if reservation creation fails.
    |--------------------------------------------------------------------------
    */

    await releaseStock(
      productId,
      quantity
    );

    throw error;
  }
};

/*
|--------------------------------------------------------------------------
| Increase Reservation Quantity
|--------------------------------------------------------------------------
*/

const increaseReservation = async ({
  reservationId,
  userId,
  quantity,
}) => {
  if (
    !isValidObjectId(reservationId) ||
    !isValidObjectId(userId)
  ) {
    const error = new Error(
      "Invalid reservation or user ID"
    );

    error.statusCode = 400;

    throw error;
  }

  if (
    !Number.isInteger(quantity) ||
    quantity < 1
  ) {
    const error = new Error(
      "Quantity must be at least 1"
    );

    error.statusCode = 400;

    throw error;
  }

  const reservation =
    await Reservation.findOne({
      _id: reservationId,
      userId,
    });

  if (!reservation) {
    const error = new Error(
      "Reservation not found"
    );

    error.statusCode = 404;
    error.code = "RESERVATION_NOT_FOUND";

    throw error;
  }

  /*
  |--------------------------------------------------------------------------
  | Payment cannot be modified.
  |--------------------------------------------------------------------------
  */

  if (
    reservation.status ===
    RESERVATION_STATUSES.PAYMENT_PENDING
  ) {
    const error = new Error(
      "Reservation cannot be changed while payment is pending"
    );

    error.statusCode = 409;

    throw error;
  }

  /*
  |--------------------------------------------------------------------------
  | Expiry check
  |--------------------------------------------------------------------------
  */

  if (
    reservation.status !==
      RESERVATION_STATUSES.ACTIVE ||
    isReservationExpired(reservation)
  ) {
    await expireReservation(
      reservation._id
    );

    const error = new Error(
      "Reservation has expired"
    );

    error.statusCode = 409;
    error.code = "RESERVATION_EXPIRED";

    throw error;
  }

  /*
  |--------------------------------------------------------------------------
  | This project has one product per reservation.
  |--------------------------------------------------------------------------
  */

  if (reservation.items.length !== 1) {
    const error = new Error(
      "Invalid reservation structure"
    );

    error.statusCode = 500;

    throw error;
  }

  const item =
    reservation.items[0];

  /*
  |--------------------------------------------------------------------------
  | Reserve additional inventory.
  |--------------------------------------------------------------------------
  */

  const stockResult =
    await reserveStock(
      item.productId,
      quantity
    );

  if (!stockResult.success) {
    const error = new Error(
      stockResult.message ||
        "Requested quantity is no longer available"
    );

    error.statusCode = 409;
    error.code = "INSUFFICIENT_STOCK";

    throw error;
  }

  /*
  |--------------------------------------------------------------------------
  | IMPORTANT:
  | Quantity changes DO NOT reset expiresAt.
  |--------------------------------------------------------------------------
  */

  item.quantity += quantity;

  await reservation.save();

  return serializeReservation(
    reservation
  );
};

/*
|--------------------------------------------------------------------------
| Decrease Reservation Quantity
|--------------------------------------------------------------------------
*/

const decreaseReservation = async ({
  reservationId,
  userId,
  quantity,
}) => {
  if (
    !isValidObjectId(reservationId) ||
    !isValidObjectId(userId)
  ) {
    const error = new Error(
      "Invalid reservation or user ID"
    );

    error.statusCode = 400;

    throw error;
  }

  if (
    !Number.isInteger(quantity) ||
    quantity < 1
  ) {
    const error = new Error(
      "Quantity must be at least 1"
    );

    error.statusCode = 400;

    throw error;
  }

  const reservation =
    await Reservation.findOne({
      _id: reservationId,
      userId,
    });

  if (!reservation) {
    const error = new Error(
      "Reservation not found"
    );

    error.statusCode = 404;
    error.code = "RESERVATION_NOT_FOUND";

    throw error;
  }

  if (
    reservation.status ===
    RESERVATION_STATUSES.PAYMENT_PENDING
  ) {
    const error = new Error(
      "Reservation cannot be changed while payment is pending"
    );

    error.statusCode = 409;

    throw error;
  }

  if (
    reservation.status !==
      RESERVATION_STATUSES.ACTIVE ||
    isReservationExpired(reservation)
  ) {
    await expireReservation(
      reservation._id
    );

    const error = new Error(
      "Reservation has expired"
    );

    error.statusCode = 409;
    error.code = "RESERVATION_EXPIRED";

    throw error;
  }

  if (reservation.items.length !== 1) {
    const error = new Error(
      "Invalid reservation structure"
    );

    error.statusCode = 500;

    throw error;
  }

  const item =
    reservation.items[0];

  /*
  |--------------------------------------------------------------------------
  | Cannot reduce below one.
  |--------------------------------------------------------------------------
  */

  if (quantity >= item.quantity) {
    const error = new Error(
      "Use remove reservation to remove the item"
    );

    error.statusCode = 400;

    throw error;
  }

  /*
  |--------------------------------------------------------------------------
  | Release inventory.
  |--------------------------------------------------------------------------
  */

  await releaseStock(
    item.productId,
    quantity
  );

  item.quantity -= quantity;

  await reservation.save();

  return serializeReservation(
    reservation
  );
};

/*
|--------------------------------------------------------------------------
| Remove Reservation
|--------------------------------------------------------------------------
*/

const removeReservation = async (
  reservationId,
  userId
) => {
  if (
    !isValidObjectId(reservationId) ||
    !isValidObjectId(userId)
  ) {
    const error = new Error(
      "Invalid reservation or user ID"
    );

    error.statusCode = 400;

    throw error;
  }

  const reservation =
    await Reservation.findOne({
      _id: reservationId,
      userId,
    });

  if (!reservation) {
    const error = new Error(
      "Reservation not found"
    );

    error.statusCode = 404;
    error.code = "RESERVATION_NOT_FOUND";

    throw error;
  }

  /*
  |--------------------------------------------------------------------------
  | Already finalized
  |--------------------------------------------------------------------------
  */

  if (
    reservation.status !==
      RESERVATION_STATUSES.ACTIVE &&
    reservation.status !==
      RESERVATION_STATUSES.PAYMENT_PENDING
  ) {
    return serializeReservation(
      reservation
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Release all reserved inventory.
  |--------------------------------------------------------------------------
  */

  for (const item of reservation.items) {
    await releaseStock(
      item.productId,
      item.quantity
    );
  }

  reservation.status =
    RESERVATION_STATUSES.CANCELLED;

  reservation.cancelledAt = new Date();

  await reservation.save();

  return serializeReservation(
    reservation
  );
};

/*
|--------------------------------------------------------------------------
| Convert Reservation
|--------------------------------------------------------------------------
|
| Called only after server/provider confirms successful payment.
|
*/

const convertReservation = async (
  reservationId,
  orderId
) => {
  if (!isValidObjectId(reservationId)) {
    const error = new Error(
      "Invalid reservation ID"
    );

    error.statusCode = 400;

    throw error;
  }

  const reservation =
    await Reservation.findById(
      reservationId
    );

  if (!reservation) {
    const error = new Error(
      "Reservation not found"
    );

    error.statusCode = 404;
    error.code = "RESERVATION_NOT_FOUND";

    throw error;
  }

  /*
  |--------------------------------------------------------------------------
  | Idempotent conversion
  |--------------------------------------------------------------------------
  */

  if (
    reservation.status ===
    RESERVATION_STATUSES.CONVERTED
  ) {
    return serializeReservation(
      reservation
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Only active/payment-pending reservations
  |--------------------------------------------------------------------------
  */

  if (
    reservation.status !==
      RESERVATION_STATUSES.ACTIVE &&
    reservation.status !==
      RESERVATION_STATUSES.PAYMENT_PENDING
  ) {
    const error = new Error(
      "Reservation cannot be converted"
    );

    error.statusCode = 409;

    throw error;
  }

  /*
  |--------------------------------------------------------------------------
  | Payment-pending expiry is authoritative.
  |--------------------------------------------------------------------------
  */

  if (
    isReservationExpired(reservation)
  ) {
    await expireReservation(
      reservation._id
    );

    const error = new Error(
      "Reservation has expired"
    );

    error.statusCode = 409;
    error.code = "RESERVATION_EXPIRED";

    throw error;
  }

  /*
  |--------------------------------------------------------------------------
  | Convert reserved inventory into sold inventory.
  |--------------------------------------------------------------------------
  */

  for (const item of reservation.items) {
    await convertReservedStock(
      item.productId,
      item.quantity
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Mark reservation converted.
  |--------------------------------------------------------------------------
  */

  reservation.status =
    RESERVATION_STATUSES.CONVERTED;

  reservation.convertedAt = new Date();

  reservation.orderId =
    orderId || null;

  await reservation.save();

  return serializeReservation(
    reservation
  );
};

/*
|--------------------------------------------------------------------------
| Get User Reservations
|--------------------------------------------------------------------------
*/

const getUserReservations = async (
  userId
) => {
  if (!isValidObjectId(userId)) {
    const error = new Error(
      "Invalid user ID"
    );

    error.statusCode = 400;

    throw error;
  }

  /*
  |--------------------------------------------------------------------------
  | Expire anything that has crossed its server expiry.
  |--------------------------------------------------------------------------
  */

  await expireDueReservationsForUser(
    userId
  );

  const reservations =
    await Reservation.find({
      userId,

      status: {
        $in: [
          RESERVATION_STATUSES.ACTIVE,
          RESERVATION_STATUSES.PAYMENT_PENDING,
        ],
      },
    }).sort({
      createdAt: 1,
    });

  return reservations.map(
    serializeReservation
  );
};

/*
|--------------------------------------------------------------------------
| Get One Reservation
|--------------------------------------------------------------------------
*/

const getReservation = async (
  reservationId,
  userId
) => {
  if (
    !isValidObjectId(reservationId) ||
    !isValidObjectId(userId)
  ) {
    const error = new Error(
      "Invalid reservation or user ID"
    );

    error.statusCode = 400;

    throw error;
  }

  const reservation =
    await Reservation.findOne({
      _id: reservationId,
      userId,
    });

  if (!reservation) {
    const error = new Error(
      "Reservation not found"
    );

    error.statusCode = 404;
    error.code = "RESERVATION_NOT_FOUND";

    throw error;
  }

  /*
  |--------------------------------------------------------------------------
  | Expire if necessary.
  |--------------------------------------------------------------------------
  */

  if (
    isReservationExpired(reservation)
  ) {
    return expireReservation(
      reservation._id
    );
  }

  return serializeReservation(
    reservation
  );
};

/*
|--------------------------------------------------------------------------
| Move Reservation To Payment Pending
|--------------------------------------------------------------------------
|
| This function is useful when payment has actually started.
|
| The caller supplies the server-controlled expiry.
|
|--------------------------------------------------------------------------
*/

const markReservationPaymentPending =
  async (
    reservationId,
    userId,
    paymentPendingExpiresAt
  ) => {
    if (
      !isValidObjectId(reservationId) ||
      !isValidObjectId(userId)
    ) {
      const error = new Error(
        "Invalid reservation or user ID"
      );

      error.statusCode = 400;

      throw error;
    }

    if (
      !paymentPendingExpiresAt ||
      new Date(
        paymentPendingExpiresAt
      ).getTime() <= Date.now()
    ) {
      const error = new Error(
        "Invalid payment pending expiry"
      );

      error.statusCode = 400;

      throw error;
    }

    const reservation =
      await Reservation.findOne({
        _id: reservationId,
        userId,
      });

    if (!reservation) {
      const error = new Error(
        "Reservation not found"
      );

      error.statusCode = 404;

      throw error;
    }

    /*
    |--------------------------------------------------------------------------
    | Idempotent
    |--------------------------------------------------------------------------
    */

    if (
      reservation.status ===
      RESERVATION_STATUSES.PAYMENT_PENDING
    ) {
      return serializeReservation(
        reservation
      );
    }

    /*
    |--------------------------------------------------------------------------
    | Only active reservations can enter payment pending.
    |--------------------------------------------------------------------------
    */

    if (
      reservation.status !==
      RESERVATION_STATUSES.ACTIVE
    ) {
      const error = new Error(
        "Reservation cannot enter payment pending state"
      );

      error.statusCode = 409;

      throw error;
    }

    /*
    |--------------------------------------------------------------------------
    | Ensure normal reservation has not expired.
    |--------------------------------------------------------------------------
    */

    if (
      isReservationExpired(reservation)
    ) {
      await expireReservation(
        reservation._id
      );

      const error = new Error(
        "Reservation has expired"
      );

      error.statusCode = 409;
      error.code = "RESERVATION_EXPIRED";

      throw error;
    }

    reservation.status =
      RESERVATION_STATUSES.PAYMENT_PENDING;

    reservation.paymentPendingAt =
      new Date();

    reservation.paymentPendingExpiresAt =
      new Date(paymentPendingExpiresAt);

    await reservation.save();

    return serializeReservation(
      reservation
    );
  };

/*
|--------------------------------------------------------------------------
| Exports
|--------------------------------------------------------------------------
*/

module.exports = {
  findActiveReservation,

  expireReservation,

  expireDueReservations,

  createReservation,

  increaseReservation,

  decreaseReservation,

  removeReservation,

  convertReservation,

  getUserReservations,

  getReservation,

  markReservationPaymentPending,
};