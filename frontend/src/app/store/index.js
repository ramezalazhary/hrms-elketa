import { configureStore } from "@reduxjs/toolkit";
import { contractsReducer } from "@/modules/contracts/store";
import { departmentsReducer } from "@/modules/departments/store";
import { employmentsReducer } from "@/modules/employments/store";
import { employeesReducer } from "@/modules/employees/store";
import { identityReducer } from "@/modules/identity/store";
import { positionsReducer } from "@/modules/positions/store";
import { teamsReducer } from "@/modules/teams/store";
import attendanceReducer from "@/modules/attendance/store";

export const store = configureStore({
  reducer: {
    identity: identityReducer,
    employees: employeesReducer,
    departments: departmentsReducer,
    teams: teamsReducer,
    positions: positionsReducer,
    employments: employmentsReducer,
    contracts: contractsReducer,
    attendance: attendanceReducer,
  },
});
