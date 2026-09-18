import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, money } from '../../api/client.js';

const Stat = ({ label, value, hint }) => (
  <div className="stat">
    <span className="stat__label">{label}</span>
    <strong className="stat__value">{value}</strong>
    {hint && <span className="stat__hint">{hint}</span>}
  </div>
);

export default function AdminDashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/dashboard')
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page page--center"><div className="spinner" /></div>;

  const { summary, products } = data;

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1 className="page__title">Dashboard</h1>
          <p className="muted">Everything you have listed on VoltCart.</p>
        </div>
        <div className="form-actions">
          <Link to="/admin/products/new" className="btn btn--primary">+ Add product</Link>
          <Link to="/admin/sales/new" className="btn btn--ghost">Create sale</Link>
        </div>
      </div>

      <div className="stat-grid">
        <Stat label="Total earned" value={money(summary.totalRevenue)} hint={`${summary.unitsSold} units sold`} />
        <Stat label="Products listed" value={summary.totalProducts} />
        <Stat label="Sold out" value={summary.soldOutProducts} hint="zero stock left" />
        <Stat label="Live sales" value={summary.liveSales} />
      </div>

      <section className="section">
        <div className="section__head">
          <h2>My products</h2>
          <p>Stock, sales and revenue for each listing.</p>
        </div>

        {products.length === 0 ? (
          <div className="empty panel">
            <h2>No products yet</h2>
            <p>Add your first product and it will appear on the storefront right away.</p>
            <Link to="/admin/products/new" className="btn btn--primary">Add product</Link>
          </div>
        ) : (
          <div className="table-wrap panel">
            <table className="table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Price</th>
                  <th>Total qty</th>
                  <th>Remaining</th>
                  <th>Sold</th>
                  <th>Revenue</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p._id}>
                    <td>
                      <div className="table__product">
                        <img src={p.image} alt={p.name} />
                        <div>
                          <strong>{p.name}</strong>
                          <span className="muted">{p.brand} · {p.category}</span>
                        </div>
                      </div>
                    </td>
                    <td>{money(p.price)}</td>
                    <td>{p.totalQuantity}</td>
                    <td className={p.remainingQuantity === 0 ? 'cell--danger' : ''}>{p.remainingQuantity}</td>
                    <td>{p.unitsSold}</td>
                    <td>{money(p.revenue)}</td>
                    <td>
                      <span className={`chip ${p.isActive ? 'chip--primary' : ''}`}>
                        {p.isActive ? 'Visible' : 'Hidden'}
                      </span>
                    </td>
                    <td><Link to={`/admin/products/${p._id}/edit`} className="link-btn">Edit</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
