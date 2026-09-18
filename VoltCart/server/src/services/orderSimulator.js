import { Order, ORDER_STATUS } from '../models/Order.js';

let timer = null;

/**
 * Demo-only delivery simulation so "My Orders" can show a real progress line:
 * ORDER_TAKEN -> OUT_FOR_DELIVERY (after 2 min) -> DELIVERED (after 5 min).
 */
async function advanceOnce() {
  const now = new Date();

  await Order.updateMany(
    { status: ORDER_STATUS.ORDER_TAKEN, 'timeline.outForDeliveryAt': { $lte: now } },
    { $set: { status: ORDER_STATUS.OUT_FOR_DELIVERY } }
  );

  await Order.updateMany(
    { status: ORDER_STATUS.OUT_FOR_DELIVERY, 'timeline.deliveredAt': { $lte: now } },
    { $set: { status: ORDER_STATUS.DELIVERED } }
  );
}

export function startOrderSimulator() {
  if (timer) return;
  timer = setInterval(() => { advanceOnce().catch((e) => console.error('[orders]', e.message)); }, 10_000);
}

export function stopOrderSimulator() {
  if (timer) clearInterval(timer);
  timer = null;
}
