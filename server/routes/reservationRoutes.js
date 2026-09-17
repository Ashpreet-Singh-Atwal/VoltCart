const express = require("express");

const {
  createReservation,
  getReservations,
  getReservation,
  increaseReservation,
  decreaseReservation,
  removeReservation,
} = require("../controllers/reservationController");

const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

/*
|--------------------------------------------------------------------------
| All reservation routes require authentication.
|--------------------------------------------------------------------------
*/

router.use(protect);

router.post("/", createReservation);

router.get("/", getReservations);

router.get(
  "/:reservationId",
  getReservation
);

router.post(
  "/:reservationId/increase",
  increaseReservation
);

router.post(
  "/:reservationId/decrease",
  decreaseReservation
);

router.delete(
  "/:reservationId",
  removeReservation
);

module.exports = router;