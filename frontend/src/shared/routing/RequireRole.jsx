import { Navigate } from "react-router-dom";
import { useAppSelector } from "@/shared/hooks/reduxHooks";

export function RequireRole({ roles, children }) {
  const currentUser = useAppSelector((state) => state.identity.currentUser);

  // If not logged in, send to login.
  if (!currentUser) return <Navigate to="/login" replace />;

  if (!roles.includes(currentUser.role)) return <Navigate to="/" replace />;
  if (currentUser.requirePasswordChange) return <Navigate to="/change-password" replace />;

  return <>{children}</>;
}
