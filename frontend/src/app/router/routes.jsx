import { AuthLayout } from "@/layouts/authLayout/AuthLayout";
import { Navigate } from "react-router-dom";
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
import { RequirePasswordRequestsAccess } from "@/shared/routing/RequirePasswordRequestsAccess";
import { RequirePermissionsManager } from "@/shared/routing/RequirePermissionsManager";
import { RequireReportsView } from "@/shared/routing/RequireReportsView";
import { RequireDashboardAccess } from "@/shared/routing/RequireDashboardAccess";
import { OrganizationRulesPage } from "@/modules/organization/pages/OrganizationRulesPage";
import { LeaveOperationsPage } from "@/modules/organization/pages/LeaveOperationsPage";
import { WelcomePage } from "@/modules/identity/pages/WelcomePage";
import { RequireOrganizationRulesManage } from "@/shared/routing/RequireOrganizationRulesManage";
import { RequireOrganizationsAccess } from "@/shared/routing/RequireOrganizationsAccess";
import { RequireLeaveOperationsAccess } from "@/shared/routing/RequireLeaveOperationsAccess";

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
          "HR",
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
      {
        path: "/dashboard",
        element: (
          <RequireDashboardAccess>
            <DashboardPage />
          </RequireDashboardAccess>
        ),
      },
      {
        path: "/organizations",
        element: (
          <RequireOrganizationsAccess>
            <OrganizationStructurePage />
          </RequireOrganizationsAccess>
        ),
      },
      {
        path: "/admin/users",
        element: (
          <RequirePermissionsManager>
            <UsersAdminPage />
          </RequirePermissionsManager>
        ),
      },
      {
        path: "/admin/password-requests",
        element: (
          <RequirePasswordRequestsAccess>
            <PasswordRequestsPage />
          </RequirePasswordRequestsAccess>
        ),
      },
      {
        path: "/admin/organization-rules",
        element: (
          <RequireOrganizationRulesManage>
            <OrganizationRulesPage />
          </RequireOrganizationRulesManage>
        ),
      },
      {
        path: "/leave-operations",
        element: (
          <RequireLeaveOperationsAccess>
            <LeaveOperationsPage />
          </RequireLeaveOperationsAccess>
        ),
      },
      {
        path: "/admin/holidays",
        element: <Navigate to="/leave-operations" replace />,
      },
      {
        path: "/reports",
        element: (
          <RequireReportsView>
            <ReportsPage />
          </RequireReportsView>
        ),
      },
      ...coreModuleRoutes,
    ],
  },
];
