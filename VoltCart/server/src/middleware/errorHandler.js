import { ZodError } from 'zod';
import { ApiError } from '../utils/http.js';
import { isProd } from '../config/env.js';

export function notFound(req, res, next) {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} does not exist`));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: { message: 'Invalid request data', code: 'VALIDATION_ERROR', details: err.flatten().fieldErrors },
    });
  }

  if (err instanceof ApiError) {
    return res.status(err.status).json({
      error: { message: err.message, code: err.code, details: err.details },
    });
  }

  if (err?.code === 11000) {
    return res.status(409).json({ error: { message: 'This record already exists', code: 'DUPLICATE' } });
  }

  console.error('[error]', err);
  return res.status(500).json({
    error: { message: isProd ? 'Something went wrong' : err.message, code: 'INTERNAL_ERROR' },
  });
}
