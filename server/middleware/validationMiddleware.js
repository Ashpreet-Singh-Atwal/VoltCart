const { validationResult } = require(
  "express-validator"
);

const validate = (
  req,
  res,
  next
) => {
  const errors =
    validationResult(req);

  if (!errors.isEmpty()) {
    const formattedErrors = {};

    errors.array().forEach(
      (error) => {
        const field =
          error.path || "general";

        if (!formattedErrors[field]) {
          formattedErrors[field] =
            error.msg;
        }
      }
    );

    return res.status(400).json({
      success: false,
      message: "Please check the highlighted fields",
      errors: formattedErrors
    });
  }

  next();
};

module.exports = validate;