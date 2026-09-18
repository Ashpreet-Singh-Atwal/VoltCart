import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, money } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';

const STEPS = ['ORDER_TAKEN', 'OUT_FOR_DELIVERY', 'DELIVERED'];
const STEP_LABEL = {
  ORDER_TAKEN: 'Order taken',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
};

function Tracker({ status }) {
  if (status === 'CANCELLED') return <div className="tracker tracker--cancelled">Order cancelled</div>;
  const current = STEPS.indexOf(status);

  return (
    <div className="tracker">
      {STEPS.map((step, index) => (
        <div key={step} className={`tracker__step ${index <= current ? 'tracker__step--done' : ''}`}>
          <span className="tracker__dot" />
          <span className="tracker__label">{STEP_LABEL[step]}</span>
        </div>
      ))}
    </div>
  );
}

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(null);
  const toast = useToast();

  const load = () => api.get('/orders').then(({ orders: list }) => setOrders(list));

  useEffect(() => {
    load().finally(() => setLoading(false));
    const id = setInterval(load, 15000); // statuses advance in the background
    return () => clearInterval(id);
  }, []);

  const handleCancel = async (order) => {
    setCancelling(order._id);
    try {
      await api.post(`/orders/${order._id}/cancel`);
      toast.success(`${order.orderNumber} cancelled. Stock has been released.`);
      await load();
    } catch (err) {
      toast.error(err.message);
      await load();
    } finally {
      setCancelling(null);
    }
  };

  if (loading) return <div className="page page--center"><div className="spinner" /></div>;

  if (!orders.length) {
    return (
      <div className="page page--center">
        <div className="empty">
          <h2>No orders yet</h2>
          <p>Your future purchases will show up here.</p>
          <Link to="/" className="btn btn--primary">Start shopping</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <h1 className="page__title">My orders</h1>

      <div className="orders">
        {orders.map((order) => (
          <article key={order._id} className="order">
            <header className="order__head">
              <div>
                <strong>{order.orderNumber}</strong>
                <span className="muted"> · placed {new Date(order.createdAt).toLocaleString()}</span>
              </div>
              <div className="order__meta">
                <span className="chip">{order.paymentMethod}</span>
                <strong>{money(order.pricing.total)}</strong>
              </div>
            </header>

            <div className="order__items">
              {order.items.map((item) => (
                <div key={item.product} className="order__item">
                  <img src={item.image} alt={item.name} />
                  <div>
                    <strong>{item.name}</strong>
                    <span className="muted">{item.brand} · Qty {item.quantity} · {money(item.unitPrice)}</span>
                    {item.isFlashSale && <span className="badge badge--deal">Flash sale</span>}
                  </div>
                </div>
              ))}
            </div>

            <Tracker status={order.status} />

            <div className="order__foot">
              <p className="muted order__address">
                Shipping to {order.shippingAddress.fullName}, {order.shippingAddress.line1}, {order.shippingAddress.city} - {order.shippingAddress.pincode}
              </p>
              {order.status === 'ORDER_TAKEN' && (
                <button
                  type="button"
                  className="btn btn--danger"
                  onClick={() => handleCancel(order)}
                  disabled={cancelling === order._id}
                >
                  {cancelling === order._id ? 'Cancelling…' : 'Cancel order'}
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
