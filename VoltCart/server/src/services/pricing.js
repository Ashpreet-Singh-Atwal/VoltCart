import { Product } from '../models/Product.js';
import { SALE_STATUS } from '../models/FlashSale.js';
import { buildSaleView, getCurrentSale } from './saleService.js';

export const DELIVERY_FEE = 0; // free delivery, always

/**
 * Prices a list of {productId, quantity} lines against the live sale.
 * Sale price only applies while the sale is LIVE and the product is in it.
 */
export async function priceCart(rawItems) {
  const items = (rawItems ?? []).filter((i) => i && i.productId && Number(i.quantity) > 0);
  const ids = items.map((i) => String(i.productId));

  const [products, sale] = await Promise.all([
    Product.find({ _id: { $in: ids }, isActive: true }),
    getCurrentSale(),
  ]);

  const saleView = sale ? await buildSaleView(sale) : null;
  const saleIsLive = saleView?.status === SALE_STATUS.LIVE;
  const saleItems = new Map((saleView?.items ?? []).map((i) => [i.productId, i]));

  const productMap = new Map(products.map((p) => [p._id.toString(), p]));

  const lines = [];
  for (const item of items) {
    const product = productMap.get(String(item.productId));
    if (!product) continue;

    const saleItem = saleItems.get(product._id.toString());
    const onSale = Boolean(saleIsLive && saleItem);
    const unitPrice = onSale ? saleItem.salePrice : product.price;
    const quantity = Number(item.quantity);

    lines.push({
      productId: product._id.toString(),
      slug: product.slug,
      name: product.name,
      brand: product.brand,
      image: product.image,
      quantity,
      unitPrice,
      originalPrice: product.price,
      lineTotal: unitPrice * quantity,
      isFlashSale: onSale,
      maxPerUser: onSale ? saleItem.maxPerUser : null,
      available: onSale ? saleItem.available : product.stock,
    });
  }

  const subtotal = lines.reduce((sum, l) => sum + l.originalPrice * l.quantity, 0);
  const discount = lines.reduce((sum, l) => sum + (l.originalPrice - l.unitPrice) * l.quantity, 0);
  const total = subtotal - discount + DELIVERY_FEE;

  return {
    lines,
    saleId: saleView?.id ?? null,
    saleStatus: saleView?.status ?? null,
    pricing: { subtotal, discount, deliveryFee: DELIVERY_FEE, total },
  };
}
