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
      title="Employees List"
      description="Manage employee records, role assignments, and profile access."
    actions={
        (["ADMIN", "HR_STAFF", "MANAGER", 2, 3].includes(role)) ? (
          <Link
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-card transition-colors hover:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-zinc-400"
            to="/employees/create"
          >
            + Create Employee
          </Link>
        ) : null
      }
    >
      <Filters
        placeholder="Search by employee name..."
        search={search}
        onSearchChange={setSearch}
      />
      <div className="mb-4 grid gap-2 md:grid-cols-2">
        <label className="text-sm font-medium text-slate-700">
          Department
          <select
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
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

        <label className="text-sm font-medium text-slate-700">
          Sort
          <select
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value)}
          >
            <option value="name-asc">Name (A-Z)</option>
            <option value="name-desc">Name (Z-A)</option>
          </select>
        </label>
      </div>
      {isLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
          Loading employees...
        </div>
      ) : null}
      <DataTable
        columns={[
          {
            key: "code",
            header: "Code",
            render: (row) => (
              <span className="font-mono text-xs font-semibold text-slate-500 bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded">
                {row.employeeCode || "N/A"}
              </span>
            ),
          },
          {
            key: "name",
            header: "Name",
            render: (row) => (
              <Link className="underline underline-offset-4" to={`/employees/${row.id}`}>
                <span className="font-medium text-zinc-900 hover:underline">
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
                <Link className="underline underline-offset-4" to={`/employees/${row.id}`}>
                  <span className="text-zinc-800 hover:underline font-medium">View</span>
                </Link>
                {(["ADMIN", "HR_STAFF", 3].includes(role)) ? (
                  <>
                    <Link className="underline underline-offset-4" to={`/employees/${row.id}/edit`}>
                      <span className="text-emerald-700 hover:text-emerald-800 font-medium">Edit</span>
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
