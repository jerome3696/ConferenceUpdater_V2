import { Navigate, Outlet } from 'react-router-dom';

// PLAN-033: 인증·권한 가드.
// authenticated=false → /login 으로 리다이렉트
// adminOnly=true 면 isAdmin=false 시 / 로 리다이렉트
export default function RouteGuard({ authenticated, isAdmin = false, adminOnly = false }) {
  if (!authenticated) return <Navigate to="/login" replace />;
  if (adminOnly && !isAdmin) return <Navigate to="/" replace />;
  return <Outlet />;
}
