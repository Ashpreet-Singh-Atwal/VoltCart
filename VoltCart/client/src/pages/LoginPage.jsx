import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart, readGuestCart, clearGuestCart } from '../context/CartContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

export default function LoginPage() {
  const { login } = useAuth();
  const { refresh } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      // The guest cart travels with the login request and is merged server-side.
      await login({ ...form, guestCart: readGuestCart() });
      clearGuestCart();
      await refresh();
      toast.success('Welcome back!');
      navigate(location.state?.from ?? '/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page page--center">
      <form className="auth-card" onSubmit={onSubmit}>
        <h1>Login</h1>
        <p className="muted">Login to checkout and track your orders.</p>

        {error && <div className="alert alert--error">{error}</div>}

        <label className="field">
          <span>Email</span>
          <input type="email" name="email" value={form.email} onChange={onChange} required autoComplete="email" />
        </label>

        <label className="field">
          <span>Password</span>
          <input type="password" name="password" value={form.password} onChange={onChange} required autoComplete="current-password" />
        </label>

        <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
          {busy ? 'Logging in…' : 'Login'}
        </button>

        <p className="auth-card__switch">
          New to VoltCart? <Link to="/register" state={location.state}>Create an account</Link>
        </p>
      </form>
    </div>
  );
}
