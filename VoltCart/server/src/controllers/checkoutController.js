import { z } from 'zod';
import { redis } from '../config/redis.js';
import { env } from '../config/env.js';
import { Cart } from '../models/Cart.js';
import { SALE_STATUS } from '../models/FlashSale.js';
import { asyncHandler, ApiError } from '../utils/http.js';
import { priceCart } from '../services/pricing.js';
import {
  getReservation, readActiveReservation, releaseReservation, reserveStock,
  sameReservationItems, userReservationKey,
} from '../services/inventoryService.js';

/**
 * Step 1 of checkout: take the flash-sale units out of the Redis pool and hold
 * them for this customer for a few minutes. Nothing is written to Mongo yet.
 */
export const createReservation = asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart || cart.items.length === 0) throw ApiError.badRequest('Your cart is empty', 'EMPTY_CART');

  const priced = await priceCart(cart.items.map((i) => ({ productId: i.product.toString(), quantity: i.quantity })));
  const saleLines = priced.lines.filter((l) => l.isFlashSale);

  const existing = await readActiveReservation(req.user._id);

  // Idempotent: opening checkout twice with the same cart keeps the same hold.
  if (existing && sameReservationItems(existing.items, saleLines.map((l) => ({ productId: l.productId, quantity: l.quantity })))) {
    return res.json({
      reservation: {
        reservationId: existing.reservationId,
        saleId: existing.saleId,
        expiresAt: existing.expiresAt,
        msRemaining: existing.msRemaining,
        items: existing.items,
      },
      cart: priced,
    });
  }

  // Cart changed since the last hold: drop it so the cart and the hold never drift.
  if (existing) {
    await releaseReservation({ saleId: existing.saleId, reservationId: existing.reservationId, reason: 'REPLACED' });
    await redis.del(userReservationKey(req.user._id));
  }

  if (saleLines.length === 0) {
    return res.json({ reservation: null, cart: priced });
  }

  if (priced.saleStatus !== SALE_STATUS.LIVE) {
    throw ApiError.conflict('The flash sale is not live right now', 'SALE_NOT_LIVE');
  }

  const reservation = await reserveStock({
    saleId: priced.saleId,
    userId: req.user._id.toString(),
    items: saleLines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
  });

  await redis.set(
    userReservationKey(req.user._id),
    `${reservation.saleId}|${reservation.reservationId}`,
    'PX', env.reservationTtlSeconds * 1000
  );

  res.status(201).json({
    reservation: {
      reservationId: reservation.reservationId,
      saleId: reservation.saleId,
      expiresAt: reservation.expiresAt,
      msRemaining: reservation.expiresAt.getTime() - Date.now(),
      items: reservation.items,
    },
    cart: priced,
  });
});

export const readReservation = asyncHandler(async (req, res) => {
  const schema = z.object({ saleId: z.string().min(1) });
  const { saleId } = schema.parse(req.query);

  const reservation = await getReservation({ saleId, reservationId: req.params.reservationId });
  if (!reservation) throw ApiError.notFound('Reservation not found or already expired');
  if (reservation.userId !== req.user._id.toString()) throw ApiError.forbidden();

  res.json({ reservation });
});

export const cancelReservation = asyncHandler(async (req, res) => {
  const schema = z.object({ saleId: z.string().min(1) });
  const { saleId } = schema.parse(req.body ?? {});

  const reservation = await getReservation({ saleId, reservationId: req.params.reservationId });
  if (!reservation) throw ApiError.notFound('Reservation not found');
  if (reservation.userId !== req.user._id.toString()) throw ApiError.forbidden();

  const result = await releaseReservation({ saleId, reservationId: req.params.reservationId, reason: 'CUSTOMER_CANCELLED' });
  await redis.del(userReservationKey(req.user._id));
  res.json({ released: result.ok });
});
