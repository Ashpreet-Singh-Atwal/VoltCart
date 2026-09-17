const errorMiddleware = (
  error,
  req,
  res,
  next
) => {
  console.error(error);

  /*
  |--------------------------------------------------------------------------
  | Mongoose Validation Error
  |--------------------------------------------------------------------------
  */

  if (
    error.name === "ValidationError"
  ) {
    const errors = {};

    Object.keys(error.errors).forEach(
      (field) => {
        errors[field] =
          error.errors[field].message;
      }
    );

    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Mongoose Cast Error
  |--------------------------------------------------------------------------
  */

  if (
    error.name === "CastError"
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid resource identifier"
    });
  }

  /*
  |--------------------------------------------------------------------------
  | MongoDB Duplicate Key Error
  |--------------------------------------------------------------------------
  */

  if (error.code === 11000) {
    const duplicateFields =
      Object.keys(error.keyPattern || {});

    return res.status(409).json({
      success: false,
      message:
        duplicateFields.length > 0
          ? `A record with this ${duplicateFields.join(
              ", "
            )} already exists`
          : "A duplicate record already exists"
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Custom application error
  |--------------------------------------------------------------------------
  */

  const statusCode =
    error.statusCode || 500;

  const message =
    statusCode === 500
      ? "Internal server error"
      : error.message;

  return res.status(statusCode).json({
    success: false,
    message
  });
};

const notFoundMiddleware = (
  req,
  res
) => {
  return res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
};

module.exports = {
  errorMiddleware,
  notFoundMiddleware
};