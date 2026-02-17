/**
 * Layout for authentication pages (login, forgot password, etc.).
 * Centers content in a clean card-based layout.
 */
import { Outlet } from 'react-router-dom';

export default function AuthLayout() {
  return (
    <div className="auth-page">
      <Outlet />
    </div>
  );
}
