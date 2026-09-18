import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { api, money } from '../api/client.js';
import { useCart } from '../context/CartContext.jsx';
import { useSale } from '../context/SaleContext.jsx';

export default function PaymentPage() {
  const { orderId } = useParams();
  const { state } = useLocation();
  const { refresh: refreshCart } = useCart();
  const { refresh: refreshSale } = useSale();

  const [phase, setPhase] = useState('processing'); // processing | success | failed
  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null);
  const started = useRef(false);

  useEffect(() => {
    // Runs exactly once per order. No cleanup on purpose: React StrictMode
    // remounts effects in dev and cancelling the timer here would strand the
    // customer on the spinner forever.
    if (started.current) return;
    started.current = true;

    const isCod = state?.paymentMethod === 'COD';
    // COD settles immediately; card/UPI gets the fake gateway spinner.
    const delay = isCod ? 300 : 2500;

    setTimeout(async () => {
      try {
        const { order: settled } = await api.post(`/payments/${orderId}/confirm`, { success: true });
        setOrder(settled);
        setPhase('success');
        await Promise.all([refreshCart(), refreshSale()]);
      } catch (err) {
        setError(err.message);
        setPhase('failed');
        await Promise.all([refreshCart(), refreshSale()]);
      }
    }, delay);
  }, [orderId, state, refreshCart, refreshSale]);

  if (phase === 'processing') {
    return (
      <div className="page page--center">
        <div className="payment">
          <div className="spinner spinner--lg" />
          <h2>Processing your payment…</h2>
          <p className="muted">Do not refresh or press back.</p>
        </div>
      </div>
    );
  }

  if (phase === 'failed') {
    return (
      <div className="page page--center">
        <div className="payment payment--failed">
          <div className="payment__mark">✕</div>
          <h2>Payment could not be completed</h2>
          <p className="muted">{error}</p>
          <Link to="/cart" className="btn btn--primary">Back to cart</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page page--center">
      <div className="payment payment--success">
        <div className="payment__mark">✓</div>
        <h2>Order successful</h2>
        <p className="muted">Order {order.orderNumber} · {money(order.pricing.total)}</p>
        <p className="muted">
          {order.paymentMethod === 'COD' ? 'Pay in cash when your order arrives.' : 'Payment received.'}
        </p>
        <div className="payment__actions">
          <Link to="/orders" className="btn btn--primary">Track my order</Link>
          <Link to="/" className="btn btn--ghost">Continue shopping</Link>
        </div>
      </div>
    </div>
  );
}
