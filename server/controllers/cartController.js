const cartService = require("../services/cartService");

/*
|--------------------------------------------------------------------------
| GET /api/cart
|--------------------------------------------------------------------------
*/

async function getCart(req, res, next) {
  try {
    const cart = await cartService.getCart(
      req.user._id
    );

    res.status(200).json({
      success: true,
      data: cart,
    });
  } catch (error) {
    next(error);
  }
}

/*
|--------------------------------------------------------------------------
| POST /api/cart/revalidate
|--------------------------------------------------------------------------
|
| Checkout will call this before payment.
|
*/

async function revalidateCart(req, res, next) {
  try {
    const cart =
      await cartService.revalidateCart(
        req.user._id
      );

    res.status(200).json({
      success: true,
      message: "Cart reservations are valid",
      data: cart,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getCart,
  revalidateCart,
};