const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true
    },

    name: {
      type: String,
      required: true,
      trim: true
    },

    slug: {
      type: String,
      required: true,
      trim: true
    },

    image: {
      type: String,
      default: ""
    },

    quantity: {
      type: Number,
      required: true,
      min: 1
    },

    unitPrice: {
      type: Number,
      required: true,
      min: 0
    },

    totalPrice: {
      type: Number,
      required: true,
      min: 0
    }
  },
  {
    _id: false
  }
);

/*
|--------------------------------------------------------------------------
| Shipping address snapshot
|--------------------------------------------------------------------------
|
| This is intentionally embedded in the order.
|
*/

const shippingAddressSchema =
  new mongoose.Schema(
    {
      label: {
        type: String,
        default: "Home"
      },

      fullName: {
        type: String,
        required: true
      },

      phone: {
        type: String,
        required: true
      },

      addressLine1: {
        type: String,
        required: true
      },

      addressLine2: {
        type: String,
        default: ""
      },

      landmark: {
        type: String,
        default: ""
      },

      city: {
        type: String,
        required: true
      },

      state: {
        type: String,
        required: true
      },

      postalCode: {
        type: String,
        required: true
      },

      country: {
        type: String,
        default: "India"
      }
    },
    {
      _id: false
    }
  );

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      index: true
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    items: {
      type: [orderItemSchema],
      required: true,
      validate: {
        validator: (items) => items.length > 0,
        message: "Order must contain at least one item"
      }
    },

    shippingAddress: {
      type: shippingAddressSchema,
      required: true
    },

    /*
    |--------------------------------------------------------------------------
    | Pricing
    |--------------------------------------------------------------------------
    */

    subtotal: {
      type: Number,
      required: true,
      min: 0
    },

    shippingFee: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },

    discount: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },

    tax: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },

    totalAmount: {
      type: Number,
      required: true,
      min: 0
    },

    /*
    |--------------------------------------------------------------------------
    | Payment
    |--------------------------------------------------------------------------
    */

    paymentMethod: {
      type: String,
      enum: ["upi", "card"],
      required: true
    },

    paymentStatus: {
      type: String,
      enum: [
        "pending",
        "processing",
        "paid",
        "failed",
        "refunded",
        "partially_refunded"
      ],
      default: "pending",
      index: true
    },

    paymentId: {
      type: String,
      default: null,
      index: true
    },

    paymentProvider: {
      type: String,
      default: null
    },

    paymentUpdatedAt: {
      type: Date,
      default: null
    },

    /*
    |--------------------------------------------------------------------------
    | Order status
    |--------------------------------------------------------------------------
    */

    status: {
      type: String,
      enum: [
        "pending_payment",
        "confirmed",
        "processing",
        "shipped",
        "out_for_delivery",
        "delivered",
        "cancelled",
        "refunded"
      ],
      default: "pending_payment",
      index: true
    },

    /*
    |--------------------------------------------------------------------------
    | Payment idempotency
    |--------------------------------------------------------------------------
    */

    idempotencyKey: {
      type: String,
      required: true,
      index: true
    },

    /*
    |--------------------------------------------------------------------------
    | Reservation reference
    |--------------------------------------------------------------------------
    */

    reservationIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Reservation"
      }
    ],

    /*
    |--------------------------------------------------------------------------
    | Cancellation
    |--------------------------------------------------------------------------
    */

    cancellationReason: {
      type: String,
      default: ""
    },

    cancelledAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

/*
|--------------------------------------------------------------------------
| Indexes
|--------------------------------------------------------------------------
*/

orderSchema.index({
  userId: 1,
  createdAt: -1
});

orderSchema.index({
  userId: 1,
  status: 1
});

orderSchema.index({
  paymentStatus: 1,
  createdAt: -1
});

/*
|--------------------------------------------------------------------------
| Prevent duplicate payment processing
|--------------------------------------------------------------------------
*/

orderSchema.index(
  {
    userId: 1,
    idempotencyKey: 1
  },
  {
    unique: true
  }
);

const Order = mongoose.model(
  "Order",
  orderSchema
);

module.exports = Order;