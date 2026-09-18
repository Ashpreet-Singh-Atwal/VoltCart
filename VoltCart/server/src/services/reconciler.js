import { env } from '../config/env.js';
import { FlashSale } from '../models/FlashSale.js';
import { getCurrentSale, readLiveAvailability } from './saleService.js';

let timer = null;

/**
 * The stream consumer applies *deltas*; this job periodically writes the
 * *absolute* Redis values into Mongo. It is the self-healing net: if a stream
 * message was ever lost or double-counted, the next snapshot repairs the row.
 */
async function reconcileOnce() {
  const sale = await getCurrentSale();
  if (!sale || !sale.items.length) return;

  const availability = await readLiveAvailability(sale);
  const ops = [];

  for (const item of sale.items) {
    const pid = item.product.toString();
    const live = availability[pid];
    if (!live) continue;
    ops.push({
      updateOne: {
        filter: { _id: sale._id, 'items.product': item.product },
        update: {
          $set: {
            'items.$.availableStock': Math.max(0, live.available),
            'items.$.reservedQuantity': Math.max(0, live.reserved),
            'items.$.soldQuantity': Math.max(0, item.totalQuantity - live.available - live.reserved),
          },
        },
      },
    });
  }

  if (ops.length) await FlashSale.bulkWrite(ops, { ordered: false });
}

export function startReconciler() {
  if (timer) return;
  timer = setInterval(() => { reconcileOnce().catch((e) => console.error('[reconciler]', e.message)); }, env.reconcileIntervalMs);
  console.log(`[reconciler] started (every ${env.reconcileIntervalMs}ms)`);
}

export function stopReconciler() {
  if (timer) clearInterval(timer);
  timer = null;
}
