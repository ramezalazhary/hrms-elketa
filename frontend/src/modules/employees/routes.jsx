import { RequireRole } from '@/shared/routing/RequireRole'
import { CreateEmployeePage } from './pages/CreateEmployeePage'
import { EditEmployeePage } from './pages/EditEmployeePage'
import { EmployeeProfilePage } from './pages/EmployeeProfilePage'
import { EmployeesListPage } from './pages/EmployeesListPage'

import { OnboardingApprovalsPage } from './pages/OnboardingApprovalsPage'

export const employeesRoutes = [
  { 
    path: '/employees', 
    element: (
      <RequireRole roles={["HR_STAFF", "ADMIN", 3]}>
        <EmployeesListPage />
      </RequireRole>
    ) 
  },
  {
    path: '/employees/onboarding',
    element: (
      <RequireRole roles={[3, "HR_STAFF", "ADMIN"]}>
        <OnboardingApprovalsPage />
      </RequireRole>
    ),
  },
  {
    path: '/employees/create',
    element: (
      <RequireRole roles={[3, "HR_STAFF", "ADMIN"]}>
        <CreateEmployeePage />
      </RequireRole>
    ),
  },
  {
    path: '/employees/:employeeId/edit',
    element: (
      <RequireRole roles={[3, "HR_STAFF", "ADMIN"]}>
        <EditEmployeePage />
      </RequireRole>
    ),
  },
  { path: '/employees/:employeeId', element: <EmployeeProfilePage /> },
]
