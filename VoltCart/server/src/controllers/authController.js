import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { User } from '../models/User.js';
import { Cart } from '../models/Cart.js';
import { asyncHandler, ApiError } from '../utils/http.js';
import { clearToken, issueToken } from '../middleware/auth.js';

const registerSchema = z.object({
  fullName: z.string().min(2, 'Enter your full name').max(80),
  email: z.string().email('Enter a valid email'),
  phone: z.string().regex(/^[0-9]{10}$/, 'Phone must be 10 digits'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
  acceptTnc: z.literal(true, { errorMap: () => ({ message: 'You must accept the terms' }) }),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Passwords do not match', path: ['confirmPassword'],
});

const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Enter your password'),
});

const guestCartSchema = z.array(z.object({
  productId: z.string(),
  quantity: z.number().int().min(1).max(10),
})).optional();

/** Merges a guest (localStorage) cart into the user's server cart on auth. */
async function mergeGuestCart(userId, guestItems) {
  if (!guestItems?.length) return;
  const cart = (await Cart.findOne({ user: userId })) ?? new Cart({ user: userId, items: [] });

  for (const incoming of guestItems) {
    const existing = cart.items.find((i) => i.product.toString() === incoming.productId);
    if (existing) existing.quantity = Math.min(10, Math.max(existing.quantity, incoming.quantity));
    else cart.items.push({ product: incoming.productId, quantity: incoming.quantity });
  }
  await cart.save();
}

export const register = asyncHandler(async (req, res) => {
  const data = registerSchema.parse(req.body);
  const guestItems = guestCartSchema.parse(req.body.guestCart);

  const exists = await User.findOne({ email: data.email.toLowerCase() });
  if (exists) throw ApiError.conflict('An account with this email already exists', 'EMAIL_TAKEN');

  const passwordHash = await bcrypt.hash(data.password, 12);
  const user = await User.create({
    fullName: data.fullName,
    email: data.email.toLowerCase(),
    phone: data.phone,
    passwordHash,
  });

  await mergeGuestCart(user._id, guestItems);
  issueToken(res, user);
  res.status(201).json({ user: user.toPublicJSON() });
});

export const login = asyncHandler(async (req, res) => {
  const data = loginSchema.parse(req.body);
  const guestItems = guestCartSchema.parse(req.body.guestCart);

  const user = await User.findOne({ email: data.email.toLowerCase() });
  // Same generic message for unknown email and wrong password (no user enumeration).
  if (!user) throw ApiError.badRequest('Invalid email or password', 'INVALID_CREDENTIALS');

  const ok = await bcrypt.compare(data.password, user.passwordHash);
  if (!ok) throw ApiError.badRequest('Invalid email or password', 'INVALID_CREDENTIALS');

  await mergeGuestCart(user._id, guestItems);
  issueToken(res, user);
  res.json({ user: user.toPublicJSON() });
});

export const logout = asyncHandler(async (req, res) => {
  clearToken(res);
  res.json({ ok: true });
});

export const me = asyncHandler(async (req, res) => {
  res.json({ user: req.user ? req.user.toPublicJSON() : null });
});

const profileSchema = z.object({
  fullName: z.string().min(2).max(80),
  phone: z.string().regex(/^[0-9]{10}$/, 'Phone must be 10 digits'),
});

export const updateProfile = asyncHandler(async (req, res) => {
  const data = profileSchema.parse(req.body);
  req.user.fullName = data.fullName;
  req.user.phone = data.phone;
  await req.user.save();
  res.json({ user: req.user.toPublicJSON() });
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

export const changePassword = asyncHandler(async (req, res) => {
  const data = passwordSchema.parse(req.body);
  const ok = await bcrypt.compare(data.currentPassword, req.user.passwordHash);
  if (!ok) throw ApiError.badRequest('Current password is incorrect', 'INVALID_PASSWORD');
  req.user.passwordHash = await bcrypt.hash(data.newPassword, 12);
  await req.user.save();
  res.json({ ok: true });
});
