import { lazy } from 'react'
import { RequireRole } from '@/shared/routing/RequireRole'

const AssignEmploymentPage = lazy(() =>
  import('./pages/AssignEmploymentPage').then(m => ({ default: m.AssignEmploymentPage }))
)

export const employmentsRoutes = [
  {
    path: '/employments/assign',
    element: (
      <RequireRole roles={[3, 4, 'HR_STAFF', 'ADMIN']}>
        <AssignEmploymentPage />
      </RequireRole>
    ),
  },
]
