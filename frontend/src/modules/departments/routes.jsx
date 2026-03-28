import { RequireRole } from "@/shared/routing/RequireRole";
import { CreateDepartmentPage } from "./pages/CreateDepartmentPage";
import { DepartmentsListPage } from "./pages/DepartmentsListPage";
import { EditDepartmentPage } from "./pages/EditDepartmentPage";

export const departmentsRoutes = [
  { path: "/departments", element: <DepartmentsListPage /> },
  {
    path: "/departments/create",
    element: (
      <RequireRole roles={[3, "ADMIN"]}>
        <CreateDepartmentPage />
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
