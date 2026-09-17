const express = require("express");

const authController = require(
  "../controllers/authController"
);

const validate = require(
  "../middleware/validationMiddleware"
);

const {
  protect
} = require(
  "../middleware/authMiddleware"
);

const {
  registerValidator,
  loginValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
  updateProfileValidator
} = require(
  "../validators/authValidator"
);

const router =
  express.Router();

/*
 * POST /api/auth/register
 */
router.post(
  "/register",
  registerValidator,
  validate,
  authController.register
);

/*
 * POST /api/auth/login
 */
router.post(
  "/login",
  loginValidator,
  validate,
  authController.login
);

/*
 * POST /api/auth/logout
 */
router.post(
  "/logout",
  authController.logout
);

/*
 * GET /api/auth/me
 */
router.get(
  "/me",
  protect,
  authController.getMe
);

/*
 * POST /api/auth/forgot-password
 */
router.post(
  "/forgot-password",
  forgotPasswordValidator,
  validate,
  authController.forgotPassword
);

/*
 * POST /api/auth/reset-password/:token
 */
router.post(
  "/reset-password/:token",
  resetPasswordValidator,
  validate,
  authController.resetPassword
);

/*
 * PUT /api/auth/profile
 */
router.put(
  "/profile",
  protect,
  updateProfileValidator,
  validate,
  authController.updateProfile
);

module.exports = router;