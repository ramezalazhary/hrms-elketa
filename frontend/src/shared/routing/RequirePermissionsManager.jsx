import { Navigate } from "react-router-dom";
import { useAppSelector } from "@/shared/hooks/reduxHooks";
import { canManagePermissions } from "@/shared/utils/accessControl";

export function RequirePermissionsManager({ children }) {
  const currentUser = useAppSelector((s) => s.identity.currentUser);
  if (!currentUser) return <Navigate to="/login" replace />;
  if (currentUser.requirePasswordChange) {
    return <Navigate to="/change-password" replace />;
  }
  if (!canManagePermissions(currentUser)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
