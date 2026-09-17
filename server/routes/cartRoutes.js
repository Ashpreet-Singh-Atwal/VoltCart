const express = require("express");

const {
  getCart,
  revalidateCart,
} = require("../controllers/cartController");

const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);

router.get("/", getCart);

router.post(
  "/revalidate",
  revalidateCart
);

module.exports = router;