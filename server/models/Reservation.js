const mongoose = require("mongoose");

const {
  RESERVATION_STATUSES,
} = require("../utils/constants");

/*
|--------------------------------------------------------------------------
| Reservation Item Schema
|--------------------------------------------------------------------------
*/

const reservationItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
    },

    /*
    |--------------------------------------------------------------------------
    | Price captured when reservation was created
    |--------------------------------------------------------------------------
    */

    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    _id: false,
  }
);

/*
|--------------------------------------------------------------------------
| Reservation Schema
|--------------------------------------------------------------------------
*/

const reservationSchema = new mongoose.Schema(
  {
    /*
    |--------------------------------------------------------------------------
    | Customer
    |--------------------------------------------------------------------------
    */

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    /*
    |--------------------------------------------------------------------------
    | Reserved Products
    |--------------------------------------------------------------------------
    */

    items: {
      type: [reservationItemSchema],

      required: true,

      validate: {
        validator: function (items) {
          return (
            Array.isArray(items) &&
            items.length > 0
          );
        },

        message:
          "Reservation must contain at least one item",
      },
    },

    /*
    |--------------------------------------------------------------------------
    | Reservation Status
    |--------------------------------------------------------------------------
    */

    status: {
      type: String,

      enum: Object.values(
        RESERVATION_STATUSES
      ),

      default:
        RESERVATION_STATUSES.ACTIVE,

      index: true,
    },

    /*
    |--------------------------------------------------------------------------
    | Original Reservation Expiry
    |--------------------------------------------------------------------------
    |
    | This is the normal ten-minute reservation expiry.
    |
    */

    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },

    /*
    |--------------------------------------------------------------------------
    | Payment Pending
    |--------------------------------------------------------------------------
    |
    | Once payment starts, the reservation moves into
    | PAYMENT_PENDING.
    |
    */

    paymentPendingAt: {
      type: Date,
      default: null,
    },

    paymentPendingExpiresAt: {
      type: Date,
      default: null,
      index: true,
    },

    /*
    |--------------------------------------------------------------------------
    | Conversion
    |--------------------------------------------------------------------------
    |
    | Set when payment succeeds and the reserved inventory becomes sold.
    |
    */

    convertedAt: {
      type: Date,
      default: null,
    },

    /*
    |--------------------------------------------------------------------------
    | Cancellation
    |--------------------------------------------------------------------------
    */

    cancelledAt: {
      type: Date,
      default: null,
    },

    /*
    |--------------------------------------------------------------------------
    | Order
    |--------------------------------------------------------------------------
    */

    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
    },

    /*
    |--------------------------------------------------------------------------
    | Creation Timestamp
    |--------------------------------------------------------------------------
    */

    createdAt: {
      type: Date,
      default: Date.now,
    },
  },

  {
    timestamps: true,
  }
);

/*
|--------------------------------------------------------------------------
| Indexes
|--------------------------------------------------------------------------
*/

reservationSchema.index({
  userId: 1,
  status: 1,
  expiresAt: 1,
});

reservationSchema.index({
  status: 1,
  expiresAt: 1,
});

reservationSchema.index({
  status: 1,
  paymentPendingExpiresAt: 1,
});

reservationSchema.index({
  orderId: 1,
});

/*
|--------------------------------------------------------------------------
| Export
|--------------------------------------------------------------------------
*/

module.exports = mongoose.model(
  "Reservation",
  reservationSchema
);