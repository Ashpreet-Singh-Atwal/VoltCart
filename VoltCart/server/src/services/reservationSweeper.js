import mongoose from 'mongoose';
import { redis } from '../config/redis.js';
import { env } from '../config/env.js';
import { EXPIRY_ZSET } from '../redis/keys.js';
import { getReservation, releaseReservation } from './inventoryService.js';
import { Cart } from '../models/Cart.js';
import { Order, ORDER_STATUS, PAYMENT_STATUS } from '../models/Order.js';

let timer = null;

/**
 * Every tick we look for reservations whose hold window elapsed, put the units
 * back into the Redis pool, drop the items from the customer's cart and cancel
 * the unpaid order. Using a sorted set (instead of key-expiry notifications)
 * keeps the sweep deterministic and restart-safe.
 */
async function sweepOnce() {
  const now = Date.now();
  const due = await redis.zrangebyscore(EXPIRY_ZSET, 0, now, 'LIMIT', 0, 50);
  if (!due.length) return;

  for (const member of due) {
    const [saleId, reservationId] = member.split('|');
    try {
      const reservation = await getReservation({ saleId, reservationId });
      const result = await releaseReservation({ saleId, reservationId, reason: 'EXPIRED' });
      if (!result.ok || !reservation) continue;

      const productIds = reservation.items.map((i) => i.productId);

      // Load-test reservations use synthetic user ids; the stock is already back
      // in the pool by now, so cart/order cleanup is best-effort only.
      if (mongoose.isValidObjectId(reservation.userId)) {
        await Cart.updateOne(
          { user: reservation.userId },
          { $pull: { items: { product: { $in: productIds } } } }
        );
      }

      await Order.updateOne(
        { reservationId, status: ORDER_STATUS.PENDING_PAYMENT },
        { $set: { status: ORDER_STATUS.CANCELLED, paymentStatus: PAYMENT_STATUS.FAILED } }
      );

      console.log(`[sweeper] released expired reservation ${reservationId} (${productIds.length} lines)`);
    } catch (err) {
      console.error('[sweeper] failed for', member, err.message);
    }
  }
}

export function startReservationSweeper() {
  if (timer) return;
  timer = setInterval(() => { sweepOnce().catch((e) => console.error('[sweeper]', e.message)); }, env.sweeperIntervalMs);
  console.log(`[sweeper] started (every ${env.sweeperIntervalMs}ms)`);
}

export function stopReservationSweeper() {
  if (timer) clearInterval(timer);
  timer = null;
}
