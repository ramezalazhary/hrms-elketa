import { RequirePayrollManager } from "@/shared/routing/RequirePayrollManager";
import { RequireAdvancesAccess } from "@/shared/routing/RequireAdvancesAccess";
import { PayrollRunsPage } from "./pages/PayrollRunsPage";
import { PayrollRunDetailPage } from "./pages/PayrollRunDetailPage";
import { AdvancesPage } from "./pages/AdvancesPage";

export const payrollRoutes = [
  {
    path: "/payroll",
    element: (
      <RequirePayrollManager>
        <PayrollRunsPage />
      </RequirePayrollManager>
    ),
  },
  {
    path: "/payroll/:id",
    element: (
      <RequirePayrollManager>
        <PayrollRunDetailPage />
      </RequirePayrollManager>
    ),
  },
  {
    path: "/advances",
    element: (
      <RequireAdvancesAccess>
        <AdvancesPage />
      </RequireAdvancesAccess>
    ),
  },
];
