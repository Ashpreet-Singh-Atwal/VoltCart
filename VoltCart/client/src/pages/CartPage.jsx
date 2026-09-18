import { Link, useNavigate } from 'react-router-dom';
import { money } from '../api/client.js';
import QuantityStepper from '../components/QuantityStepper.jsx';
import { useCart } from '../context/CartContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

export default function CartPage() {
  const { lines, pricing, loading, setItem, removeItem } = useCart();
  const { isAuthed } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const handleCheckout = () => {
    if (!isAuthed) {
      toast.info('Please login to checkout');
      navigate('/login', { state: { from: '/checkout' } });
      return;
    }
    navigate('/checkout');
  };

  if (loading) return <div className="page page--center"><div className="spinner" /></div>;

  if (!lines.length) {
    return (
      <div className="page page--center">
        <div className="empty">
          <h2>Your cart is empty</h2>
          <p>Deals do not wait. Grab something before the timer runs out.</p>
          <Link to="/" className="btn btn--primary">Continue shopping</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <h1 className="page__title">Your cart</h1>

      <div className="cart-layout">
        <div className="cart-lines">
          {lines.map((line) => (
            <div key={line.productId} className="cart-line">
              <img src={line.image} alt={line.name} />
              <div className="cart-line__info">
                <span className="cart-line__brand">{line.brand}</span>
                <Link to={`/product/${line.slug}`} className="cart-line__name">{line.name}</Link>
                {line.isFlashSale && <span className="badge badge--deal">Flash sale price</span>}
                <div className="cart-line__price">
                  <strong>{money(line.unitPrice)}</strong>
                  {line.isFlashSale && <span className="cart-line__mrp">{money(line.originalPrice)}</span>}
                </div>
              </div>
              <div className="cart-line__actions">
                <QuantityStepper
                  value={line.quantity}
                  min={1}
                  max={line.maxPerUser ? Math.min(line.maxPerUser, Math.max(1, line.available)) : 10}
                  onChange={(q) => setItem(line.productId, q).catch((e) => toast.error(e.message))}
                />
                <button type="button" className="link-btn" onClick={() => removeItem(line.productId)}>Remove</button>
                <strong className="cart-line__total">{money(line.lineTotal)}</strong>
              </div>
            </div>
          ))}
        </div>

        <aside className="summary">
          <h2>Order summary</h2>
          <div className="summary__row"><span>Subtotal</span><span>{money(pricing.subtotal)}</span></div>
          <div className="summary__row summary__row--save"><span>Discount</span><span>− {money(pricing.discount)}</span></div>
          <div className="summary__row"><span>Delivery</span><span className="free">FREE</span></div>
          <div className="summary__row summary__row--total"><span>Total</span><span>{money(pricing.total)}</span></div>
          <button type="button" className="btn btn--primary btn--lg btn--block" onClick={handleCheckout}>
            Checkout
          </button>
          <p className="summary__note">Flash-sale items are reserved for 3 minutes once you checkout.</p>
        </aside>
      </div>
    </div>
  );
}
