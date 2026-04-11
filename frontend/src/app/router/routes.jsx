import { AuthLayout } from "@/layouts/authLayout/AuthLayout";
import { DashboardLayout } from "@/layouts/dashboardLayout/DashboardLayoutEnhanced";
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
import { RequireAdminOrHrHead } from "@/shared/routing/RequireAdminOrHrHead";
import { OrganizationRulesPage } from "@/modules/organization/pages/OrganizationRulesPage";
import { HolidaysPage } from "@/modules/organization/pages/HolidaysPage";
import { WelcomePage } from "@/modules/identity/pages/WelcomePage";

export const appRoutes = [
  {
    element: <AuthLayout />,
    children: [
      { path: "/login", element: <LoginPage /> },
      { path: "/forgot-password", element: <ForgotPasswordPage /> },
      { path: "/change-password", element: <ChangePasswordPage /> },
      {
        path: "/welcome/:token",
        element: <WelcomePage />,
      },
    ],
  },
  {
    element: (
      <RequireRole
        roles={[
          "EMPLOYEE",
          "TEAM_LEADER",
          "MANAGER",
          "HR_STAFF",
          "HR_MANAGER",
          "ADMIN",
        ]}
      >
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
          <RequireRole roles={["MANAGER", "HR_STAFF", "HR_MANAGER", "ADMIN"]}>
            <UsersAdminPage />
          </RequireRole>
        ),
      },
      {
        path: "/admin/password-requests",
        element: (
          <RequireAdminOrHrHead>
            <PasswordRequestsPage />
          </RequireAdminOrHrHead>
        ),
      },
      {
        path: "/admin/organization-rules",
        element: (
          <RequireRole roles={["ADMIN"]}>
            <OrganizationRulesPage />
          </RequireRole>
        ),
      },
      {
        path: "/admin/holidays",
        element: (
          <RequireRole roles={["ADMIN", "HR_MANAGER", "HR_STAFF"]}>
            <HolidaysPage />
          </RequireRole>
        ),
      },
      {
        path: "/reports",
        element: (
          <RequireRole roles={["HR_STAFF", "HR_MANAGER", "ADMIN"]}>
            <ReportsPage />
          </RequireRole>
        ),
      },
      ...coreModuleRoutes,
    ],
  },
];
