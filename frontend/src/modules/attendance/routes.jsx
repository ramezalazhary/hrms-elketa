import { AttendancePage } from "./pages/AttendancePage";
import { RequireAttendanceAccess } from "@/shared/routing/RequireAttendanceAccess";

export const attendanceRoutes = [
  {
    path: "/attendance",
    element: (
      <RequireAttendanceAccess>
        <AttendancePage />
      </RequireAttendanceAccess>
    ),
  },
];
