import { useEffect } from "react";
import { Layout } from "@/shared/components/Layout";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/reduxHooks";
import { fetchEmployeesThunk } from "@/modules/employees/store";
import { fetchDepartmentsThunk } from "@/modules/departments/store";
import { fetchTeamsThunk } from "@/modules/teams/store";
import { LeadershipOrgOverview } from "./LeadershipOrgOverview";

function isEmployeeOnlyRole(role) {
  return role === 1 || role === "EMPLOYEE";
}

/**
 * Home: full org analytics for leadership (Admin, HR, managers); simple welcome card for employees.
 */
export function HomePage() {
  const dispatch = useAppDispatch();
  const currentUser = useAppSelector((state) => state.identity.currentUser);
  const employees = useAppSelector((state) => state.employees.items);
  const departments = useAppSelector((state) => state.departments.items);
  const teams = useAppSelector((state) => state.teams.items);
  const employeesLoading = useAppSelector((state) => state.employees.isLoading);

  const role = currentUser?.role;
  const showAnalytics = !isEmployeeOnlyRole(role);

  useEffect(() => {
    if (!showAnalytics) return;
    void dispatch(fetchEmployeesThunk());
    void dispatch(fetchDepartmentsThunk());
    void dispatch(fetchTeamsThunk({}));
  }, [dispatch, showAnalytics]);

  if (showAnalytics) {
    return (
      <LeadershipOrgOverview
        currentUser={currentUser}
        employees={employees}
        departments={departments}
        teams={teams}
        isLoading={employeesLoading}
      />
    );
  }

  const roleDisplay = currentUser?.role?.replace("_", " ") || "Member";

  return (
    <Layout
      title={`Welcome, ${currentUser?.email?.split("@")[0] || "User"}`}
      description="Overview and quick context."
    >
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <article className="rounded-lg border border-zinc-200 bg-white p-6 shadow-card flex flex-col">
          <div className="h-16 w-16 rounded-full border border-zinc-200 bg-zinc-50 mb-5 flex items-center justify-center text-zinc-700 text-lg font-medium">
            {currentUser?.email?.[0]?.toUpperCase() || "U"}
          </div>
          <h2 className="text-sm font-medium text-zinc-900">{currentUser?.email || "User"}</h2>
          <span className="mt-2 inline-flex w-fit text-[11px] font-medium text-zinc-500 uppercase tracking-wide">
            {roleDisplay}
          </span>

          <div className="mt-8 w-full space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-zinc-100">
              <span className="text-zinc-500">Profile</span>
              <span className="text-zinc-800">
                {new Date(currentUser?.createdAt || Date.now()).toLocaleDateString()}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-zinc-100">
              <span className="text-zinc-500">Status</span>
              <span className="text-zinc-800">Active</span>
            </div>
          </div>
        </article>

        <article className="rounded-lg border border-zinc-200 bg-white p-6 shadow-card md:col-span-2 flex flex-col justify-center">
          <h3 className="text-sm font-medium text-zinc-900">Workspace</h3>
          <p className="mt-2 text-sm text-zinc-500 leading-relaxed max-w-lg">
            Use the sidebar for structure, employees, and departments. Your manager or HR can see organization
            analytics on the home page.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="p-3 rounded-md border border-zinc-100 bg-zinc-50/80">
              <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wide">Modules</p>
              <p className="text-sm text-zinc-700 mt-1">HR core</p>
            </div>
            <div className="p-3 rounded-md border border-zinc-100 bg-zinc-50/80">
              <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wide">Next</p>
              <p className="text-sm text-zinc-700 mt-1">As configured</p>
            </div>
          </div>
        </article>
      </div>
    </Layout>
  );
}
