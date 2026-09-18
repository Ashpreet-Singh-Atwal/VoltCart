import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function ProtectedRoute({ children, role }) {
  const { isAuthed, user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="page page--center"><div className="spinner" /></div>;
  if (!isAuthed) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  // Send people to the side of the app that matches their role.
  if (role && user.role !== role) return <Navigate to={user.role === 'ADMIN' ? '/admin' : '/'} replace />;
  return children;
}
