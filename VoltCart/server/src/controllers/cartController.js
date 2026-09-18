import { z } from 'zod';
import { Cart } from '../models/Cart.js';
import { Product } from '../models/Product.js';
import { asyncHandler, ApiError } from '../utils/http.js';
import { priceCart } from '../services/pricing.js';

const itemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(0).max(10),
});

async function loadCart(userId) {
  return (await Cart.findOne({ user: userId })) ?? new Cart({ user: userId, items: [] });
}

async function respondWithCart(res, cart) {
  const priced = await priceCart(cart.items.map((i) => ({ productId: i.product.toString(), quantity: i.quantity })));
  res.json({ cart: priced });
}

export const getCart = asyncHandler(async (req, res) => {
  const cart = await loadCart(req.user._id);
  await respondWithCart(res, cart);
});

/** Guests price their localStorage cart through this endpoint. */
export const priceGuestCart = asyncHandler(async (req, res) => {
  const items = z.array(itemSchema).max(50).parse(req.body.items ?? []);
  const priced = await priceCart(items.filter((i) => i.quantity > 0));
  res.json({ cart: priced });
});

export const setCartItem = asyncHandler(async (req, res) => {
  const { productId, quantity } = itemSchema.parse(req.body);

  const product = await Product.findById(productId).catch(() => null);
  if (!product || !product.isActive) throw ApiError.notFound('Product not found');

  const cart = await loadCart(req.user._id);
  const existing = cart.items.find((i) => i.product.toString() === productId);

  if (quantity === 0) {
    cart.items = cart.items.filter((i) => i.product.toString() !== productId);
  } else if (existing) {
    existing.quantity = quantity;
  } else {
    cart.items.push({ product: productId, quantity });
  }

  await cart.save();
  await respondWithCart(res, cart);
});

export const removeCartItem = asyncHandler(async (req, res) => {
  const cart = await loadCart(req.user._id);
  cart.items = cart.items.filter((i) => i.product.toString() !== req.params.productId);
  await cart.save();
  await respondWithCart(res, cart);
});

export const clearCart = asyncHandler(async (req, res) => {
  const cart = await loadCart(req.user._id);
  cart.items = [];
  await cart.save();
  await respondWithCart(res, cart);
});
