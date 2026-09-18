import { z } from 'zod';
import mongoose from 'mongoose';
import { customAlphabet } from 'nanoid';
import { withTransaction } from '../config/db.js';
import { Cart } from '../models/Cart.js';
import { Product } from '../models/Product.js';
import { Order, ORDER_STATUS, PAYMENT_METHOD, PAYMENT_STATUS } from '../models/Order.js';
import { asyncHandler, ApiError } from '../utils/http.js';
import { priceCart } from '../services/pricing.js';
import { getReservation, restockReservation } from '../services/inventoryService.js';

const orderNo = customAlphabet('0123456789ABCDEFGHJKLMNPQRSTUVWXYZ', 8);

const createOrderSchema = z.object({
  addressId: z.string().min(1),
  paymentMethod: z.nativeEnum(PAYMENT_METHOD),
  reservationId: z.string().optional().nullable(),
  saleId: z.string().optional().nullable(),
});

/**
 * Non-sale items are not held in Redis, so they are decremented here with a
 * conditional update (`stock >= qty`). The filter makes the check-and-decrement
 * a single atomic Mongo operation, which is what prevents overselling for the
 * regular catalogue.
 */
async function decrementRegularStock(lines, session) {
  const applied = [];
  try {
    for (const line of lines) {
      const result = await Product.updateOne(
        { _id: line.productId, stock: { $gte: line.quantity } },
        { $inc: { stock: -line.quantity } },
        { session }
      );
      if (result.modifiedCount !== 1) {
        throw ApiError.conflict(`${line.name} just went out of stock`, 'INSUFFICIENT_STOCK', { productId: line.productId });
      }
      applied.push(line);
    }
  } catch (err) {
    // Compensating writes for deployments without transactions (standalone Mongo).
    if (!session) {
      for (const line of applied) {
        await Product.updateOne({ _id: line.productId }, { $inc: { stock: line.quantity } });
      }
    }
    throw err;
  }
}

export const createOrder = asyncHandler(async (req, res) => {
  const data = createOrderSchema.parse(req.body);

  const address = req.user.addresses.id(data.addressId);
  if (!address) throw ApiError.badRequest('Select a valid delivery address', 'INVALID_ADDRESS');

  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart || cart.items.length === 0) throw ApiError.badRequest('Your cart is empty', 'EMPTY_CART');

  const priced = await priceCart(cart.items.map((i) => ({ productId: i.product.toString(), quantity: i.quantity })));
  const saleLines = priced.lines.filter((l) => l.isFlashSale);
  const regularLines = priced.lines.filter((l) => !l.isFlashSale);

  // Flash-sale lines must be backed by a live reservation owned by this user.
  if (saleLines.length > 0) {
    if (!data.reservationId || !data.saleId) {
      throw ApiError.badRequest('Reserve your flash-sale items before ordering', 'RESERVATION_REQUIRED');
    }
    const reservation = await getReservation({ saleId: data.saleId, reservationId: data.reservationId });
    if (!reservation) throw ApiError.conflict('Your reservation expired', 'RESERVATION_EXPIRED');
    if (reservation.userId !== req.user._id.toString()) throw ApiError.forbidden();
    if (reservation.status !== 'ACTIVE') throw ApiError.conflict('Your reservation expired', 'RESERVATION_EXPIRED');
    if (reservation.msRemaining <= 0) throw ApiError.conflict('Your reservation expired', 'RESERVATION_EXPIRED');

    const held = new Map(reservation.items.map((i) => [String(i.productId), Number(i.quantity)]));
    for (const line of saleLines) {
      if (held.get(line.productId) !== line.quantity) {
        throw ApiError.conflict('Your cart changed after reserving. Please checkout again.', 'RESERVATION_MISMATCH');
      }
    }
    if (held.size !== saleLines.length) {
      throw ApiError.conflict('Your cart changed after reserving. Please checkout again.', 'RESERVATION_MISMATCH');
    }
  }

  const order = await withTransaction(async (session) => {
    await decrementRegularStock(regularLines, session);

    const docs = await Order.create([{
      orderNumber: `VC${orderNo()}`,
      user: req.user._id,
      items: priced.lines.map((l) => ({
        product: new mongoose.Types.ObjectId(l.productId),
        name: l.name,
        brand: l.brand,
        image: l.image,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        originalPrice: l.originalPrice,
        isFlashSale: l.isFlashSale,
      })),
      shippingAddress: address.toObject(),
      pricing: priced.pricing,
      paymentMethod: data.paymentMethod,
      paymentStatus: PAYMENT_STATUS.PENDING,
      status: ORDER_STATUS.PENDING_PAYMENT,
      sale: saleLines.length ? new mongoose.Types.ObjectId(data.saleId) : null,
      reservationId: saleLines.length ? data.reservationId : null,
    }], session ? { session } : {});

    return docs[0];
  });

  res.status(201).json({ order: order.toObject({ versionKey: false }) });
});

export const listOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.user._id, status: { $ne: ORDER_STATUS.PENDING_PAYMENT } })
    .sort({ createdAt: -1 })
    .limit(50);
  res.json({ orders });
});

export const getOrder = asyncHandler(async (req, res) => {
  const order = await Order.findOne({ _id: req.params.orderId, user: req.user._id });
  if (!order) throw ApiError.notFound('Order not found');
  res.json({ order });
});

/**
 * Customer-initiated cancellation, allowed until the parcel is dispatched.
 * The status is flipped with a conditional update so two concurrent cancels
 * cannot both proceed and hand the stock back twice.
 */
export const cancelOrder = asyncHandler(async (req, res) => {
  const order = await Order.findOneAndUpdate(
    { _id: req.params.orderId, user: req.user._id, status: ORDER_STATUS.ORDER_TAKEN },
    { $set: { status: ORDER_STATUS.CANCELLED, 'timeline.cancelledAt': new Date() } },
    { new: true }
  );

  if (!order) {
    const existing = await Order.findOne({ _id: req.params.orderId, user: req.user._id });
    if (!existing) throw ApiError.notFound('Order not found');
    if (existing.status === ORDER_STATUS.CANCELLED) return res.json({ order: existing });
    throw ApiError.conflict('This order has already been dispatched and can no longer be cancelled.', 'CANCELLATION_WINDOW_CLOSED');
  }

  // Flash-sale units live in Redis; the script is idempotent per reservation.
  if (order.reservationId && order.sale) {
    await restockReservation({
      saleId: order.sale.toString(),
      reservationId: order.reservationId,
      reason: 'ORDER_CANCELLED',
    });
  }

  for (const item of order.items.filter((i) => !i.isFlashSale)) {
    await Product.updateOne({ _id: item.product }, { $inc: { stock: item.quantity } });
  }

  res.json({ order });
});
