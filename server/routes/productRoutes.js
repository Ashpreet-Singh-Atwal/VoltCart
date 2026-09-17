const express = require("express");

const productController =
  require(
    "../controllers/productController"
  );

const router =
  express.Router();

/*
 * Homepage products
 *
 * GET /api/products/home
 */
router.get(
  "/home",
  productController.getHomepageProducts
);

/*
 * Flash sale products
 *
 * GET /api/products/sale
 *
 * No category filters.
 * No sorting.
 */
router.get(
  "/sale",
  productController.getSaleProducts
);

/*
 * Upcoming products
 *
 * GET /api/products/upcoming
 */
router.get(
  "/upcoming",
  productController.getUpcomingProducts
);

/*
 * Product details
 *
 * GET /api/products/slug/:slug
 */
router.get(
  "/slug/:slug",
  productController.getProductBySlug
);

/*
 * Product by MongoDB ID
 *
 * GET /api/products/id/:productId
 */
router.get(
  "/id/:productId",
  productController.getProductById
);

module.exports = router;