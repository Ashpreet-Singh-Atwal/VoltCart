import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';

export default function Header() {
  const { user, isAuthed, logout } = useAuth();
  const { count, refresh } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  const isAdmin = user?.role === 'ADMIN';

  const handleLogout = async () => {
    await logout();
    setMenuOpen(false);
    await refresh();
    navigate('/');
  };

  return (
    <header className="header">
      <div className="header__inner">
        <Link to={isAdmin ? '/admin' : '/'} className="brand">
          <span className="brand__bolt" aria-hidden="true">⚡</span>
          <span className="brand__name">VoltCart</span>
          {isAdmin && <span className="brand__tag">Admin</span>}
        </Link>

        <nav className="header__actions">
          {isAdmin && (
            <div className="header__links">
              <NavLink to="/admin" end className="header__link">Dashboard</NavLink>
              <NavLink to="/admin/sales" className="header__link">Sales</NavLink>
            </div>
          )}

          {isAuthed ? (
            <div className="menu">
              <button type="button" className="btn btn--ghost" onClick={() => setMenuOpen((v) => !v)}>
                {user.fullName.split(' ')[0]} ▾
              </button>
              {menuOpen && (
                <div className="menu__panel" onMouseLeave={() => setMenuOpen(false)}>
                  <NavLink to="/profile" onClick={() => setMenuOpen(false)}>My Profile</NavLink>
                  {isAdmin ? (
                    <>
                      <NavLink to="/admin" onClick={() => setMenuOpen(false)}>Dashboard</NavLink>
                      <NavLink to="/admin/sales" onClick={() => setMenuOpen(false)}>Sales</NavLink>
                    </>
                  ) : (
                    <>
                      <NavLink to="/orders" onClick={() => setMenuOpen(false)}>My Orders</NavLink>
                      <NavLink to="/addresses" onClick={() => setMenuOpen(false)}>Addresses</NavLink>
                    </>
                  )}
                  <button type="button" onClick={handleLogout}>Logout</button>
                </div>
              )}
            </div>
          ) : (
            <Link to="/login" className="btn btn--ghost">Login / Register</Link>
          )}

          {!isAdmin && (
            <Link to="/cart" className="cart-btn" aria-label="Open cart">
              🛒
              {count > 0 && <span className="cart-btn__count">{count}</span>}
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
