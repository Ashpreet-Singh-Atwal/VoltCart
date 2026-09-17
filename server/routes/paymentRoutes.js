const express = require("express");

const {
  createPayment,
  getStatus,
  simulatePayment,
} = require("../controllers/paymentController");

const {
  protect,
} = require("../middleware/authMiddleware");

const {
  startPaymentValidator,
  paymentStatusValidator,
  simulatePaymentValidator,
} = require("../validators/paymentValidator");

const validate = require("../middleware/validationMiddleware");

const router = express.Router();

/*
|--------------------------------------------------------------------------
| All payment routes require authentication
|--------------------------------------------------------------------------
*/

router.use(protect);

/*
|--------------------------------------------------------------------------
| Start / reuse payment
|--------------------------------------------------------------------------
|
| POST /api/payments/:orderNumber/start
|--------------------------------------------------------------------------
*/

router.post(
  "/:orderNumber/start",
  startPaymentValidator,
  validate,
  createPayment
);

/*
|--------------------------------------------------------------------------
| Get payment status
|--------------------------------------------------------------------------
|
| GET /api/payments/:orderNumber/status
|--------------------------------------------------------------------------
*/

router.get(
  "/:orderNumber/status",
  paymentStatusValidator,
  validate,
  getStatus
);

/*
|--------------------------------------------------------------------------
| Development mock provider
|--------------------------------------------------------------------------
|
| POST /api/payments/mock/:paymentId/simulate
|--------------------------------------------------------------------------
*/

router.post(
  "/mock/:paymentId/simulate",
  simulatePaymentValidator,
  validate,
  simulatePayment
);

module.exports = router;