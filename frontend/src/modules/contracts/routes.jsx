import { RequireRole } from "@/shared/routing/RequireRole";
import { CreateContractPage } from './pages/CreateContractPage'

export const contractsRoutes = [
  {
    path: '/contracts/create',
    element: (
      <RequireRole roles={["HR_STAFF", "HR_MANAGER", "ADMIN"]}>
        <CreateContractPage />
      </RequireRole>
    ),
  },
]
