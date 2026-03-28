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
import { Trash2, Edit, Building2, LayoutDashboard } from "lucide-react";

export function DepartmentsListPage() {
  const dispatch = useAppDispatch();
  const { showToast } = useToast();
  const departments = useAppSelector((state) => state.departments.items);
  const role = useAppSelector((state) => state.identity.currentUser?.role);
  const isAdmin = role === 3 || role === "ADMIN";
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
      description="Structural management of the organization."
      actions={
        isAdmin ? (
          <Link
            className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-zinc-900/20 transition hover:bg-zinc-800 active:scale-95"
            to="/departments/create"
          >
            + Create Department
          </Link>
        ) : null
      }
    >
      <Filters
        placeholder="Filter by name..."
        search={search}
        onSearchChange={setSearch}
      />
      <DataTable
        columns={[
          {
            key: "name",
            header: "Department",
            render: (row) => (
              <div className="flex items-center gap-3">
                <div className="p-2 bg-zinc-50 border border-zinc-100 rounded-lg">
                  <Building2 size={16} className="text-zinc-400" />
                </div>
                <DepartmentBadge name={row.name} className="font-bold text-zinc-900" />
              </div>
            ),
          },
          {
            key: "type",
            header: "Type",
            render: (row) => (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${row.type === 'PROJECT' ? 'bg-purple-50 text-purple-700 border border-purple-100' : 'bg-slate-50 text-slate-700 border border-slate-100'}`}>
                {row.type || "PERMANENT"}
              </span>
            ),
          },
          {
            key: "head",
            header: "Leader",
            render: (row) => (
              <div className="flex flex-col">
                <span className="text-zinc-900 font-bold text-xs">{row.head || "Unassigned"}</span>
                <span className="text-[10px] text-zinc-400 font-medium">{row.headTitle || "Department Leader"}</span>
              </div>
            ),
          },
          {
            key: "structure",
            header: "Sub-Units",
            render: (row) => (
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest">
                <span className="px-2 py-0.5 bg-zinc-100 text-zinc-600 rounded border border-zinc-200">
                  {row.teams?.length || 0} Teams
                </span>
                <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded border border-indigo-100">
                  {row.positions?.length || 0} Roles
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
                  <div key={idx} className="text-[10px] flex items-center gap-1.5 font-medium text-zinc-500">
                    <span className="text-zinc-900 font-bold">{pos.title}</span>
                    <span className="text-[9px] bg-zinc-100 px-1 rounded">{(pos.members || []).length} staff</span>
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
                  className="p-2 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition border border-transparent hover:border-emerald-100"
                  title="View Structure"
                >
                  <LayoutDashboard size={16} />
                </Link>
                {isAdmin ? (
                  <>
                    <Link
                      to={`/departments/${row.id}/edit`}
                      className="p-2 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition border border-transparent hover:border-indigo-100"
                      title="Edit Structure"
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
                      className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition border border-transparent hover:border-red-100"
                      title="Delete Department"
                    >
                      <Trash2 size={16} />
                    </button>
                  </>
                ) : (
                  <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-widest px-2 py-1 bg-zinc-50 rounded border border-zinc-100">Read Only</span>
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
