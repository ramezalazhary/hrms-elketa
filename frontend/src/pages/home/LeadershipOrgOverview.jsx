import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  Building2,
  Users,
  Layers,
  Wallet,
  UserCheck,
  Plane,
  Briefcase,
  MapPin,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import { Layout } from "@/shared/components/Layout";
import { DepartmentBadge } from "@/shared/components/EntityBadges";

const CHART_COLORS = ["#3f3f46", "#71717a", "#a1a1aa", "#d4d4d8", "#10b981", "#f59e0b", "#6366f1"];
const STATUS_COLORS = {
  ACTIVE: "#10b981",
  ON_LEAVE: "#f59e0b",
  RESIGNED: "#64748b",
  TERMINATED: "#ef4444",
};

function formatMoney(n, currency = "USD") {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
}

function yearsSince(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return (Date.now() - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
}

/**
 * Rich org + workforce analytics for Admin / HR / managers (data = whatever the API returns for the user).
 */
export function LeadershipOrgOverview({
  currentUser,
  employees,
  departments,
  teams,
  isLoading,
}) {
  const teamCountByDepartmentId = useMemo(() => {
    const m = new Map();
    for (const t of teams) {
      const raw = t.departmentId;
      const id = raw != null ? String(raw) : "";
      if (!id) continue;
      m.set(id, (m.get(id) || 0) + 1);
    }
    return m;
  }, [teams]);
  const metrics = useMemo(() => {
    const total = employees.length;
    const byStatus = { ACTIVE: 0, ON_LEAVE: 0, RESIGNED: 0, TERMINATED: 0 };
    const byEmployment = {};
    const byGender = {};
    const byLocation = {};
    let payrollSum = 0;
    let payrollCount = 0;
    let newHires90 = 0;
    const now = Date.now();
    const ms90 = 90 * 24 * 60 * 60 * 1000;

    for (const e of employees) {
      if (byStatus[e.status] !== undefined) byStatus[e.status]++;
      const et = e.employmentType || "UNKNOWN";
      byEmployment[et] = (byEmployment[et] || 0) + 1;
      const g = e.gender || "UNKNOWN";
      byGender[g] = (byGender[g] || 0) + 1;
      const loc = (e.workLocation || "Not set").trim() || "Not set";
      byLocation[loc] = (byLocation[loc] || 0) + 1;

      const sal = e.financial?.baseSalary;
      if (typeof sal === "number" && sal > 0) {
        payrollSum += sal;
        payrollCount++;
      }
      if (e.dateOfHire) {
        const t = new Date(e.dateOfHire).getTime();
        if (!Number.isNaN(t) && now - t <= ms90) newHires90++;
      }
    }

    const tenureBuckets = { under1: 0, y1_3: 0, y3_5: 0, over5: 0, unknown: 0 };
    for (const e of employees) {
      const y = yearsSince(e.dateOfHire);
      if (y == null) {
        tenureBuckets.unknown++;
        continue;
      }
      if (y < 1) tenureBuckets.under1++;
      else if (y < 3) tenureBuckets.y1_3++;
      else if (y < 5) tenureBuckets.y3_5++;
      else tenureBuckets.over5++;
    }

    const active = byStatus.ACTIVE;
    const onLeave = byStatus.ON_LEAVE;

    return {
      total,
      byStatus,
      byEmployment,
      byGender,
      byLocation,
      payrollSum,
      payrollCount,
      avgSalary: payrollCount ? payrollSum / payrollCount : 0,
      newHires90,
      active,
      onLeave,
      activeRate: total ? Math.round((active / total) * 1000) / 10 : 0,
      tenureBuckets,
    };
  }, [employees]);

  const departmentRows = useMemo(() => {
    const map = new Map();
    for (const d of departments) {
      const did = d.id != null ? String(d.id) : "";
      const fromTeams = did ? teamCountByDepartmentId.get(did) : undefined;
      const nestedTeams = Array.isArray(d.teams) ? d.teams.length : 0;
      map.set(d.name, {
        id: d.id,
        name: d.name,
        head: d.head || "—",
        positionsDefined: Array.isArray(d.positions) ? d.positions.length : 0,
        teamCount: fromTeams ?? nestedTeams,
        headcount: 0,
        active: 0,
        onLeave: 0,
        payroll: 0,
      });
    }
    for (const e of employees) {
      const name = e.department || "—";
      if (!map.has(name)) {
        map.set(name, {
          id: null,
          name,
          head: "—",
          positionsDefined: 0,
          teamCount: 0,
          headcount: 0,
          active: 0,
          onLeave: 0,
          payroll: 0,
        });
      }
      const row = map.get(name);
      row.headcount++;
      if (e.status === "ACTIVE") row.active++;
      if (e.status === "ON_LEAVE") row.onLeave++;
      const sal = e.financial?.baseSalary;
      if (typeof sal === "number" && sal > 0) row.payroll += sal;
    }
    const totalEmp = employees.length || 1;
    return Array.from(map.values())
      .map((r) => ({
        ...r,
        share: Math.round((r.headcount / totalEmp) * 1000) / 10,
      }))
      .sort((a, b) => b.headcount - a.headcount);
  }, [employees, departments, teamCountByDepartmentId]);

  const topDepartmentsChart = useMemo(() => {
    return departmentRows.slice(0, 12).map((r) => ({
      name: r.name.length > 18 ? `${r.name.slice(0, 16)}…` : r.name,
      fullName: r.name,
      employees: r.headcount,
    }));
  }, [departmentRows]);

  const statusPieData = useMemo(() => {
    const m = metrics.byStatus;
    return [
      { name: "Active", value: m.ACTIVE, color: STATUS_COLORS.ACTIVE },
      { name: "On leave", value: m.ON_LEAVE, color: STATUS_COLORS.ON_LEAVE },
      { name: "Resigned", value: m.RESIGNED, color: STATUS_COLORS.RESIGNED },
      { name: "Terminated", value: m.TERMINATED, color: STATUS_COLORS.TERMINATED },
    ].filter((x) => x.value > 0);
  }, [metrics.byStatus]);

  const employmentData = useMemo(() => {
    return Object.entries(metrics.byEmployment)
      .map(([key, value]) => ({
        name: key.replace(/_/g, " "),
        value,
      }))
      .filter((x) => x.value > 0);
  }, [metrics.byEmployment]);

  const genderData = useMemo(() => {
    return Object.entries(metrics.byGender)
      .map(([key, value]) => ({
        name: key.replace(/_/g, " "),
        value,
      }))
      .filter((x) => x.value > 0);
  }, [metrics.byGender]);

  const locationData = useMemo(() => {
    return Object.entries(metrics.byLocation)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [metrics.byLocation]);

  const tenureSeries = useMemo(() => {
    const t = metrics.tenureBuckets;
    return [
      { range: "< 1 yr", count: t.under1 },
      { range: "1–3 yr", count: t.y1_3 },
      { range: "3–5 yr", count: t.y3_5 },
      { range: "5+ yr", count: t.over5 },
      { range: "Unknown", count: t.unknown },
    ];
  }, [metrics.tenureBuckets]);

  const positionMix = useMemo(() => {
    const map = new Map();
    for (const e of employees) {
      const p = (e.position || "Unspecified").trim() || "Unspecified";
      map.set(p, (map.get(p) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([title, count]) => ({ title, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
  }, [employees]);

  const openPositionsTotal = useMemo(() => {
    return departments.reduce((s, d) => s + (Array.isArray(d.positions) ? d.positions.length : 0), 0);
  }, [departments]);

  const name = currentUser?.email?.split("@")[0] || "User";

  return (
    <Layout
      className="max-w-[min(100%,1440px)]"
      title={`Organization overview`}
      description={`Workforce and structure snapshot for ${name}. Data reflects employees and departments you can access.`}
      actions={
        <div className="flex flex-wrap gap-2">
          <Link
            to="/employees"
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
          >
            Employees <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <Link
            to="/organizations"
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
          >
            Structure <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      }
    >
      {isLoading ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-12 text-center text-sm text-zinc-500">
          Loading organization data…
        </div>
      ) : (
        <div className="space-y-8">
          {/* KPI strip */}
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
            <Kpi icon={Users} label="Total people" value={metrics.total} sub={`${metrics.activeRate}% active`} />
            <Kpi icon={UserCheck} label="Active" value={metrics.active} />
            <Kpi icon={Plane} label="On leave" value={metrics.onLeave} />
            <Kpi icon={Building2} label="Departments" value={departments.length} />
            <Kpi icon={Layers} label="Teams" value={teams.length} />
            <Kpi
              icon={Wallet}
              label="Payroll (sum)"
              value={formatMoney(metrics.payrollSum)}
              sub={metrics.payrollCount ? `Avg ${formatMoney(metrics.avgSalary)}` : "No salary data"}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-card">
              <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                <TrendingUp className="h-3.5 w-3.5" />
                New hires (90d)
              </div>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-zinc-900">{metrics.newHires90}</p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-card">
              <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                <Briefcase className="h-3.5 w-3.5" />
                Role templates (dept)
              </div>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-zinc-900">{openPositionsTotal}</p>
              <p className="text-xs text-zinc-500 mt-1">Defined positions across departments</p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-card sm:col-span-2">
              <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                <MapPin className="h-3.5 w-3.5" />
                Top locations
              </div>
              <p className="mt-2 text-sm text-zinc-700 line-clamp-2">
                {locationData.length === 0
                  ? "—"
                  : locationData
                      .slice(0, 3)
                      .map((l) => `${l.name} (${l.value})`)
                      .join(" · ")}
              </p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <ChartCard title="Status distribution">
              <div className="h-[280px] w-full">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={statusPieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={58}
                      outerRadius={88}
                      paddingAngle={2}
                    >
                      {statusPieData.map((entry, i) => (
                        <Cell key={entry.name} fill={entry.color || CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            <ChartCard title="Employment type">
              <div className="h-[280px] w-full">
                {employmentData.length === 0 ? (
                  <p className="text-sm text-zinc-500 flex items-center justify-center h-full">No employment type data</p>
                ) : (
                  <ResponsiveContainer>
                    <BarChart data={employmentData} layout="vertical" margin={{ left: 8, right: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e4e4e7" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#3f3f46" radius={[0, 2, 2, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </ChartCard>
          </div>

          <ChartCard title="Headcount by department (top 12)">
            <div className="h-[320px] w-full">
              <ResponsiveContainer>
                <BarChart data={topDepartmentsChart} margin={{ top: 8, right: 8, left: 0, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip
                    formatter={(v, _n, p) => [v, "Employees"]}
                    labelFormatter={(_, p) => p?.payload?.fullName ?? ""}
                  />
                  <Bar dataKey="employees" fill="#3f3f46" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <div className="grid gap-6 lg:grid-cols-2">
            <ChartCard title="Tenure (years of service)">
              <div className="h-[240px] w-full">
                <ResponsiveContainer>
                  <BarChart data={tenureSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
                    <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#3f3f46" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            <ChartCard title="Gender (self-reported)">
              <div className="h-[240px] w-full">
                {genderData.length === 0 ? (
                  <p className="text-sm text-zinc-500 flex items-center justify-center h-full">No gender data</p>
                ) : (
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={genderData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={78}
                      >
                        {genderData.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </ChartCard>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white shadow-card overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="text-sm font-medium text-zinc-900">Department breakdown</h3>
              <span className="text-xs text-zinc-500">{departmentRows.length} departments</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50/80">
                    <th className="px-4 py-3 text-[11px] font-medium text-zinc-500 uppercase tracking-wide">
                      Department
                    </th>
                    <th className="px-4 py-3 text-[11px] font-medium text-zinc-500 uppercase tracking-wide">
                      Head
                    </th>
                    <th className="px-4 py-3 text-[11px] font-medium text-zinc-500 uppercase tracking-wide text-right">
                      People
                    </th>
                    <th className="px-4 py-3 text-[11px] font-medium text-zinc-500 uppercase tracking-wide text-right">
                      Active
                    </th>
                    <th className="px-4 py-3 text-[11px] font-medium text-zinc-500 uppercase tracking-wide text-right">
                      Leave
                    </th>
                    <th className="px-4 py-3 text-[11px] font-medium text-zinc-500 uppercase tracking-wide text-right">
                      % workforce
                    </th>
                    <th className="px-4 py-3 text-[11px] font-medium text-zinc-500 uppercase tracking-wide text-right">
                      Payroll Σ
                    </th>
                    <th className="px-4 py-3 text-[11px] font-medium text-zinc-500 uppercase tracking-wide text-right">
                      Teams
                    </th>
                    <th className="px-4 py-3 text-[11px] font-medium text-zinc-500 uppercase tracking-wide text-right">
                      Roles def.
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {departmentRows.map((row) => (
                    <tr key={row.name} className="hover:bg-zinc-50/80">
                      <td className="px-4 py-2.5">
                        <DepartmentBadge name={row.name} />
                      </td>
                      <td className="px-4 py-2.5 text-zinc-600 text-xs max-w-[140px] truncate" title={row.head}>
                        {row.head}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-medium">{row.headcount}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-zinc-600">{row.active}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-zinc-600">{row.onLeave}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-zinc-500">{row.share}%</td>
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums text-zinc-700">
                        {row.payroll > 0 ? formatMoney(row.payroll) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-zinc-600">{row.teamCount}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-zinc-600">{row.positionsDefined}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white shadow-card overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-100">
              <h3 className="text-sm font-medium text-zinc-900">Top job titles (headcount)</h3>
              <p className="text-xs text-zinc-500 mt-0.5">Most common position titles in the directory</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50/80">
                    <th className="px-4 py-2.5 text-[11px] font-medium text-zinc-500 uppercase tracking-wide">#</th>
                    <th className="px-4 py-2.5 text-[11px] font-medium text-zinc-500 uppercase tracking-wide">
                      Title
                    </th>
                    <th className="px-4 py-2.5 text-[11px] font-medium text-zinc-500 uppercase tracking-wide text-right">
                      People
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {positionMix.map((row, idx) => (
                    <tr key={row.title} className="hover:bg-zinc-50/80">
                      <td className="px-4 py-2 text-zinc-400 tabular-nums">{idx + 1}</td>
                      <td className="px-4 py-2 text-zinc-800">{row.title}</td>
                      <td className="px-4 py-2 text-right tabular-nums font-medium">{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-4 text-xs text-zinc-600">
            <p className="font-medium text-zinc-800 mb-1">Reading this dashboard</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Counts and payroll use employee records you are allowed to see (API may scope by role).</li>
              <li>Payroll sums only include employees with a numeric base salary on file.</li>
              <li>Tenure uses hire date; unknown hire dates appear in the “Unknown” bucket.</li>
            </ul>
          </div>
        </div>
      )}
    </Layout>
  );
}

function Kpi({ icon: Icon, label, value, sub }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-card">
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {label}
      </div>
      <p className="mt-2 text-xl font-semibold tabular-nums text-zinc-900 leading-tight">{value}</p>
      {sub ? <p className="text-[11px] text-zinc-500 mt-1">{sub}</p> : null}
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-card">
      <h3 className="text-sm font-medium text-zinc-900 mb-3">{title}</h3>
      {children}
    </div>
  );
}
