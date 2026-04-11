import { Navigate } from 'react-router-dom'
import { RequireRole } from '@/shared/routing/RequireRole'
import { CreateEmployeePage } from './pages/CreateEmployeePage'
import { EditEmployeePage } from './pages/EditEmployeePage'
import { EmployeeProfilePage } from './pages/EmployeeProfilePage'
import { EmployeesListPage } from './pages/EmployeesListPage'

import { OnboardingApprovalsPage } from './pages/OnboardingApprovalsPage'
import { TimeOffPage } from './pages/TimeOffPage'
import { LeaveApprovalsPage } from './pages/LeaveApprovalsPage'
import { BulkLeaveBalanceCreditPage } from './pages/BulkLeaveBalanceCreditPage'
import { BonusApprovalsPage } from './pages/BonusApprovalsPage'

export const employeesRoutes = [
  { path: '/employees/time-off', element: <TimeOffPage /> },
  { path: '/employees/time-off/approvals', element: <LeaveApprovalsPage /> },
  {
    path: '/employees/time-off/bulk-credit',
    element: (
      <RequireRole roles={['HR_STAFF', 'HR_MANAGER', 'ADMIN']}>
        <BulkLeaveBalanceCreditPage />
      </RequireRole>
    ),
  },
  {
    path: '/employees/bonus-approvals',
    element: (
      <RequireRole roles={['HR_STAFF', 'HR_MANAGER', 'ADMIN']}>
        <BonusApprovalsPage />
      </RequireRole>
    ),
  },
  {
    path: '/employees/bonusapproved',
    element: <Navigate to="/employees/bonus-approvals" replace />,
  },
  {
    path: '/employees/bouns-approvals',
    element: <Navigate to="/employees/bonus-approvals" replace />,
  },
  {
    path: '/employees/bonus-approval',
    element: <Navigate to="/employees/bonus-approvals" replace />,
  },
  { 
    path: '/employees', 
    element: (
      <RequireRole roles={["HR_STAFF", "HR_MANAGER", "ADMIN"]}>
        <EmployeesListPage />
      </RequireRole>
    ) 
  },
  {
    path: '/employees/onboarding',
    element: (
      <RequireRole roles={["HR_STAFF", "HR_MANAGER", "ADMIN"]}>
        <OnboardingApprovalsPage />
      </RequireRole>
    ),
  },
  {
    path: '/employees/create',
    element: (
      <RequireRole roles={["HR_STAFF", "HR_MANAGER", "ADMIN"]}>
        <CreateEmployeePage />
      </RequireRole>
    ),
  },
  {
    path: '/employees/:employeeId/edit',
    element: (
      <RequireRole roles={["HR_STAFF", "HR_MANAGER", "ADMIN"]}>
        <EditEmployeePage />
      </RequireRole>
    ),
  },
  { path: '/employees/:employeeId', element: <EmployeeProfilePage /> },
]
