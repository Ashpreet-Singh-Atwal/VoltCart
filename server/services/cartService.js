const Reservation = require("../models/Reservation");

const reservationService = require("./reservationService");

function calculateCartTotals(reservations) {
  let subtotal = 0;
  let originalSubtotal = 0;
  let totalQuantity = 0;

  const items = reservations.map((reservation) => {
    const reservationItem = reservation.items[0];

    const product =
      reservationItem?.productId &&
      typeof reservationItem.productId === "object"
        ? reservationItem.productId
        : null;

    const quantity = reservationItem.quantity;
    const unitPrice = reservationItem.unitPrice;

    const originalPrice = product?.originalPrice || unitPrice;

    const lineTotal = quantity * unitPrice;
    const originalLineTotal = quantity * originalPrice;

    subtotal += lineTotal;
    originalSubtotal += originalLineTotal;
    totalQuantity += quantity;

    return {
      reservationId: reservation._id,
      productId: product?._id || reservationItem.productId,
      name: product?.name || "Product",
      slug: product?.slug || null,
      image:
        product?.thumbnail ||
        product?.images?.[0] ||
        null,
      category: product?.category || null,
      quantity,
      unitPrice,
      originalPrice,
      lineTotal,
      expiresAt: reservation.expiresAt,
    };
  });

  const discount = Math.max(
    0,
    originalSubtotal - subtotal
  );

  /*
   * Flash-sale cart currently has free delivery.
   *
   * Tax/shipping rules can be applied later when the final
   * checkout calculation is implemented.
   */
  const shippingFee = 0;
  const tax = 0;

  const total = subtotal + shippingFee + tax;

  const earliestExpiry =
    reservations.length > 0
      ? reservations.reduce((earliest, current) => {
          if (!earliest) {
            return current.expiresAt;
          }

          return current.expiresAt < earliest
            ? current.expiresAt
            : earliest;
        }, null)
      : null;

  return {
    items,
    totalQuantity,
    itemCount: items.length,

    subtotal,
    originalSubtotal,
    discount,

    shippingFee,
    tax,
    total,

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
| Get Cart
|--------------------------------------------------------------------------
*/

async function getCart(userId) {
  /*
   * Expire reservations before building the cart.
   */
  await reservationService.expireDueReservations();

  const reservations = await Reservation.find({
    userId,
    status: "active",
    expiresAt: {
      $gt: new Date(),
    },
  })
    .populate(
      "items.productId",
      "name slug thumbnail images category price originalPrice onSale saleEndsAt"
    )
    .sort({
      expiresAt: 1,
    });

  return calculateCartTotals(reservations);
}

/*
|--------------------------------------------------------------------------
| Revalidate Cart
|--------------------------------------------------------------------------
|
| Used before checkout/payment.
|
*/

async function revalidateCart(userId) {
  await reservationService.expireDueReservations();

  const reservations = await Reservation.find({
    userId,
    status: "active",
    expiresAt: {
      $gt: new Date(),
    },
  }).populate(
    "items.productId",
    "name slug thumbnail images category price originalPrice onSale saleEndsAt"
  );

  if (reservations.length === 0) {
    const error = new Error(
      "Your reservation has expired"
    );

    error.statusCode = 409;

    throw error;
  }

  const now = new Date();

  for (const reservation of reservations) {
    if (reservation.expiresAt <= now) {
      await reservationService.expireReservation(
        reservation
      );

      const error = new Error(
        "Your reservation has expired"
      );

      error.statusCode = 409;

      throw error;
    }

    for (const item of reservation.items) {
      const product =
        item.productId &&
        typeof item.productId === "object"
          ? item.productId
          : null;

      if (!product) {
        const error = new Error(
          "A product in your cart is no longer available"
        );

        error.statusCode = 409;

        throw error;
      }

      if (!product.isActive) {
        const error = new Error(
          `${product.name} is no longer available`
        );

        error.statusCode = 409;

        throw error;
      }

      if (!product.onSale) {
        const error = new Error(
          `${product.name} is no longer part of the flash sale`
        );

        error.statusCode = 409;

        throw error;
      }

      if (
        product.saleEndsAt &&
        product.saleEndsAt <= now
      ) {
        const error = new Error(
          `${product.name}: Sale ended`
        );

        error.statusCode = 409;

        throw error;
      }
    }
  }

  return calculateCartTotals(reservations);
}

module.exports = {
  getCart,
  revalidateCart,
  calculateCartTotals,
};