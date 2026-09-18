import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function ProtectedRoute({ children }) {
  const { isAuthed, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="page page--center"><div className="spinner" /></div>;
  if (!isAuthed) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}
