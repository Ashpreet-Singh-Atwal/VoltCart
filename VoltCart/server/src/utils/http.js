export class ApiError extends Error {
  constructor(status, message, code = undefined, details = undefined) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(msg, code, details) { return new ApiError(400, msg, code, details); }
  static unauthorized(msg = 'Please login to continue') { return new ApiError(401, msg, 'UNAUTHORIZED'); }
  static forbidden(msg = 'Not allowed') { return new ApiError(403, msg, 'FORBIDDEN'); }
  static notFound(msg = 'Not found') { return new ApiError(404, msg, 'NOT_FOUND'); }
  static conflict(msg, code, details) { return new ApiError(409, msg, code, details); }
}

export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
