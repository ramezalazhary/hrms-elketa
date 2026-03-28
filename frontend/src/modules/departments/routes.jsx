import { RequireRole } from "@/shared/routing/RequireRole";
import { CreateDepartmentPage } from "./pages/CreateDepartmentPage";
import { DepartmentsListPage } from "./pages/DepartmentsListPage";
import { EditDepartmentPage } from "./pages/EditDepartmentPage";
import { DepartmentStructurePage } from "./pages/DepartmentStructurePage";

export const departmentsRoutes = [
  { 
    path: "/departments", 
    element: (
      <RequireRole roles={[3, "ADMIN", "HR_STAFF"]}>
        <DepartmentsListPage />
      </RequireRole>
    ) 
  },
  {
    path: "/departments/create",
    element: (
      <RequireRole roles={[3, "ADMIN"]}>
        <CreateDepartmentPage />
      </RequireRole>
    ),
  },
  {
    path: "/departments/:departmentId",
    element: (
      <RequireRole roles={[2, 3, "MANAGER", "ADMIN", "HR_STAFF"]}>
        <DepartmentStructurePage />
      </RequireRole>
    ),
  },
  {
    path: "/departments/:departmentId/edit",
    element: (
      <RequireRole roles={[3, "ADMIN"]}>
        <EditDepartmentPage />
      </RequireRole>
    ),
  },
];
