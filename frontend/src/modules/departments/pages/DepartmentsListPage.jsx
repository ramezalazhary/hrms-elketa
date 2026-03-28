import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { DataTable } from "@/shared/components/DataTable";
import { Filters } from "@/shared/components/Filters";
import { Layout } from "@/shared/components/Layout";
import { Pagination } from "@/shared/components/Pagination";
import { useToast } from "@/shared/components/ToastProvider";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/reduxHooks";
import { fetchDepartmentsThunk, deleteDepartmentThunk } from "../store";

export function DepartmentsListPage() {
  const dispatch = useAppDispatch();
  const { showToast } = useToast();
  const departments = useAppSelector((state) => state.departments.items);
  const role = useAppSelector((state) => state.identity.currentUser?.role);
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
      title="Departments List"
      description="Review department structures and ownership."
      actions={
        (role === 3 || role === "ADMIN") ? (
          <Link
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
            to="/departments/create"
          >
            + Add Department
          </Link>
        ) : null
      }
    >
      <Filters
        placeholder="Search departments..."
        search={search}
        onSearchChange={setSearch}
      />
      <DataTable
        columns={[
          { key: "name", header: "Name", render: (row) => row.name },
          {
            key: "type",
            header: "Type",
            render: (row) => (
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tight ${row.type === 'PROJECT' ? 'bg-purple-50 text-purple-700 border border-purple-100' : 'bg-slate-50 text-slate-700 border border-slate-100'}`}>
                {row.type || "PERMANENT"}
              </span>
            ),
          },
          {
            key: "head",
            header: "Manager",
            render: (row) => (
              <span className="text-slate-900 font-medium">{row.head || "Not assigned"}</span>
            ),
          },
          {
            key: "teams",
            header: "Teams",
            render: (row) => (
              <span className="text-slate-600 font-semibold">{row.teams?.length || 0} teams</span>
            ),
          },
          {
            key: "positions",
            header: "Positions",
            render: (row) => (
              <div>
                {row.positions.length > 0 ? (
                  row.positions.map((pos, index) => (
                    <div
                      key={pos.id ?? `${pos.title}-${pos.level}-${index}`}
                      className="text-sm"
                    >
                      {pos.title} ({pos.level})
                    </div>
                  ))
                ) : (
                  <span className="text-slate-500">No positions</span>
                )}
              </div>
            ),
          },
          {
            key: "actions",
            header: "Actions",
            render: (row) => (
              <div className="flex gap-2">
                {(role === 3 || role === "ADMIN") ? (
                  <>
                    <Link
                      to={`/departments/${row.id}/edit`}
                      className="rounded-lg bg-gray-600 px-3 py-1 text-sm text-white hover:bg-gray-700"
                    >
                      Edit
                    </Link>
                    <button
                      type="button"
                      onClick={async () => {
                        if (
                          !window.confirm(
                            `Delete department '${row.name}'?`,
                          )
                        ) {
                          return;
                        }
                        try {
                          await dispatch(deleteDepartmentThunk(row.id)).unwrap();
                          showToast("Department deleted", "success");
                        } catch (error) {
                          console.error(error);
                          showToast("Failed to delete department", "error");
                        }
                      }}
                      className="rounded-lg bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700"
                    >
                      Delete
                    </button>
                  </>
                ) : null}
              </div>
            ),
          },
        ]}
        data={paged}
      />
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </Layout>
  );
}
