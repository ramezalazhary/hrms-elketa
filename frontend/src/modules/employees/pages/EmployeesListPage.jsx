import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { DataTable } from "@/shared/components/DataTable";
import { Filters } from "@/shared/components/Filters";
import { Layout } from "@/shared/components/Layout";
import { Pagination } from "@/shared/components/Pagination";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/reduxHooks";
import { useToast } from "@/shared/components/ToastProvider";
import { fetchEmployeesThunk, deleteEmployeeThunk, processSalaryIncreaseThunk } from "../store";
import { DepartmentBadge, StatusBadge } from "@/shared/components/EntityBadges";
import { Users, UserPlus, Sparkles, TrendingUp, AlertCircle, AlertTriangle } from "lucide-react";
import { FormBuilder } from "@/shared/components/FormBuilder";
import { getDocumentRequirementsApi } from "../../organization/api";

export function EmployeesListPage() {
  const dispatch = useAppDispatch();
  const { showToast } = useToast();
  const employees = useAppSelector((state) => state.employees.items);
  const isLoading = useAppSelector((state) => state.employees.isLoading);
  const role = useAppSelector((state) => state.identity.currentUser?.role);
  const [searchParams, setSearchParams] = useSearchParams();

  const [increaseModalTarget, setIncreaseModalTarget] = useState(null);
  const [orgPolicy, setOrgPolicy] = useState(null);

  useEffect(() => {
    async function loadPolicy() {
      try {
        const data = await getDocumentRequirementsApi();
        setOrgPolicy(data);
      } catch (err) {
        console.error("Failed to load policy for increase defaults", err);
      }
    }
    loadPolicy();
  }, []);

  const search = searchParams.get("search") || "";
  const departmentFilter = searchParams.get("department") || "all";
  const idExpiringSoon = searchParams.get("idExpiringSoon") === "true";
  const idExpired = searchParams.get("idExpired") === "true";
  const recentTransfers = searchParams.get("recentTransfers") === "true";
  const increasePeriod = searchParams.get("increasePeriod") || "all";

  const [sortBy, setSortBy] = useState("name-asc");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    const params = Object.fromEntries(searchParams.entries());
    void dispatch(fetchEmployeesThunk(params));
  }, [dispatch, searchParams]);

  const departmentOptions = useMemo(
    () =>
      Array.from(
        new Set(employees.map((employee) => employee.department)),
      ).sort(),
    [employees],
  );

  const filtered = useMemo(() => {
    const result = [...employees];
    result.sort((a, b) => {
      if (sortBy === "name-asc") return a.fullName.localeCompare(b.fullName);
      if (sortBy === "name-desc") return b.fullName.localeCompare(a.fullName);

      // Handle date sorts (default to 0 if null)
      if (sortBy.startsWith("salary-increase")) {
        const valA = a.yearlySalaryIncreaseDate ? new Date(a.yearlySalaryIncreaseDate).getTime() : 0;
        const valB = b.yearlySalaryIncreaseDate ? new Date(b.yearlySalaryIncreaseDate).getTime() : 0;
        return sortBy === "salary-increase-asc" ? valA - valB : valB - valA;
      }
      if (sortBy.startsWith("id-expiry")) {
        const valA = a.nationalIdExpiryDate ? new Date(a.nationalIdExpiryDate).getTime() : 0;
        const valB = b.nationalIdExpiryDate ? new Date(b.nationalIdExpiryDate).getTime() : 0;
        return sortBy === "id-expiry-asc" ? valA - valB : valB - valA;
      }

      return 0;
    });
    return result;
  }, [employees, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const handleProcessIncrease = async (values) => {
    try {
      await dispatch(processSalaryIncreaseThunk({
        id: increaseModalTarget.id,
        ...values,
        increasePercentage: values.method === "PERCENT" ? values.value : undefined,
        increaseAmount: values.method === "FIXED" ? values.value : undefined,
      })).unwrap();
      showToast(`Salary increase processed for ${increaseModalTarget.fullName}`, "success");
      setIncreaseModalTarget(null);
    } catch (err) {
      showToast(err.message || "Failed to process increase", "error");
    }
  };

  return (
    <Layout
      title="Employees"
      description="Directory, filters, and quick actions for your workforce."
      actions={
        ["ADMIN", "HR_STAFF", 3, "HR_MANAGER"].includes(role) ? (
          <div className="flex gap-2">
            <Link
              className="inline-flex items-center gap-2 rounded-xl border border-teal-200 bg-white px-4 py-2.5 text-sm font-semibold text-teal-700 shadow-sm transition hover:bg-teal-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
              to="/employees/onboarding"
            >
              <Users className="h-4 w-4 opacity-90" />
              Onboarding Requests
            </Link>
            <Link
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal-600/25 transition hover:from-teal-500 hover:to-cyan-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2"
              to="/employees/create"
            >
              <UserPlus className="h-4 w-4 opacity-90" />
              Add employee
            </Link>
          </div>
        ) : null
      }
    >
      {/* Salary Increase Modal */}
      {increaseModalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute right-0 top-0 -mr-8 -mt-8 h-32 w-32 rounded-full bg-teal-500/10 blur-2xl" />
            <div className="relative">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-teal-600" />
                Annual Salary Increase
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Update base salary for <strong>{increaseModalTarget.fullName}</strong>. This will record a transaction and roll the date forward by 1 year.
              </p>
              <div className="mt-6">
                <FormBuilder
                  fields={[
                    {
                      name: "method",
                      label: "Increase Method",
                      type: "radio",
                      required: true,
                      options: [
                        { label: "Percentage (%)", value: "PERCENT" },
                        { label: "Fixed Amount (EGP)", value: "FIXED" },
                      ]
                    },
                    { name: "value", label: "Increase Value", type: "number", required: true },
                    { name: "effectiveDate", label: "Effective Date", type: "date", required: true },
                    { name: "reason", label: "Reason / Notes", type: "textarea", placeholder: "e.g. Annual performance review cycle 2024" },
                  ]}
                  initialValues={{
                    method: "PERCENT",
                    value: (() => {
                      if (!orgPolicy?.salaryIncreaseRules) return "10";
                      const rules = orgPolicy.salaryIncreaseRules;
                      const empMatch = rules.find(r => r.type === "EMPLOYEE" && (r.target === increaseModalTarget.id || r.target === increaseModalTarget.employeeCode));
                      if (empMatch) return empMatch.percentage.toString();
                      const deptMatch = rules.find(r => r.type === "DEPARTMENT" && r.target === increaseModalTarget.department);
                      if (deptMatch) return deptMatch.percentage.toString();
                      const defaultMatch = rules.find(r => r.type === "DEFAULT");
                      return (defaultMatch?.percentage || 10).toString();
                    })(),
                    effectiveDate: new Date().toISOString().split('T')[0],
                    reason: `Annual Salary Increase - ${new Date().getFullYear()}`
                  }}
                  submitLabel="Apply Increase & Save History"
                  onCancel={() => setIncreaseModalTarget(null)}
                  onSubmit={handleProcessIncrease}
                />
              </div>
            </div>
          </div>
        </div>
      )}

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
          onSearchChange={(v) => {
            const next = new URLSearchParams(searchParams);
            if (v) next.set("search", v); else next.delete("search");
            setSearchParams(next);
            setPage(1);
          }}
        />
        <div className="mt-4 grid gap-4 md:grid-cols-4 items-end">
          <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Department
            <select
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm transition focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              value={departmentFilter}
              onChange={(event) => {
                const next = new URLSearchParams(searchParams);
                if (event.target.value !== "all") next.set("department", event.target.value);
                else next.delete("department");
                setSearchParams(next);
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
            Quick Analytics
            <div className="mt-1.5 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  const next = new URLSearchParams(searchParams);
                  if (idExpiringSoon) next.delete("idExpiringSoon");
                  else next.set("idExpiringSoon", "true");
                  setSearchParams(next);
                  setPage(1);
                }}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition flex-1 text-center ${idExpiringSoon ? 'glass-premium glow-amber animate-glow-slow border-amber-200/50 bg-amber-50/50 text-amber-600' : 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100'}`}
              >
                ID Expiry (60d)
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = new URLSearchParams(searchParams);
                  if (recentTransfers) next.delete("recentTransfers");
                  else next.set("recentTransfers", "true");
                  setSearchParams(next);
                  setPage(1);
                }}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition flex-1 text-center ${recentTransfers ? 'glass-premium glow-indigo animate-glow-slow border-indigo-200/50 bg-indigo-50/50 text-indigo-600' : 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100'}`}
              >
                Transfers (30d)
              </button>
            </div>
          </label>

          <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Salary Increase Period
            <select
              value={increasePeriod}
              onChange={(e) => {
                const val = e.target.value;
                const next = new URLSearchParams(searchParams);
                const now = new Date();

                if (val === "all") {
                  next.delete("salaryIncreaseFrom");
                  next.delete("salaryIncreaseTo");
                  next.delete("increasePeriod");
                } else if (val === "this-month") {
                  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
                  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
                  next.set("salaryIncreaseFrom", from);
                  next.set("salaryIncreaseTo", to);
                  next.set("increasePeriod", "this-month");
                } else if (val === "next-month") {
                  const from = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().split('T')[0];
                  const to = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString().split('T')[0];
                  next.set("salaryIncreaseFrom", from);
                  next.set("salaryIncreaseTo", to);
                  next.set("increasePeriod", "next-month");
                }
                setSearchParams(next);
                setPage(Page(1));
              }}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 shadow-sm transition focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            >
              <option value="all">Any time</option>
              <option value="this-month">This Month</option>
              <option value="next-month">Next Month</option>
            </select>
          </label>

          <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Sort Order
            <select
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 shadow-sm transition focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
            >
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
              <option value="salary-increase-asc">Next Salary Increase (Earliest)</option>
              <option value="id-expiry-asc">ID Expiry (Earliest)</option>
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
          { key: "email", header: "Email", render: (row) => row.email || "—" },
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
          {
            key: "keyDates",
            header: "Key Dates",
            render: (row) => {
              const increaseDateObj = row.yearlySalaryIncreaseDate ? new Date(row.yearlySalaryIncreaseDate) : null;
              const increaseDateStr = increaseDateObj ? increaseDateObj.toLocaleDateString() : '—';
              const idExpiryDate = row.nationalIdExpiryDate ? new Date(row.nationalIdExpiryDate).toLocaleDateString() : '—';
              const isIdExpired = row.nationalIdExpiryDate && new Date(row.nationalIdExpiryDate).getTime() < new Date().getTime();
              const isIdExpiringSoon = row.nationalIdExpiryDate && new Date(row.nationalIdExpiryDate).getTime() < new Date().getTime() + 60 * 24 * 60 * 60 * 1000;

              const isIncreaseDue = increaseDateObj && increaseDateObj.getTime() < new Date().getTime() + 7 * 24 * 60 * 60 * 1000;

              return (
                <div className="flex flex-col gap-1 text-[11px] text-slate-500 font-medium">
                  <div className="flex items-center gap-1.5">
                    <span className="w-12 opacity-70">Next Inc:</span>
                    <span className={`px-1.5 py-0.5 rounded flex items-center gap-1 ${isIncreaseDue ? 'text-amber-700 bg-amber-50 font-bold border border-amber-100' : 'text-teal-700 bg-teal-50'}`}>
                      {increaseDateStr}
                      {isIncreaseDue && <AlertCircle className="h-3 w-3" />}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-12 opacity-70">ID Exp:</span>
                    <span className={`px-1.5 py-0.5 rounded flex items-center gap-1 ${isIdExpired ? 'text-rose-800 bg-rose-100 font-bold animate-pulse' : isIdExpiringSoon ? 'text-amber-700 bg-amber-50 font-bold' : 'text-slate-600 bg-slate-50'}`}>
                      {idExpiryDate}
                      {isIdExpired && <AlertTriangle className="h-3 w-3" />}
                    </span>
                  </div>
                </div>
              );
            }
          },
          {
            key: "actions",
            header: "Actions",
            render: (row) => {
              const increaseDateObj = row.yearlySalaryIncreaseDate ? new Date(row.yearlySalaryIncreaseDate) : null;
              const isIncreaseDue = increaseDateObj && increaseDateObj.getTime() < new Date().getTime() + 15 * 24 * 60 * 60 * 1000;
              const canModify = ["ADMIN", "HR_STAFF", "HR_MANAGER"].includes(role);

              return (
                <div className="flex items-center gap-2">
                  <Link
                    className="rounded-lg px-2 py-1 text-sm font-medium text-teal-700 transition hover:bg-teal-50"
                    to={`/employees/${row.id}`}
                  >
                    View
                  </Link>
                  {canModify && (
                    <>
                      {isIncreaseDue && (
                        <button
                          type="button"
                          onClick={() => setIncreaseModalTarget(row)}
                          className="flex items-center gap-1 rounded-lg bg-teal-600 px-2 py-1 text-[11px] font-bold text-white shadow-sm transition hover:bg-teal-500"
                        >
                          <TrendingUp className="h-3 w-3" />
                          Process Increase
                        </button>
                      )}
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
                        className="text-red-500 hover:text-red-600 transition"
                      >
                        <Users className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              );
            },
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
