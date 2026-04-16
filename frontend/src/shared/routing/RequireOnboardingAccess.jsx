import { Navigate } from "react-router-dom";
import { useAppSelector } from "@/shared/hooks/reduxHooks";
import { canManageOnboardingApprovals } from "@/shared/utils/accessControl";

export function RequireOnboardingAccess({ children }) {
  const currentUser = useAppSelector((s) => s.identity.currentUser);
  if (!currentUser) return <Navigate to="/login" replace />;
  if (currentUser.requirePasswordChange) {
    return <Navigate to="/change-password" replace />;
  }
  if (!canManageOnboardingApprovals(currentUser)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
