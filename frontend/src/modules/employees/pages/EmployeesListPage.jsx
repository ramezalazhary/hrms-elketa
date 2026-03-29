import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { DataTable } from "@/shared/components/DataTable";
import { Filters } from "@/shared/components/Filters";
import { Layout } from "@/shared/components/Layout";
import { Pagination } from "@/shared/components/Pagination";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/reduxHooks";
import { useToast } from "@/shared/components/ToastProvider";
import { fetchEmployeesThunk, deleteEmployeeThunk } from "../store";
import { DepartmentBadge, StatusBadge } from "@/shared/components/EntityBadges";
import { Users, UserPlus, Sparkles } from "lucide-react";

export function EmployeesListPage() {
  const dispatch = useAppDispatch();
  const { showToast } = useToast();
  const employees = useAppSelector((state) => state.employees.items);
  const isLoading = useAppSelector((state) => state.employees.isLoading);
  const role = useAppSelector((state) => state.identity.currentUser?.role);
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name-asc");
  const [page, setPage] = useState(1);
  const pageSize = 5;

  useEffect(() => {
    void dispatch(fetchEmployeesThunk());
  }, [dispatch]);

  const departmentOptions = useMemo(
    () =>
      Array.from(
        new Set(employees.map((employee) => employee.department)),
      ).sort(),
    [employees],
  );

  const filtered = useMemo(() => {
    const result = employees.filter((employee) => {
      const byName = employee.fullName
        .toLowerCase()
        .includes(search.toLowerCase());
      const byCode = (employee.employeeCode || "")
        .toLowerCase()
        .includes(search.toLowerCase());
      const byDepartment =
        departmentFilter === "all"
          ? true
          : employee.department === departmentFilter;
      return (byName || byCode) && byDepartment;
    });

    result.sort((a, b) => {
      if (sortBy === "name-asc") return a.fullName.localeCompare(b.fullName);
      return b.fullName.localeCompare(a.fullName);
    });

    return result;
  }, [departmentFilter, employees, search, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <Layout
      title="Employees"
      description="Directory, filters, and quick actions for your workforce."
      actions={
        ["ADMIN", "HR_STAFF", 3].includes(role) ? (
          <Link
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal-600/25 transition hover:from-teal-500 hover:to-cyan-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2"
            to="/employees/create"
          >
            <UserPlus className="h-4 w-4 opacity-90" />
            Add employee
          </Link>
        ) : null
      }
    >
      <div className="relative overflow-hidden rounded-2xl border border-teal-100/80 bg-gradient-to-br from-teal-50/90 via-white to-violet-50/60 p-5 shadow-sm ring-1 ring-teal-500/10 md:p-6">
        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-cyan-400/20 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-10 left-1/4 h-24 w-24 rounded-full bg-violet-400/15 blur-2xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-md">
              <Users className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-800">Workforce overview</p>
              <p className="mt-0.5 text-xs text-slate-500">
                <span className="font-semibold text-teal-700">{employees.length}</span> total
                {search || departmentFilter !== "all" ? (
                  <>
                    {" · "}
                    <span className="font-semibold text-violet-700">{filtered.length}</span> match filters
                  </>
                ) : null}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-teal-200/60 bg-white/80 px-3 py-2 text-xs text-teal-900 backdrop-blur-sm">
            <Sparkles className="h-3.5 w-3.5 text-teal-600" />
            Refine with search and department below
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200/80 bg-white/90 p-4 shadow-sm backdrop-blur-sm md:p-5">
        <Filters
          placeholder="Search by name or employee code…"
          search={search}
          onSearchChange={setSearch}
        />
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Department
            <select
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm transition focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              value={departmentFilter}
              onChange={(event) => {
                setDepartmentFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="all">All departments</option>
              {departmentOptions.map((department) => (
                <option key={department} value={department}>
                  {department}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Sort
            <select
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm transition focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
            >
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
            </select>
          </label>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-3 rounded-xl border border-teal-100 bg-teal-50/40 px-4 py-3 text-sm text-teal-900">
          <span className="inline-block h-4 w-4 animate-pulse rounded-full bg-teal-400" />
          Loading employees…
        </div>
      ) : null}

      <DataTable
        columns={[
          {
            key: "code",
            header: "Code",
            render: (row) => (
              <span className="rounded-md border border-teal-200/80 bg-gradient-to-r from-teal-50 to-cyan-50 px-2 py-1 font-mono text-xs font-semibold text-teal-900">
                {row.employeeCode || "N/A"}
              </span>
            ),
          },
          {
            key: "name",
            header: "Name",
            render: (row) => (
              <Link
                className="group inline-flex items-center gap-1 font-medium text-slate-900 transition hover:text-teal-700"
                to={`/employees/${row.id}`}
              >
                <span className="border-b border-transparent group-hover:border-teal-300">
                  {row.fullName}
                </span>
              </Link>
            ),
          },
          { key: "email", header: "Email", render: (row) => row.email },
          {
            key: "department",
            header: "Department",
            render: (row) => <DepartmentBadge name={row.department || "—"} />,
          },
          {
            key: "status",
            header: "Status",
            render: (row) => <StatusBadge status={row.status} />,
          },
          { key: "position", header: "Position", render: (row) => row.position },
          {
            key: "actions",
            header: "Actions",
            render: (row) => (
              <div className="flex gap-3">
                <Link
                  className="rounded-lg px-2 py-1 text-sm font-medium text-teal-700 transition hover:bg-teal-50"
                  to={`/employees/${row.id}`}
                >
                  View
                </Link>
                {["ADMIN", "HR_STAFF", 3].includes(role) ? (
                  <>
                    <Link
                      className="rounded-lg px-2 py-1 text-sm font-medium text-violet-700 transition hover:bg-violet-50"
                      to={`/employees/${row.id}/edit`}
                    >
                      Edit
                    </Link>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!window.confirm(`Delete employee '${row.fullName}'?`)) return;
                        try {
                          await dispatch(deleteEmployeeThunk(row.id)).unwrap();
                          showToast("Employee deleted", "success");
                        } catch (error) {
                          console.error(error);
                          showToast(error.message || "Failed to delete employee", "error");
                        }
                      }}
                      className="text-red-600 hover:text-red-700 font-medium"
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
        emptyText="No employees match your filters."
        getRowKey={(row) => row.id}
      />
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </Layout>
  );
}
