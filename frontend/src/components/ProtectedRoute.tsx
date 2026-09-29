import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import type { UserRole } from '../types';

export function ProtectedRoute({ allow }: { allow?: UserRole[] }) {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);

  if (!accessToken || !user) return <Navigate to="/login" replace />;
  if (allow && !allow.includes(user.role)) return <Navigate to="/" replace />;

  return <Outlet />;
}
