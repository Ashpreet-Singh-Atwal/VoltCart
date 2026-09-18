import mongoose from 'mongoose';
import { redis, redisBlocking } from '../config/redis.js';
import { STREAM_GROUP, STREAM_KEY } from '../redis/keys.js';
import { FlashSale } from '../models/FlashSale.js';
import { InventoryEvent } from '../models/InventoryEvent.js';

const CONSUMER = `sync-${process.pid}`;
let running = false;

async function ensureGroup() {
  try {
    await redis.xgroup('CREATE', STREAM_KEY, STREAM_GROUP, '$', 'MKSTREAM');
    console.log(`[stream] consumer group "${STREAM_GROUP}" created`);
  } catch (err) {
    if (!String(err.message).includes('BUSYGROUP')) throw err;
  }
}

function toObject(fieldArray) {
  const obj = {};
  for (let i = 0; i < fieldArray.length; i += 2) obj[fieldArray[i]] = fieldArray[i + 1];
  return obj;
}

/** Translates one inventory event into the Mongo counters for that sale. */
function buildOps(saleId, type, items) {
  const ops = [];
  for (const item of items) {
    const inc = {};
    const qty = Number(item.quantity);

    if (type === 'RESERVE') {
      inc['items.$.reservedQuantity'] = qty;
      inc['items.$.availableStock'] = -qty;
    } else if (type === 'RELEASE') {
      inc['items.$.reservedQuantity'] = -qty;
      inc['items.$.availableStock'] = qty;
    } else if (type === 'COMMIT') {
      inc['items.$.reservedQuantity'] = -qty;
      inc['items.$.soldQuantity'] = qty;
    } else if (type === 'RESTOCK') {
      inc['items.$.soldQuantity'] = -qty;
      inc['items.$.availableStock'] = qty;
    } else {
      continue;
    }

    ops.push({
      updateOne: {
        filter: {
          _id: new mongoose.Types.ObjectId(saleId),
          'items.product': new mongoose.Types.ObjectId(item.productId),
        },
        update: { $inc: inc },
      },
    });
  }
  return ops;
}

async function applyMessage(id, fields) {
  const event = toObject(fields);
  const items = JSON.parse(event.items ?? '[]');

  try {
    // Insert-first idempotency guard: a redelivered message hits the unique _id.
    await InventoryEvent.create({
      _id: id,
      type: event.type,
      saleId: event.saleId,
      reservationId: event.reservationId ?? null,
      userId: event.userId ?? null,
      items,
    });
  } catch (err) {
    if (err?.code === 11000) {
      await redis.xack(STREAM_KEY, STREAM_GROUP, id);
      return;
    }
    throw err;
  }

  const ops = buildOps(event.saleId, event.type, items);
  if (ops.length) await FlashSale.bulkWrite(ops, { ordered: false });

  await redis.xack(STREAM_KEY, STREAM_GROUP, id);
}

async function drain(startId) {
  const response = await redisBlocking.xreadgroup(
    'GROUP', STREAM_GROUP, CONSUMER,
    'COUNT', 50,
    'BLOCK', 5000,
    'STREAMS', STREAM_KEY, startId
  );
  if (!response) return 0;

  let processed = 0;
  for (const [, messages] of response) {
    for (const [id, fields] of messages) {
      try {
        await applyMessage(id, fields);
        processed += 1;
      } catch (err) {
        // Leave it in the PEL; it will be retried on the next pending pass.
        console.error('[stream] failed to apply', id, err.message);
      }
    }
  }
  return processed;
}

export async function startStreamConsumer() {
  await ensureGroup();
  running = true;

  // First pass: anything this consumer claimed earlier but never acked.
  try { await drain('0'); } catch (err) { console.error('[stream] pending pass failed', err.message); }

  (async function loop() {
    console.log('[stream] consumer started:', CONSUMER);
    while (running) {
      try {
        await drain('>');
      } catch (err) {
        if (!running) break;
        // Re-seeding deletes the stream (and with it the group); rebuild and carry on.
        if (String(err.message).includes('NOGROUP')) {
          await ensureGroup().catch(() => {});
          continue;
        }
        console.error('[stream] read error:', err.message);
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  })();
}

export function stopStreamConsumer() {
  running = false;
}
