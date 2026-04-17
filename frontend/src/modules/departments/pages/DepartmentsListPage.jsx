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
import { Trash2, Edit, Building2, LayoutDashboard, Layers } from "lucide-react";
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

  return (
    <Layout
      title="Departments"
      description="Org units, leaders, teams, and roles—in one directory."
      actions={
        isAdmin ? (
          <Link
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-600/25 transition hover:from-violet-500 hover:to-teal-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2"
            to="/departments/create"
          >
            <Layers className="h-4 w-4 opacity-90" />
            New department
          </Link>
        ) : null
      }
    >
      <div className="relative overflow-hidden rounded-2xl border border-violet-100/80 bg-gradient-to-br from-violet-50/90 via-white to-teal-50/70 p-5 shadow-sm ring-1 ring-violet-500/10 md:p-6">
        <div className="pointer-events-none absolute -left-6 top-0 h-28 w-28 rounded-full bg-teal-300/20 blur-2xl" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-24 w-24 rounded-full bg-violet-400/20 blur-2xl" />
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-teal-600 text-white shadow-md">
              <Building2 className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-800">Organization structure</p>
              <p className="mt-0.5 text-xs text-slate-500">
                <span className="font-semibold text-violet-700">{departments.length}</span> departments
                {search ? (
                  <>
                    {" · "}
                    <span className="font-semibold text-teal-700">{filtered.length}</span> visible
                  </>
                ) : null}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200/80 bg-white dark:bg-zinc-900/90 p-4 shadow-sm backdrop-blur-sm">
        <Filters
          placeholder="Search departments by name…"
          search={search}
          onSearchChange={setSearch}
        />
      </div>

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
