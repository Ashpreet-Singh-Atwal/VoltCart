import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import * as auth from '../controllers/authController.js';
import * as catalog from '../controllers/catalogController.js';
import * as cart from '../controllers/cartController.js';
import * as address from '../controllers/addressController.js';
import * as checkout from '../controllers/checkoutController.js';
import * as orders from '../controllers/orderController.js';
import * as payments from '../controllers/paymentController.js';
import * as admin from '../controllers/adminController.js';

const router = Router();

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });
const checkoutLimiter = rateLimit({ windowMs: 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });

router.get('/health', (req, res) => res.json({ ok: true, time: new Date() }));

// --- auth ---------------------------------------------------------------
router.post('/auth/register', authLimiter, auth.register);
router.post('/auth/login', authLimiter, auth.login);
router.post('/auth/logout', auth.logout);
router.get('/auth/me', auth.me);
router.patch('/auth/profile', requireAuth, auth.updateProfile);
router.patch('/auth/password', requireAuth, authLimiter, auth.changePassword);

// --- catalogue + sale ---------------------------------------------------
router.get('/products', catalog.listProducts);
router.get('/products/:slug', catalog.getProduct);
router.get('/sale', catalog.getSale);
router.post('/sale/schedule', requireAuth, requireAdmin, catalog.scheduleSale); // demo control
router.post('/sale/reset', requireAuth, requireAdmin, catalog.resetSale);       // demo control

// --- cart ---------------------------------------------------------------
router.post('/cart/price', cart.priceGuestCart);
router.get('/cart', requireAuth, cart.getCart);
router.put('/cart/items', requireAuth, cart.setCartItem);
router.delete('/cart/items/:productId', requireAuth, cart.removeCartItem);
router.delete('/cart', requireAuth, cart.clearCart);

// --- addresses ----------------------------------------------------------
router.get('/addresses', requireAuth, address.listAddresses);
router.post('/addresses', requireAuth, address.addAddress);
router.put('/addresses/:addressId', requireAuth, address.updateAddress);
router.patch('/addresses/:addressId/default', requireAuth, address.setDefaultAddress);
router.delete('/addresses/:addressId', requireAuth, address.deleteAddress);

// --- checkout / reservations -------------------------------------------
router.post('/checkout/reserve', requireAuth, checkoutLimiter, checkout.createReservation);
router.get('/checkout/reservations/:reservationId', requireAuth, checkout.readReservation);
router.post('/checkout/reservations/:reservationId/cancel', requireAuth, checkout.cancelReservation);

// --- orders + payment ---------------------------------------------------
router.post('/orders', requireAuth, checkoutLimiter, orders.createOrder);
router.get('/orders', requireAuth, orders.listOrders);
router.get('/orders/:orderId', requireAuth, orders.getOrder);
router.post('/orders/:orderId/cancel', requireAuth, orders.cancelOrder);
router.post('/payments/:orderId/confirm', requireAuth, checkoutLimiter, payments.confirmPayment);

// --- admin --------------------------------------------------------------
router.use('/admin', requireAuth, requireAdmin);
router.get('/admin/dashboard', admin.getDashboard);
router.get('/admin/products', admin.listProducts);
router.post('/admin/products', admin.createProduct);
router.get('/admin/products/:productId', admin.getProduct);
router.put('/admin/products/:productId', admin.updateProduct);
router.get('/admin/sales', admin.listSales);
router.post('/admin/sales', admin.createSale);
router.get('/admin/sales/:saleId', admin.getSale);
router.put('/admin/sales/:saleId', admin.updateSale);

export default router;
