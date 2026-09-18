import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useToast } from '../../context/ToastContext.jsx';

const EMPTY = {
  name: '', brand: '', category: '', image: '', price: '', stock: '',
  description: '', highlights: '', gallery: '', isActive: true,
};

const toLines = (text) => text.split('\n').map((s) => s.trim()).filter(Boolean);

export default function AdminProductFormPage() {
  const { productId } = useParams();
  const isEdit = Boolean(productId);
  const navigate = useNavigate();
  const toast = useToast();

  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(isEdit);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    if (!isEdit) return;
    api.get(`/admin/products/${productId}`)
      .then(({ product }) => setForm({
        name: product.name,
        brand: product.brand,
        category: product.category,
        image: product.image,
        price: String(product.price),
        stock: String(product.stock),
        description: product.description,
        highlights: (product.highlights ?? []).join('\n'),
        gallery: (product.gallery ?? []).join('\n'),
        isActive: product.isActive,
      }))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [isEdit, productId]);

  const onChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFieldErrors({});

    const payload = {
      name: form.name.trim(),
      brand: form.brand.trim(),
      category: form.category.trim(),
      image: form.image.trim(),
      gallery: toLines(form.gallery),
      price: Number(form.price),
      stock: Number(form.stock),
      description: form.description.trim(),
      highlights: toLines(form.highlights),
      isActive: form.isActive,
    };

    try {
      if (isEdit) await api.put(`/admin/products/${productId}`, payload);
      else await api.post('/admin/products', payload);
      toast.success(isEdit ? 'Product updated' : 'Product added');
      navigate('/admin');
    } catch (err) {
      setError(err.message);
      setFieldErrors(err.details ?? {});
    } finally {
      setBusy(false);
    }
  };

  const fieldError = (name) => fieldErrors[name]?.[0];

  if (loading) return <div className="page page--center"><div className="spinner" /></div>;

  return (
    <div className="page">
      <div className="page__head">
        <h1 className="page__title">{isEdit ? 'Edit product' : 'Add product'}</h1>
        <Link to="/admin" className="btn btn--ghost">Back to dashboard</Link>
      </div>

      <form className="panel form-panel" onSubmit={onSubmit}>
        {error && <div className="alert alert--error">{error}</div>}

        <div className="field-row">
          <label className="field">
            <span>Product name</span>
            <input name="name" value={form.name} onChange={onChange} required />
            {fieldError('name') && <em>{fieldError('name')}</em>}
          </label>
          <label className="field">
            <span>Brand</span>
            <input name="brand" value={form.brand} onChange={onChange} required />
            {fieldError('brand') && <em>{fieldError('brand')}</em>}
          </label>
          <label className="field">
            <span>Category</span>
            <input name="category" value={form.category} onChange={onChange} placeholder="Audio, Power, Desk…" required />
            {fieldError('category') && <em>{fieldError('category')}</em>}
          </label>
        </div>

        <div className="field-row">
          <label className="field">
            <span>Price (₹)</span>
            <input type="number" name="price" value={form.price} onChange={onChange} min="1" step="1" required />
            {fieldError('price') && <em>{fieldError('price')}</em>}
          </label>
          <label className="field">
            <span>Stock quantity</span>
            <input type="number" name="stock" value={form.stock} onChange={onChange} min="0" step="1" required />
            {fieldError('stock') && <em>{fieldError('stock')}</em>}
          </label>
        </div>

        <label className="field">
          <span>Main image URL</span>
          <input name="image" value={form.image} onChange={onChange} placeholder="https://…" required />
          {fieldError('image') && <em>{fieldError('image')}</em>}
        </label>

        {form.image && (
          <div className="image-preview">
            <img src={form.image} alt="Preview" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            <span className="muted">Image preview</span>
          </div>
        )}

        <label className="field">
          <span>Extra image URLs <span className="muted">(one per line, optional)</span></span>
          <textarea name="gallery" value={form.gallery} onChange={onChange} rows={2} />
        </label>

        <label className="field">
          <span>Description</span>
          <textarea name="description" value={form.description} onChange={onChange} rows={4} required minLength={10} />
          {fieldError('description') && <em>{fieldError('description')}</em>}
        </label>

        <label className="field">
          <span>Key points <span className="muted">(one per line)</span></span>
          <textarea name="highlights" value={form.highlights} onChange={onChange} rows={5} placeholder={'40 hour battery\nBluetooth 5.3\n1 year warranty'} />
          {fieldError('highlights') && <em>{fieldError('highlights')}</em>}
        </label>

        <label className="field field--check">
          <input type="checkbox" name="isActive" checked={form.isActive} onChange={onChange} />
          <span>Visible to customers</span>
        </label>

        <div className="form-actions">
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Add product'}
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => navigate('/admin')}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
