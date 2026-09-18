import jwt from 'jsonwebtoken';
import { env, isProd } from '../config/env.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/http.js';

export const COOKIE_NAME = 'voltcart_token';

export function issueToken(res, user) {
  const token = jwt.sign({ sub: user._id.toString() }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
  return token;
}

export function clearToken(res) {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, secure: isProd, sameSite: isProd ? 'none' : 'lax', path: '/' });
}

function readToken(req) {
  if (req.cookies?.[COOKIE_NAME]) return req.cookies[COOKIE_NAME];
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  return null;
}

/** Attaches req.user when a valid token is present; never throws. */
export async function attachUser(req, res, next) {
  try {
    const token = readToken(req);
    if (!token) return next();
    const payload = jwt.verify(token, env.jwtSecret);
    const user = await User.findById(payload.sub);
    if (user) req.user = user;
    return next();
  } catch {
    return next();
  }
}

/** Blocks the request when nobody is logged in. */
export function requireAuth(req, res, next) {
  if (!req.user) return next(ApiError.unauthorized());
  return next();
}
