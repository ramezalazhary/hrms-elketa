import { contractsRoutes } from "./contracts/routes";
import { departmentsRoutes } from "./departments/routes";
import { employmentsRoutes } from "./employments/routes";
import { employeesRoutes } from "./employees/routes";
import { positionsRoutes } from "./positions/routes";
import { teamsRoutes } from "./teams/routes";
import { attendanceRoutes } from "./attendance/routes";

const contractsRoutesActive =
  import.meta.env.VITE_ENABLE_CONTRACTS === "true" ? contractsRoutes : [];

export const coreModuleRoutes = [
  ...employeesRoutes,
  ...departmentsRoutes,
  ...teamsRoutes,
  ...positionsRoutes,
  ...employmentsRoutes,
  ...contractsRoutesActive,
  ...attendanceRoutes,
];

// Future modules (payroll, recruitment) can append routes here.
