import { AuthLayout } from "@/layouts/authLayout/AuthLayout";
import { DashboardLayout } from "@/layouts/dashboardLayout/DashboardLayout";
import { identityRoutes } from "@/modules/identity/routes";
import { coreModuleRoutes } from "@/modules";
import { DashboardPage } from "@/pages/dashboard/DashboardPage";
import { LoginPage } from "@/pages/login/LoginPage";
import OrganizationStructurePage from "@/pages/OrganizationStructure/OrganizationStructurePage";
import { RequireRole } from "@/shared/routing/RequireRole";
import { UsersAdminPage } from "@/pages/admin/UsersAdminPage";
import { ReportsPage } from "@/pages/reports/ReportsPage";
import { ChangePasswordPage } from "@/modules/identity/pages/ChangePasswordPage";
import { HomePage } from "@/pages/home/HomePage";
import { PasswordRequestsPage } from "@/pages/admin/PasswordRequestsPage";
import { ForgotPasswordPage } from "@/modules/identity/pages/ForgotPasswordPage";

export const appRoutes = [
  {
    element: <AuthLayout />,
    children: [
      { path: "/login", element: <LoginPage /> },
      { path: "/forgot-password", element: <ForgotPasswordPage /> },
      { path: "/change-password", element: <ChangePasswordPage /> },
      ...identityRoutes
    ],
  },
  {
    element: (
      <RequireRole roles={[1, 2, 3, "EMPLOYEE", "TEAM_LEADER", "MANAGER", "HR_STAFF", "ADMIN"]}>
        <DashboardLayout />
      </RequireRole>
    ),
    children: [
      { path: "/", element: <HomePage /> },
      { path: "/dashboard", element: <DashboardPage /> },
      { path: "/organizations", element: <OrganizationStructurePage /> },
      {
        path: "/admin/users",
        element: (
          <RequireRole roles={[2, 3, "MANAGER", "HR_STAFF", "ADMIN"]}>
            <UsersAdminPage />
          </RequireRole>
        ),
      },
      {
        path: "/admin/password-requests",
        element: (
          <RequireRole roles={[3, "ADMIN"]}>
            <PasswordRequestsPage />
          </RequireRole>
        ),
      },
      {
        path: "/reports",
        element: (
          <RequireRole roles={[3, 4, "HR_STAFF", "ADMIN"]}>
            <ReportsPage />
          </RequireRole>
        ),
      },
      ...coreModuleRoutes,
    ],
  },
];
