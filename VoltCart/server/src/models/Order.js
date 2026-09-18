import mongoose from 'mongoose';

export const ORDER_STATUS = {
  PENDING_PAYMENT: 'PENDING_PAYMENT',
  ORDER_TAKEN: 'ORDER_TAKEN',
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
};

export const PAYMENT_METHOD = {
  CARD: 'CARD',
  UPI: 'UPI',
  COD: 'COD',
};

export const PAYMENT_STATUS = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  FAILED: 'FAILED',
  COD_PENDING: 'COD_PENDING',
};

const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: String,
    brand: String,
    image: String,
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    originalPrice: { type: Number, required: true, min: 0 },
    isFlashSale: { type: Boolean, default: false },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    items: { type: [orderItemSchema], default: [] },
    shippingAddress: { type: Object, required: true },
    pricing: {
      subtotal: { type: Number, required: true },
      discount: { type: Number, required: true },
      deliveryFee: { type: Number, required: true, default: 0 },
      total: { type: Number, required: true },
    },
    paymentMethod: { type: String, enum: Object.values(PAYMENT_METHOD), required: true },
    paymentStatus: { type: String, enum: Object.values(PAYMENT_STATUS), default: PAYMENT_STATUS.PENDING },
    status: { type: String, enum: Object.values(ORDER_STATUS), default: ORDER_STATUS.PENDING_PAYMENT, index: true },
    sale: { type: mongoose.Schema.Types.ObjectId, ref: 'FlashSale', default: null },
    reservationId: { type: String, default: null, index: true },
    // Demo delivery simulation timestamps.
    timeline: {
      placedAt: { type: Date, default: null },
      outForDeliveryAt: { type: Date, default: null },
      deliveredAt: { type: Date, default: null },
      cancelledAt: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

export const Order = mongoose.model('Order', orderSchema);
