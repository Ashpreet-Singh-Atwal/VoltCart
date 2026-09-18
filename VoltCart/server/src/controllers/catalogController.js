import { z } from 'zod';
import { Product } from '../models/Product.js';
import { asyncHandler, ApiError } from '../utils/http.js';
import { buildSaleView, getCurrentSale, rescheduleSale, resetSaleInventory } from '../services/saleService.js';

export const listProducts = asyncHandler(async (req, res) => {
  const [products, sale] = await Promise.all([
    Product.find({ isActive: true }).sort({ createdAt: 1 }),
    getCurrentSale(),
  ]);
  const saleView = sale ? await buildSaleView(sale) : null;

  res.json({
    products: products.map((p) => p.toObject({ versionKey: false })),
    sale: saleView,
  });
});

export const getProduct = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ slug: req.params.slug, isActive: true });
  if (!product) throw ApiError.notFound('Product not found');

  const sale = await getCurrentSale();
  const saleView = sale ? await buildSaleView(sale) : null;

  res.json({ product: product.toObject({ versionKey: false }), sale: saleView });
});

export const getSale = asyncHandler(async (req, res) => {
  const sale = await getCurrentSale();
  res.json({ sale: sale ? await buildSaleView(sale) : null, serverTime: new Date() });
});

const scheduleSchema = z.object({
  startInSeconds: z.number().int().min(0).max(86400).default(60),
  durationMinutes: z.number().int().min(1).max(1440).default(30),
});

/** Demo control used during the presentation to line the countdown up. */
export const scheduleSale = asyncHandler(async (req, res) => {
  const data = scheduleSchema.parse(req.body ?? {});
  const sale = await rescheduleSale(data);
  if (!sale) throw ApiError.notFound('No sale configured. Run `npm run seed` first.');
  res.json({ sale: await buildSaleView(sale) });
});

export const resetSale = asyncHandler(async (req, res) => {
  const sale = await resetSaleInventory();
  if (!sale) throw ApiError.notFound('No sale configured');
  res.json({ sale: await buildSaleView(sale) });
});
