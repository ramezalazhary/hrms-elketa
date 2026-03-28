import React from "react";
import { RequireRole } from "@/shared/routing/RequireRole";
import AttendanceDashboard from "./pages/AttendanceDashboard";
import MyAttendancePage from "./pages/MyAttendancePage";
import EventsLogPage from "./pages/EventsLogPage";
import PoliciesPage from "./pages/PoliciesPage";
import ImportPage from "./pages/ImportPage";
import PayrollReportsPage from "./pages/PayrollReportsPage";

export const attendanceRoutes = [
  {
    path: "/attendance",
    element: (
      <RequireRole roles={["MANAGER", "TEAM_LEADER", "HR_STAFF", "ADMIN", 2, 3]}>
        <AttendanceDashboard />
      </RequireRole>
    ),
  },
  {
    path: "/attendance/me",
    element: <MyAttendancePage />,
  },
  {
    path: "/attendance/events",
    element: (
      <RequireRole roles={["HR_STAFF", "ADMIN", 3]}>
        <EventsLogPage />
      </RequireRole>
    ),
  },
  {
    path: "/attendance/policies",
    element: (
      <RequireRole roles={["HR_STAFF", "ADMIN", 3]}>
        <PoliciesPage />
      </RequireRole>
    ),
  },
  {
    path: "/attendance/import",
    element: (
      <RequireRole roles={["HR_STAFF", "ADMIN", 3]}>
        <ImportPage />
      </RequireRole>
    ),
  },
  {
    path: "/attendance/reports",
    element: (
      <RequireRole roles={["HR_STAFF", "ADMIN", 3]}>
        <PayrollReportsPage />
      </RequireRole>
    ),
  },
];
