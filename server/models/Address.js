const mongoose = require("mongoose");

const addressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      index: true
    },

    label: {
      type: String,
      enum: ["Home", "Work", "Other"],
      default: "Home"
    },

    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
      maxlength: 100
    },

    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true
    },

    addressLine1: {
      type: String,
      required: [true, "Address line 1 is required"],
      trim: true,
      maxlength: 200
    },

    addressLine2: {
      type: String,
      trim: true,
      default: ""
    },

    landmark: {
      type: String,
      trim: true,
      default: ""
    },

    city: {
      type: String,
      required: [true, "City is required"],
      trim: true
    },

    state: {
      type: String,
      required: [true, "State is required"],
      trim: true
    },

    postalCode: {
      type: String,
      required: [true, "Postal code is required"],
      trim: true
    },

    country: {
      type: String,
      default: "India",
      trim: true
    },

    isDefault: {
      type: Boolean,
      default: false,
      index: true
    }
  },
  {
    timestamps: true
  }
);

/*
|--------------------------------------------------------------------------
| Useful index
|--------------------------------------------------------------------------
*/

addressSchema.index({
  userId: 1,
  isDefault: 1
});

const Address = mongoose.model(
  "Address",
  addressSchema
);

module.exports = Address;