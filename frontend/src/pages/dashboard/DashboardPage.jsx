import { useEffect, useMemo } from "react";
import { Layout } from "@/shared/components/Layout";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/reduxHooks";
import { fetchDepartmentsThunk } from "@/modules/departments/store";
import { fetchEmployeesThunk } from "@/modules/employees/store";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { StatusBadge } from "@/shared/components/EntityBadges";

const STATUS_PIE_COLORS = {
  Active: "#10b981",
  "On Leave": "#f59e0b",
  Resigned: "#64748b",
  Terminated: "#ef4444",
};

function EmployeeDashboard({ currentUser }) {
  return (
    <Layout
      title={`Welcome, ${currentUser?.email?.split("@")[0] || "Employee"}`}
      description="Your profile overview."
    >
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <article className="rounded-lg border border-zinc-200 bg-white p-6 shadow-card flex flex-col items-center col-span-1 lg:col-span-1">
          <div className="h-20 w-20 rounded-full border border-zinc-200 bg-zinc-50 mb-4 flex items-center justify-center text-zinc-700 text-xl font-medium">
            {currentUser?.email?.[0]?.toUpperCase() || "U"}
          </div>
          <h2 className="text-sm font-medium text-zinc-900">{currentUser?.email || "User"}</h2>
          <span className="mt-2 text-[11px] font-medium text-zinc-500 uppercase tracking-wide">
            Employee
          </span>
        </article>

        <article className="rounded-lg border border-zinc-200 bg-white p-6 shadow-card col-span-1 lg:col-span-2">
          <h3 className="text-sm font-medium text-zinc-900 mb-4">Analytics</h3>
          <div className="rounded-md border border-dashed border-zinc-200 bg-zinc-50/50 p-8 text-center min-h-[12rem] flex flex-col items-center justify-center">
            <p className="text-sm text-zinc-600">Personal metrics will appear here when enabled.</p>
            <p className="text-xs text-zinc-400 mt-2">Optional HR modules.</p>
          </div>
        </article>
      </div>
    </Layout>
  );
}

function TeamLeaderDashboard({ employees }) {
  return (
    <Layout title="Team" description="Members you manage.">
      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-card">
        <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
          <h2 className="text-sm font-medium text-zinc-900">Team members</h2>
          <span className="text-xs text-zinc-500 tabular-nums">{employees.length}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50/80">
                <th className="px-4 py-3 text-[11px] font-medium text-zinc-500 uppercase tracking-wide">
                  Name
                </th>
                <th className="px-4 py-3 text-[11px] font-medium text-zinc-500 uppercase tracking-wide">
                  Position
                </th>
                <th className="px-4 py-3 text-[11px] font-medium text-zinc-500 uppercase tracking-wide">
                  Status
                </th>
                <th className="px-4 py-3 text-[11px] font-medium text-zinc-500 uppercase tracking-wide">
                  Email
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {employees.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-4 py-10 text-center text-sm text-zinc-500">
                    No team members yet.
                  </td>
                </tr>
              ) : (
                employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-zinc-50/80">
                    <td className="px-4 py-3">
                      <div className="font-medium text-zinc-900">{emp.fullName}</div>
                      <div className="text-xs text-zinc-400">{emp.employeeCode}</div>
                    </td>
                    <td className="px-4 py-3 text-zinc-600">{emp.position}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={emp.status} />
                    </td>
                    <td className="px-4 py-3 text-zinc-500">{emp.email}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}

function AdminDashboard({ employees, departments, employeesPerDepartment }) {
  const totalPayroll = useMemo(() => {
    return employees.reduce((sum, emp) => sum + (emp.financial?.baseSalary || 0), 0);
  }, [employees]);

  const activeEmployees = employees.filter((e) => e.status === "ACTIVE").length;

  const statusData = useMemo(() => {
    const statuses = { ACTIVE: 0, ON_LEAVE: 0, RESIGNED: 0, TERMINATED: 0 };
    employees.forEach((emp) => {
      if (statuses[emp.status] !== undefined) statuses[emp.status]++;
    });
    return [
      { name: "Active", value: statuses.ACTIVE },
      { name: "On Leave", value: statuses.ON_LEAVE },
      { name: "Resigned", value: statuses.RESIGNED },
      { name: "Terminated", value: statuses.TERMINATED },
    ]
      .filter((s) => s.value > 0)
      .map((s) => ({
        ...s,
        color: STATUS_PIE_COLORS[s.name] || "#71717a",
      }));
  }, [employees]);

  const deptData = useMemo(() => {
    return employeesPerDepartment
      .map((d) => ({
        name: d.departmentName,
        members: d.employeeCount,
      }))
      .sort((a, b) => b.members - a.members);
  }, [employeesPerDepartment]);

  return (
    <Layout
      title="Overview"
      description="Headcount, payroll, and distribution."
    >
      <div className="grid gap-4 md:grid-cols-4 mb-8">
        <article className="rounded-lg border border-zinc-200 bg-white p-4 shadow-card">
          <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wide">Headcount</p>
          <div className="mt-2 flex flex-wrap items-baseline gap-2">
            <p className="text-2xl font-medium text-zinc-900 tabular-nums">{employees.length}</p>
            <span className="text-xs text-zinc-500">{activeEmployees} active</span>
          </div>
        </article>
        <article className="rounded-lg border border-zinc-200 bg-white p-4 shadow-card">
          <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wide">Payroll</p>
          <p className="mt-2 text-2xl font-medium text-zinc-900 tabular-nums">
            {new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: "USD",
              maximumFractionDigits: 0,
            }).format(totalPayroll)}
          </p>
        </article>
        <article className="rounded-lg border border-zinc-200 bg-white p-4 shadow-card">
          <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wide">Departments</p>
          <p className="mt-2 text-2xl font-medium text-zinc-900 tabular-nums">{departments.length}</p>
        </article>
        <article className="rounded-lg border border-zinc-200 bg-white p-4 shadow-card">
          <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wide">Avg / dept</p>
          <p className="mt-2 text-2xl font-medium text-zinc-900 tabular-nums">
            {departments.length > 0 ? (employees.length / departments.length).toFixed(1) : "0.0"}
          </p>
        </article>
      </div>

      <div className="grid gap-6 md:grid-cols-2 mb-8">
        <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-card">
          <h2 className="mb-4 text-sm font-medium text-zinc-900">Status</h2>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: "6px",
                    border: "1px solid #e4e4e7",
                    fontSize: "12px",
                  }}
                />
                <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: "12px" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-card">
          <h2 className="mb-4 text-sm font-medium text-zinc-900">By department</h2>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={deptData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "#71717a" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis tick={{ fontSize: 11, fill: "#71717a" }} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: "#fafafa" }}
                  contentStyle={{
                    borderRadius: "6px",
                    border: "1px solid #e4e4e7",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="members" fill="#3f3f46" radius={[2, 2, 0, 0]} barSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </Layout>
  );
}

export function DashboardPage() {
  const dispatch = useAppDispatch();
  const currentUser = useAppSelector((state) => state.identity.currentUser);
  const role = currentUser?.role || 1;

  const employees = useAppSelector((state) => state.employees.items);
  const departments = useAppSelector((state) => state.departments.items);

  useEffect(() => {
    if (role >= 2 || ["TEAM_LEADER", "MANAGER", "HR_STAFF", "ADMIN"].includes(role)) {
      void dispatch(fetchEmployeesThunk());
      void dispatch(fetchDepartmentsThunk());
    }
  }, [dispatch, role]);

  const employeesPerDepartment = useMemo(() => {
    const counts = new Map();

    for (const department of departments) {
      counts.set(department.name, 0);
    }

    for (const employee of employees) {
      counts.set(employee.department, (counts.get(employee.department) ?? 0) + 1);
    }

    return Array.from(counts.entries()).map(([departmentName, employeeCount]) => ({
      departmentName,
      employeeCount,
    }));
  }, [departments, employees]);

  if (role === 1 || role === "EMPLOYEE") {
    return <EmployeeDashboard currentUser={currentUser} />;
  }

  if (role === 2 || role === "MANAGER") {
    return <TeamLeaderDashboard employees={employees} />;
  }

  if (role === "TEAM_LEADER") {
    return <TeamLeaderDashboard employees={employees} />;
  }

  return (
    <AdminDashboard
      employees={employees}
      departments={departments}
      employeesPerDepartment={employeesPerDepartment}
    />
  );
}
