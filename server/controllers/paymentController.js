const {
  startPayment,
  getPaymentStatus,
  simulateMockPayment,
} = require("../services/paymentService");

/*
|--------------------------------------------------------------------------
| POST /api/payments/:orderNumber/start
|--------------------------------------------------------------------------
*/

const createPayment = async (req, res, next) => {
  try {
    const result = await startPayment({
      orderNumber: req.params.orderNumber,
      userId: req.user._id,
      paymentMethod:
        req.body.paymentMethod,
      idempotencyKey:
        req.body.idempotencyKey,
    });

    res.status(200).json({
      success: true,
      message: result.reused
        ? "Existing payment attempt reused"
        : "Payment initiated",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/*
|--------------------------------------------------------------------------
| GET /api/payments/:orderNumber/status
|--------------------------------------------------------------------------
*/

const getStatus = async (req, res, next) => {
  try {
    const payment = await getPaymentStatus({
      orderNumber: req.params.orderNumber,
      userId: req.user._id,
    });

    res.status(200).json({
      success: true,
      data: payment,
    });
  } catch (error) {
    next(error);
  }
};

/*
|--------------------------------------------------------------------------
| POST /api/payments/mock/:paymentId/simulate
|--------------------------------------------------------------------------
|
| Development-only provider simulation.
|
*/

const simulatePayment = async (
  req,
  res,
  next
) => {
  try {
    const payment =
      await simulateMockPayment({
        paymentId: req.params.paymentId,
        result: req.body.result,
      });

    res.status(200).json({
      success: true,
      message: "Mock payment result processed",
      data: payment,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createPayment,
  getStatus,
  simulatePayment,
};