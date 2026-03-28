import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/reduxHooks";
import { fetchDepartmentsThunk } from "@/modules/departments/store";

const HR_NAME = "HR";

/**
 * Allows system Admin or HR Staff who is the configured head of the HR department.
 * Waits for department fetch before denying HR staff (avoids a false redirect).
 */
export function RequireAdminOrHrHead({ children }) {
  const dispatch = useAppDispatch();
  const currentUser = useAppSelector((s) => s.identity.currentUser);
  const departments = useAppSelector((s) => s.departments.items);
  const departmentsLoading = useAppSelector((s) => s.departments.isLoading);

  useEffect(() => {
    if (
      currentUser?.role === "HR_STAFF" ||
      currentUser?.role === "ADMIN" ||
      currentUser?.role === 3
    ) {
      void dispatch(fetchDepartmentsThunk());
    }
  }, [dispatch, currentUser?.role]);

  if (!currentUser) return <Navigate to="/login" replace />;

  if (currentUser.requirePasswordChange) {
    return <Navigate to="/change-password" replace />;
  }

  const isAdmin = currentUser.role === "ADMIN" || currentUser.role === 3;
  if (isAdmin) return <>{children}</>;

  if (currentUser.role !== "HR_STAFF") {
    return <Navigate to="/" replace />;
  }

  if (departmentsLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-sm text-zinc-500">
        Checking access…
      </div>
    );
  }

  const isHrHead = departments.some(
    (d) => d.name === HR_NAME && d.head === currentUser.email,
  );

  if (isHrHead) return <>{children}</>;

  return <Navigate to="/" replace />;
}
