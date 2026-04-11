import { RequireRole } from "@/shared/routing/RequireRole";
import { PayrollRunsPage } from "./pages/PayrollRunsPage";
import { PayrollRunDetailPage } from "./pages/PayrollRunDetailPage";
import { AdvancesPage } from "./pages/AdvancesPage";

export const payrollRoutes = [
  {
    path: "/payroll",
    element: (
      <RequireRole roles={["HR_STAFF", "HR_MANAGER", "ADMIN"]}>
        <PayrollRunsPage />
      </RequireRole>
    ),
  },
  {
    path: "/payroll/:id",
    element: (
      <RequireRole roles={["HR_STAFF", "HR_MANAGER", "ADMIN"]}>
        <PayrollRunDetailPage />
      </RequireRole>
    ),
  },
  {
    path: "/advances",
    element: (
      <RequireRole roles={["HR_STAFF", "HR_MANAGER", "ADMIN", "EMPLOYEE", "MANAGER", "TEAM_LEADER"]}>
        <AdvancesPage />
      </RequireRole>
    ),
  },
];
