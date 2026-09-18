import mongoose from 'mongoose';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectMongo } from './config/db.js';
import { connectRedis, redis, redisBlocking } from './config/redis.js';
import { syncSaleStatus } from './services/saleService.js';
import { startReservationSweeper, stopReservationSweeper } from './services/reservationSweeper.js';
import { startStreamConsumer, stopStreamConsumer } from './services/streamConsumer.js';
import { startReconciler, stopReconciler } from './services/reconciler.js';
import { startOrderSimulator, stopOrderSimulator } from './services/orderSimulator.js';

async function main() {
  await connectMongo();
  await connectRedis();

  await syncSaleStatus();
  const saleTicker = setInterval(() => { syncSaleStatus().catch((e) => console.error('[sale]', e.message)); }, 1000);

  startReservationSweeper();
  await startStreamConsumer();
  startReconciler();
  startOrderSimulator();

  const server = createApp().listen(env.port, () => {
    console.log(`[api] VoltCart server listening on http://localhost:${env.port}`);
  });

  const shutdown = async (signal) => {
    console.log(`\n[api] ${signal} received, shutting down...`);
    clearInterval(saleTicker);
    stopReservationSweeper();
    stopStreamConsumer();
    stopReconciler();
    stopOrderSimulator();
    server.close();
    await Promise.allSettled([mongoose.disconnect(), redis.quit(), redisBlocking.quit()]);
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[api] failed to start:', err);
  process.exit(1);
});
