import { RequireRole } from '@/shared/routing/RequireRole'
import { CreateEmployeePage } from './pages/CreateEmployeePage'
import { EditEmployeePage } from './pages/EditEmployeePage'
import { EmployeeProfilePage } from './pages/EmployeeProfilePage'
import { EmployeesListPage } from './pages/EmployeesListPage'

export const employeesRoutes = [
  { path: '/employees', element: <EmployeesListPage /> },
  {
    path: '/employees/create',
    element: (
      <RequireRole roles={[2, 3, "MANAGER", "HR_STAFF", "ADMIN"]}>
        <CreateEmployeePage />
      </RequireRole>
    ),
  },
  {
    path: '/employees/:employeeId/edit',
    element: (
      <RequireRole roles={[2, 3, "MANAGER", "HR_STAFF", "ADMIN"]}>
        <EditEmployeePage />
      </RequireRole>
    ),
  },
  { path: '/employees/:employeeId', element: <EmployeeProfilePage /> },
]
