/**
 * Concurrency proof: fires N simultaneous reservations for the same product and
 * shows that Redis never hands out more units than exist.
 *
 *   node scripts/oversell-test.js 200
 */
import mongoose from 'mongoose';
import { connectMongo } from '../src/config/db.js';
import { connectRedis, redis, redisBlocking } from '../src/config/redis.js';
import { getCurrentSale, loadSaleStockIntoRedis } from '../src/services/saleService.js';
import { commitReservation, reserveStock } from '../src/services/inventoryService.js';
import { stockKey } from '../src/redis/keys.js';
import { SALE_STATUS } from '../src/models/FlashSale.js';

const ATTEMPTS = Number(process.argv[2] ?? 200);

async function run() {
  await connectMongo();
  await connectRedis();

  const sale = await getCurrentSale();
  if (!sale) throw new Error('No sale found. Run: npm run seed');

  // Force the sale open for the duration of the test.
  sale.startAt = new Date(Date.now() - 1000);
  sale.endAt = new Date(Date.now() + 10 * 60 * 1000);
  sale.status = SALE_STATUS.LIVE;
  await sale.save();
  await loadSaleStockIntoRedis(sale);
  await redis.hset(`fs:{sale:${sale._id}}:state`, 'status', 'LIVE', 'endAt', sale.endAt.getTime());

  const item = sale.items[0];
  const productId = item.product.toString();
  const before = Number(await redis.get(stockKey(sale._id, productId)));

  console.log(`\nProduct ${productId} | stock before: ${before} | concurrent buyers: ${ATTEMPTS}\n`);

  const started = Date.now();
  const results = await Promise.allSettled(
    Array.from({ length: ATTEMPTS }, (_, i) =>
      reserveStock({
        saleId: sale._id.toString(),
        userId: `loadtest-user-${i}`,
        items: [{ productId, quantity: 1 }],
        ttlSeconds: 120,
      }).then((r) =>
        commitReservation({ saleId: sale._id.toString(), reservationId: r.reservationId, orderId: `load-${i}` })
      )
    )
  );

  const ok = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.length - ok;
  const after = Number(await redis.get(stockKey(sale._id, productId)));
  const sold = Number((await redis.get(`fs:{sale:${sale._id}}:sold:${productId}`)) ?? 0);

  console.log(`elapsed        : ${Date.now() - started} ms`);
  console.log(`successful buys: ${ok}`);
  console.log(`rejected buys  : ${failed}`);
  console.log(`stock after    : ${after}`);
  console.log(`sold counter   : ${sold}`);
  console.log(`\noversold?      : ${ok > before ? 'YES - BUG' : 'NO - ' + ok + ' sold out of ' + before}\n`);

  await Promise.allSettled([mongoose.disconnect(), redis.quit(), redisBlocking.quit()]);
  process.exit(0);
}

run().catch((err) => { console.error(err); process.exit(1); });
