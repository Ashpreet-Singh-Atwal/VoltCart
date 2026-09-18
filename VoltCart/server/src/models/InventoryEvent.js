import mongoose from 'mongoose';

/**
 * Append-only ledger of Redis stream messages that were already applied to
 * MongoDB. The stream message id is used as the _id, so a duplicate delivery
 * (Redis streams are at-least-once) fails with E11000 and is skipped.
 */
const inventoryEventSchema = new mongoose.Schema(
  {
    _id: { type: String }, // redis stream message id, e.g. "1717171717171-0"
    type: { type: String, required: true },
    saleId: { type: String, required: true },
    reservationId: { type: String, default: null },
    userId: { type: String, default: null },
    items: { type: Array, default: [] },
    appliedAt: { type: Date, default: Date.now },
  },
  { _id: false, versionKey: false }
);

export const InventoryEvent = mongoose.model('InventoryEvent', inventoryEventSchema);
