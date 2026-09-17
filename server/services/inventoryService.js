const Product = require("../models/Product");

/*
 * Reserve inventory atomically.
 *
 * availableStock is decreased while
 * reservedStock is increased in the
 * same MongoDB update.
 *
 * This prevents two requests from both
 * successfully reserving the same unit
 * when only one is available.
 */
const reserveInventory = async ({
  productId,
  quantity,
  session = null
}) => {
  if (!Number.isInteger(quantity)) {
    const error = new Error(
      "Quantity must be a whole number"
    );

    error.statusCode = 400;

    throw error;
  }

  if (quantity <= 0) {
    const error = new Error(
      "Quantity must be greater than zero"
    );

    error.statusCode = 400;

    throw error;
  }

  const options = {
    new: true
  };

  if (session) {
    options.session = session;
  }

  const product =
    await Product.findOneAndUpdate(
      {
        _id: productId,
        isActive: true,
        availableStock: {
          $gte: quantity
        }
      },
      {
        $inc: {
          availableStock: -quantity,
          reservedStock: quantity
        }
      },
      options
    );

  if (!product) {
    const error = new Error(
      "No more units are available"
    );

    error.statusCode = 409;

    throw error;
  }

  return product;
};

/*
 * Release reserved inventory.
 *
 * One reserved unit moves back into
 * available inventory.
 */
const releaseInventory = async ({
  productId,
  quantity,
  session = null
}) => {
  if (!Number.isInteger(quantity)) {
    const error = new Error(
      "Quantity must be a whole number"
    );

    error.statusCode = 400;

    throw error;
  }

  if (quantity <= 0) {
    const error = new Error(
      "Quantity must be greater than zero"
    );

    error.statusCode = 400;

    throw error;
  }

  const options = {
    new: true
  };

  if (session) {
    options.session = session;
  }

  const product =
    await Product.findOneAndUpdate(
      {
        _id: productId,
        isActive: true,
        reservedStock: {
          $gte: quantity
        }
      },
      {
        $inc: {
          reservedStock: -quantity,
          availableStock: quantity
        }
      },
      options
    );

  if (!product) {
    const error = new Error(
      "Unable to release the requested inventory"
    );

    error.statusCode = 409;

    throw error;
  }

  return product;
};

/*
 * Convert reserved inventory into sold
 * inventory after successful payment/order
 * confirmation.
 */
const convertReservedInventory =
  async ({
    productId,
    quantity,
    session = null
  }) => {
    if (!Number.isInteger(quantity)) {
      const error = new Error(
        "Quantity must be a whole number"
      );

      error.statusCode = 400;

      throw error;
    }

    if (quantity <= 0) {
      const error = new Error(
        "Quantity must be greater than zero"
      );

      error.statusCode = 400;

      throw error;
    }

    const options = {
      new: true
    };

    if (session) {
      options.session = session;
    }

    const product =
      await Product.findOneAndUpdate(
        {
          _id: productId,
          isActive: true,
          reservedStock: {
            $gte: quantity
          }
        },
        {
          $inc: {
            reservedStock: -quantity,
            soldStock: quantity
          }
        },
        options
      );

    if (!product) {
      const error = new Error(
        "Unable to convert reserved inventory"
      );

      error.statusCode = 409;

      throw error;
    }

    return product;
  };

module.exports = {
  reserveInventory,
  releaseInventory,
  convertReservedInventory
};