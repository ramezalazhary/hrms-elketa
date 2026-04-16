import { Navigate } from "react-router-dom";
import { useAppSelector } from "@/shared/hooks/reduxHooks";
import { canManageOrganizationRules } from "@/shared/utils/accessControl";

export function RequireOrganizationRulesManage({ children }) {
  const currentUser = useAppSelector((s) => s.identity.currentUser);
  if (!currentUser) return <Navigate to="/login" replace />;
  if (currentUser.requirePasswordChange) {
    return <Navigate to="/change-password" replace />;
  }
  if (!canManageOrganizationRules(currentUser)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
