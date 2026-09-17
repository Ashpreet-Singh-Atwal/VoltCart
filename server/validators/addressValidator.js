/*
|--------------------------------------------------------------------------
| Address Validators
|--------------------------------------------------------------------------
*/

const { body, param } = require("express-validator");

const mongoose = require("mongoose");

const {
  ADDRESS_LABELS,
} = require("../utils/constants");

/*
|--------------------------------------------------------------------------
| Common Address Fields
|--------------------------------------------------------------------------
*/

const addressFields = [
  body("label")
    .trim()
    .notEmpty()
    .withMessage("Address label is required")
    .isIn(Object.values(ADDRESS_LABELS))
    .withMessage(
      `Address label must be one of: ${Object.values(
        ADDRESS_LABELS
      ).join(", ")}`
    ),

  body("fullName")
    .trim()
    .notEmpty()
    .withMessage("Full name is required")
    .isLength({
      min: 2,
      max: 100,
    })
    .withMessage(
      "Full name must be between 2 and 100 characters"
    ),

  body("phone")
    .trim()
    .notEmpty()
    .withMessage("Phone number is required")
    .matches(/^[6-9]\d{9}$/)
    .withMessage(
      "Please enter a valid 10-digit Indian phone number"
    ),

  body("addressLine1")
    .trim()
    .notEmpty()
    .withMessage("Address line 1 is required")
    .isLength({
      min: 5,
      max: 200,
    })
    .withMessage(
      "Address line 1 must be between 5 and 200 characters"
    ),

  body("addressLine2")
    .optional({
      values: "falsy",
    })
    .trim()
    .isLength({
      max: 200,
    })
    .withMessage(
      "Address line 2 cannot exceed 200 characters"
    ),

  body("landmark")
    .optional({
      values: "falsy",
    })
    .trim()
    .isLength({
      max: 100,
    })
    .withMessage(
      "Landmark cannot exceed 100 characters"
    ),

  body("city")
    .trim()
    .notEmpty()
    .withMessage("City is required")
    .isLength({
      min: 2,
      max: 100,
    })
    .withMessage(
      "City must be between 2 and 100 characters"
    ),

  body("state")
    .trim()
    .notEmpty()
    .withMessage("State is required")
    .isLength({
      min: 2,
      max: 100,
    })
    .withMessage(
      "State must be between 2 and 100 characters"
    ),

  body("postalCode")
    .trim()
    .notEmpty()
    .withMessage("Postal code is required")
    .matches(/^\d{6}$/)
    .withMessage(
      "Please enter a valid 6-digit postal code"
    ),

  body("country")
    .trim()
    .notEmpty()
    .withMessage("Country is required")
    .isLength({
      min: 2,
      max: 100,
    })
    .withMessage(
      "Country must be between 2 and 100 characters"
    ),

  body("isDefault")
    .optional()
    .isBoolean()
    .withMessage(
      "isDefault must be true or false"
    ),
];

/*
|--------------------------------------------------------------------------
| Create Address Validator
|--------------------------------------------------------------------------
*/

const createAddressValidator = [
  ...addressFields,
];

/*
|--------------------------------------------------------------------------
| Update Address Validator
|--------------------------------------------------------------------------
*/

const updateAddressValidator = [
  body("label")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Address label cannot be empty")
    .isIn(Object.values(ADDRESS_LABELS))
    .withMessage(
      `Address label must be one of: ${Object.values(
        ADDRESS_LABELS
      ).join(", ")}`
    ),

  body("fullName")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Full name cannot be empty")
    .isLength({
      min: 2,
      max: 100,
    })
    .withMessage(
      "Full name must be between 2 and 100 characters"
    ),

  body("phone")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Phone number cannot be empty")
    .matches(/^[6-9]\d{9}$/)
    .withMessage(
      "Please enter a valid 10-digit Indian phone number"
    ),

  body("addressLine1")
    .optional()
    .trim()
    .notEmpty()
    .withMessage(
      "Address line 1 cannot be empty"
    )
    .isLength({
      min: 5,
      max: 200,
    })
    .withMessage(
      "Address line 1 must be between 5 and 200 characters"
    ),

  body("addressLine2")
    .optional()
    .trim()
    .isLength({
      max: 200,
    })
    .withMessage(
      "Address line 2 cannot exceed 200 characters"
    ),

  body("landmark")
    .optional()
    .trim()
    .isLength({
      max: 100,
    })
    .withMessage(
      "Landmark cannot exceed 100 characters"
    ),

  body("city")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("City cannot be empty")
    .isLength({
      min: 2,
      max: 100,
    })
    .withMessage(
      "City must be between 2 and 100 characters"
    ),

  body("state")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("State cannot be empty")
    .isLength({
      min: 2,
      max: 100,
    })
    .withMessage(
      "State must be between 2 and 100 characters"
    ),

  body("postalCode")
    .optional()
    .trim()
    .notEmpty()
    .withMessage(
      "Postal code cannot be empty"
    )
    .matches(/^\d{6}$/)
    .withMessage(
      "Please enter a valid 6-digit postal code"
    ),

  body("country")
    .optional()
    .trim()
    .notEmpty()
    .withMessage(
      "Country cannot be empty"
    )
    .isLength({
      min: 2,
      max: 100,
    })
    .withMessage(
      "Country must be between 2 and 100 characters"
    ),

  body("isDefault")
    .optional()
    .isBoolean()
    .withMessage(
      "isDefault must be true or false"
    ),
];

/*
|--------------------------------------------------------------------------
| Address ID Validator
|--------------------------------------------------------------------------
*/

const addressIdValidator = [
  param("addressId")
    .custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error("Invalid address ID");
      }

      return true;
    }),
];

module.exports = {
  createAddressValidator,
  updateAddressValidator,
  addressIdValidator,
};