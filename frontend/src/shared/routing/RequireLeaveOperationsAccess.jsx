import { Navigate } from "react-router-dom";
import { useAppSelector } from "@/shared/hooks/reduxHooks";
import { canAccessLeaveOperations } from "@/shared/utils/accessControl";

export function RequireLeaveOperationsAccess({ children }) {
  const currentUser = useAppSelector((s) => s.identity.currentUser);
  if (!currentUser) return <Navigate to="/login" replace />;
  if (currentUser.requirePasswordChange) {
    return <Navigate to="/change-password" replace />;
  }
  if (!canAccessLeaveOperations(currentUser)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
