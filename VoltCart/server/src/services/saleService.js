import { redis } from '../config/redis.js';
import { FlashSale, SALE_STATUS } from '../models/FlashSale.js';
import {
  ACTIVE_SALE_KEY, metaKey, reservedKey, saleNs, stateKey, stockKey,
} from '../redis/keys.js';

/**
 * The sale customers should currently see: the one that is live, otherwise the
 * next scheduled one, otherwise the most recent finished one.
 */
export async function getCurrentSale() {
  const now = new Date();
  const live = await FlashSale.findOne({ startAt: { $lte: now }, endAt: { $gt: now } }).sort({ startAt: 1 });
  if (live) return live;

  const upcoming = await FlashSale.findOne({ startAt: { $gt: now } }).sort({ startAt: 1 });
  if (upcoming) return upcoming;

  return FlashSale.findOne({}).sort({ endAt: -1 });
}

/**
 * Pushes the sale inventory into Redis. Redis becomes the source of truth for
 * availability while the sale runs. Safe to call repeatedly: stock counters are
 * only written the first time (NX) so a restart never resurrects sold units.
 */
export async function loadSaleStockIntoRedis(sale) {
  const ns = saleNs(sale._id.toString());
  const pipeline = redis.pipeline();

  for (const item of sale.items) {
    const productId = item.product.toString();
    pipeline.set(stockKey(sale._id, productId), item.totalQuantity, 'NX');
    pipeline.set(reservedKey(sale._id, productId), 0, 'NX');
    pipeline.hset(metaKey(sale._id, productId), {
      salePrice: item.salePrice,
      originalPrice: item.originalPrice,
      totalQuantity: item.totalQuantity,
      maxPerUser: item.maxPerUser,
    });
  }

  pipeline.hset(stateKey(sale._id), {
    saleId: sale._id.toString(),
    status: sale.computedStatus(),
    startAt: new Date(sale.startAt).getTime(),
    endAt: new Date(sale.endAt).getTime(),
    ns,
  });
  pipeline.set(ACTIVE_SALE_KEY, sale._id.toString());
  await pipeline.exec();

  if (!sale.stockLoadedAt) {
    sale.stockLoadedAt = new Date();
    await sale.save();
  }
}

/** Keeps the Mongo status field and the Redis state hash in sync with the clock. */
export async function syncSaleStatus() {
  const sale = await getCurrentSale();
  if (!sale) return null;

  const status = sale.computedStatus();

  // Stock is loaded a little before the sale opens so the very first request
  // after the countdown hits a warm Redis.
  const warmupWindowMs = 60_000;
  const shouldLoad = Date.now() >= new Date(sale.startAt).getTime() - warmupWindowMs;
  if (shouldLoad) await loadSaleStockIntoRedis(sale);

  await redis.hset(stateKey(sale._id), {
    status,
    startAt: new Date(sale.startAt).getTime(),
    endAt: new Date(sale.endAt).getTime(),
  });

  if (sale.status !== status) {
    sale.status = status;
    await sale.save();
    console.log(`[sale] ${sale.title} -> ${status}`);
  }
  return sale;
}

/** Live per-product availability straight from Redis. */
export async function readLiveAvailability(sale) {
  if (!sale?.items?.length) return {};
  const pipeline = redis.pipeline();
  for (const item of sale.items) {
    const pid = item.product._id ? item.product._id.toString() : item.product.toString();
    pipeline.get(stockKey(sale._id, pid));
    pipeline.get(reservedKey(sale._id, pid));
  }
  const results = await pipeline.exec();

  const availability = {};
  sale.items.forEach((item, index) => {
    const pid = item.product._id ? item.product._id.toString() : item.product.toString();
    const available = Number(results[index * 2]?.[1] ?? item.availableStock ?? 0);
    const reserved = Number(results[index * 2 + 1]?.[1] ?? 0);
    availability[pid] = {
      available: Number.isFinite(available) ? available : 0,
      reserved: Number.isFinite(reserved) ? reserved : 0,
      totalQuantity: item.totalQuantity,
      salePrice: item.salePrice,
      originalPrice: item.originalPrice,
      maxPerUser: item.maxPerUser,
    };
  });
  return availability;
}

/** Shapes a sale (+ products + live counters) for the client. */
export async function buildSaleView(sale) {
  if (!sale) return null;
  await sale.populate('items.product');
  const availability = await readLiveAvailability(sale);
  const status = sale.computedStatus();

  return {
    id: sale._id.toString(),
    title: sale.title,
    tagline: sale.tagline,
    status,
    startAt: sale.startAt,
    endAt: sale.endAt,
    serverTime: new Date(),
    items: sale.items
      .filter((item) => item.product)
      .map((item) => {
        const pid = item.product._id.toString();
        const live = availability[pid] ?? {};
        return {
          productId: pid,
          salePrice: item.salePrice,
          originalPrice: item.originalPrice,
          totalQuantity: item.totalQuantity,
          available: status === SALE_STATUS.SCHEDULED ? item.totalQuantity : live.available ?? 0,
          reserved: live.reserved ?? 0,
          maxPerUser: item.maxPerUser,
          discountPercent: Math.round(((item.originalPrice - item.salePrice) / item.originalPrice) * 100),
        };
      }),
  };
}

/** Demo helper: move the sale window so it lines up with a presentation. */
export async function rescheduleSale({ startInSeconds = 60, durationMinutes = 30 }) {
  const sale = await getCurrentSale();
  if (!sale) return null;

  const startAt = new Date(Date.now() + startInSeconds * 1000);
  sale.startAt = startAt;
  sale.endAt = new Date(startAt.getTime() + durationMinutes * 60 * 1000);
  sale.status = sale.computedStatus();
  await sale.save();

  await loadSaleStockIntoRedis(sale);
  await redis.hset(stateKey(sale._id), {
    status: sale.status,
    startAt: sale.startAt.getTime(),
    endAt: sale.endAt.getTime(),
  });
  return sale;
}

/** Demo helper: wipe Redis counters and restore full stock for a fresh run. */
export async function resetSaleInventory() {
  const sale = await getCurrentSale();
  if (!sale) return null;

  const pattern = `${saleNs(sale._id.toString())}:*`;
  const keys = [];
  let cursor = '0';
  do {
    const [next, batch] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 200);
    cursor = next;
    keys.push(...batch);
  } while (cursor !== '0');
  if (keys.length) await redis.del(keys);

  sale.items.forEach((item) => {
    item.availableStock = item.totalQuantity;
    item.soldQuantity = 0;
    item.reservedQuantity = 0;
  });
  sale.stockLoadedAt = null;
  await sale.save();
  await loadSaleStockIntoRedis(sale);
  return sale;
}
