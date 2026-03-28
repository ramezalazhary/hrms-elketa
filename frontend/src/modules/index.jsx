import { contractsRoutes } from "./contracts/routes";
import { departmentsRoutes } from "./departments/routes";
import { employmentsRoutes } from "./employments/routes";
import { employeesRoutes } from "./employees/routes";
import { positionsRoutes } from "./positions/routes";
import { teamsRoutes } from "./teams/routes";
import { attendanceRoutes } from "./attendance/routes";

export const coreModuleRoutes = [
  ...employeesRoutes,
  ...departmentsRoutes,
  ...teamsRoutes,
  ...positionsRoutes,
  ...employmentsRoutes,
  ...contractsRoutes,
  ...attendanceRoutes,
];

// Future modules (payroll, recruitment) can append routes here.
