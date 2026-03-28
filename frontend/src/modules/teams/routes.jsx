import { RequireRole } from "@/shared/routing/RequireRole";
import { lazy } from "react";

const TeamsListPage = lazy(() =>
  import("./pages/TeamsListPage").then((m) => ({ default: m.TeamsListPage })),
);
const CreateTeamPage = lazy(() =>
  import("./pages/CreateTeamPage").then((m) => ({ default: m.CreateTeamPage })),
);
const EditTeamPage = lazy(() =>
  import("./pages/EditTeamPage").then((m) => ({ default: m.EditTeamPage })),
);

export const teamsRoutes = [
  {
    path: "/teams",
    element: (
      <RequireRole roles={[3, "ADMIN"]}>
        <TeamsListPage />
      </RequireRole>
    ),
  },
  {
    path: "/teams/create",
    element: (
      <RequireRole roles={[3, "ADMIN"]}>
        <CreateTeamPage />
      </RequireRole>
    ),
  },
  {
    path: "/teams/:teamId/edit",
    element: (
      <RequireRole roles={[3, "ADMIN"]}>
        <EditTeamPage />
      </RequireRole>
    ),
  },
];
