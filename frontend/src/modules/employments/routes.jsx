import { lazy } from 'react'
import { Navigate } from 'react-router-dom'
import { RequireRole } from '@/shared/routing/RequireRole'

const AssignEmploymentPage = lazy(() =>
  import('./pages/AssignEmploymentPage').then(m => ({ default: m.AssignEmploymentPage }))
)

export const employmentsRoutes = [
  {
    path: '/employments',
    element: <Navigate to="/employments/assign" replace />,
  },
  {
    path: '/employments/assign',
    element: (
      <RequireRole roles={[3, 4, 'HR_STAFF', 'ADMIN']}>
        <AssignEmploymentPage />
      </RequireRole>
    ),
  },
]
