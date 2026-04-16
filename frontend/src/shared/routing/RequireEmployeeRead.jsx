import { Navigate } from "react-router-dom";
import { useAppSelector } from "@/shared/hooks/reduxHooks";
import { canReadEmployees } from "@/shared/utils/accessControl";

export function RequireEmployeeRead({ children }) {
  const currentUser = useAppSelector((s) => s.identity.currentUser);
  if (!currentUser) return <Navigate to="/login" replace />;
  if (currentUser.requirePasswordChange) {
    return <Navigate to="/change-password" replace />;
  }
  if (!canReadEmployees(currentUser)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
