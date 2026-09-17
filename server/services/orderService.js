const mongoose = require("mongoose");

const Order = require("../models/Order");
const Product = require("../models/Product");
const Address = require("../models/Address");
const Reservation = require("../models/Reservation");

const {
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  ORDER_STATUSES,
} = require("../utils/constants");

const reservationService = require("./reservationService");

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function createServiceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function validateObjectId(value, fieldName) {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw createServiceError(`Invalid ${fieldName}`, 400);
  }
}

/*
|--------------------------------------------------------------------------
| Get User's Active Reservations
|--------------------------------------------------------------------------
*/

async function getValidReservations(userId) {
  await reservationService.expireDueReservations();

  const reservations = await Reservation.find({
    userId,
    status: "active",
    expiresAt: {
      $gt: new Date(),
    },
  }).sort({ createdAt: 1 });

  if (!reservations.length) {
    throw createServiceError(
      "Your cart is empty or your reservations have expired",
      409
    );
  }

  return reservations;
}

/*
|--------------------------------------------------------------------------
| Validate Reservations
|--------------------------------------------------------------------------
|
| This is called immediately before creating an order.
|
| The browser countdown is never treated as authoritative.
| MongoDB/server reservation expiry is authoritative.
|
*/

async function validateReservations(userId) {
  const reservations = await getValidReservations(userId);

  const productIds = reservations.flatMap((reservation) =>
    reservation.items.map((item) => item.productId)
  );

  const products = await Product.find({
    _id: { $in: productIds },
    isActive: true,
  });

  const productMap = new Map(
    products.map((product) => [
      product._id.toString(),
      product,
    ])
  );

  const validatedItems = [];
  let subtotal = 0;
  let originalSubtotal = 0;

  for (const reservation of reservations) {
    if (reservation.expiresAt <= new Date()) {
      throw createServiceError(
        "One or more reservations have expired",
        409
      );
    }

    for (const reservedItem of reservation.items) {
      const product = productMap.get(
        reservedItem.productId.toString()
      );

      if (!product) {
        throw createServiceError(
          "One or more products are no longer available",
          409
        );
      }

      /*
       * Flash-sale product must still be inside its sale window.
       */
      const now = new Date();

      if (!product.onSale) {
        throw createServiceError(
          `${product.name} is no longer part of the flash sale`,
          409
        );
      }

      if (
        product.saleStartsAt &&
        now < product.saleStartsAt
      ) {
        throw createServiceError(
          `${product.name} sale has not started`,
          409
        );
      }

      if (
        product.saleEndsAt &&
        now >= product.saleEndsAt
      ) {
        throw createServiceError(
          `${product.name} sale has ended`,
          409
        );
      }

      const quantity = reservedItem.quantity;

      if (!Number.isInteger(quantity) || quantity < 1) {
        throw createServiceError(
          `Invalid quantity for ${product.name}`,
          400
        );
      }

      /*
       * IMPORTANT:
       * The price comes from the current server-side Product document.
       * Never trust a price sent by React.
       */
      const unitPrice = product.price;
      const originalPrice = product.originalPrice || product.price;

      const lineTotal = unitPrice * quantity;
      const originalLineTotal =
        originalPrice * quantity;

      subtotal += lineTotal;
      originalSubtotal += originalLineTotal;

      validatedItems.push({
        reservationId: reservation._id,
        product,
        quantity,
        unitPrice,
        lineTotal,
      });
    }
  }

  return {
    reservations,
    items: validatedItems,
    subtotal,
    originalSubtotal,
    discount: originalSubtotal - subtotal,
  };
}

/*
|--------------------------------------------------------------------------
| Calculate Order Totals
|--------------------------------------------------------------------------
*/

function calculateOrderTotals(subtotal, discount) {
  /*
   * Current VoltCart MVP:
   * - No coupon system
   * - Free delivery
   * - No additional tax configured yet
   *
   * These values can be changed later when the pricing rules
   * are introduced.
   */

  const shippingFee = 0;
  const tax = 0;

  const totalAmount =
    subtotal + shippingFee + tax;

  return {
    subtotal,
    shippingFee,
    discount,
    tax,
    totalAmount,
  };
}

/*
|--------------------------------------------------------------------------
| Validate Address
|--------------------------------------------------------------------------
*/

async function getValidatedAddress(userId, addressId) {
  validateObjectId(addressId, "address ID");

  const address = await Address.findOne({
    _id: addressId,
    userId,
  });

  if (!address) {
    throw createServiceError(
      "Selected address was not found",
      404
    );
  }

  return address;
}

/*
|--------------------------------------------------------------------------
| Create Order
|--------------------------------------------------------------------------
*/

async function createOrder({
  userId,
  addressId,
  paymentMethod,
  idempotencyKey,
}) {
  if (!userId) {
    throw createServiceError(
      "Authentication required",
      401
    );
  }

  if (!addressId) {
    throw createServiceError(
      "Delivery address is required",
      400
    );
  }

  if (
    !Object.values(PAYMENT_METHODS).includes(
      paymentMethod
    )
  ) {
    throw createServiceError(
      "Invalid payment method",
      400
    );
  }

  if (!idempotencyKey) {
    throw createServiceError(
      "Idempotency key is required",
      400
    );
  }

  /*
   * Idempotency:
   *
   * If React retries the same checkout request with the same
   * idempotency key, return the already-created order.
   */
  const existingOrder = await Order.findOne({
    userId,
    idempotencyKey,
  });

  if (existingOrder) {
    return {
      order: serializeOrder(existingOrder),
      reused: true,
    };
  }

  /*
   * Validate address.
   */
  const address = await getValidatedAddress(
    userId,
    addressId
  );

  /*
   * Revalidate every reservation.
   */
  const cart = await validateReservations(userId);

  /*
   * Calculate totals from server-side product data.
   */
  const totals = calculateOrderTotals(
    cart.subtotal,
    cart.discount
  );

  /*
   * Create immutable snapshots.
   *
   * Product information may change later.
   * Order history should not change.
   */
  const orderItems = cart.items.map((item) => ({
    productId: item.product._id,
    name: item.product.name,
    slug: item.product.slug,
    image:
      item.product.thumbnail ||
      item.product.images?.[0] ||
      "",
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    totalPrice: item.lineTotal,
  }));

  /*
   * Address snapshot.
   *
   * The Address collection can change later,
   * but this order must preserve the original delivery address.
   */
  const shippingAddress = {
    label: address.label,
    fullName: address.fullName,
    phone: address.phone,
    addressLine1: address.addressLine1,
    addressLine2: address.addressLine2 || "",
    landmark: address.landmark || "",
    city: address.city,
    state: address.state,
    postalCode: address.postalCode,
    country: address.country,
  };

  const reservationIds = cart.reservations.map(
    (reservation) => reservation._id
  );

  /*
   * Create the order.
   *
   * IMPORTANT:
   * Inventory is NOT converted from reserved → sold here.
   *
   * It stays reserved until the payment service confirms
   * successful payment.
   */
  let order;

  try {
    order = await Order.create({
      userId,

      items: orderItems,

      shippingAddress,

      subtotal: totals.subtotal,
      shippingFee: totals.shippingFee,
      discount: totals.discount,
      tax: totals.tax,
      totalAmount: totals.totalAmount,

      paymentMethod,

      paymentStatus: PAYMENT_STATUSES.PENDING,

      paymentId: null,
      paymentProvider: null,

      status: ORDER_STATUSES.PENDING_PAYMENT,

      idempotencyKey,

      reservationIds,
    });
  } catch (error) {
    /*
     * MongoDB duplicate-key error can occur if two identical
     * requests arrive simultaneously with the same idempotency key.
     *
     * Fetch the already-created order and reuse it.
     */
    if (error.code === 11000) {
      const duplicateOrder = await Order.findOne({
        userId,
        idempotencyKey,
      });

      if (duplicateOrder) {
        return {
          order: serializeOrder(duplicateOrder),
          reused: true,
        };
      }
    }

    throw error;
  }

  return {
    order: serializeOrder(order),
    reused: false,
  };
}

/*
|--------------------------------------------------------------------------
| Get User Orders
|--------------------------------------------------------------------------
*/

async function getUserOrders(
  userId,
  { page = 1, limit = 10 } = {}
) {
  const safePage = Math.max(
    Number.parseInt(page, 10) || 1,
    1
  );

  const safeLimit = Math.min(
    Math.max(
      Number.parseInt(limit, 10) || 10,
      1
    ),
    50
  );

  const skip = (safePage - 1) * safeLimit;

  const [orders, total] = await Promise.all([
    Order.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean(),

    Order.countDocuments({ userId }),
  ]);

  return {
    orders: orders.map(serializeOrder),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit),
    },
  };
}

/*
|--------------------------------------------------------------------------
| Get Single User Order
|--------------------------------------------------------------------------
*/

async function getUserOrder(userId, orderNumber) {
  if (!orderNumber) {
    throw createServiceError(
      "Order number is required",
      400
    );
  }

  const order = await Order.findOne({
    userId,
    orderNumber,
  }).lean();

  if (!order) {
    throw createServiceError(
      "Order not found",
      404
    );
  }

  return serializeOrder(order);
}

/*
|--------------------------------------------------------------------------
| Get Checkout Summary
|--------------------------------------------------------------------------
|
| Useful for the React checkout page before payment.
|
*/

async function getCheckoutSummary(userId) {
  const cart = await validateReservations(userId);

  const totals = calculateOrderTotals(
    cart.subtotal,
    cart.discount
  );

  const earliestExpiry = cart.reservations.reduce(
    (earliest, reservation) => {
      if (!earliest) {
        return reservation.expiresAt;
      }

      return reservation.expiresAt < earliest
        ? reservation.expiresAt
        : earliest;
    },
    null
  );

  return {
    items: cart.items.map((item) => ({
      reservationId: item.reservationId,
      productId: item.product._id,
      name: item.product.name,
      slug: item.product.slug,
      image:
        item.product.thumbnail ||
        item.product.images?.[0] ||
        "",
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
    })),

    subtotal: totals.subtotal,
    originalSubtotal: cart.originalSubtotal,
    discount: totals.discount,
    shippingFee: totals.shippingFee,
    tax: totals.tax,
    totalAmount: totals.totalAmount,

    earliestExpiry,

    remainingMilliseconds: earliestExpiry
      ? Math.max(
          0,
          new Date(earliestExpiry).getTime() -
            Date.now()
        )
      : 0,
  };
}

/*
|--------------------------------------------------------------------------
| Serialize Order
|--------------------------------------------------------------------------
*/

function serializeOrder(order) {
  if (!order) {
    return null;
  }

  return {
    id: order._id,
    orderNumber: order.orderNumber,
    userId: order.userId,

    items: order.items,

    shippingAddress: order.shippingAddress,

    subtotal: order.subtotal,
    shippingFee: order.shippingFee,
    discount: order.discount,
    tax: order.tax,
    totalAmount: order.totalAmount,

    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,

    /*
     * Do not expose sensitive payment-provider data here.
     */
    paymentId: order.paymentId || null,
    paymentProvider:
      order.paymentProvider || null,

    status: order.status,

    reservationIds:
      order.reservationIds || [],

    cancellationReason:
      order.cancellationReason || null,

    cancelledAt:
      order.cancelledAt || null,

    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

module.exports = {
  createOrder,
  getUserOrders,
  getUserOrder,
  getCheckoutSummary,
  validateReservations,
  serializeOrder,
};