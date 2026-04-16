import { RequireRole } from "@/shared/routing/RequireRole";
import { lazy } from "react";

const PositionsListPage = lazy(() =>
  import("./pages/PositionsListPage").then((m) => ({
    default: m.PositionsListPage,
  })),
);
const CreatePositionPage = lazy(() =>
  import("./pages/CreatePositionPage").then((m) => ({
    default: m.CreatePositionPage,
  })),
);
const EditPositionPage = lazy(() =>
  import("./pages/EditPositionPage").then((m) => ({
    default: m.EditPositionPage,
  })),
);

export const positionsRoutes = [
  {
    path: "/positions",
    element: (
      <RequireRole roles={[3, "ADMIN", "HR_STAFF", "HR_MANAGER"]}>
        <PositionsListPage />
      </RequireRole>
    ),
  },
  {
    path: "/positions/create",
    element: (
      <RequireRole roles={[3, "ADMIN", "HR", "HR_STAFF", "HR_MANAGER"]}>
        <CreatePositionPage />
      </RequireRole>
    ),
  },
  {
    path: "/positions/:positionId/edit",
    element: (
      <RequireRole roles={[3, "ADMIN", "HR", "HR_STAFF", "HR_MANAGER"]}>
        <EditPositionPage />
      </RequireRole>
    ),
  },
];
