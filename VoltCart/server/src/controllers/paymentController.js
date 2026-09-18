import { z } from 'zod';
import { redis } from '../config/redis.js';
import { Cart } from '../models/Cart.js';
import { Product } from '../models/Product.js';
import { Order, ORDER_STATUS, PAYMENT_METHOD, PAYMENT_STATUS } from '../models/Order.js';
import { asyncHandler, ApiError } from '../utils/http.js';
import { commitReservation, releaseReservation } from '../services/inventoryService.js';

const confirmSchema = z.object({
  // Demo gateway switch: the UI always sends true, tests can send false.
  success: z.boolean().optional().default(true),
});

const OUT_FOR_DELIVERY_AFTER_MS = 2 * 60 * 1000;
const DELIVERED_AFTER_MS = 5 * 60 * 1000;

/**
 * Final step: the (simulated) gateway result arrives. On success the Redis hold
 * becomes a real sale; on failure the units go straight back to the pool.
 */
export const confirmPayment = asyncHandler(async (req, res) => {
  const { success } = confirmSchema.parse(req.body ?? {});

  const order = await Order.findOne({ _id: req.params.orderId, user: req.user._id });
  if (!order) throw ApiError.notFound('Order not found');

  if (order.status !== ORDER_STATUS.PENDING_PAYMENT) {
    // Idempotent: replaying the payment call returns the settled order.
    return res.json({ order });
  }

  if (!success) {
    if (order.reservationId) {
      await releaseReservation({
        saleId: order.sale.toString(),
        reservationId: order.reservationId,
        reason: 'PAYMENT_FAILED',
      });
      await redis.del(`fs:user-resv:${req.user._id}`);
    }
    for (const item of order.items.filter((i) => !i.isFlashSale)) {
      await Product.updateOne({ _id: item.product }, { $inc: { stock: item.quantity } });
    }
    order.status = ORDER_STATUS.CANCELLED;
    order.paymentStatus = PAYMENT_STATUS.FAILED;
    await order.save();
    throw ApiError.badRequest('Payment failed. Your items were released.', 'PAYMENT_FAILED');
  }

  if (order.reservationId) {
    await commitReservation({
      saleId: order.sale.toString(),
      reservationId: order.reservationId,
      orderId: order._id.toString(),
    });
    await redis.del(`fs:user-resv:${req.user._id}`);
  }

  const now = new Date();
  order.status = ORDER_STATUS.ORDER_TAKEN;
  order.paymentStatus = order.paymentMethod === PAYMENT_METHOD.COD ? PAYMENT_STATUS.COD_PENDING : PAYMENT_STATUS.PAID;
  order.timeline = {
    placedAt: now,
    outForDeliveryAt: new Date(now.getTime() + OUT_FOR_DELIVERY_AFTER_MS),
    deliveredAt: new Date(now.getTime() + DELIVERED_AFTER_MS),
  };
  await order.save();

  // Everything that was bought leaves the cart.
  const purchasedIds = order.items.map((i) => i.product);
  await Cart.updateOne({ user: req.user._id }, { $pull: { items: { product: { $in: purchasedIds } } } });

  res.json({ order });
});
