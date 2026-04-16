import { Navigate } from "react-router-dom";
import { useAppSelector } from "@/shared/hooks/reduxHooks";
import { canAccessAdvances } from "@/shared/utils/accessControl";

export function RequireAdvancesAccess({ children }) {
  const currentUser = useAppSelector((s) => s.identity.currentUser);
  if (!currentUser) return <Navigate to="/login" replace />;
  if (currentUser.requirePasswordChange) {
    return <Navigate to="/change-password" replace />;
  }
  if (!canAccessAdvances(currentUser)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
