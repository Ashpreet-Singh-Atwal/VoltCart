import { customAlphabet } from 'nanoid';
import { redis } from '../config/redis.js';
import '../redis/scripts.js';
import { EXPIRY_ZSET, STREAM_KEY, reservationKey, saleNs } from '../redis/keys.js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/http.js';
import { Cart } from '../models/Cart.js';
import { priceCart } from './pricing.js';

const newId = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 16);

const FRIENDLY = {
  SALE_NOT_LIVE: 'The flash sale is not live right now.',
  SALE_ENDED: 'The flash sale just ended.',
  EMPTY_RESERVATION: 'Your cart has no flash-sale items to reserve.',
  NOT_IN_SALE: 'One of the items is no longer part of the sale.',
  INSUFFICIENT_STOCK: 'Someone grabbed the last units before you.',
  USER_LIMIT_EXCEEDED: 'You have reached the per-customer limit for this deal.',
  RESERVATION_EXISTS: 'A reservation with this id already exists.',
  RESERVATION_NOT_FOUND: 'Your reservation no longer exists.',
  RESERVATION_NOT_ACTIVE: 'This reservation is no longer active.',
  RESERVATION_EXPIRED: 'Your reservation window expired.',
  RESERVATION_NOT_COMMITTED: 'These units were never sold, so there is nothing to restock.',
  INVALID_QUANTITY: 'Invalid quantity requested.',
};

/**
 * Atomically holds `items` for the user for RESERVATION_TTL_SECONDS.
 * Either every line is reserved or nothing is.
 */
export async function reserveStock({ saleId, userId, items, ttlSeconds = env.reservationTtlSeconds }) {
  const reservationId = newId();
  const payload = JSON.stringify(items.map((i) => ({ productId: String(i.productId), quantity: Number(i.quantity) })));

  const raw = await redis.fsReserve(
    saleNs(saleId), String(saleId), reservationId, String(userId),
    String(ttlSeconds), String(Date.now()), payload, EXPIRY_ZSET, STREAM_KEY
  );
  const result = JSON.parse(raw);

  if (!result.ok) {
    throw ApiError.conflict(FRIENDLY[result.code] ?? 'Could not reserve these items.', result.code, result);
  }

  return {
    reservationId,
    saleId: String(saleId),
    items,
    expiresAt: new Date(Number(result.expiresAt)),
    ttlSeconds,
  };
}

export async function releaseReservation({ saleId, reservationId, reason = 'MANUAL' }) {
  const raw = await redis.fsRelease(
    saleNs(saleId), String(saleId), reservationId, String(Date.now()), reason, EXPIRY_ZSET, STREAM_KEY
  );
  return JSON.parse(raw);
}

export async function commitReservation({ saleId, reservationId, orderId }) {
  const raw = await redis.fsCommit(
    saleNs(saleId), String(saleId), reservationId, String(Date.now()), String(orderId), EXPIRY_ZSET, STREAM_KEY
  );
  const result = JSON.parse(raw);
  if (!result.ok) {
    throw ApiError.conflict(FRIENDLY[result.code] ?? 'Could not confirm your reservation.', result.code, result);
  }
  return result;
}

/** Reverses a committed reservation so a cancelled order returns its units. */
export async function restockReservation({ saleId, reservationId, reason = 'ORDER_CANCELLED' }) {
  const raw = await redis.fsRestock(
    saleNs(saleId), String(saleId), reservationId, String(Date.now()), reason, STREAM_KEY
  );
  const result = JSON.parse(raw);
  if (!result.ok) {
    throw ApiError.conflict(FRIENDLY[result.code] ?? 'Could not return these units to the sale.', result.code, result);
  }
  return result;
}

export async function getReservation({ saleId, reservationId }) {
  const data = await redis.hgetall(reservationKey(saleId, reservationId));
  if (!data || !data.status) return null;
  return {
    reservationId,
    saleId: data.saleId,
    userId: data.userId,
    status: data.status,
    items: JSON.parse(data.items ?? '[]'),
    expiresAt: new Date(Number(data.expiresAt)),
    msRemaining: Math.max(0, Number(data.expiresAt) - Date.now()),
    orderId: data.orderId ?? null,
  };
}

/** Points a user at their one in-flight reservation. */
export const userReservationKey = (userId) => `fs:user-resv:${userId}`;

export async function readActiveReservation(userId) {
  const pointer = await redis.get(userReservationKey(userId));
  if (!pointer) return null;
  const [saleId, reservationId] = pointer.split('|');
  const reservation = await getReservation({ saleId, reservationId });
  if (!reservation || reservation.status !== 'ACTIVE' || reservation.msRemaining <= 0) return null;
  return reservation;
}

export function sameReservationItems(a, b) {
  if (a.length !== b.length) return false;
  const map = new Map(a.map((i) => [String(i.productId), Number(i.quantity)]));
  return b.every((i) => map.get(String(i.productId)) === Number(i.quantity));
}

/** The flash-sale lines of a user's cart, in reservation shape. */
export async function cartSaleLines(userId) {
  const cart = await Cart.findOne({ user: userId });
  if (!cart?.items?.length) return [];
  const priced = await priceCart(cart.items.map((i) => ({ productId: i.product.toString(), quantity: i.quantity })));
  return priced.lines.filter((l) => l.isFlashSale).map((l) => ({ productId: l.productId, quantity: l.quantity }));
}

/**
 * Returns held units to the pool the moment the cart stops matching the hold,
 * so a customer who backs out of checkout does not block stock for the full TTL.
 */
export async function releaseReservationIfCartChanged(userId) {
  const existing = await readActiveReservation(userId);
  if (!existing) return null;

  if (sameReservationItems(existing.items, await cartSaleLines(userId))) return existing;

  await releaseReservation({
    saleId: existing.saleId,
    reservationId: existing.reservationId,
    reason: 'CART_CHANGED',
  });
  await redis.del(userReservationKey(userId));
  return null;
}
