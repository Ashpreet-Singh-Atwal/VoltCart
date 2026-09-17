const reservationService = require("../services/reservationService");

/*
|--------------------------------------------------------------------------
| POST /api/reservations
|--------------------------------------------------------------------------
| Create a new 10-minute reservation.
*/

async function createReservation(req, res, next) {
  try {
    const { productId, quantity } = req.body;

    const result =
      await reservationService.createReservation({
        userId: req.user._id,
        productId,
        quantity,
      });

    res.status(201).json({
      success: true,
      message: "Items reserved successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/*
|--------------------------------------------------------------------------
| GET /api/reservations
|--------------------------------------------------------------------------
*/

async function getReservations(req, res, next) {
  try {
    const reservations =
      await reservationService.getUserReservations(
        req.user._id
      );

    res.status(200).json({
      success: true,
      data: reservations,
    });
  } catch (error) {
    next(error);
  }
}

/*
|--------------------------------------------------------------------------
| GET /api/reservations/:reservationId
|--------------------------------------------------------------------------
*/

async function getReservation(req, res, next) {
  try {
    const reservation =
      await reservationService.getReservation({
        userId: req.user._id,
        reservationId: req.params.reservationId,
      });

    res.status(200).json({
      success: true,
      data: reservation,
    });
  } catch (error) {
    next(error);
  }
}

/*
|--------------------------------------------------------------------------
| POST /api/reservations/:reservationId/increase
|--------------------------------------------------------------------------
*/

async function increaseReservation(req, res, next) {
  try {
    const reservation =
      await reservationService.increaseReservation({
        userId: req.user._id,
        reservationId: req.params.reservationId,
      });

    res.status(200).json({
      success: true,
      message: "Quantity increased",
      data: reservation,
    });
  } catch (error) {
    next(error);
  }
}

/*
|--------------------------------------------------------------------------
| POST /api/reservations/:reservationId/decrease
|--------------------------------------------------------------------------
*/

async function decreaseReservation(req, res, next) {
  try {
    const reservation =
      await reservationService.decreaseReservation({
        userId: req.user._id,
        reservationId: req.params.reservationId,
      });

    res.status(200).json({
      success: true,
      message: "Quantity decreased",
      data: reservation,
    });
  } catch (error) {
    next(error);
  }
}

/*
|--------------------------------------------------------------------------
| DELETE /api/reservations/:reservationId
|--------------------------------------------------------------------------
*/

async function removeReservation(req, res, next) {
  try {
    const result =
      await reservationService.removeReservation({
        userId: req.user._id,
        reservationId: req.params.reservationId,
      });

    res.status(200).json({
      success: true,
      message: result.expired
        ? "Reservation had already expired"
        : "Reservation cancelled and inventory released",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createReservation,
  getReservations,
  getReservation,
  increaseReservation,
  decreaseReservation,
  removeReservation,
};