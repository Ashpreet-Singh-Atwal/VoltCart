import mongoose from 'mongoose';

export const SALE_STATUS = {
  SCHEDULED: 'SCHEDULED',
  LIVE: 'LIVE',
  ENDED: 'ENDED',
};

const saleItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    salePrice: { type: Number, required: true, min: 0 },
    originalPrice: { type: Number, required: true, min: 0 },
    totalQuantity: { type: Number, required: true, min: 0 },
    // Snapshot of Redis availability, refreshed by the reconciler. Redis is the
    // source of truth while the sale is live; this field is for reads/reporting.
    availableStock: { type: Number, required: true, min: 0 },
    soldQuantity: { type: Number, default: 0, min: 0 },
    reservedQuantity: { type: Number, default: 0, min: 0 },
    maxPerUser: { type: Number, default: 2, min: 1 },
  },
  { _id: false }
);

const flashSaleSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    tagline: { type: String, default: 'Lightning deals. Limited units. Blink and it is gone.' },
    startAt: { type: Date, required: true, index: true },
    endAt: { type: Date, required: true, index: true },
    status: { type: String, enum: Object.values(SALE_STATUS), default: SALE_STATUS.SCHEDULED, index: true },
    // Set once stock has been pushed into Redis for this sale.
    stockLoadedAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    items: { type: [saleItemSchema], default: [] },
  },
  { timestamps: true }
);

flashSaleSchema.methods.computedStatus = function computedStatus(now = new Date()) {
  if (now < this.startAt) return SALE_STATUS.SCHEDULED;
  if (now >= this.endAt) return SALE_STATUS.ENDED;
  return SALE_STATUS.LIVE;
};

export const FlashSale = mongoose.model('FlashSale', flashSaleSchema);
