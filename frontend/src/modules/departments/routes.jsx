import { RequireDepartmentsAccess } from "@/shared/routing/RequireDepartmentsAccess";
import { RequireDepartmentsManage } from "@/shared/routing/RequireDepartmentsManage";
import { CreateDepartmentPage } from "./pages/CreateDepartmentPage";
import { DepartmentsListPage } from "./pages/DepartmentsListPage";
import { EditDepartmentPage } from "./pages/EditDepartmentPage";
import { DepartmentStructurePage } from "./pages/DepartmentStructurePage";

export const departmentsRoutes = [
  { 
    path: "/departments", 
    element: (
      <RequireDepartmentsAccess>
        <DepartmentsListPage />
      </RequireDepartmentsAccess>
    ) 
  },
  {
    path: "/departments/create",
    element: (
      <RequireDepartmentsManage>
        <CreateDepartmentPage />
      </RequireDepartmentsManage>
    ),
  },
  {
    path: "/departments/:departmentId",
    element: (
      <RequireDepartmentsAccess>
        <DepartmentStructurePage />
      </RequireDepartmentsAccess>
    ),
  },
  {
    path: "/departments/:departmentId/edit",
    element: (
      <RequireDepartmentsManage>
        <EditDepartmentPage />
      </RequireDepartmentsManage>
    ),
  },
];
