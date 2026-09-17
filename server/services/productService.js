const Product = require("../models/Product");

const getSaleState = (product) => {
  const now = new Date();

  if (!product.onSale) {
    return "normal";
  }

  if (
    product.saleStartsAt &&
    now < product.saleStartsAt
  ) {
    return "upcoming";
  }

  if (
    product.saleEndsAt &&
    now >= product.saleEndsAt
  ) {
    return "ended";
  }

  return "live";
};

const getAvailabilityState = (product) => {
  const saleState = getSaleState(product);

  if (saleState === "upcoming") {
    return "upcoming";
  }

  if (saleState === "ended") {
    return "sale_ended";
  }

  if (
    saleState === "live" &&
    product.availableStock <= 0
  ) {
    return "sold_out";
  }

  if (
    saleState === "live" &&
    product.availableStock > 0 &&
    product.availableStock <= 5
  ) {
    return "low_stock";
  }

  return "available";
};

const serializeProduct = (product) => {
  const saleState =
    getSaleState(product);

  const availabilityState =
    getAvailabilityState(product);

  return {
    id: product._id,
    name: product.name,
    slug: product.slug,

    description:
      product.description,

    shortDescription:
      product.shortDescription,

    category:
      product.category,

    brand:
      product.brand,

    images:
      product.images,

    thumbnail:
      product.thumbnail,

    price:
      product.price,

    originalPrice:
      product.originalPrice,

    discountPercentage:
      product.discountPercentage,

    onSale:
      product.onSale,

    saleStartsAt:
      product.saleStartsAt,

    saleEndsAt:
      product.saleEndsAt,

    saleState,

    availabilityState,

    totalStock:
      product.totalStock,

    availableStock:
      product.availableStock,

    reservedStock:
      product.reservedStock,

    soldStock:
      product.soldStock,

    isActive:
      product.isActive,

    isFeatured:
      product.isFeatured,

    isUpcoming:
      product.isUpcoming,

    upcomingAt:
      product.upcomingAt,

    createdAt:
      product.createdAt,

    updatedAt:
      product.updatedAt
  };
};

/*
 * Get the fixed homepage product set.
 *
 * The frontend specification defines exactly
 * 12 products for the desktop 4 x 3 grid.
 *
 * We use explicit featured ordering rather
 * than category filters or sorting controls.
 */
const getHomepageProducts = async () => {
  const products =
    await Product.find({
      isActive: true,
      isFeatured: true
    });

  return products.map(
    serializeProduct
  );
};

/*
 * Get products for the flash-sale page.
 *
 * There are deliberately NO:
 * - search parameters
 * - category filters
 * - sorting parameters
 *
 * The UI displays the fixed mixed-product grid.
 */
const getSaleProducts = async () => {
  const products =
    await Product.find({
      isActive: true,
      onSale: true
    });

  return products.map(
    serializeProduct
  );
};

const getUpcomingProducts =
  async () => {
    const products =
      await Product.find({
        isActive: true,
        isUpcoming: true
      })
        .sort({
          upcomingAt: 1
        });

    return products.map(
      serializeProduct
    );
  };

const getProductBySlug =
  async (slug) => {
    const product =
      await Product.findOne({
        slug: slug.toLowerCase().trim(),
        isActive: true
      });

    if (!product) {
      const error = new Error(
        "Product not found"
      );

      error.statusCode = 404;

      throw error;
    }

    return serializeProduct(product);
  };

const getProductById =
  async (productId) => {
    const product =
      await Product.findOne({
        _id: productId,
        isActive: true
      });

    if (!product) {
      const error = new Error(
        "Product not found"
      );

      error.statusCode = 404;

      throw error;
    }

    return serializeProduct(product);
  };

const getSaleProductForReservation =
  async (productId) => {
    const product =
      await Product.findOne({
        _id: productId,
        isActive: true,
        onSale: true
      });

    if (!product) {
      const error = new Error(
        "Sale product not found"
      );

      error.statusCode = 404;

      throw error;
    }

    return product;
  };

module.exports = {
  getSaleState,
  getAvailabilityState,
  serializeProduct,
  getHomepageProducts,
  getSaleProducts,
  getUpcomingProducts,
  getProductBySlug,
  getProductById,
  getSaleProductForReservation
};