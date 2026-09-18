import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, money } from '../../api/client.js';

const STATUS_LABEL = { SCHEDULED: 'Scheduled', LIVE: 'Live now', ENDED: 'Ended' };

export default function AdminSalesPage() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = () => api.get('/admin/sales').then(({ sales: list }) => setSales(list));
    load().finally(() => setLoading(false));
    const id = setInterval(load, 10000); // live counters move while a sale runs
    return () => clearInterval(id);
  }, []);

  if (loading) return <div className="page page--center"><div className="spinner" /></div>;

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1 className="page__title">Sales</h1>
          <p className="muted">Every flash sale you have scheduled, and how it performed.</p>
        </div>
        <Link to="/admin/sales/new" className="btn btn--primary">+ Create sale</Link>
      </div>

      {sales.length === 0 ? (
        <div className="empty panel">
          <h2>No sales yet</h2>
          <p>Schedule a flash sale and it will appear on the storefront with a live countdown.</p>
          <Link to="/admin/sales/new" className="btn btn--primary">Create sale</Link>
        </div>
      ) : (
        <div className="orders">
          {sales.map((sale) => (
            <article key={sale._id} className="order">
              <header className="order__head">
                <div>
                  <strong>{sale.title}</strong>
                  <span className="muted"> · {new Date(sale.startAt).toLocaleString()} → {new Date(sale.endAt).toLocaleString()}</span>
                </div>
                <div className="order__meta">
                  <span className={`chip chip--${sale.status.toLowerCase()}`}>{STATUS_LABEL[sale.status]}</span>
                  <Link to={`/admin/sales/${sale._id}/edit`} className="link-btn">Edit</Link>
                </div>
              </header>

              <div className="stat-grid stat-grid--compact">
                <div className="stat"><span className="stat__label">Revenue</span><strong className="stat__value">{money(sale.revenue)}</strong></div>
                <div className="stat"><span className="stat__label">Units sold</span><strong className="stat__value">{sale.unitsSold}</strong></div>
                <div className="stat"><span className="stat__label">Units left</span><strong className="stat__value">{sale.unitsLeft}</strong></div>
                <div className="stat"><span className="stat__label">Sell-through</span><strong className="stat__value">{sale.sellThroughPercent}%</strong></div>
                <div className="stat"><span className="stat__label">Orders</span><strong className="stat__value">{sale.orderCount}</strong></div>
              </div>

              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Sale price</th>
                      <th>MRP</th>
                      <th>Offered</th>
                      <th>Sold</th>
                      <th>Left</th>
                      <th>Max/user</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sale.items.map((item) => (
                      <tr key={item.productId}>
                        <td>
                          <div className="table__product">
                            <img src={item.image} alt={item.name} />
                            <strong>{item.name}</strong>
                          </div>
                        </td>
                        <td>{money(item.salePrice)}</td>
                        <td className="muted">{money(item.originalPrice)}</td>
                        <td>{item.totalQuantity}</td>
                        <td>{item.soldQuantity}</td>
                        <td className={item.availableStock === 0 ? 'cell--danger' : ''}>{item.availableStock}</td>
                        <td>{item.maxPerUser}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
