import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

export default function ProfilePage() {
  const { user, setUser } = useAuth();
  const toast = useToast();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ fullName: user.fullName, phone: user.phone });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '' });
  const [busy, setBusy] = useState(false);

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  const onPasswordChange = (e) => setPasswordForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const saveProfile = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { user: updated } = await api.patch('/auth/profile', form);
      setUser(updated);
      setEditing(false);
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.patch('/auth/password', passwordForm);
      setPasswordForm({ currentPassword: '', newPassword: '' });
      toast.success('Password changed');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <h1 className="page__title">My profile</h1>

      <div className="profile-layout">
        <section className="panel">
          <div className="panel__head">
            <h2>Account details</h2>
            {!editing && <button type="button" className="link-btn" onClick={() => setEditing(true)}>Edit</button>}
          </div>

          {editing ? (
            <form onSubmit={saveProfile}>
              <label className="field">
                <span>Full name</span>
                <input name="fullName" value={form.fullName} onChange={onChange} required />
              </label>
              <label className="field">
                <span>Phone number</span>
                <input name="phone" value={form.phone} onChange={onChange} maxLength={10} required />
              </label>
              <label className="field">
                <span>Email (cannot be changed)</span>
                <input value={user.email} disabled />
              </label>
              <div className="form-actions">
                <button type="submit" className="btn btn--primary" disabled={busy}>Save changes</button>
                <button type="button" className="btn btn--ghost" onClick={() => setEditing(false)}>Cancel</button>
              </div>
            </form>
          ) : (
            <dl className="detail-list">
              <div><dt>Name</dt><dd>{user.fullName}</dd></div>
              <div><dt>Email</dt><dd>{user.email}</dd></div>
              <div><dt>Phone</dt><dd>{user.phone}</dd></div>
              <div><dt>Member since</dt><dd>{new Date(user.createdAt).toLocaleDateString()}</dd></div>
            </dl>
          )}
        </section>

        <section className="panel">
          <h2>Change password</h2>
          <form onSubmit={savePassword}>
            <label className="field">
              <span>Current password</span>
              <input type="password" name="currentPassword" value={passwordForm.currentPassword} onChange={onPasswordChange} required />
            </label>
            <label className="field">
              <span>New password</span>
              <input type="password" name="newPassword" value={passwordForm.newPassword} onChange={onPasswordChange} minLength={8} required />
            </label>
            <button type="submit" className="btn btn--primary" disabled={busy}>Update password</button>
          </form>
        </section>

        <section className="panel">
          <h2>Quick links</h2>
          <div className="quick-links">
            <Link to="/orders" className="btn btn--ghost btn--block">My orders</Link>
            <Link to="/addresses" className="btn btn--ghost btn--block">My addresses</Link>
          </div>
        </section>
      </div>
    </div>
  );
}
