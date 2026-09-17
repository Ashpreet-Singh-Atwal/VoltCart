const { body, param, query } = require("express-validator");

const {
  PAYMENT_METHODS,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} = require("../utils/constants");

/*
|--------------------------------------------------------------------------
| Create Order Validator
|--------------------------------------------------------------------------
|
| POST /api/orders
|
| Expected body:
|
| {
|   "addressId": "...",
|   "paymentMethod": "upi",
|   "idempotencyKey": "..."
| }
|
*/

const createOrderValidator = [
  body("addressId")
    .trim()
    .notEmpty()
    .withMessage("Address ID is required")
    .isMongoId()
    .withMessage("Invalid address ID"),

  body("paymentMethod")
    .trim()
    .notEmpty()
    .withMessage("Payment method is required")
    .isIn(Object.values(PAYMENT_METHODS))
    .withMessage(
      "Payment method must be upi or card"
    ),

  body("idempotencyKey")
    .trim()
    .notEmpty()
    .withMessage(
      "Idempotency key is required"
    )
    .isLength({
      min: 10,
      max: 100,
    })
    .withMessage(
      "Idempotency key must be between 10 and 100 characters"
    )
    .matches(/^[A-Za-z0-9_-]+$/)
    .withMessage(
      "Idempotency key contains invalid characters"
    ),
];

/*
|--------------------------------------------------------------------------
| Order Number Validator
|--------------------------------------------------------------------------
|
| GET /api/orders/:orderNumber
|
*/

const orderNumberValidator = [
  param("orderNumber")
    .trim()
    .notEmpty()
    .withMessage("Order number is required")
    .isLength({
      min: 3,
      max: 50,
    })
    .withMessage("Invalid order number"),
];

/*
|--------------------------------------------------------------------------
| Get Orders Validator
|--------------------------------------------------------------------------
|
| GET /api/orders?page=1&limit=10
|
*/

const getOrdersValidator = [
  query("page")
    .optional()
    .default(String(DEFAULT_PAGE))
    .isInt({
      min: 1,
    })
    .withMessage(
      "Page must be a positive integer"
    )
    .toInt(),

  query("limit")
    .optional()
    .default(String(DEFAULT_LIMIT))
    .isInt({
      min: 1,
      max: MAX_LIMIT,
    })
    .withMessage(
      `Limit must be between 1 and ${MAX_LIMIT}`
    )
    .toInt(),
];

module.exports = {
  createOrderValidator,
  orderNumberValidator,
  getOrdersValidator,
};