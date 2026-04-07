import { useMemo, useState, useEffect } from "react";
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
  AlertTriangle,
  Clock,
  ChevronDown,
  ChevronUp,
  Download,
  RefreshCw,
  FileSpreadsheet,
} from "lucide-react";
import { Layout } from "@/shared/components/Layout";
import { DepartmentBadge } from "@/shared/components/EntityBadges";
import { downloadBulkTemplateApi, uploadBulkFileApi, getAlertsFeedApi } from "@/modules/bulk/api";
import { useAppSelector } from "@/shared/hooks/reduxHooks";

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

function yearsSince(dateStr, asOfMs) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return (asOfMs - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
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
  const [asOfMs] = useState(() => Date.now());
  const accessToken = useAppSelector((state) => state.identity.accessToken);
  const [alerts, setAlerts] = useState([]);
  const [alertsExpanded, setAlertsExpanded] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleDownloadTemplate = async () => {
    try {
      const blob = await downloadBulkTemplateApi();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "HRMS_Template.xlsx";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      alert("Custom template download failed.");
    }
  };

  const handleUploadSync = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const confirmed = window.confirm(
      "⚠️ CRITICAL ACTION: This will PERMANENTLY DELETE organizational data and replace it from the file. The server must have ALLOW_DESTRUCTIVE_BULK=true or the upload will be rejected. \n\nAre you absolutely sure you want to proceed?"
    );

    if (!confirmed) {
      e.target.value = "";
      return;
    }

    setIsSyncing(true);

    try {
      await uploadBulkFileApi(file);
      alert("✓ Synchronization successful. The system has been reset with the new data.");
      window.location.reload();
    } catch (error) {
      console.error(error);
      alert("A network error occurred during the synchronization process.");
    } finally {
      setIsSyncing(false);
      e.target.value = "";
    }
  };

  useEffect(() => {
    async function fetchAlerts() {
      try {
        if (!accessToken) return;
        const data = await getAlertsFeedApi();
        setAlerts(data.alerts || []);
      } catch (e) {
        console.error("Failed to fetch alerts:", e);
      }
    }
    void fetchAlerts();
  }, [accessToken]);

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
    const now = asOfMs;
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
      const y = yearsSince(e.dateOfHire, asOfMs);
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
  }, [employees, asOfMs]);

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
      hideHeader={true}
    >
      <div className="relative overflow-hidden rounded-3xl bg-zinc-900 p-8 shadow-xl mb-8 group border border-zinc-800">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-indigo-500/10 via-transparent to-transparent" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Strategic Intelligence</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">
              Institutional <span className="text-indigo-500">Overview</span>
            </h1>
            <p className="text-zinc-400 text-sm max-w-xl font-medium leading-relaxed">
              Real-time synchronization across {departments.length} departments and {teams.length} operational units. 
              Currently monitoring <span className="text-white font-bold">{employees.length} personnel</span> records.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 md:border-l md:border-zinc-800 md:pl-8">
            <Link
              to="/employees"
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-zinc-950 text-xs font-black uppercase tracking-widest hover:bg-zinc-100 transition-all active:scale-95 shadow-lg shadow-white/5"
            >
              Roster <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              to="/organizations"
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-zinc-800 text-white text-xs font-black uppercase tracking-widest border border-zinc-700 hover:bg-zinc-700 transition-all active:scale-95"
            >
              Org Map <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {(currentUser?.role === "ADMIN" || currentUser?.role === 3) && (
            <div className="flex flex-col gap-3 md:border-l md:border-zinc-800 md:pl-8">
              <div className="flex flex-col space-y-1 mb-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Sync Center</span>
                <span className="text-[9px] text-zinc-600 font-medium">Bulk Data Management</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadTemplate}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 text-[10px] font-bold uppercase tracking-wider border border-zinc-700 hover:bg-zinc-700 hover:text-white transition-all active:scale-95 whitespace-nowrap"
                >
                  <Download className="h-3 w-3" /> Get Template
                </button>
                <div className="relative">
                  <input
                    type="file"
                    accept=".xlsx"
                    onChange={handleUploadSync}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-wait"
                    disabled={isSyncing}
                  />
                  <button
                    disabled={isSyncing}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider border transition-all active:scale-95 whitespace-nowrap ${
                      isSyncing 
                        ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" 
                        : "bg-indigo-500/10 text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/20"
                    }`}
                  >
                    {isSyncing ? (
                      <>
                        <RefreshCw className="h-3 w-3 animate-spin" /> Syncing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-3 w-3" /> Sync & Reset
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {isLoading ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-12 text-center text-sm text-zinc-500">
          Loading organization data…
        </div>
      ) : (
        <div className="space-y-8">

          {/* Alerts Widget */}
          {alerts.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 overflow-hidden shadow-sm">
              <button
                type="button"
                onClick={() => setAlertsExpanded((p) => !p)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-amber-100/60 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <span className="text-sm font-semibold text-amber-900">
                    {alerts.length} Active Alert{alerts.length !== 1 ? "s" : ""}
                  </span>
                  <span className="flex gap-1.5 ml-2">
                    {alerts.filter(a => a.type === "ID_EXPIRY").length > 0 && (
                      <span className="text-[10px] font-bold bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full">
                        {alerts.filter(a => a.type === "ID_EXPIRY").length} ID Expiry
                      </span>
                    )}
                    {alerts.filter(a => a.type === "SALARY_INCREASE").length > 0 && (
                      <span className="text-[10px] font-bold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full">
                        {alerts.filter(a => a.type === "SALARY_INCREASE").length} Salary Due
                      </span>
                    )}
                    {alerts.filter(a => a.severity === "critical").length > 0 && (
                      <span className="text-[10px] font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                        {alerts.filter(a => a.severity === "critical").length} Critical
                      </span>
                    )}
                  </span>
                </div>
                {alertsExpanded ? <ChevronUp className="h-4 w-4 text-amber-600" /> : <ChevronDown className="h-4 w-4 text-amber-600" />}
              </button>
              {alertsExpanded && (
                <div className="border-t border-amber-200 divide-y divide-amber-100">
                  {alerts.map((alert, idx) => (
                    <div key={idx} className={`flex items-center gap-3 px-4 py-2.5 text-sm ${
                      alert.severity === "critical" ? "bg-red-50" : "bg-amber-50/50"
                    }`}>
                      {alert.type === "ID_EXPIRY" ? (
                        <AlertTriangle className={`h-3.5 w-3.5 shrink-0 ${alert.severity === "critical" ? "text-red-500" : "text-amber-500"}`} />
                      ) : (
                        <Clock className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
                      )}
                      <span className={`flex-1 ${alert.severity === "critical" ? "text-red-800" : "text-amber-900"}`}>
                        {alert.message}
                      </span>
                      {alert.department && (
                        <span className="text-[10px] text-zinc-500 border border-zinc-200 bg-white rounded-full px-2 py-0.5 shrink-0">
                          {alert.department}
                        </span>
                      )}
                      <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 shrink-0 ${
                        alert.daysRemaining <= 7 ? "bg-red-100 text-red-700"
                        : alert.daysRemaining <= 14 ? "bg-orange-100 text-orange-700"
                        : "bg-zinc-100 text-zinc-600"
                      }`}>
                        {alert.daysRemaining}d
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

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
                    formatter={(v) => [v, "Employees"]}
                    labelFormatter={(_, item) => item?.payload?.fullName ?? ""}
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
