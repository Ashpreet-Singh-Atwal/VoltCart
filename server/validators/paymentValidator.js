const { body, param } = require("express-validator");

const {
  PAYMENT_METHODS,
} = require("../utils/constants");

/*
|--------------------------------------------------------------------------
| Start Payment
|--------------------------------------------------------------------------
*/

const startPaymentValidator = [
  param("orderNumber")
    .trim()
    .notEmpty()
    .withMessage("Order number is required")
    .isLength({ min: 3, max: 50 })
    .withMessage("Invalid order number"),

  body("paymentMethod")
    .trim()
    .notEmpty()
    .withMessage("Payment method is required")
    .isIn(Object.values(PAYMENT_METHODS))
    .withMessage("Payment method must be upi or card"),

  body("idempotencyKey")
    .trim()
    .notEmpty()
    .withMessage("Idempotency key is required")
    .isLength({ min: 10, max: 100 })
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
| Get Payment Status
|--------------------------------------------------------------------------
*/

const paymentStatusValidator = [
  param("orderNumber")
    .trim()
    .notEmpty()
    .withMessage("Order number is required")
    .isLength({ min: 3, max: 50 })
    .withMessage("Invalid order number"),
];

/*
|--------------------------------------------------------------------------
| Development Mock Provider
|--------------------------------------------------------------------------
|
| This endpoint simulates a payment-provider callback.
|
| It is intentionally restricted to development mode in the controller.
|
*/

const simulatePaymentValidator = [
  param("paymentId")
    .trim()
    .notEmpty()
    .withMessage("Payment ID is required")
    .isLength({ min: 5, max: 150 })
    .withMessage("Invalid payment ID"),

  body("result")
    .trim()
    .notEmpty()
    .withMessage("Payment result is required")
    .isIn(["success", "failed", "pending"])
    .withMessage(
      "Payment result must be success, failed, or pending"
    ),
];

module.exports = {
  startPaymentValidator,
  paymentStatusValidator,
  simulatePaymentValidator,
};