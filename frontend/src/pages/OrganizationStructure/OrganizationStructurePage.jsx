import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/reduxHooks";
import { fetchDepartmentsThunk } from "@/modules/departments/store";
import { fetchEmployeesThunk } from "@/modules/employees/store";
import { fetchTeamsThunk } from "@/modules/teams/store";
import {
  Network,
  Users,
  Layers,
  Search,
  ChevronRight,
  Building2,
  UserCircle,
} from "lucide-react";
import { employeeBelongsToDepartment } from "@/shared/utils/departmentMembership";

/**
 * Organization overview: departments, team counts, and headcount in a readable grid.
 */
function OrganizationStructurePage() {
  const dispatch = useAppDispatch();
  const employees = useAppSelector((state) => state.employees.items);
  const departments = useAppSelector((state) => state.departments.items);
  const loading = useAppSelector(
    (state) =>
      state.employees.isLoading ||
      state.departments.isLoading ||
      state.teams.isLoading,
  );

  const [search, setSearch] = useState("");

  useEffect(() => {
    dispatch(fetchEmployeesThunk());
    dispatch(fetchDepartmentsThunk());
    dispatch(fetchTeamsThunk());
  }, [dispatch]);

  const hierarchy = useMemo(() => {
    return departments.map((dept) => ({
      ...dept,
      headCount: employees.filter((e) => employeeBelongsToDepartment(e, dept))
        .length,
      activeCount: employees.filter(
        (e) => employeeBelongsToDepartment(e, dept) && e.status === "ACTIVE",
      ).length,
    }));
  }, [departments, employees]);

  const q = search.trim().toLowerCase();
  const filteredHierarchy = hierarchy.filter((dept) => {
    const name = (dept.name || "").toLowerCase();
    const teams = dept.teams || [];
    return (
      name.includes(q) ||
      teams.some((t) => (t.name || "").toLowerCase().includes(q))
    );
  });

  const totalTeamsCount = useMemo(() => {
    return departments.reduce((sum, d) => sum + (d.teams?.length || 0), 0);
  }, [departments]);

  const stats = [
    {
      label: "People",
      value: employees.length,
      hint: "All employees",
      icon: Users,
    },
    {
      label: "Departments",
      value: departments.length,
      hint: "Top-level units",
      icon: Network,
    },
    {
      label: "Teams",
      value: totalTeamsCount,
      hint: "Across departments",
      icon: Layers,
    },
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3">
        <div className="h-1 w-32 overflow-hidden rounded-full bg-zinc-200">
          <div className="h-full w-1/3 animate-pulse rounded-full bg-zinc-500" />
        </div>
        <p className="text-sm text-zinc-500">Loading organization…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-4 md:p-6">
      <header className="flex flex-col gap-6 border-b border-zinc-200 pb-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Overview
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 md:text-3xl">
            Organization
          </h1>
          <p className="max-w-xl text-sm leading-relaxed text-zinc-600">
            Departments, teams, and staffing at a glance. Use search to narrow
            the list.
          </p>
        </div>

        <div className="relative w-full lg:max-w-md">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
            aria-hidden
          />
          <input
            type="search"
            placeholder="Search by department or team…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 bg-white py-2.5 pl-10 pr-3 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200"
          />
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-2 text-zinc-600">
                <stat.icon className="h-5 w-5" strokeWidth={1.75} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-zinc-500">{stat.label}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900">
                  {stat.value}
                </p>
                <p className="mt-0.5 text-xs text-zinc-500">{stat.hint}</p>
              </div>
            </div>
          </div>
        ))}
      </section>

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {filteredHierarchy.map((dept) => {
          const initial = (dept.name?.trim()?.[0] || "?").toUpperCase();
          const teams = dept.teams || [];
          return (
            <article
              key={dept.id}
              className="flex flex-col rounded-xl border border-zinc-200 bg-white shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex flex-1 flex-col p-5">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-base font-semibold text-zinc-700">
                    {initial}
                  </div>
                  <Link
                    to={`/departments/${dept.id}`}
                    className="rounded-md p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
                    title="Open department"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Link>
                </div>

                <div className="mb-1">
                  <span className="mb-2 inline-block rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-600">
                    {dept.type || dept.kind || "Department"}
                  </span>
                  <h2 className="text-lg font-semibold text-zinc-900">
                    {dept.name || "Untitled"}
                  </h2>
                </div>

                <div className="mt-4 flex gap-2 border-t border-zinc-100 pt-4">
                  <div className="flex min-w-0 flex-1 gap-2">
                    <UserCircle
                      className="mt-0.5 h-9 w-9 shrink-0 text-zinc-300"
                      strokeWidth={1.25}
                    />
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                        Head
                      </p>
                      <p className="truncate text-sm font-medium text-zinc-900">
                        {dept.head || "—"}
                      </p>
                      {(dept.headTitle || dept.headRole) && (
                        <p className="truncate text-xs text-zinc-500">
                          {dept.headTitle || dept.headRole}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg border border-zinc-100 bg-zinc-50/80 px-3 py-2">
                    <dt className="text-[11px] font-medium text-zinc-500">
                      Staff
                    </dt>
                    <dd className="text-lg font-semibold tabular-nums text-zinc-900">
                      {dept.headCount}
                    </dd>
                  </div>
                  <div className="rounded-lg border border-zinc-100 bg-zinc-50/80 px-3 py-2">
                    <dt className="text-[11px] font-medium text-zinc-500">
                      Active
                    </dt>
                    <dd className="text-lg font-semibold tabular-nums text-zinc-900">
                      {dept.activeCount}
                    </dd>
                  </div>
                </dl>

                <div className="mt-4">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                    Teams ({teams.length})
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {teams.slice(0, 4).map((team) => (
                      <span
                        key={team.id || team.name}
                        className="inline-flex max-w-full items-center truncate rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700"
                      >
                        {team.name}
                      </span>
                    ))}
                    {teams.length > 4 && (
                      <span className="inline-flex items-center rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs font-medium text-zinc-600">
                        +{teams.length - 4} more
                      </span>
                    )}
                    {teams.length === 0 && (
                      <p className="text-xs text-zinc-500">No teams yet.</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="border-t border-zinc-100 p-4">
                <Link
                  to={`/departments/${dept.id}`}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white py-2.5 text-sm font-medium text-zinc-800 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
                >
                  View department
                  <ChevronRight className="h-4 w-4 opacity-70" />
                </Link>
              </div>
            </article>
          );
        })}

        {filteredHierarchy.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 px-6 py-16 text-center">
            <Search className="h-10 w-10 text-zinc-300" strokeWidth={1.25} />
            <p className="mt-4 text-base font-medium text-zinc-900">
              No matches
            </p>
            <p className="mt-1 max-w-sm text-sm text-zinc-600">
              Try another search, or clear the box to see all departments.
            </p>
          </div>
        )}
      </section>

      <footer className="border-t border-zinc-200 pt-8">
        <div className="flex flex-col items-start justify-between gap-4 rounded-xl border border-zinc-200 bg-zinc-50/80 p-6 md:flex-row md:items-center">
          <div className="flex gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-500">
              <Building2 className="h-5 w-5" strokeWidth={1.5} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-900">
                Manage structure
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-zinc-600">
                Edit departments, teams, and assignments from the departments
                list.
              </p>
            </div>
          </div>
          <Link
            to="/departments"
            className="inline-flex shrink-0 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-800 shadow-sm transition-colors hover:bg-zinc-50"
          >
            Go to departments
          </Link>
        </div>
      </footer>
    </div>
  );
}

export default OrganizationStructurePage;
