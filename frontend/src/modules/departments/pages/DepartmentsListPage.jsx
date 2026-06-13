import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { DataTable } from "@/shared/components/DataTable";
import { Filters } from "@/shared/components/Filters";
import { Layout } from "@/shared/components/Layout";
import { Pagination } from "@/shared/components/Pagination";
import { useToast } from "@/shared/components/ToastProvider";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/reduxHooks";
import { fetchDepartmentsThunk, deleteDepartmentThunk } from "../store";
import { DepartmentBadge } from "@/shared/components/EntityBadges";
import { Trash2, Edit, Building2, LayoutDashboard, Layers, Users, Briefcase, Search } from "lucide-react";
import { canManageDepartments } from "@/shared/utils/accessControl";

export function DepartmentsListPage() {
  const dispatch = useAppDispatch();
  const { showToast } = useToast();
  const departments = useAppSelector((state) => state.departments.items);
  const currentUser = useAppSelector((state) => state.identity.currentUser);
  const isAdmin = canManageDepartments(currentUser);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 5;

  useEffect(() => {
    void dispatch(fetchDepartmentsThunk());
  }, [dispatch]);

  const filtered = useMemo(
    () =>
      departments.filter((department) =>
        department.name.toLowerCase().includes(search.toLowerCase()),
      ),
    [departments, search],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  /* ── Aggregate stats ── */
  const totalTeams = useMemo(() => departments.reduce((sum, d) => sum + (d.teams?.length || 0), 0), [departments]);
  const totalPositions = useMemo(() => departments.reduce((sum, d) => sum + (d.positions?.length || 0), 0), [departments]);
  const totalStaff = useMemo(() => departments.reduce((sum, d) => {
    const posMembers = (d.positions || []).reduce((s, p) => s + (p.members?.length || 0), 0);
    return sum + posMembers;
  }, 0), [departments]);

  return (
    <Layout
      title="Departments"
      description="Org units, leaders, teams, and roles—in one directory."
      className="max-w-6xl"
      hideHeader
    >
      {/* ═══════════ Unified Hero Header ═══════════ */}
      <section className="relative overflow-hidden rounded-[20px] bg-white p-6 shadow-sm ring-1 ring-zinc-950/[0.06] dark:bg-zinc-900 dark:ring-zinc-800 md:p-8">
        {/* Decorative blurs */}
        <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-violet-100/60 blur-3xl dark:bg-violet-900/20" />
        <div className="pointer-events-none absolute -left-8 bottom-0 h-32 w-32 rounded-full bg-teal-100/50 blur-3xl dark:bg-teal-900/15" />

        <div className="relative space-y-6">
          {/* ── Row 1: Identity + Action ── */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            {/* Left: Icon + Title block */}
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-zinc-700 to-zinc-900 text-white shadow-md dark:from-zinc-600 dark:to-zinc-800">
                <Building2 className="h-6 w-6" strokeWidth={1.75} />
              </div>
              <div className="min-w-0">
                <div className="mb-1 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200/80 bg-zinc-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400">
                    <Layers className="h-3 w-3" />
                    Directory
                  </span>
                </div>
                <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                  Departments
                </h1>
                <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                  Org units, leaders, teams, and roles — in one directory.
                </p>
              </div>
            </div>

            {/* Right: CTA button */}
            {isAdmin && (
              <Link
                className="inline-flex shrink-0 items-center gap-2 self-start rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:bg-zinc-800 hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:bg-indigo-600 dark:hover:bg-indigo-500 dark:focus-visible:ring-indigo-400"
                to="/departments/create"
              >
                <Layers className="h-4 w-4 opacity-80" />
                New department
              </Link>
            )}
          </div>

          {/* ── Row 2: Stat pills ── */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { icon: Building2, label: "Departments", value: departments.length, accent: "text-zinc-900 dark:text-zinc-100" },
              { icon: Users, label: "Teams", value: totalTeams, accent: "text-zinc-900 dark:text-zinc-100" },
              { icon: Briefcase, label: "Roles", value: totalPositions, accent: "text-zinc-900 dark:text-zinc-100" },
              { icon: LayoutDashboard, label: "Staff assigned", value: totalStaff, accent: "text-zinc-900 dark:text-zinc-100" },
            ].map(({ icon: Icon, label, value, accent }) => (
              <div
                key={label}
                className="flex items-center gap-3 rounded-xl border border-zinc-200/80 bg-zinc-50/80 p-3 transition-colors hover:bg-zinc-100/60 dark:border-zinc-800 dark:bg-zinc-800/40 dark:hover:bg-zinc-800/60"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-zinc-500 shadow-sm ring-1 ring-zinc-200/80 dark:bg-zinc-900 dark:text-zinc-400 dark:ring-zinc-700">
                  <Icon size={16} strokeWidth={1.75} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</p>
                  <p className={`text-lg font-semibold tabular-nums leading-tight ${accent}`}>{value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── Row 3: Integrated search + result count ── */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search departments…"
                className="w-full rounded-xl border border-zinc-200/80 bg-zinc-50/80 py-2.5 pl-10 pr-4 text-sm text-zinc-900 placeholder-zinc-400 outline-none transition-all focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-600 dark:focus:bg-zinc-800 dark:focus:ring-zinc-700"
              />
            </div>
            {search && (
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Showing <span className="font-bold text-zinc-900 dark:text-zinc-100">{filtered.length}</span> of{" "}
                <span className="font-bold text-zinc-900 dark:text-zinc-100">{departments.length}</span> departments
              </p>
            )}
          </div>
        </div>
      </section>

      <DataTable
        columns={[
          {
            key: "name",
            header: "Department",
            render: (row) => (
              <div className="flex items-center gap-3">
                <div className="rounded-xl border border-teal-100 bg-gradient-to-br from-teal-50 to-cyan-50 p-2 shadow-sm">
                  <Building2 size={16} className="text-teal-600" />
                </div>
                <DepartmentBadge name={row.name} className="font-semibold" />
              </div>
            ),
          },
          {
            key: "type",
            header: "Type",
            render: (row) => (
              <span
                className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                  row.type === "PROJECT"
                    ? "border-violet-200 bg-violet-50 text-violet-800"
                    : "border-teal-200 bg-teal-50 text-teal-800"
                }`}
              >
                {row.type || "PERMANENT"}
              </span>
            ),
          },
          {
            key: "head",
            header: "Leader",
            render: (row) => (
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-slate-900">{row.head || "Unassigned"}</span>
                <span className="text-[10px] font-medium text-slate-500">{row.headTitle || "Department lead"}</span>
              </div>
            ),
          },
          {
            key: "structure",
            header: "Sub-Units",
            render: (row) => (
              <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide">
                <span className="rounded-md border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-cyan-900">
                  {row.teams?.length || 0} teams
                </span>
                <span className="rounded-md border border-violet-200 bg-violet-50 px-2 py-0.5 text-violet-900">
                  {row.positions?.length || 0} roles
                </span>
              </div>
            ),
          },
          {
            key: "positions_detail",
            header: "Staffing",
            render: (row) => (
              <div className="flex flex-col gap-1">
                {(row.positions || []).slice(0, 2).map((pos, idx) => (
                  <div key={idx} className="text-[10px] flex items-center gap-1.5 font-medium text-zinc-500 dark:text-zinc-400">
                    <span className="text-zinc-900 dark:text-zinc-100 font-bold">{pos.title}</span>
                    <span className="text-[9px] bg-zinc-100 dark:bg-zinc-800 px-1 rounded">{(pos.members || []).length} staff</span>
                  </div>
                ))}
                {(row.positions || []).length > 2 && <span className="text-[9px] text-zinc-400 font-bold uppercase">+{row.positions.length - 2} more roles</span>}
              </div>
            ),
          },
          {
            key: "actions",
            header: "",
            render: (row) => (
              <div className="flex justify-end gap-2">
                <Link
                  to={`/departments/${row.id}`}
                  className="rounded-lg border border-transparent p-2 text-slate-400 transition hover:border-teal-100 hover:bg-teal-50 hover:text-teal-700"
                  title="View structure"
                >
                  <LayoutDashboard size={16} />
                </Link>
                {isAdmin ? (
                  <>
                    <Link
                      to={`/departments/${row.id}/edit`}
                      className="rounded-lg border border-transparent p-2 text-slate-400 transition hover:border-violet-100 hover:bg-violet-50 hover:text-violet-700"
                      title="Edit department"
                    >
                      <Edit size={16} />
                    </Link>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!window.confirm(`Permanently delete '${row.name}'? ALL employees in this department will be set to 'Unassigned'.`)) return;
                        try {
                          await dispatch(deleteDepartmentThunk(row.id)).unwrap();
                          showToast("Department and subunits deleted", "success");
                        } catch (error) {
                          showToast(error.message || "Deletion failed", "error");
                        }
                      }}
                      className="rounded-lg border border-transparent p-2 text-slate-400 transition hover:border-rose-100 hover:bg-rose-50 hover:text-rose-600"
                      title="Delete department"
                    >
                      <Trash2 size={16} />
                    </button>
                  </>
                ) : (
                  <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    View only
                  </span>
                )}
              </div>
            ),
          },
        ]}
        data={paged}
        getRowKey={(row) => row.id}
      />
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </Layout>
  );
}
