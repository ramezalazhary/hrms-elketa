import { useEffect, useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { Layout } from "@/shared/components/Layout";
import { StatusBadge } from "@/shared/components/EntityBadges";
import { fetchWithAuth } from "@/shared/api/fetchWithAuth";
import { API_URL } from "@/shared/api/apiBase";
import { employeeBelongsToDepartment } from "@/shared/utils/departmentMembership";
import { 
  Building2, 
  Users, 
  UserCircle2, 
  Briefcase, 
  LayoutDashboard,
  Calendar,
  ShieldCheck,
  TrendingUp
} from "lucide-react";
import { useAppSelector } from "@/shared/hooks/reduxHooks";
import { canManageDepartments } from "@/shared/utils/accessControl";

export function DepartmentStructurePage() {
  const { departmentId } = useParams();
  const currentUser = useAppSelector((state) => state.identity.currentUser);
  const canEditDepartment = canManageDepartments(currentUser);
  const [department, setDepartment] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [deptRes, empRes] = await Promise.all([
          fetchWithAuth(`${API_URL}/departments/${departmentId}`),
          fetchWithAuth(`${API_URL}/employees`)
        ]);

        if (!deptRes.ok) throw new Error("Could not fetch department");
        if (!empRes.ok) throw new Error("Could not fetch employees");

        const deptData = await deptRes.json();
        const empData = await empRes.json();

        setDepartment(deptData);
        setEmployees(empData);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [departmentId]);

  const deptEmployees = useMemo(() => {
    if (!department) return [];
    return employees.filter((emp) => employeeBelongsToDepartment(emp, department));
  }, [department, employees]);

  const activeCount = useMemo(() => 
    deptEmployees.filter(e => e.status === 'ACTIVE').length, 
  [deptEmployees]);

  const headRecord = useMemo(() => 
    deptEmployees.find(e => e.email === department?.head),
  [deptEmployees, department]);

  if (isLoading) return <Layout title="Loading Structure..." />;
  if (error || !department) return <Layout title="Error" description={error || "Department not found"} />;

  const deptInitial = (department.code?.trim()?.[0] || department.name?.trim()?.[0] || "?").toUpperCase();

  return (
    <Layout
      title={department.name}
      description={department.code ? `${department.code} · Department overview` : "Department overview"}
      className="max-w-6xl"
      hideHeader
    >
      <div className="space-y-8">
        <section className="relative overflow-hidden rounded-[20px] bg-white p-6 shadow-sm ring-1 ring-zinc-950/[0.06] dark:bg-zinc-900 dark:ring-zinc-800 md:p-8">
          {/* Decorative background elements */}
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-zinc-100/70 dark:bg-zinc-800/60" />
          <div className="pointer-events-none absolute -left-8 bottom-0 h-32 w-32 rounded-full bg-zinc-50/80 blur-2xl dark:bg-zinc-800/30" />

          <div className="relative space-y-6">
            {/* ── Row 1: Identity Block ── */}
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              {/* Left: Avatar + Department info */}
              <div className="flex items-center gap-5">
                <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-zinc-700 to-zinc-900 text-3xl font-semibold text-white shadow-lg dark:from-zinc-600 dark:to-zinc-800">
                  {deptInitial}
                </div>
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200/80 bg-zinc-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400">
                      <Building2 className="h-3 w-3" />
                      {department.type || "Department"}
                    </span>
                    {department.code && (
                      <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-zinc-600 ring-1 ring-zinc-200/70 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700">
                        {department.code}
                      </span>
                    )}
                    <StatusBadge status={department.status || "ACTIVE"} />
                  </div>
                  <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 md:text-3xl">
                    {department.name}
                  </h1>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">Department overview</p>
                </div>
              </div>

              {/* Right: Edit action (admin only) — desktop inline */}
              {canEditDepartment && (
                <Link
                  to={`/departments/${departmentId}/edit`}
                  className="hidden shrink-0 items-center gap-2 rounded-xl bg-zinc-900 px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-white shadow-lg transition-all hover:bg-zinc-800 hover:shadow-xl dark:bg-indigo-600 dark:hover:bg-indigo-500 sm:inline-flex"
                >
                  <Briefcase size={14} strokeWidth={1.75} />
                  Edit department
                </Link>
              )}
            </div>

            {/* ── Divider ── */}
            <div className="border-t border-zinc-100 dark:border-zinc-800" />

            {/* ── Row 2: Leadership Info Cards ── */}
            <div className="grid gap-3 sm:grid-cols-3">
              {/* Head */}
              <div className="flex items-center gap-3.5 rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-4 transition-colors hover:bg-zinc-100/50 dark:border-zinc-800 dark:bg-zinc-800/40 dark:hover:bg-zinc-800/60">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-zinc-600 shadow-sm ring-1 ring-zinc-200/80 dark:bg-zinc-900 dark:text-zinc-400 dark:ring-zinc-700">
                  <UserCircle2 size={18} strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">Head</p>
                  <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {headRecord?.fullName || department.head || "Unassigned"}
                  </p>
                </div>
              </div>

              {/* Title */}
              <div className="flex items-center gap-3.5 rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-4 transition-colors hover:bg-zinc-100/50 dark:border-zinc-800 dark:bg-zinc-800/40 dark:hover:bg-zinc-800/60">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-zinc-600 shadow-sm ring-1 ring-zinc-200/80 dark:bg-zinc-900 dark:text-zinc-400 dark:ring-zinc-700">
                  <ShieldCheck size={18} strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">Title</p>
                  <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {department.headTitle || "Head of department"}
                  </p>
                </div>
              </div>

              {/* Focus */}
              <div className="flex items-center gap-3.5 rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-4 transition-colors hover:bg-zinc-100/50 dark:border-zinc-800 dark:bg-zinc-800/40 dark:hover:bg-zinc-800/60">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-zinc-600 shadow-sm ring-1 ring-zinc-200/80 dark:bg-zinc-900 dark:text-zinc-400 dark:ring-zinc-700">
                  <Calendar size={18} strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">Focus</p>
                  <p className="line-clamp-2 text-sm text-zinc-700 dark:text-zinc-300" title={department.headResponsibility}>
                    {department.headResponsibility || "Strategic leadership"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>


        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Users, label: "People", value: deptEmployees.length, hint: "In this department" },
            {
              icon: LayoutDashboard,
              label: "Active",
              value: `${deptEmployees.length > 0 ? Math.round((activeCount / deptEmployees.length) * 100) : 0}%`,
              hint: `${activeCount} active now`,
            },
            { icon: Building2, label: "Teams", value: (department.teams || []).length, hint: "Sub-units" },
            { icon: Briefcase, label: "Roles", value: (department.positions || []).length, hint: "Defined positions" },
          ].map(({ icon: Icon, label, value, hint }) => (
            <div
              key={label}
              className="rounded-[20px] border border-zinc-200/80 bg-white p-5 shadow-sm ring-1 ring-zinc-950/[0.04] dark:border-zinc-800 dark:bg-zinc-900 dark:ring-zinc-800"
            >
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                <Icon size={18} strokeWidth={1.75} />
              </div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</p>
              <p className="mt-1 text-3xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{value}</p>
              <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">{hint}</p>
            </div>
          ))}
        </div>

        {/* --- Phase 3: Detailed Organizational Units --- */}
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Sub-units Grid */}
          <section className="space-y-4">
            <h3 className="flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                <TrendingUp size={14} />
              </span>
              Teams
            </h3>
            <div className="grid gap-4">
              {(department.teams || []).map(team => (
                <div key={team.id} className="group relative overflow-hidden rounded-[20px] border border-zinc-200/80 bg-white p-5 shadow-sm ring-1 ring-zinc-950/[0.04] transition hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:ring-zinc-800 dark:hover:border-zinc-700">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-lg font-semibold tracking-tight text-zinc-900 transition group-hover:text-zinc-700 dark:text-zinc-100 dark:group-hover:text-zinc-300">
                        {team.name}
                      </h4>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className="rounded-md border border-zinc-200/80 bg-zinc-50 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400">
                          {team.leaderTitle || "Lead"}: {team.leaderEmail || "Not Assigned"}
                        </span>
                        <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-semibold text-white dark:bg-indigo-600">
                          {(team.members || []).length} people
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-4 flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                    <UserCircle2 size={12} className="text-zinc-400" />
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">Headcount assigned to this sub-unit.</span>
                  </div>
                  
                  <div className="mt-3 flex -space-x-2">
                    {(team.members || []).slice(0, 8).map((email, idx) => (
                      <div key={idx} className="h-7 w-7 rounded-full border-2 border-white bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase">
                        {email[0]}
                      </div>
                    ))}
                    {(team.members || []).length > 8 && (
                      <div className="h-7 w-7 rounded-full border-2 border-white bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-center text-[8px] font-bold text-zinc-400">
                        +{(team.members || []).length - 8}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {(department.teams || []).length === 0 && (
                <div className="p-8 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl text-center text-zinc-400 text-sm italic">
                  No sub-units defined for this department structure.
                </div>
              )}
            </div>
          </section>

          {/* Job Architecture (Positions) */}
          <section className="space-y-4">
             <h3 className="flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                <Briefcase size={14} />
              </span>
              Roles
            </h3>
            <div className="overflow-hidden rounded-[20px] border border-zinc-200/80 bg-white shadow-sm ring-1 ring-zinc-950/[0.04] dark:border-zinc-800 dark:bg-zinc-900 dark:ring-zinc-800">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-800/50">
                    <th className="px-6 py-3.5 font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">Role</th>
                    <th className="px-6 py-3.5 text-center font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">Level</th>
                    <th className="px-6 py-3.5 text-right font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">Filled</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {(department.positions || []).map((pos, idx) => {
                    const count = deptEmployees.filter(e => e.position === pos.title).length;
                    return (
                      <tr key={idx} className="group transition-colors hover:bg-zinc-50/70 dark:hover:bg-zinc-800/50">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-zinc-900 dark:text-zinc-100">{pos.title}</div>
                          <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">{pos.responsibility || "General task scope"}</div>
                        </td>
                        <td className="px-6 py-4 text-center font-black text-zinc-400 italic">
                          {pos.level}
                        </td>
                        <td className="px-6 py-4 text-right pr-10">
                           <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                             count > 0 ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-zinc-50 dark:bg-zinc-800/50 text-zinc-400 border border-zinc-100 dark:border-zinc-800/50 italic"
                           }`}>
                             {count} Assigned
                           </span>
                        </td>
                      </tr>
                    );
                  })}
                  {(department.positions || []).length === 0 && (
                    <tr>
                      <td colSpan="3" className="px-6 py-12 text-center text-zinc-400 italic">No formal roles defined.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* --- Phase 4: Complete Workforce Register --- */}
        <section className="space-y-4 pt-4">
          <div className="flex justify-between items-end px-2">
             <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                <Users size={14} />
              </span>
              People in this department
            </h3>
            <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">
              {department.name}
            </span>
          </div>
          <div className="overflow-hidden rounded-[20px] border border-zinc-200/80 bg-white shadow-sm ring-1 ring-zinc-950/[0.04] dark:border-zinc-800 dark:bg-zinc-900 dark:ring-zinc-800">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-800/50">
                    <th className="px-6 py-4 font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">Name</th>
                    <th className="px-6 py-4 font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">Role</th>
                    <th className="px-6 py-4 font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">Email</th>
                    <th className="px-6 py-4 text-right font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {deptEmployees.map(emp => (
                    <tr key={emp.id} className="group cursor-default transition-colors hover:bg-zinc-50/70 dark:hover:bg-zinc-800/50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200/80 bg-zinc-100 text-sm font-semibold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                            {(emp.fullName?.trim()?.[0] || "?").toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{emp.fullName}</div>
                            <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-400">Profile</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                         <div className="font-medium text-zinc-800 dark:text-zinc-200">{emp.position}</div>
                         <div className="mt-0.5 text-[10px] text-zinc-400">Position</div>
                      </td>
                      <td className="px-6 py-4 font-medium text-zinc-600 decoration-zinc-300 underline decoration-dotted underline-offset-4 dark:text-zinc-400">
                        {emp.email}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <StatusBadge status={emp.status} />
                      </td>
                    </tr>
                  ))}
                  {deptEmployees.length === 0 && (
                    <tr>
                      <td colSpan="4" className="px-8 py-16 text-center text-zinc-500 dark:text-zinc-400">
                         <p className="mb-1 text-base font-semibold text-zinc-700 dark:text-zinc-300">No people yet</p>
                         <p className="text-sm">Assign employees to this department to see them listed here.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Floating Action Button for department managers (admin only). */}
        {canEditDepartment && (
          <div className="fixed bottom-8 right-8 z-40 flex gap-3">
            <Link
              to={`/departments/${departmentId}/edit`}
              className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-white shadow-lg transition hover:bg-zinc-800 dark:bg-indigo-600 dark:hover:bg-indigo-500"
            >
              <Briefcase size={16} strokeWidth={1.75} /> Edit department
            </Link>
          </div>
        )}
      </div>
    </Layout>
  );
}
