import { Navigate } from "react-router-dom";
import { useAppSelector } from "@/shared/hooks/reduxHooks";
import { canAccessDepartments } from "@/shared/utils/accessControl";

export function RequireDepartmentsAccess({ children }) {
  const currentUser = useAppSelector((s) => s.identity.currentUser);
  if (!currentUser) return <Navigate to="/login" replace />;
  if (currentUser.requirePasswordChange) {
    return <Navigate to="/change-password" replace />;
  }
  if (!canAccessDepartments(currentUser)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
