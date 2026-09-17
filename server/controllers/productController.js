const mongoose = require("mongoose");

const productService = require(
  "../services/productService"
);

const getHomepageProducts =
  async (req, res, next) => {
    try {
      const products =
        await productService
          .getHomepageProducts();

      return res.status(200).json({
        success: true,
        count: products.length,
        products
      });
    } catch (error) {
      next(error);
    }
  };

const getSaleProducts =
  async (req, res, next) => {
    try {
      const products =
        await productService
          .getSaleProducts();

      return res.status(200).json({
        success: true,
        count: products.length,
        products
      });
    } catch (error) {
      next(error);
    }
  };

const getUpcomingProducts =
  async (req, res, next) => {
    try {
      const products =
        await productService
          .getUpcomingProducts();

      return res.status(200).json({
        success: true,
        count: products.length,
        products
      });
    } catch (error) {
      next(error);
    }
  };

const getProductBySlug =
  async (req, res, next) => {
    try {
      const { slug } = req.params;

      const product =
        await productService
          .getProductBySlug(slug);

      return res.status(200).json({
        success: true,
        product
      });
    } catch (error) {
      next(error);
    }
  };

const getProductById =
  async (req, res, next) => {
    try {
      const { productId } =
        req.params;

      if (
        !mongoose.Types.ObjectId.isValid(
          productId
        )
      ) {
        const error = new Error(
          "Invalid product ID"
        );

        error.statusCode = 400;

        throw error;
      }

      const product =
        await productService
          .getProductById(productId);

      return res.status(200).json({
        success: true,
        product
      });
    } catch (error) {
      next(error);
    }
  };

module.exports = {
  getHomepageProducts,
  getSaleProducts,
  getUpcomingProducts,
  getProductBySlug,
  getProductById
};