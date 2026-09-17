const express = require("express");

const {
  createOrder,
  getCheckoutSummary,
  getMyOrders,
  getMyOrder,
} = require("../controllers/orderController");

const { protect } = require("../middleware/authMiddleware");

const {
  createOrderValidator,
  orderNumberValidator,
  getOrdersValidator,
} = require("../validators/orderValidator");

const validate = require("../middleware/validationMiddleware");

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Authentication
|--------------------------------------------------------------------------
|
| Every order and checkout route requires a logged-in customer.
|
*/

router.use(protect);

/*
|--------------------------------------------------------------------------
| Checkout Summary
|--------------------------------------------------------------------------
|
| GET /api/orders/checkout-summary
|
| Returns:
| - Reserved items
| - Server-calculated prices
| - Discount
| - Shipping fee
| - Tax
| - Final total
| - Earliest reservation expiry
|
| This route must be declared before /:orderNumber so that
| "checkout-summary" is not interpreted as an order number.
|
*/

router.get(
  "/checkout-summary",
  getCheckoutSummary
);

/*
|--------------------------------------------------------------------------
| Create Order
|--------------------------------------------------------------------------
|
| POST /api/orders
|
| Body:
|
| {
|   "addressId": "...",
|   "paymentMethod": "upi",
|   "idempotencyKey": "..."
| }
|
*/

router.post(
  "/",
  createOrderValidator,
  validate,
  createOrder
);

/*
|--------------------------------------------------------------------------
| Get My Orders
|--------------------------------------------------------------------------
|
| GET /api/orders?page=1&limit=10
|
*/

router.get(
  "/",
  getOrdersValidator,
  validate,
  getMyOrders
);

/*
|--------------------------------------------------------------------------
| Get Single Order
|--------------------------------------------------------------------------
|
| GET /api/orders/:orderNumber
|
*/

router.get(
  "/:orderNumber",
  orderNumberValidator,
  validate,
  getMyOrder
);

module.exports = router;