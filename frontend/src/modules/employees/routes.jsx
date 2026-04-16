import { Navigate } from 'react-router-dom'
import { RequireEmployeeRead } from '@/shared/routing/RequireEmployeeRead'
import { RequireLeaveApprover } from '@/shared/routing/RequireLeaveApprover'
import { RequireBonusApprover } from '@/shared/routing/RequireBonusApprover'
import { RequireOnboardingAccess } from "@/shared/routing/RequireOnboardingAccess";
import { RequireEmployeeManage } from "@/shared/routing/RequireEmployeeManage";
import { CreateEmployeePage } from './pages/CreateEmployeePage'
import { EditEmployeePage } from './pages/EditEmployeePage'
import { EmployeeProfilePage } from './pages/EmployeeProfilePage'
import { EmployeesListPage } from './pages/EmployeesListPage'

import { OnboardingApprovalsPage } from './pages/OnboardingApprovalsPage'
import { LeaveApprovalsPage } from './pages/LeaveApprovalsPage'
import { BonusApprovalsPage } from './pages/BonusApprovalsPage'
import { TimeOffPage } from './pages/TimeOffPage'

export const employeesRoutes = [
  {
    path: '/employees/time-off',
    element: <TimeOffPage />,
  },
  {
    path: '/employees/time-off/approvals',
    element: (
      <RequireLeaveApprover>
        <LeaveApprovalsPage />
      </RequireLeaveApprover>
    ),
  },
  {
    path: '/employees/time-off/bulk-credit',
    element: <Navigate to="/leave-operations" replace />,
  },
  {
    path: '/employees/bonus-approvals',
    element: (
      <RequireBonusApprover>
        <BonusApprovalsPage />
      </RequireBonusApprover>
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
      <RequireEmployeeRead>
        <EmployeesListPage />
      </RequireEmployeeRead>
    ) 
  },
  {
    path: '/employees/onboarding',
    element: (
      <RequireOnboardingAccess>
        <OnboardingApprovalsPage />
      </RequireOnboardingAccess>
    ),
  },
  {
    path: '/employees/create',
    element: (
      <RequireEmployeeManage>
        <CreateEmployeePage />
      </RequireEmployeeManage>
    ),
  },
  {
    path: '/employees/:employeeId/edit',
    element: (
      <RequireEmployeeManage>
        <EditEmployeePage />
      </RequireEmployeeManage>
    ),
  },
  {
    path: '/employees/:employeeId',
    element: (
      <RequireEmployeeRead>
        <EmployeeProfilePage />
      </RequireEmployeeRead>
    ),
  },
]
