import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, money } from '../api/client.js';
import { formatDuration } from '../components/Countdown.jsx';
import { useCart } from '../context/CartContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

const PAYMENT_OPTIONS = [
  { id: 'CARD', label: 'Credit / Debit card', hint: 'Visa, Mastercard, RuPay' },
  { id: 'UPI', label: 'UPI', hint: 'GPay, PhonePe, Paytm' },
  { id: 'COD', label: 'Cash on delivery', hint: 'Pay when it arrives' },
];

export default function CheckoutPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { refresh: refreshCart } = useCart();

  const [state, setState] = useState({ loading: true, error: null });
  const [reservation, setReservation] = useState(null);
  const [cart, setCart] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('CARD');
  const [msLeft, setMsLeft] = useState(null);
  const [placing, setPlacing] = useState(false);
  const reserveStarted = useRef(false);

  // Reserving happens exactly once, when the customer lands on checkout.
  // The ref guard matters: React StrictMode runs effects twice in dev, and two
  // reserve calls would leave the page holding an already-replaced reservation.
  useEffect(() => {
    if (reserveStarted.current) return;
    reserveStarted.current = true;

    (async () => {
      try {
        const [{ reservation: held, cart: priced }, { addresses: list }] = await Promise.all([
          api.post('/checkout/reserve', {}),
          api.get('/addresses'),
        ]);

        setReservation(held);
        setCart(priced);
        setAddresses(list);
        setSelectedAddress(list.find((a) => a.isDefault)?._id ?? list[0]?._id ?? null);
        if (held) setMsLeft(held.msRemaining);
        setState({ loading: false, error: null });
      } catch (err) {
        setState({ loading: false, error: err.message });
      }
    })();
  }, []);

  // Local ticker for the hold window; the server is still the real authority.
  useEffect(() => {
    if (msLeft === null) return undefined;
    const id = setInterval(() => {
      setMsLeft((ms) => {
        const next = Math.max(0, ms - 1000);
        if (next === 0) {
          clearInterval(id);
          toast.error('Your reservation expired. The items were released.');
          refreshCart();
          navigate('/cart');
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [msLeft === null, navigate, refreshCart, toast]);

  const releaseAndBack = useCallback(async () => {
    if (reservation) {
      await api.post(`/checkout/reservations/${reservation.reservationId}/cancel`, { saleId: reservation.saleId })
        .catch(() => {});
    }
    await refreshCart();
    navigate('/cart');
  }, [reservation, refreshCart, navigate]);

  const placeOrder = async () => {
    if (!selectedAddress) { toast.error('Add a delivery address first'); return; }
    setPlacing(true);
    try {
      const { order } = await api.post('/orders', {
        addressId: selectedAddress,
        paymentMethod,
        reservationId: reservation?.reservationId ?? null,
        saleId: reservation?.saleId ?? null,
      });
      navigate(`/payment/${order._id}`, { state: { paymentMethod } });
    } catch (err) {
      toast.error(err.message);
      if (['RESERVATION_EXPIRED', 'RESERVATION_MISMATCH'].includes(err.code)) {
        await refreshCart();
        navigate('/cart');
      }
    } finally {
      setPlacing(false);
    }
  };

  const total = useMemo(() => cart?.pricing?.total ?? 0, [cart]);

  if (state.loading) return <div className="page page--center"><div className="spinner" /></div>;

  if (state.error) {
    return (
      <div className="page page--center">
        <div className="empty">
          <h2>Checkout could not start</h2>
          <p>{state.error}</p>
          <Link to="/cart" className="btn btn--primary">Back to cart</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <h1 className="page__title">Checkout</h1>

      {reservation && (
        <div className={`hold-bar ${msLeft < 60000 ? 'hold-bar--urgent' : ''}`}>
          <span>⏳ Your flash-sale items are reserved. Reservation ending in</span>
          <strong>{formatDuration(msLeft ?? 0)}</strong>
        </div>
      )}

      <div className="checkout-layout">
        <div className="checkout-main">
          <section className="panel">
            <div className="panel__head">
              <h2>Delivery address</h2>
              <Link to="/addresses/new" className="link-btn">+ Add new address</Link>
            </div>

            {addresses.length === 0 ? (
              <p className="muted">No addresses yet. Add one to continue.</p>
            ) : (
              <div className="address-list">
                {addresses.map((a) => (
                  <label key={a._id} className={`address ${selectedAddress === a._id ? 'address--active' : ''}`}>
                    <input
                      type="radio"
                      name="address"
                      checked={selectedAddress === a._id}
                      onChange={() => setSelectedAddress(a._id)}
                    />
                    <div>
                      <div className="address__head">
                        <strong>{a.fullName}</strong>
                        <span className="chip">{a.label}</span>
                        {a.isDefault && <span className="chip chip--primary">Default</span>}
                      </div>
                      <p>{a.line1}{a.line2 ? `, ${a.line2}` : ''}, {a.city}, {a.state} - {a.pincode}</p>
                      <p className="muted">Phone: {a.phone}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </section>

          <section className="panel">
            <h2>Order review</h2>
            <div className="review-lines">
              {cart.lines.map((line) => (
                <div key={line.productId} className="review-line">
                  <img src={line.image} alt={line.name} />
                  <div>
                    <strong>{line.name}</strong>
                    <span className="muted">{line.brand} · Qty {line.quantity}</span>
                    {line.isFlashSale && <span className="badge badge--deal">Flash sale</span>}
                  </div>
                  <strong>{money(line.lineTotal)}</strong>
                </div>
              ))}
            </div>
          </section>

          <section className="panel">
            <h2>Payment method</h2>
            <div className="pay-options">
              {PAYMENT_OPTIONS.map((option) => (
                <label key={option.id} className={`pay-option ${paymentMethod === option.id ? 'pay-option--active' : ''}`}>
                  <input
                    type="radio"
                    name="payment"
                    checked={paymentMethod === option.id}
                    onChange={() => setPaymentMethod(option.id)}
                  />
                  <div>
                    <strong>{option.label}</strong>
                    <span className="muted">{option.hint}</span>
                  </div>
                </label>
              ))}
            </div>
          </section>
        </div>

        <aside className="summary">
          <h2>Order summary</h2>
          <div className="summary__row"><span>Subtotal</span><span>{money(cart.pricing.subtotal)}</span></div>
          <div className="summary__row summary__row--save"><span>Discount</span><span>− {money(cart.pricing.discount)}</span></div>
          <div className="summary__row"><span>Delivery</span><span className="free">FREE</span></div>
          <div className="summary__row summary__row--total"><span>Total</span><span>{money(total)}</span></div>

          <button type="button" className="btn btn--primary btn--lg btn--block" onClick={placeOrder} disabled={placing}>
            {placing ? 'Placing order…' : `Pay ${money(total)}`}
          </button>
          <button type="button" className="link-btn link-btn--center" onClick={releaseAndBack}>
            Back to cart (releases your reservation)
          </button>
        </aside>
      </div>
    </div>
  );
}
