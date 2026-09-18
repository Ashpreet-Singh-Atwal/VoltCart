import { z } from 'zod';
import mongoose from 'mongoose';
import { Product } from '../models/Product.js';
import { FlashSale, SALE_STATUS } from '../models/FlashSale.js';
import { Order, ORDER_STATUS } from '../models/Order.js';
import { asyncHandler, ApiError } from '../utils/http.js';
import { clearSaleRedis, loadSaleStockIntoRedis, syncLiveSaleStock } from '../services/saleService.js';

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

const slugify = (name) =>
  name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

/** Appends -2, -3 ... until the slug is free. */
async function uniqueSlug(name, excludeId = null) {
  const base = slugify(name) || 'product';
  let slug = base;
  for (let n = 2; ; n += 1) {
    const clash = await Product.findOne({ slug, ...(excludeId ? { _id: { $ne: excludeId } } : {}) }).select('_id');
    if (!clash) return slug;
    slug = `${base}-${n}`;
  }
}

/** Units sold + revenue per product, ignoring cancelled orders. */
async function salesByProduct(productIds) {
  if (!productIds.length) return new Map();
  const rows = await Order.aggregate([
    { $match: { status: { $ne: ORDER_STATUS.CANCELLED } } },
    { $unwind: '$items' },
    { $match: { 'items.product': { $in: productIds } } },
    {
      $group: {
        _id: '$items.product',
        units: { $sum: '$items.quantity' },
        revenue: { $sum: { $multiply: ['$items.unitPrice', '$items.quantity'] } },
      },
    },
  ]);
  return new Map(rows.map((r) => [r._id.toString(), { units: r.units, revenue: r.revenue }]));
}

const ownedProductIds = async (userId) =>
  (await Product.find({ createdBy: userId }).select('_id')).map((p) => p._id);

/* ------------------------------------------------------------------ */
/* dashboard                                                           */
/* ------------------------------------------------------------------ */

export const getDashboard = asyncHandler(async (req, res) => {
  const products = await Product.find({ createdBy: req.user._id }).sort({ createdAt: -1 });
  const stats = await salesByProduct(products.map((p) => p._id));

  const rows = products.map((p) => {
    const s = stats.get(p._id.toString()) ?? { units: 0, revenue: 0 };
    return {
      _id: p._id,
      slug: p.slug,
      name: p.name,
      brand: p.brand,
      category: p.category,
      image: p.image,
      price: p.price,
      isActive: p.isActive,
      remainingQuantity: p.stock,
      unitsSold: s.units,
      // What the admin originally put on the shelf.
      totalQuantity: p.stock + s.units,
      revenue: s.revenue,
      createdAt: p.createdAt,
    };
  });

  const liveSales = await FlashSale.countDocuments({
    createdBy: req.user._id,
    startAt: { $lte: new Date() },
    endAt: { $gt: new Date() },
  });

  res.json({
    summary: {
      totalRevenue: rows.reduce((sum, r) => sum + r.revenue, 0),
      totalProducts: rows.length,
      soldOutProducts: rows.filter((r) => r.remainingQuantity === 0).length,
      unitsSold: rows.reduce((sum, r) => sum + r.unitsSold, 0),
      liveSales,
    },
    products: rows,
  });
});

/* ------------------------------------------------------------------ */
/* products                                                            */
/* ------------------------------------------------------------------ */

const productSchema = z.object({
  name: z.string().min(2, 'Product name is required').max(120),
  brand: z.string().min(1, 'Brand is required').max(60),
  category: z.string().min(1, 'Category is required').max(60),
  image: z.string().url('Image must be a valid URL'),
  gallery: z.array(z.string().url()).max(6).default([]),
  price: z.number().int('Price must be a whole number').min(1, 'Price must be greater than 0'),
  description: z.string().min(10, 'Description must be at least 10 characters').max(2000),
  highlights: z.array(z.string().min(1).max(160)).max(10).default([]),
  stock: z.number().int().min(0, 'Stock cannot be negative'),
  isActive: z.boolean().default(true),
});

export const listProducts = asyncHandler(async (req, res) => {
  const products = await Product.find({ createdBy: req.user._id }).sort({ createdAt: -1 });
  res.json({ products });
});

export const getProduct = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ _id: req.params.productId, createdBy: req.user._id });
  if (!product) throw ApiError.notFound('Product not found');
  res.json({ product });
});

export const createProduct = asyncHandler(async (req, res) => {
  const data = productSchema.parse(req.body);
  const product = await Product.create({
    ...data,
    slug: await uniqueSlug(data.name),
    createdBy: req.user._id,
  });
  res.status(201).json({ product });
});

export const updateProduct = asyncHandler(async (req, res) => {
  const data = productSchema.parse(req.body);
  const product = await Product.findOne({ _id: req.params.productId, createdBy: req.user._id });
  if (!product) throw ApiError.notFound('Product not found');

  Object.assign(product, data);
  if (product.isModified('name')) product.slug = await uniqueSlug(data.name, product._id);
  await product.save();

  res.json({ product });
});

/* ------------------------------------------------------------------ */
/* sales                                                               */
/* ------------------------------------------------------------------ */

const saleSchema = z.object({
  title: z.string().min(3, 'Sale title is required').max(120),
  tagline: z.string().max(200).optional().default(''),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  items: z.array(z.object({
    productId: z.string().min(1),
    salePrice: z.number().int().min(1, 'Sale price must be greater than 0'),
    totalQuantity: z.number().int().min(1, 'Quantity must be at least 1'),
    maxPerUser: z.number().int().min(1).max(20),
  })).min(1, 'Add at least one product to the sale'),
}).refine((d) => d.endAt > d.startAt, { message: 'End time must be after the start time', path: ['endAt'] });

/** Only one sale can run at a time - the storefront shows a single window. */
async function assertNoOverlap({ startAt, endAt, excludeId }) {
  const clash = await FlashSale.findOne({
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    startAt: { $lt: endAt },
    endAt: { $gt: startAt },
  });
  if (clash) {
    throw ApiError.conflict(
      `"${clash.title}" already runs between ${new Date(clash.startAt).toLocaleString()} and ${new Date(clash.endAt).toLocaleString()}. Pick a different window.`,
      'SALE_WINDOW_OVERLAP'
    );
  }
}

/** Validates the lines against the admin's catalogue and returns sale items. */
async function buildSaleItems(items, userId) {
  const ids = items.map((i) => i.productId);
  if (new Set(ids).size !== ids.length) throw ApiError.badRequest('The same product was added twice', 'DUPLICATE_ITEM');

  const products = await Product.find({ _id: { $in: ids }, createdBy: userId });
  const byId = new Map(products.map((p) => [p._id.toString(), p]));

  return items.map((line) => {
    const product = byId.get(line.productId);
    if (!product) throw ApiError.badRequest('One of the selected products does not exist', 'INVALID_PRODUCT');
    if (line.salePrice >= product.price) {
      throw ApiError.badRequest(`Sale price for ${product.name} must be below its regular price of ${product.price}`, 'INVALID_SALE_PRICE');
    }
    return {
      product: product._id,
      salePrice: line.salePrice,
      originalPrice: product.price,
      totalQuantity: line.totalQuantity,
      availableStock: line.totalQuantity,
      soldQuantity: 0,
      reservedQuantity: 0,
      maxPerUser: line.maxPerUser,
    };
  });
}

export const listSales = asyncHandler(async (req, res) => {
  const sales = await FlashSale.find({ createdBy: req.user._id }).sort({ startAt: -1 }).populate('items.product');

  const revenueRows = await Order.aggregate([
    { $match: { status: { $ne: ORDER_STATUS.CANCELLED }, sale: { $in: sales.map((s) => s._id) } } },
    { $unwind: '$items' },
    { $match: { 'items.isFlashSale': true } },
    {
      $group: {
        _id: '$sale',
        units: { $sum: '$items.quantity' },
        revenue: { $sum: { $multiply: ['$items.unitPrice', '$items.quantity'] } },
        orders: { $addToSet: '$_id' },
      },
    },
  ]);
  const bySale = new Map(revenueRows.map((r) => [r._id.toString(), r]));

  res.json({
    sales: sales.map((sale) => {
      const agg = bySale.get(sale._id.toString());
      const offered = sale.items.reduce((sum, i) => sum + i.totalQuantity, 0);
      const sold = sale.items.reduce((sum, i) => sum + i.soldQuantity, 0);
      return {
        _id: sale._id,
        title: sale.title,
        tagline: sale.tagline,
        startAt: sale.startAt,
        endAt: sale.endAt,
        status: sale.computedStatus(),
        productCount: sale.items.length,
        unitsOffered: offered,
        unitsSold: sold,
        unitsLeft: Math.max(0, offered - sold),
        sellThroughPercent: offered ? Math.round((sold / offered) * 100) : 0,
        revenue: agg?.revenue ?? 0,
        orderCount: agg?.orders?.length ?? 0,
        items: sale.items.filter((i) => i.product).map((i) => ({
          productId: i.product._id,
          name: i.product.name,
          image: i.product.image,
          salePrice: i.salePrice,
          originalPrice: i.originalPrice,
          totalQuantity: i.totalQuantity,
          soldQuantity: i.soldQuantity,
          availableStock: i.availableStock,
          maxPerUser: i.maxPerUser,
        })),
      };
    }),
  });
});

export const getSale = asyncHandler(async (req, res) => {
  const sale = await FlashSale.findOne({ _id: req.params.saleId, createdBy: req.user._id });
  if (!sale) throw ApiError.notFound('Sale not found');
  res.json({ sale: { ...sale.toObject({ versionKey: false }), status: sale.computedStatus() } });
});

export const createSale = asyncHandler(async (req, res) => {
  const data = saleSchema.parse(req.body);
  if (data.endAt <= new Date()) throw ApiError.badRequest('The sale must end in the future', 'SALE_IN_PAST');

  await assertNoOverlap({ startAt: data.startAt, endAt: data.endAt });
  const items = await buildSaleItems(data.items, req.user._id);

  const sale = await FlashSale.create({
    title: data.title,
    tagline: data.tagline || undefined,
    startAt: data.startAt,
    endAt: data.endAt,
    status: SALE_STATUS.SCHEDULED,
    createdBy: req.user._id,
    items,
  });
  sale.status = sale.computedStatus();
  await sale.save();
  await loadSaleStockIntoRedis(sale);

  res.status(201).json({ sale });
});

/**
 * A live sale already has counters in Redis, so its shape is frozen: items
 * cannot be added or removed and quantities can only grow. Scheduled and
 * finished sales are rewritten from scratch.
 */
export const updateSale = asyncHandler(async (req, res) => {
  const data = saleSchema.parse(req.body);
  const sale = await FlashSale.findOne({ _id: req.params.saleId, createdBy: req.user._id });
  if (!sale) throw ApiError.notFound('Sale not found');

  const wasLive = sale.computedStatus() === SALE_STATUS.LIVE;
  await assertNoOverlap({ startAt: data.startAt, endAt: data.endAt, excludeId: sale._id });

  if (wasLive) {
    if (data.startAt.getTime() !== new Date(sale.startAt).getTime()) {
      throw ApiError.badRequest('A live sale cannot have its start time changed', 'SALE_LIVE_LOCKED');
    }
    if (data.endAt <= new Date()) throw ApiError.badRequest('End time must be in the future', 'SALE_IN_PAST');

    const existing = new Map(sale.items.map((i) => [i.product.toString(), i]));
    if (data.items.length !== existing.size || data.items.some((i) => !existing.has(i.productId))) {
      throw ApiError.badRequest('Products cannot be added or removed while the sale is live', 'SALE_LIVE_LOCKED');
    }

    for (const line of data.items) {
      const item = existing.get(line.productId);
      if (line.totalQuantity < item.totalQuantity) {
        throw ApiError.badRequest('Quantities can only be increased while the sale is live', 'SALE_LIVE_LOCKED');
      }
      item.totalQuantity = line.totalQuantity;
      item.salePrice = line.salePrice;
      item.maxPerUser = line.maxPerUser;
    }

    sale.title = data.title;
    sale.tagline = data.tagline || sale.tagline;
    sale.endAt = data.endAt;
    sale.status = sale.computedStatus();
    await sale.save();
    await syncLiveSaleStock(sale);
  } else {
    if (data.endAt <= new Date()) throw ApiError.badRequest('The sale must end in the future', 'SALE_IN_PAST');

    sale.title = data.title;
    sale.tagline = data.tagline || sale.tagline;
    sale.startAt = data.startAt;
    sale.endAt = data.endAt;
    sale.items = await buildSaleItems(data.items, req.user._id);
    sale.stockLoadedAt = null;
    sale.status = sale.computedStatus();
    await sale.save();

    // Counters start clean; a rescheduled sale is effectively a fresh run.
    await clearSaleRedis(sale._id.toString());
    await loadSaleStockIntoRedis(sale);
  }

  res.json({ sale });
});
