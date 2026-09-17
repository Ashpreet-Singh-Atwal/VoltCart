/*
|--------------------------------------------------------------------------
| API Response Utilities
|--------------------------------------------------------------------------
| Centralized response helpers.
|--------------------------------------------------------------------------
*/

const successResponse = (
  res,
  {
    statusCode = 200,
    message = "Success",
    data = null,
    meta = null,
  } = {}
) => {
  const response = {
    success: true,
    message,
  };

  if (data !== null) {
    response.data = data;
  }

  if (meta !== null) {
    response.meta = meta;
  }

  return res.status(statusCode).json(response);
};

const errorResponse = (
  res,
  {
    statusCode = 500,
    message = "Internal server error",
    errors = null,
  } = {}
) => {
  const response = {
    success: false,
    message,
  };

  if (errors !== null) {
    response.errors = errors;
  }

  return res.status(statusCode).json(response);
};

module.exports = {
  successResponse,
  errorResponse,
};