/*
|--------------------------------------------------------------------------
| Application Constants
|--------------------------------------------------------------------------
*/

/*
|--------------------------------------------------------------------------
| Sale States
|--------------------------------------------------------------------------
*/

const SALE_STATES = Object.freeze({
  NORMAL: "normal",
  UPCOMING: "upcoming",
  LIVE: "live",
  ENDED: "ended",
});

/*
|--------------------------------------------------------------------------
| Product Availability States
|--------------------------------------------------------------------------
*/

const AVAILABILITY_STATES = Object.freeze({
  AVAILABLE: "available",
  LOW_STOCK: "low_stock",
  SOLD_OUT: "sold_out",
  RESERVING: "reserving",
  RESERVED: "reserved",
  UPCOMING: "upcoming",
  SALE_ENDED: "sale_ended",
});

/*
|--------------------------------------------------------------------------
| Reservation Statuses
|--------------------------------------------------------------------------
*/

const RESERVATION_STATUSES = Object.freeze({
  ACTIVE: "active",

  /*
  |--------------------------------------------------------------------------
  | Payment Pending
  |--------------------------------------------------------------------------
  |
  | Payment has started with the provider.
  | The reservation receives a short server-controlled grace period.
  |
  */

  PAYMENT_PENDING: "payment_pending",

  EXPIRED: "expired",
  CONVERTED: "converted",
  CANCELLED: "cancelled",
});

/*
|--------------------------------------------------------------------------
| Order Statuses
|--------------------------------------------------------------------------
*/

const ORDER_STATUSES = Object.freeze({
  PENDING_PAYMENT: "pending_payment",
  CONFIRMED: "confirmed",
  PROCESSING: "processing",
  SHIPPED: "shipped",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
});

/*
|--------------------------------------------------------------------------
| Payment Statuses
|--------------------------------------------------------------------------
*/

const PAYMENT_STATUSES = Object.freeze({
  PENDING: "pending",
  PROCESSING: "processing",
  PAID: "paid",
  FAILED: "failed",
  REFUNDED: "refunded",
});

/*
|--------------------------------------------------------------------------
| Payment Methods
|--------------------------------------------------------------------------
*/

const PAYMENT_METHODS = Object.freeze({
  UPI: "upi",
  CARD: "card",
});

/*
|--------------------------------------------------------------------------
| User Roles
|--------------------------------------------------------------------------
*/

const USER_ROLES = Object.freeze({
  CUSTOMER: "customer",
  ADMIN: "admin",
});

/*
|--------------------------------------------------------------------------
| Address Labels
|--------------------------------------------------------------------------
*/

const ADDRESS_LABELS = Object.freeze({
  HOME: "Home",
  WORK: "Work",
  OTHER: "Other",
});

/*
|--------------------------------------------------------------------------
| Reservation Configuration
|--------------------------------------------------------------------------
*/

const DEFAULT_RESERVATION_DURATION_MINUTES = 10;

const RESERVATION_DURATION_MINUTES = Math.max(
  Number.parseInt(
    process.env.RESERVATION_DURATION_MINUTES,
    10
  ) || DEFAULT_RESERVATION_DURATION_MINUTES,
  1
);

/*
|--------------------------------------------------------------------------
| Payment Pending Grace Period
|--------------------------------------------------------------------------
|
| This is applied only after payment has actually started.
|
| The frontend never controls this value.
|
*/

const DEFAULT_PAYMENT_PENDING_GRACE_MINUTES = 5;

const PAYMENT_PENDING_GRACE_MINUTES = Math.max(
  Number.parseInt(
    process.env.PAYMENT_PENDING_GRACE_MINUTES,
    10
  ) || DEFAULT_PAYMENT_PENDING_GRACE_MINUTES,
  1
);

/*
|--------------------------------------------------------------------------
| Pagination
|--------------------------------------------------------------------------
*/

const DEFAULT_PAGE = 1;

const DEFAULT_LIMIT = 12;

const MAX_LIMIT = 50;

/*
|--------------------------------------------------------------------------
| Order Pricing
|--------------------------------------------------------------------------
*/

const SHIPPING_FEE = 0;

const TAX_RATE = 0;

/*
|--------------------------------------------------------------------------
| Exports
|--------------------------------------------------------------------------
*/

module.exports = {
  SALE_STATES,
  AVAILABILITY_STATES,

  RESERVATION_STATUSES,

  ORDER_STATUSES,

  PAYMENT_STATUSES,

  PAYMENT_METHODS,

  USER_ROLES,

  ADDRESS_LABELS,

  DEFAULT_RESERVATION_DURATION_MINUTES,

  RESERVATION_DURATION_MINUTES,

  DEFAULT_PAYMENT_PENDING_GRACE_MINUTES,

  PAYMENT_PENDING_GRACE_MINUTES,

  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,

  SHIPPING_FEE,
  TAX_RATE,
};