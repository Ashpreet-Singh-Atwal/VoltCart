import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, money } from '../../api/client.js';
import { useToast } from '../../context/ToastContext.jsx';

const pad = (n) => String(n).padStart(2, '0');

/** <input type="datetime-local"> needs local wall-clock time, not an ISO string. */
const toLocalInput = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const defaultStart = () => toLocalInput(new Date(Date.now() + 10 * 60 * 1000));
const defaultEnd = () => toLocalInput(new Date(Date.now() + 40 * 60 * 1000));

export default function AdminSaleFormPage() {
  const { saleId } = useParams();
  const isEdit = Boolean(saleId);
  const navigate = useNavigate();
  const toast = useToast();

  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({ title: '', tagline: '', startAt: defaultStart(), endAt: defaultEnd() });
  // productId -> { salePrice, totalQuantity, maxPerUser }
  const [picked, setPicked] = useState({});
  const [saleStatus, setSaleStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      const { products: list } = await api.get('/admin/products');
      setProducts(list);

      if (isEdit) {
        const { sale } = await api.get(`/admin/sales/${saleId}`);
        setForm({
          title: sale.title,
          tagline: sale.tagline ?? '',
          startAt: toLocalInput(sale.startAt),
          endAt: toLocalInput(sale.endAt),
        });
        setSaleStatus(sale.status);
        setPicked(Object.fromEntries(sale.items.map((i) => [
          String(i.product),
          { salePrice: String(i.salePrice), totalQuantity: String(i.totalQuantity), maxPerUser: String(i.maxPerUser) },
        ])));
      }
    };
    load().catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, [isEdit, saleId]);

  const isLive = saleStatus === 'LIVE';

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const toggle = (product) => {
    setPicked((p) => {
      if (p[product._id]) {
        const next = { ...p };
        delete next[product._id];
        return next;
      }
      return {
        ...p,
        [product._id]: {
          salePrice: String(Math.max(1, Math.round(product.price * 0.7))),
          totalQuantity: '10',
          maxPerUser: '2',
        },
      };
    });
  };

  const setLine = (productId, key, value) =>
    setPicked((p) => ({ ...p, [productId]: { ...p[productId], [key]: value } }));

  const selected = useMemo(() => Object.keys(picked), [picked]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (selected.length === 0) {
      setError('Pick at least one product for the sale.');
      return;
    }

    const payload = {
      title: form.title.trim(),
      tagline: form.tagline.trim(),
      startAt: new Date(form.startAt).toISOString(),
      endAt: new Date(form.endAt).toISOString(),
      items: selected.map((productId) => ({
        productId,
        salePrice: Number(picked[productId].salePrice),
        totalQuantity: Number(picked[productId].totalQuantity),
        maxPerUser: Number(picked[productId].maxPerUser),
      })),
    };

    setBusy(true);
    try {
      if (isEdit) await api.put(`/admin/sales/${saleId}`, payload);
      else await api.post('/admin/sales', payload);
      toast.success(isEdit ? 'Sale updated' : 'Sale created');
      navigate('/admin/sales');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="page page--center"><div className="spinner" /></div>;

  return (
    <div className="page">
      <div className="page__head">
        <h1 className="page__title">{isEdit ? 'Edit sale' : 'Create sale'}</h1>
        <Link to="/admin/sales" className="btn btn--ghost">Back to sales</Link>
      </div>

      {isLive && (
        <div className="hold-bar">
          <span>
            This sale is <strong>LIVE</strong>. Customers already hold stock, so products cannot be added or
            removed and quantities can only go up. Price, limit and end time are still editable.
          </span>
        </div>
      )}

      <form className="panel form-panel" onSubmit={onSubmit}>
        {error && <div className="alert alert--error">{error}</div>}

        <label className="field">
          <span>Sale title</span>
          <input name="title" value={form.title} onChange={onChange} placeholder="VoltCart Lightning Hour" required />
        </label>

        <label className="field">
          <span>Tagline <span className="muted">(optional)</span></span>
          <input name="tagline" value={form.tagline} onChange={onChange} placeholder="Charged up. Priced down." />
        </label>

        <div className="field-row">
          <label className="field">
            <span>Starts at</span>
            <input type="datetime-local" name="startAt" value={form.startAt} onChange={onChange} disabled={isLive} required />
          </label>
          <label className="field">
            <span>Ends at</span>
            <input type="datetime-local" name="endAt" value={form.endAt} onChange={onChange} required />
          </label>
        </div>

        <h2 className="form-panel__heading">Products in this sale</h2>

        {products.length === 0 ? (
          <p className="muted">You have no products yet. <Link to="/admin/products/new" className="link-btn">Add one first</Link>.</p>
        ) : (
          <div className="sale-picker">
            {products.map((product) => {
              const line = picked[product._id];
              return (
                <div key={product._id} className={`sale-picker__row ${line ? 'sale-picker__row--on' : ''}`}>
                  <label className="sale-picker__pick">
                    <input
                      type="checkbox"
                      checked={Boolean(line)}
                      onChange={() => toggle(product)}
                      disabled={isLive}
                    />
                    <img src={product.image} alt={product.name} />
                    <div>
                      <strong>{product.name}</strong>
                      <span className="muted">{money(product.price)} · {product.stock} in stock</span>
                    </div>
                  </label>

                  {line && (
                    <div className="sale-picker__fields">
                      <label className="field">
                        <span>Sale price (₹)</span>
                        <input
                          type="number" min="1" step="1" required
                          value={line.salePrice}
                          onChange={(e) => setLine(product._id, 'salePrice', e.target.value)}
                        />
                      </label>
                      <label className="field">
                        <span>Units in sale</span>
                        <input
                          type="number" min="1" step="1" required
                          value={line.totalQuantity}
                          onChange={(e) => setLine(product._id, 'totalQuantity', e.target.value)}
                        />
                      </label>
                      <label className="field">
                        <span>Max per customer</span>
                        <input
                          type="number" min="1" max="20" step="1" required
                          value={line.maxPerUser}
                          onChange={(e) => setLine(product._id, 'maxPerUser', e.target.value)}
                        />
                      </label>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="form-actions">
          <button type="submit" className="btn btn--primary" disabled={busy || products.length === 0}>
            {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Create sale'}
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => navigate('/admin/sales')}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
