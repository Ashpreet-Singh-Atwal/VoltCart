import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectMongo } from '../config/db.js';
import { connectRedis, redis, redisBlocking } from '../config/redis.js';
import { Product } from '../models/Product.js';
import { FlashSale, SALE_STATUS } from '../models/FlashSale.js';
import { InventoryEvent } from '../models/InventoryEvent.js';
import { Cart } from '../models/Cart.js';
import { Order } from '../models/Order.js';
import { User } from '../models/User.js';
import { loadSaleStockIntoRedis } from '../services/saleService.js';

const img = (label, bg = '0B1120', fg = 'FACC15') =>
  `https://placehold.co/800x800/${bg}/${fg}?text=${encodeURIComponent(label)}`;

const PRODUCTS = [
  {
    slug: 'volt-pulse-anc-headphones', name: 'Pulse ANC Wireless Headphones', brand: 'VoltAudio',
    category: 'Audio', price: 12999, stock: 40,
    description: 'Over-ear wireless headphones with hybrid active noise cancellation, 40 hour battery life and a feather-light memory foam headband built for long listening sessions.',
    highlights: ['Hybrid ANC up to 38 dB', '40 hours playback, 10 min = 6 hours', 'Bluetooth 5.3 multipoint', 'Memory foam ear cushions', '1 year warranty'],
  },
  {
    slug: 'volt-buds-pro', name: 'VoltBuds Pro TWS Earbuds', brand: 'VoltAudio',
    category: 'Audio', price: 5499, stock: 60,
    description: 'True wireless earbuds with 11 mm titanium drivers, adaptive transparency mode and an IPX5 sweat-proof shell. Charging case gives you three extra full charges.',
    highlights: ['11 mm titanium drivers', 'Adaptive transparency', 'IPX5 water resistance', '32 hours with case', 'USB-C fast charge'],
  },
  {
    slug: 'volt-surge-powerbank-20k', name: 'Surge 20000mAh Power Bank', brand: 'VoltPower',
    category: 'Power', price: 3499, stock: 80,
    description: 'A 20000 mAh power bank with 65 W USB-C PD output that can charge a laptop, a phone and a pair of earbuds at the same time without breaking a sweat.',
    highlights: ['65 W USB-C Power Delivery', 'Charges laptops', 'Three device output', 'Digital charge display', 'Airline safe capacity'],
  },
  {
    slug: 'volt-charge-gan-65w', name: 'Charge GaN 65W Wall Adapter', brand: 'VoltPower',
    category: 'Power', price: 2299, stock: 100,
    description: 'Compact gallium nitride charger that is 40% smaller than a standard 65 W brick, with intelligent power sharing across two USB-C ports and one USB-A port.',
    highlights: ['GaN II technology', 'Dual USB-C + USB-A', 'Smart power sharing', 'Foldable pins', 'Over-voltage protection'],
  },
  {
    slug: 'volt-track-fit-watch', name: 'TrackFit Smart Watch', brand: 'VoltWear',
    category: 'Wearables', price: 8999, stock: 50,
    description: 'A 1.9 inch AMOLED smart watch with built-in GPS, SpO2 and 24x7 heart rate monitoring, plus 120 workout modes and a seven day battery.',
    highlights: ['1.9" AMOLED always-on display', 'Built-in GPS', 'SpO2 + HR monitoring', '120 sport modes', '7 day battery life'],
  },
  {
    slug: 'volt-band-active', name: 'Band Active Fitness Tracker', brand: 'VoltWear',
    category: 'Wearables', price: 2999, stock: 90,
    description: 'Lightweight fitness band with automatic workout detection, sleep staging and smart notifications that lasts up to 14 days on a single charge.',
    highlights: ['14 day battery', 'Auto workout detection', 'Sleep stage tracking', '5 ATM water resistance', 'Silicone quick-release strap'],
  },
  {
    slug: 'volt-keys-mech-75', name: 'Keys 75% Mechanical Keyboard', brand: 'VoltDesk',
    category: 'Desk', price: 6499, stock: 45,
    description: 'Hot-swappable 75% mechanical keyboard with gasket mounting, south-facing RGB and pre-lubed linear switches that sound as good as they feel.',
    highlights: ['Hot-swappable switches', 'Gasket mounted board', 'Tri-mode: BT / 2.4G / USB-C', 'South-facing RGB', 'PBT double-shot keycaps'],
  },
  {
    slug: 'volt-glide-mouse', name: 'Glide Wireless Mouse', brand: 'VoltDesk',
    category: 'Desk', price: 3299, stock: 70,
    description: 'A 58 gram wireless mouse with a 26K DPI optical sensor, 1000 Hz polling and PTFE feet for effortless glide across any surface.',
    highlights: ['58 g ultralight body', '26K DPI sensor', '1000 Hz polling rate', '70 hour battery', 'PTFE skates'],
  },
  {
    slug: 'volt-beam-soundbar', name: 'Beam 2.1 Soundbar', brand: 'VoltAudio',
    category: 'Home', price: 14999, stock: 30,
    description: 'A 240 W 2.1 channel soundbar with a wireless subwoofer, Dolby Audio decoding and HDMI eARC so your TV finally sounds like it should.',
    highlights: ['240 W output', 'Wireless subwoofer', 'Dolby Audio', 'HDMI eARC + optical', 'Four EQ presets'],
  },
  {
    slug: 'volt-lumen-desk-lamp', name: 'Lumen Smart Desk Lamp', brand: 'VoltHome',
    category: 'Home', price: 2799, stock: 65,
    description: 'Flicker-free LED desk lamp with adjustable colour temperature from 2700K to 6500K, an ambient light sensor and a built-in wireless charging pad.',
    highlights: ['2700K - 6500K tuning', 'Flicker-free eye care', 'Auto brightness sensor', '10 W wireless charging pad', 'Touch + app control'],
  },
  {
    slug: 'volt-cam-360', name: 'Cam 360 Security Camera', brand: 'VoltHome',
    category: 'Home', price: 4499, stock: 55,
    description: '2K indoor security camera with 360 degree pan and tilt, AI person detection, two-way audio and local microSD plus cloud recording options.',
    highlights: ['2K QHD resolution', '360° pan / 110° tilt', 'AI person detection', 'Two-way audio', 'Night vision up to 10 m'],
  },
  {
    slug: 'volt-hub-usb-c-8in1', name: 'Hub 8-in-1 USB-C Dock', brand: 'VoltDesk',
    category: 'Desk', price: 3999, stock: 75,
    description: 'Aluminium USB-C hub with 4K60 HDMI, gigabit ethernet, 100 W pass-through charging, SD/microSD readers and three USB 3.2 ports.',
    highlights: ['4K @ 60 Hz HDMI', 'Gigabit ethernet', '100 W PD pass-through', 'SD + microSD reader', 'Aluminium chassis'],
  },
];

// Demo logins for the presentation. Never seeded in production.
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? 'Voltcart@123';
const DEMO_USERS = [
  { fullName: 'Asha Demo', email: 'demo@voltcart.test', phone: '9876543210' },
  { fullName: 'Ravi Demo', email: 'demo2@voltcart.test', phone: '9876543211' },
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
  for (const u of DEMO_USERS) console.log(`         ${u.email}`);
}

// slug -> [salePrice, quantityInSale, maxPerUser]
const SALE_PLAN = {
  'volt-pulse-anc-headphones': [6499, 15, 2],
  'volt-buds-pro': [2199, 25, 2],
  'volt-surge-powerbank-20k': [1749, 20, 2],
  'volt-track-fit-watch': [4499, 10, 1],
  'volt-keys-mech-75': [3249, 12, 2],
  'volt-beam-soundbar': [7499, 8, 1],
};

async function seed() {
  await connectMongo();
  await connectRedis();

  console.log('[seed] clearing products, sales, carts, orders and event ledger...');
  await Promise.all([
    Product.deleteMany({}),
    FlashSale.deleteMany({}),
    Cart.deleteMany({}),
    InventoryEvent.deleteMany({}),
  ]);

  // Orders reference products that are about to be replaced, and older schema
  // versions may have left indexes behind, so the collection is dropped whole.
  await Order.collection.drop().catch(() => {});
  for (const legacy of ['reservations', 'addresses']) {
    await mongoose.connection.db.dropCollection(legacy).catch(() => {});
  }

  // Rebuild indexes from the current schemas (drops any that no longer exist).
  await Promise.all([User, Product, FlashSale, Cart, Order, InventoryEvent].map((m) => m.syncIndexes()));

  // Remove every flash-sale key so a re-seed starts from a clean pool.
  const stream = redis.scanStream({ match: 'fs:*', count: 200 });
  const keys = [];
  for await (const batch of stream) keys.push(...batch);
  if (keys.length) await redis.del(keys);

  const products = await Product.insertMany(
    PRODUCTS.map((p) => ({ ...p, image: img(p.name), gallery: [img(p.name), img(`${p.brand} ${p.category}`)] }))
  );
  console.log(`[seed] inserted ${products.length} products`);

  await seedDemoUsers();

  const bySlug = new Map(products.map((p) => [p.slug, p]));

  // SALE_START_AT accepts any Date-parseable string ("2026-09-18T14:30:00" is
  // read in local time); otherwise the sale opens SALE_START_IN_MINUTES from now.
  const startAt = process.env.SALE_START_AT
    ? new Date(process.env.SALE_START_AT)
    : new Date(Date.now() + Number(process.env.SALE_START_IN_MINUTES ?? 1) * 60_000);
  if (Number.isNaN(startAt.getTime())) throw new Error(`Invalid SALE_START_AT: ${process.env.SALE_START_AT}`);
  const endAt = new Date(startAt.getTime() + Number(process.env.SALE_DURATION_MINUTES ?? 30) * 60_000);

  const sale = await FlashSale.create({
    title: 'VoltCart Lightning Hour',
    tagline: 'Charged up. Priced down. Only while the units last.',
    startAt,
    endAt,
    status: SALE_STATUS.SCHEDULED,
    items: Object.entries(SALE_PLAN).map(([slug, [salePrice, qty, maxPerUser]]) => {
      const product = bySlug.get(slug);
      return {
        product: product._id,
        salePrice,
        originalPrice: product.price,
        totalQuantity: qty,
        availableStock: qty,
        soldQuantity: 0,
        reservedQuantity: 0,
        maxPerUser,
      };
    }),
  });

  await loadSaleStockIntoRedis(sale);

  console.log(`[seed] flash sale "${sale.title}" starts ${startAt.toLocaleString()} and ends ${endAt.toLocaleString()}`);
  console.log('[seed] done');

  await Promise.allSettled([mongoose.disconnect(), redis.quit(), redisBlocking.quit()]);
  process.exit(0);
}

seed().catch((err) => {
  console.error('[seed] failed:', err);
  process.exit(1);
});
