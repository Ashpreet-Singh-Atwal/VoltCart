/*
|--------------------------------------------------------------------------
| User Model
|--------------------------------------------------------------------------
*/

const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    /*
    |--------------------------------------------------------------------------
    | Basic Information
    |--------------------------------------------------------------------------
    */

    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [100, "Name cannot exceed 100 characters"],
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters"],
      select: false,
    },

    phone: {
      type: String,
      trim: true,
      default: "",
    },

    /*
    |--------------------------------------------------------------------------
    | Account
    |--------------------------------------------------------------------------
    */

    role: {
      type: String,
      enum: ["customer", "admin"],
      default: "customer",
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    lastActivityAt: {
      type: Date,
      default: null,
    },

    /*
    |--------------------------------------------------------------------------
    | Password Reset
    |--------------------------------------------------------------------------
    */

    passwordResetToken: {
      type: String,
      default: null,
      select: false,
    },

    passwordResetExpires: {
      type: Date,
      default: null,
      select: false,
    },
  },
  {
    timestamps: true,
  }
);

/*
|--------------------------------------------------------------------------
| Normalize Email Before Validation
|--------------------------------------------------------------------------
*/

userSchema.pre("validate", function () {
  if (this.email) {
    this.email = this.email
      .trim()
      .toLowerCase();
  }
});

/*
|--------------------------------------------------------------------------
| Update Activity
|--------------------------------------------------------------------------
*/

userSchema.methods.updateActivity = function () {
  this.lastActivityAt = new Date();

  return this.save();
};


/*
|--------------------------------------------------------------------------
| Model
|--------------------------------------------------------------------------
*/

const User = mongoose.model(
  "User",
  userSchema
);

module.exports = User;