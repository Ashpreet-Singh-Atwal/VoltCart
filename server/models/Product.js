const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
      minlength: [2, "Product name must be at least 2 characters"],
      maxlength: [150, "Product name cannot exceed 150 characters"],
    },

    slug: {
      type: String,
      required: [true, "Product slug is required"],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    description: {
      type: String,
      required: [true, "Product description is required"],
      trim: true,
      maxlength: [5000, "Product description cannot exceed 5000 characters"],
    },

    shortDescription: {
      type: String,
      trim: true,
      maxlength: [300, "Short description cannot exceed 300 characters"],
    },

    category: {
      type: String,
      required: [true, "Product category is required"],
      trim: true,
      index: true,
    },

    brand: {
      type: String,
      required: [true, "Product brand is required"],
      trim: true,
    },

    images: {
      type: [String],
      default: [],
      validate: {
        validator: function (images) {
          return Array.isArray(images);
        },
        message: "Images must be an array",
      },
    },

    thumbnail: {
      type: String,
      required: [true, "Product thumbnail is required"],
      trim: true,
    },

    price: {
      type: Number,
      required: [true, "Product price is required"],
      min: [0, "Product price cannot be negative"],
    },

    originalPrice: {
      type: Number,
      required: [true, "Original price is required"],
      min: [0, "Original price cannot be negative"],
      validate: {
        validator: function (value) {
          return value >= this.price;
        },
        message: "Original price must be greater than or equal to the sale price",
      },
    },

    onSale: {
      type: Boolean,
      default: false,
      index: true,
    },

    saleStartsAt: {
      type: Date,
      default: null,
    },

    saleEndsAt: {
      type: Date,
      default: null,
    },

    totalStock: {
      type: Number,
      required: [true, "Total stock is required"],
      min: [0, "Total stock cannot be negative"],
    },

    availableStock: {
      type: Number,
      required: [true, "Available stock is required"],
      min: [0, "Available stock cannot be negative"],
    },

    reservedStock: {
      type: Number,
      required: [true, "Reserved stock is required"],
      min: [0, "Reserved stock cannot be negative"],
      default: 0,
    },

    soldStock: {
      type: Number,
      required: [true, "Sold stock is required"],
      min: [0, "Sold stock cannot be negative"],
      default: 0,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    isFeatured: {
      type: Boolean,
      default: false,
      index: true,
    },

    isUpcoming: {
      type: Boolean,
      default: false,
      index: true,
    },

    upcomingAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
    },
    toObject: {
      virtuals: true,
    },
  }
);

/*
|--------------------------------------------------------------------------
| Inventory Validation
|--------------------------------------------------------------------------
|
| Inventory must always satisfy:
|
| totalStock =
| availableStock +
| reservedStock +
| soldStock
|
| Example:
|
| totalStock     = 100
| availableStock = 80
| reservedStock  = 10
| soldStock      = 10
|
| 80 + 10 + 10 = 100 ✓
|
| IMPORTANT:
| Do not use `next()` here.
| This is intentional for compatibility with the current
| Mongoose version being used by the project.
|
*/
productSchema.pre("validate", function () {
  const calculatedStock =
    this.availableStock + this.reservedStock + this.soldStock;

  if (calculatedStock !== this.totalStock) {
    throw new Error(
      "Inventory values are inconsistent: availableStock + reservedStock + soldStock must equal totalStock"
    );
  }
});

/*
|--------------------------------------------------------------------------
| Sale Date Validation
|--------------------------------------------------------------------------
*/

productSchema.pre("validate", function () {
  if (this.onSale) {
    if (!this.saleStartsAt) {
      throw new Error("Sale start date is required when product is on sale");
    }

    if (!this.saleEndsAt) {
      throw new Error("Sale end date is required when product is on sale");
    }

    if (this.saleEndsAt <= this.saleStartsAt) {
      throw new Error("Sale end date must be after sale start date");
    }
  }
});

/*
|--------------------------------------------------------------------------
| Upcoming Product Validation
|--------------------------------------------------------------------------
*/

productSchema.pre("validate", function () {
  if (this.isUpcoming && !this.upcomingAt) {
    throw new Error(
      "Upcoming date is required when product is marked as upcoming"
    );
  }
});

/*
|--------------------------------------------------------------------------
| Virtual: Discount Percentage
|--------------------------------------------------------------------------
*/

productSchema.virtual("discountPercentage").get(function () {
  if (
    !this.originalPrice ||
    this.originalPrice <= 0 ||
    this.price >= this.originalPrice
  ) {
    return 0;
  }

  return Math.round(
    ((this.originalPrice - this.price) / this.originalPrice) * 100
  );
});

/*
|--------------------------------------------------------------------------
| Indexes
|--------------------------------------------------------------------------
*/

productSchema.index({
  onSale: 1,
  isActive: 1,
});

productSchema.index({
  isFeatured: 1,
  isActive: 1,
});

productSchema.index({
  isUpcoming: 1,
  upcomingAt: 1,
});

/*
|--------------------------------------------------------------------------
| Export
|--------------------------------------------------------------------------
*/

module.exports = mongoose.model("Product", productSchema);