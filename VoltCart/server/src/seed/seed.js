import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectMongo } from '../config/db.js';
import { connectRedis, redis, redisBlocking } from '../config/redis.js';
import { Product } from '../models/Product.js';
import { FlashSale } from '../models/FlashSale.js';
import { InventoryEvent } from '../models/InventoryEvent.js';
import { Cart } from '../models/Cart.js';
import { Order } from '../models/Order.js';
import { User, ROLES } from '../models/User.js';

// Demo logins for the presentation. Never seeded in production.
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? 'Voltcart@123';
const DEMO_USERS = [
  { fullName: 'Admin User', email: 'admin@voltcart.test', phone: '9876543200', role: ROLES.ADMIN },
  { fullName: 'Asha Demo', email: 'demo@voltcart.test', phone: '9876543210', role: ROLES.BUYER },
  { fullName: 'Ravi Demo', email: 'demo2@voltcart.test', phone: '9876543211', role: ROLES.BUYER },
];

async function seedDemoUsers() {
  if (process.env.NODE_ENV === 'production') {
    console.log('[seed] production detected - skipping demo users');
    return;
  }
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  for (const u of DEMO_USERS) {
    await User.updateOne(
      { email: u.email },
      { $set: { ...u, passwordHash }, $setOnInsert: { addresses: [] } },
      { upsert: true }
    );
  }
  console.log(`[seed] demo logins ready (password: ${DEMO_PASSWORD}):`);
  for (const u of DEMO_USERS) console.log(`         ${u.role.padEnd(5)}  ${u.email}`);
}

/** Destructive: only runs with --reset. The catalogue belongs to admins now. */
async function resetEverything() {
  console.log('[seed] --reset: clearing products, sales, carts, orders and event ledger...');
  await Promise.all([
    Product.deleteMany({}),
    FlashSale.deleteMany({}),
    Cart.deleteMany({}),
    InventoryEvent.deleteMany({}),
    Order.deleteMany({}),
  ]);

  const stream = redis.scanStream({ match: 'fs:*', count: 200 });
  const keys = [];
  for await (const batch of stream) keys.push(...batch);
  if (keys.length) await redis.del(keys);
  console.log(`[seed] removed ${keys.length} flash-sale keys from Redis`);
}

async function seed() {
  await connectMongo();
  await connectRedis();

  if (process.argv.includes('--reset')) await resetEverything();

  // Rebuild indexes from the current schemas (drops any that no longer exist).
  await Promise.all([User, Product, FlashSale, Cart, Order, InventoryEvent].map((m) => m.syncIndexes()));

  await seedDemoUsers();

  const productCount = await Product.countDocuments();
  console.log(`[seed] catalogue holds ${productCount} product(s) - add more from the admin dashboard`);
  console.log('[seed] done');

  await Promise.allSettled([mongoose.disconnect(), redis.quit(), redisBlocking.quit()]);
  process.exit(0);
}

seed().catch((err) => {
  console.error('[seed] failed:', err);
  process.exit(1);
});
