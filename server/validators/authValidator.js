const {
  body
} = require("express-validator");

const registerValidator = [
  body("name")
    .exists({
      checkFalsy: true
    })
    .withMessage("Full name is required")
    .bail()
    .isString()
    .withMessage("Full name must be text")
    .bail()
    .trim()
    .isLength({
      min: 2,
      max: 100
    })
    .withMessage(
      "Full name must be between 2 and 100 characters"
    ),

  body("email")
    .exists({
      checkFalsy: true
    })
    .withMessage("Email address is required")
    .bail()
    .isEmail()
    .withMessage(
      "Please enter a valid email address"
    )
    .bail()
    .normalizeEmail(),

  body("password")
    .exists({
      checkFalsy: true
    })
    .withMessage("Password is required")
    .bail()
    .isString()
    .withMessage("Password must be text")
    .bail()
    .isLength({
      min: 8
    })
    .withMessage(
      "Password must contain at least 8 characters"
    ),

  body("confirmPassword")
    .exists({
      checkFalsy: true
    })
    .withMessage(
      "Please confirm your password"
    )
    .bail()
    .custom(
      (
        confirmPassword,
        { req }
      ) => {
        if (
          confirmPassword !==
          req.body.password
        ) {
          throw new Error(
            "Passwords do not match"
          );
        }

        return true;
      }
    ),

  body("termsAccepted")
    .custom((value) => {
      if (value !== true) {
        throw new Error(
          "You must agree to the Terms and Privacy Policy"
        );
      }

      return true;
    })
];

const loginValidator = [
  body("email")
    .exists({
      checkFalsy: true
    })
    .withMessage(
      "Email address is required"
    )
    .bail()
    .isEmail()
    .withMessage(
      "Please enter a valid email address"
    )
    .bail()
    .normalizeEmail(),

  body("password")
    .exists({
      checkFalsy: true
    })
    .withMessage("Password is required")
    .bail()
    .isString()
    .withMessage("Password must be text")
];

const forgotPasswordValidator = [
  body("email")
    .exists({
      checkFalsy: true
    })
    .withMessage(
      "Email address is required"
    )
    .bail()
    .isEmail()
    .withMessage(
      "Please enter a valid email address"
    )
    .bail()
    .normalizeEmail()
];

const resetPasswordValidator = [
  body("password")
    .exists({
      checkFalsy: true
    })
    .withMessage("Password is required")
    .bail()
    .isString()
    .withMessage("Password must be text")
    .bail()
    .isLength({
      min: 8
    })
    .withMessage(
      "Password must contain at least 8 characters"
    ),

  body("confirmPassword")
    .exists({
      checkFalsy: true
    })
    .withMessage(
      "Please confirm your password"
    )
    .bail()
    .custom(
      (
        confirmPassword,
        { req }
      ) => {
        if (
          confirmPassword !==
          req.body.password
        ) {
          throw new Error(
            "Passwords do not match"
          );
        }

        return true;
      }
    )
];

const updateProfileValidator = [
  body("name")
    .optional()
    .isString()
    .withMessage("Name must be text")
    .bail()
    .trim()
    .isLength({
      min: 2,
      max: 100
    })
    .withMessage(
      "Name must be between 2 and 100 characters"
    ),

  body("phone")
    .optional()
    .isString()
    .withMessage("Phone must be text")
    .bail()
    .trim()
    .isLength({
      max: 20
    })
    .withMessage(
      "Phone number is invalid"
    )
];

module.exports = {
  registerValidator,
  loginValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
  updateProfileValidator
};