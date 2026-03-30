import { Navigate } from "react-router-dom";
import { useAppSelector } from "@/shared/hooks/reduxHooks";

/**
 * Route guard: allows `children` only if `currentUser.role` is in `roles` (and user is logged in).
 * Forces password change flow when `requirePasswordChange` is set.
 *
 * @param {{ roles: Array<string|number>, children: import("react").ReactNode }} props
 * @returns {JSX.Element} `children`, or `<Navigate />` to `/login`, `/`, or `/change-password`.
 *
 * Data flow: `useAppSelector(identity.currentUser)` → compare `role` to `roles` array → render or redirect.
 */
export function RequireRole({ roles, children }) {
  const currentUser = useAppSelector((state) => state.identity.currentUser);

  if (!currentUser) return <Navigate to="/login" replace />; // [#1] the user is already login
  if (!roles.includes(currentUser.role)) return <Navigate to="/" replace />; // [#2] the user role has to access this route
  if (currentUser.requirePasswordChange) // [#3] the user is new so need to change password
    return <Navigate to="/change-password" replace />;

  return <>{children}</>;
}
