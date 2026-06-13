import { Navigate } from "react-router-dom";
import { useAppSelector } from "@/shared/hooks/reduxHooks";

/**
 * Auth-route guard: only guests (not signed in) may see login / forgot-password.
 * Signed-in users are sent home, or to change-password when required.
 */
export function RequireGuest({ children }) {
  const currentUser = useAppSelector((state) => state.identity.currentUser);

  if (currentUser) {
    if (currentUser.requirePasswordChange) {
      return <Navigate to="/change-password" replace />;
    }
    return <Navigate to="/" replace />;
  }

  return children;
}
