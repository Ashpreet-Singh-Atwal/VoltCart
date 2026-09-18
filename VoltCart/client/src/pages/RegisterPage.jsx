import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart, readGuestCart, clearGuestCart } from '../context/CartContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

const EMPTY = { fullName: '', email: '', phone: '', password: '', confirmPassword: '', role: 'BUYER', acceptTnc: false };

export default function RegisterPage() {
  const { register } = useAuth();
  const { refresh } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const onChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    if (form.password !== form.confirmPassword) {
      setFieldErrors({ confirmPassword: ['Passwords do not match'] });
      return;
    }

    setBusy(true);
    try {
      const me = await register({ ...form, guestCart: readGuestCart() });
      clearGuestCart();
      await refresh();
      toast.success('Account created');
      const home = me.role === 'ADMIN' ? '/admin' : '/';
      navigate(me.role === 'ADMIN' ? home : (location.state?.from ?? home), { replace: true });
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
      <form className="auth-card" onSubmit={onSubmit}>
        <h1>Create your account</h1>
        <p className="muted">It takes less than a minute.</p>

        {error && <div className="alert alert--error">{error}</div>}

        <div className="field">
          <span>I am registering as</span>
          <div className="role-pick">
            {[
              { value: 'BUYER', label: 'Buyer', hint: 'Shop the flash sales' },
              { value: 'ADMIN', label: 'Admin', hint: 'List products and run sales' },
            ].map((option) => (
              <label key={option.value} className={`role-pick__option ${form.role === option.value ? 'role-pick__option--active' : ''}`}>
                <input
                  type="radio"
                  name="role"
                  value={option.value}
                  checked={form.role === option.value}
                  onChange={onChange}
                />
                <span>
                  <strong>{option.label}</strong>
                  <em>{option.hint}</em>
                </span>
              </label>
            ))}
          </div>
        </div>

        <label className="field">
          <span>Full name</span>
          <input name="fullName" value={form.fullName} onChange={onChange} required />
          {fieldError('fullName') && <em>{fieldError('fullName')}</em>}
        </label>

        <label className="field">
          <span>Email</span>
          <input type="email" name="email" value={form.email} onChange={onChange} required />
          {fieldError('email') && <em>{fieldError('email')}</em>}
        </label>

        <label className="field">
          <span>Phone number</span>
          <input name="phone" value={form.phone} onChange={onChange} maxLength={10} required />
          {fieldError('phone') && <em>{fieldError('phone')}</em>}
        </label>

        <label className="field">
          <span>Password</span>
          <input type="password" name="password" value={form.password} onChange={onChange} required minLength={8} />
          {fieldError('password') && <em>{fieldError('password')}</em>}
        </label>

        <label className="field">
          <span>Confirm password</span>
          <input type="password" name="confirmPassword" value={form.confirmPassword} onChange={onChange} required />
          {fieldError('confirmPassword') && <em>{fieldError('confirmPassword')}</em>}
        </label>

        <label className="field field--check">
          <input type="checkbox" name="acceptTnc" checked={form.acceptTnc} onChange={onChange} required />
          <span>I accept the terms and conditions</span>
        </label>

        <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
          {busy ? 'Creating account…' : 'Register'}
        </button>

        <p className="auth-card__switch">
          Already have an account? <Link to="/login" state={location.state}>Login</Link>
        </p>
      </form>
    </div>
  );
}
