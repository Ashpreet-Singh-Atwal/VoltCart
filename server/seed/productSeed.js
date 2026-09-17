const mongoose = require("mongoose");
const dotenv = require("dotenv");

const Product = require("../models/Product");

dotenv.config();

const products = [
  {
    name: "StreetRun Limited Sneaker",
    slug: "streetrun-limited-sneaker",
    description:
      "Limited-edition everyday sneakers designed for comfort, street style, and all-day movement.",
    shortDescription:
      "Limited-edition street sneakers with everyday comfort.",
    category: "Sneakers",
    brand: "StreetRun",

    images: [
      "/images/products/streetrun-limited-sneaker-1.jpg",
      "/images/products/streetrun-limited-sneaker-2.jpg",
      "/images/products/streetrun-limited-sneaker-3.jpg"
    ],

    thumbnail:
      "/images/products/streetrun-limited-sneaker-1.jpg",

    price: 5499,
    originalPrice: 8999,

    onSale: true,

    saleStartsAt:
      new Date("2026-09-15T09:00:00+05:30"),

    saleEndsAt:
      new Date("2026-09-20T21:00:00+05:30"),

    totalStock: 50,
    availableStock: 50,
    reservedStock: 0,
    soldStock: 0,

    isActive: true,
    isFeatured: true,
    isUpcoming: false
  },

  {
    name: "Volt X1 Wireless Headphones",
    slug: "volt-x1-wireless-headphones",
    description:
      "Wireless over-ear headphones with immersive sound, comfortable ear cushions, and long battery life.",
    shortDescription:
      "Immersive wireless headphones with long battery life.",
    category: "Electronics",
    brand: "Volt",

    images: [
      "/images/products/volt-x1-headphones-1.jpg",
      "/images/products/volt-x1-headphones-2.jpg",
      "/images/products/volt-x1-headphones-3.jpg"
    ],

    thumbnail:
      "/images/products/volt-x1-headphones-1.jpg",

    price: 4999,
    originalPrice: 12999,

    onSale: true,

    saleStartsAt:
      new Date("2026-09-15T09:00:00+05:30"),

    saleEndsAt:
      new Date("2026-09-20T21:00:00+05:30"),

    totalStock: 40,
    availableStock: 40,
    reservedStock: 0,
    soldStock: 0,

    isActive: true,
    isFeatured: true,
    isUpcoming: false
  },

  {
    name: "Forge Mechanical Keyboard",
    slug: "forge-mechanical-keyboard",
    description:
      "Mechanical keyboard built for responsive typing and gaming with a durable compact design.",
    shortDescription:
      "Responsive mechanical keyboard for work and gaming.",
    category: "Electronics",
    brand: "Forge",

    images: [
      "/images/products/forge-mechanical-keyboard-1.jpg",
      "/images/products/forge-mechanical-keyboard-2.jpg",
      "/images/products/forge-mechanical-keyboard-3.jpg"
    ],

    thumbnail:
      "/images/products/forge-mechanical-keyboard-1.jpg",

    price: 6999,
    originalPrice: 9999,

    onSale: true,

    saleStartsAt:
      new Date("2026-09-15T09:00:00+05:30"),

    saleEndsAt:
      new Date("2026-09-20T21:00:00+05:30"),

    totalStock: 30,
    availableStock: 30,
    reservedStock: 0,
    soldStock: 0,

    isActive: true,
    isFeatured: true,
    isUpcoming: false
  },

  {
    name: "Pulse Smartwatch",
    slug: "pulse-smartwatch",
    description:
      "Modern smartwatch with activity tracking, notifications, and a bright everyday display.",
    shortDescription:
      "Everyday smartwatch with activity tracking.",
    category: "Wearables",
    brand: "Pulse",

    images: [
      "/images/products/pulse-smartwatch-1.jpg",
      "/images/products/pulse-smartwatch-2.jpg",
      "/images/products/pulse-smartwatch-3.jpg"
    ],

    thumbnail:
      "/images/products/pulse-smartwatch-1.jpg",

    price: 3999,
    originalPrice: 7499,

    onSale: true,

    saleStartsAt:
      new Date("2026-09-15T09:00:00+05:30"),

    saleEndsAt:
      new Date("2026-09-20T21:00:00+05:30"),

    totalStock: 35,
    availableStock: 35,
    reservedStock: 0,
    soldStock: 0,

    isActive: true,
    isFeatured: true,
    isUpcoming: false
  },

  {
    name: "VoltStrike Gaming Controller",
    slug: "voltstrike-gaming-controller",
    description:
      "Comfortable wireless gaming controller with responsive controls for extended gaming sessions.",
    shortDescription:
      "Wireless controller built for comfortable gaming.",
    category: "Gaming",
    brand: "VoltStrike",

    images: [
      "/images/products/voltstrike-controller-1.jpg",
      "/images/products/voltstrike-controller-2.jpg",
      "/images/products/voltstrike-controller-3.jpg"
    ],

    thumbnail:
      "/images/products/voltstrike-controller-1.jpg",

    price: 3499,
    originalPrice: 5999,

    onSale: true,

    saleStartsAt:
      new Date("2026-09-15T09:00:00+05:30"),

    saleEndsAt:
      new Date("2026-09-20T21:00:00+05:30"),

    totalStock: 45,
    availableStock: 45,
    reservedStock: 0,
    soldStock: 0,

    isActive: true,
    isFeatured: true,
    isUpcoming: false
  },

  {
    name: "Boom Mini Portable Speaker",
    slug: "boom-mini-portable-speaker",
    description:
      "Compact portable speaker delivering room-filling sound in a travel-friendly design.",
    shortDescription:
      "Compact portable speaker with powerful sound.",
    category: "Electronics",
    brand: "Boom",

    images: [
      "/images/products/boom-mini-speaker-1.jpg",
      "/images/products/boom-mini-speaker-2.jpg",
      "/images/products/boom-mini-speaker-3.jpg"
    ],

    thumbnail:
      "/images/products/boom-mini-speaker-1.jpg",

    price: 2499,
    originalPrice: 4499,

    onSale: true,

    saleStartsAt:
      new Date("2026-09-15T09:00:00+05:30"),

    saleEndsAt:
      new Date("2026-09-20T21:00:00+05:30"),

    totalStock: 55,
    availableStock: 55,
    reservedStock: 0,
    soldStock: 0,

    isActive: true,
    isFeatured: true,
    isUpcoming: false
  },

  {
    name: "StreetRun Everyday Running Shoes",
    slug: "streetrun-everyday-running-shoes",
    description:
      "Lightweight running shoes designed for everyday training, walking, and active routines.",
    shortDescription:
      "Lightweight running shoes for everyday movement.",
    category: "Running",
    brand: "StreetRun",

    images: [
      "/images/products/streetrun-running-shoes-1.jpg",
      "/images/products/streetrun-running-shoes-2.jpg",
      "/images/products/streetrun-running-shoes-3.jpg"
    ],

    thumbnail:
      "/images/products/streetrun-running-shoes-1.jpg",

    price: 4299,
    originalPrice: 6999,

    onSale: true,

    saleStartsAt:
      new Date("2026-09-15T09:00:00+05:30"),

    saleEndsAt:
      new Date("2026-09-20T21:00:00+05:30"),

    totalStock: 40,
    availableStock: 40,
    reservedStock: 0,
    soldStock: 0,

    isActive: true,
    isFeatured: true,
    isUpcoming: false
  },

  {
    name: "VoltCharge 20K Power Bank",
    slug: "voltcharge-20k-power-bank",
    description:
      "High-capacity portable power bank designed to keep your everyday devices charged on the move.",
    shortDescription:
      "High-capacity portable charging for everyday devices.",
    category: "Electronics",
    brand: "VoltCharge",

    images: [
      "/images/products/voltcharge-power-bank-1.jpg",
      "/images/products/voltcharge-power-bank-2.jpg",
      "/images/products/voltcharge-power-bank-3.jpg"
    ],

    thumbnail:
      "/images/products/voltcharge-power-bank-1.jpg",

    price: 1999,
    originalPrice: 3499,

    onSale: true,

    saleStartsAt:
      new Date("2026-09-15T09:00:00+05:30"),

    saleEndsAt:
      new Date("2026-09-20T21:00:00+05:30"),

    totalStock: 60,
    availableStock: 60,
    reservedStock: 0,
    soldStock: 0,

    isActive: true,
    isFeatured: true,
    isUpcoming: false
  },

  {
    name: "Creator Macro Pad",
    slug: "creator-macro-pad",
    description:
      "Compact programmable macro pad designed for creators, developers, editors, and productivity workflows.",
    shortDescription:
      "Compact programmable controls for creators.",
    category: "Electronics",
    brand: "Creator",

    images: [
      "/images/products/creator-macro-pad-1.jpg",
      "/images/products/creator-macro-pad-2.jpg",
      "/images/products/creator-macro-pad-3.jpg"
    ],

    thumbnail:
      "/images/products/creator-macro-pad-1.jpg",

    price: 2999,
    originalPrice: 4999,

    onSale: true,

    saleStartsAt:
      new Date("2026-09-15T09:00:00+05:30"),

    saleEndsAt:
      new Date("2026-09-20T21:00:00+05:30"),

    totalStock: 25,
    availableStock: 25,
    reservedStock: 0,
    soldStock: 0,

    isActive: true,
    isFeatured: true,
    isUpcoming: false
  },

  {
    name: "Pulse Fitness Band",
    slug: "pulse-fitness-band",
    description:
      "Lightweight fitness band for everyday activity tracking and movement goals.",
    shortDescription:
      "Lightweight fitness tracking for everyday activity.",
    category: "Wearables",
    brand: "Pulse",

    images: [
      "/images/products/pulse-fitness-band-1.jpg",
      "/images/products/pulse-fitness-band-2.jpg",
      "/images/products/pulse-fitness-band-3.jpg"
    ],

    thumbnail:
      "/images/products/pulse-fitness-band-1.jpg",

    price: 1799,
    originalPrice: 2999,

    onSale: true,

    saleStartsAt:
      new Date("2026-09-15T09:00:00+05:30"),

    saleEndsAt:
      new Date("2026-09-20T21:00:00+05:30"),

    totalStock: 50,
    availableStock: 50,
    reservedStock: 0,
    soldStock: 0,

    isActive: true,
    isFeatured: true,
    isUpcoming: false
  },

  {
    name: "UrbanTrail Everyday Backpack",
    slug: "urbantrail-everyday-backpack",
    description:
      "Versatile everyday backpack with organized storage for work, study, and travel.",
    shortDescription:
      "Versatile everyday backpack with organized storage.",
    category: "Bags",
    brand: "UrbanTrail",

    images: [
      "/images/products/urbantrail-backpack-1.jpg",
      "/images/products/urbantrail-backpack-2.jpg",
      "/images/products/urbantrail-backpack-3.jpg"
    ],

    thumbnail:
      "/images/products/urbantrail-backpack-1.jpg",

    price: 2299,
    originalPrice: 3999,

    onSale: true,

    saleStartsAt:
      new Date("2026-09-15T09:00:00+05:30"),

    saleEndsAt:
      new Date("2026-09-20T21:00:00+05:30"),

    totalStock: 45,
    availableStock: 45,
    reservedStock: 0,
    soldStock: 0,

    isActive: true,
    isFeatured: true,
    isUpcoming: false
  },

  {
    name: "VoltPods Wireless Earbuds",
    slug: "voltpods-wireless-earbuds",
    description:
      "Compact wireless earbuds with a comfortable fit and dependable everyday audio.",
    shortDescription:
      "Compact wireless earbuds for everyday listening.",
    category: "Electronics",
    brand: "VoltPods",

    images: [
      "/images/products/voltpods-earbuds-1.jpg",
      "/images/products/voltpods-earbuds-2.jpg",
      "/images/products/voltpods-earbuds-3.jpg"
    ],

    thumbnail:
      "/images/products/voltpods-earbuds-1.jpg",

    price: 2999,
    originalPrice: 5499,

    onSale: true,

    saleStartsAt:
      new Date("2026-09-15T09:00:00+05:30"),

    saleEndsAt:
      new Date("2026-09-20T21:00:00+05:30"),

    totalStock: 45,
    availableStock: 45,
    reservedStock: 0,
    soldStock: 0,

    isActive: true,
    isFeatured: true,
    isUpcoming: false
  }
];

const seedProducts = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error(
        "MONGO_URI is not configured"
      );
    }

    await mongoose.connect(
      process.env.MONGO_URI
    );

    console.log(
      "MongoDB connected for product seeding"
    );

    /*
     * Clear existing products.
     *
     * This is intentionally a development
     * seed script, not a production migration.
     */
    await Product.deleteMany({});

    const insertedProducts =
      await Product.insertMany(
        products
      );

    console.log(
      `${insertedProducts.length} products inserted successfully`
    );

    insertedProducts.forEach(
      (product, index) => {
        console.log(
          `${index + 1}. ${product.name}`
        );
      }
    );

    await mongoose.disconnect();

    console.log(
      "MongoDB disconnected"
    );

    process.exit(0);
  } catch (error) {
    console.error(
      "Product seeding failed:",
      error.message
    );

    await mongoose.disconnect();

    process.exit(1);
  }
};

seedProducts();