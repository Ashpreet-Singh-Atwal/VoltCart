import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';

const EMPTY = {
  label: 'Home', fullName: '', phone: '', line1: '', line2: '',
  city: '', state: '', pincode: '', isDefault: false,
};

export default function AddAddressPage() {
  const [form, setForm] = useState(EMPTY);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  const onChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      await api.post('/addresses', form);
      toast.success('Address saved');
      navigate(-1);
    } catch (err) {
      setError(err.message);
      setFieldErrors(err.details ?? {});
    } finally {
      setBusy(false);
    }
  };

  const fieldError = (name) => fieldErrors[name]?.[0];

  return (
    <div className="page page--center">
      <form className="auth-card auth-card--wide" onSubmit={onSubmit}>
        <h1>Add a new address</h1>
        {error && <div className="alert alert--error">{error}</div>}

        <div className="field-row">
          <label className="field">
            <span>Label</span>
            <select name="label" value={form.label} onChange={onChange}>
              <option>Home</option><option>Work</option><option>Other</option>
            </select>
          </label>
          <label className="field">
            <span>Full name</span>
            <input name="fullName" value={form.fullName} onChange={onChange} required />
            {fieldError('fullName') && <em>{fieldError('fullName')}</em>}
          </label>
        </div>

        <label className="field">
          <span>Phone number</span>
          <input name="phone" value={form.phone} onChange={onChange} maxLength={10} required />
          {fieldError('phone') && <em>{fieldError('phone')}</em>}
        </label>

        <label className="field">
          <span>Address line 1</span>
          <input name="line1" value={form.line1} onChange={onChange} required />
          {fieldError('line1') && <em>{fieldError('line1')}</em>}
        </label>

        <label className="field">
          <span>Address line 2 (optional)</span>
          <input name="line2" value={form.line2} onChange={onChange} />
        </label>

        <div className="field-row">
          <label className="field">
            <span>City</span>
            <input name="city" value={form.city} onChange={onChange} required />
            {fieldError('city') && <em>{fieldError('city')}</em>}
          </label>
          <label className="field">
            <span>State</span>
            <input name="state" value={form.state} onChange={onChange} required />
            {fieldError('state') && <em>{fieldError('state')}</em>}
          </label>
          <label className="field">
            <span>Pincode</span>
            <input name="pincode" value={form.pincode} onChange={onChange} maxLength={6} required />
            {fieldError('pincode') && <em>{fieldError('pincode')}</em>}
          </label>
        </div>

        <label className="field field--check">
          <input type="checkbox" name="isDefault" checked={form.isDefault} onChange={onChange} />
          <span>Make this my default address</span>
        </label>

        <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
          {busy ? 'Saving…' : 'Save address'}
        </button>
      </form>
    </div>
  );
}
