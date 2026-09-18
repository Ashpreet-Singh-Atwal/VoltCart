import { z } from 'zod';
import { asyncHandler, ApiError } from '../utils/http.js';

const addressSchema = z.object({
  label: z.string().max(20).default('Home'),
  fullName: z.string().min(2).max(80),
  phone: z.string().regex(/^[0-9]{10}$/, 'Phone must be 10 digits'),
  line1: z.string().min(4).max(120),
  line2: z.string().max(120).optional().default(''),
  city: z.string().min(2).max(60),
  state: z.string().min(2).max(60),
  pincode: z.string().regex(/^[0-9]{6}$/, 'Pincode must be 6 digits'),
  isDefault: z.boolean().optional().default(false),
});

export const listAddresses = asyncHandler(async (req, res) => {
  res.json({ addresses: req.user.addresses });
});

export const addAddress = asyncHandler(async (req, res) => {
  const data = addressSchema.parse(req.body);
  const makeDefault = data.isDefault || req.user.addresses.length === 0;
  if (makeDefault) req.user.addresses.forEach((a) => { a.isDefault = false; });

  req.user.addresses.push({ ...data, isDefault: makeDefault });
  await req.user.save();
  res.status(201).json({ addresses: req.user.addresses });
});

export const updateAddress = asyncHandler(async (req, res) => {
  const data = addressSchema.parse(req.body);
  const address = req.user.addresses.id(req.params.addressId);
  if (!address) throw ApiError.notFound('Address not found');

  if (data.isDefault) req.user.addresses.forEach((a) => { a.isDefault = false; });
  address.set({ ...data, isDefault: data.isDefault || address.isDefault });
  await req.user.save();
  res.json({ addresses: req.user.addresses });
});

export const setDefaultAddress = asyncHandler(async (req, res) => {
  const address = req.user.addresses.id(req.params.addressId);
  if (!address) throw ApiError.notFound('Address not found');
  req.user.addresses.forEach((a) => { a.isDefault = a._id.equals(address._id); });
  await req.user.save();
  res.json({ addresses: req.user.addresses });
});

export const deleteAddress = asyncHandler(async (req, res) => {
  const address = req.user.addresses.id(req.params.addressId);
  if (!address) throw ApiError.notFound('Address not found');
  const wasDefault = address.isDefault;
  address.deleteOne();
  if (wasDefault && req.user.addresses.length) req.user.addresses[0].isDefault = true;
  await req.user.save();
  res.json({ addresses: req.user.addresses });
});
