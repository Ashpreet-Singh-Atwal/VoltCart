/*
|--------------------------------------------------------------------------
| Async Handler Middleware
|--------------------------------------------------------------------------
| Automatically forwards rejected async controller errors
| to the global Express error middleware.
|--------------------------------------------------------------------------
*/

const asyncHandler = (handler) => {
  return (req, res, next) => {
    Promise
      .resolve(handler(req, res, next))
      .catch(next);
  };
};

module.exports = asyncHandler;