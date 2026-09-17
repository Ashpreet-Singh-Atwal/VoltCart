const orderService = require("../services/orderService");

/*
|--------------------------------------------------------------------------
| Create Order
|--------------------------------------------------------------------------
|
| POST /api/orders
|
*/

async function createOrder(req, res, next) {
  try {
    const {
      addressId,
      paymentMethod,
      idempotencyKey,
    } = req.body;

    const result =
      await orderService.createOrder({
        userId: req.user._id,
        addressId,
        paymentMethod,
        idempotencyKey,
      });

    res.status(result.reused ? 200 : 201).json({
      success: true,
      message: result.reused
        ? "Existing order returned"
        : "Order created successfully",
      data: result.order,
      reused: result.reused,
    });
  } catch (error) {
    next(error);
  }
}

/*
|--------------------------------------------------------------------------
| Checkout Summary
|--------------------------------------------------------------------------
|
| GET /api/orders/checkout-summary
|
*/

async function getCheckoutSummary(req, res, next) {
  try {
    const summary =
      await orderService.getCheckoutSummary(
        req.user._id
      );

    res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    next(error);
  }
}

/*
|--------------------------------------------------------------------------
| Get My Orders
|--------------------------------------------------------------------------
|
| GET /api/orders
|
*/

async function getMyOrders(req, res, next) {
  try {
    const {
      page = 1,
      limit = 10,
    } = req.query;

    const result =
      await orderService.getUserOrders(
        req.user._id,
        {
          page,
          limit,
        }
      );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/*
|--------------------------------------------------------------------------
| Get Single Order
|--------------------------------------------------------------------------
|
| GET /api/orders/:orderNumber
|
*/

async function getMyOrder(req, res, next) {
  try {
    const { orderNumber } = req.params;

    const order =
      await orderService.getUserOrder(
        req.user._id,
        orderNumber
      );

    res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createOrder,
  getCheckoutSummary,
  getMyOrders,
  getMyOrder,
};