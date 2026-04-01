import { AttendancePage } from "./pages/AttendancePage";
import { RequireRole } from "@/shared/routing/RequireRole";

export const attendanceRoutes = [
  {
    path: "/attendance",
    element: (
      <RequireRole roles={[2, 3, "MANAGER", "HR_STAFF", "ADMIN"]}>
        <AttendancePage />
      </RequireRole>
    ),
  },
];
