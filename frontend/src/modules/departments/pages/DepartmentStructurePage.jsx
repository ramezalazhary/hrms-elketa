import { useEffect, useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { Layout } from "@/shared/components/Layout";
import { StatusBadge } from "@/shared/components/EntityBadges";
import { fetchWithAuth } from "@/shared/api/fetchWithAuth";
import { API_URL } from "@/shared/api/apiBase";
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

export function DepartmentStructurePage() {
  const { departmentId } = useParams();
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
    return employees.filter(emp => emp.departmentId === department.id || emp.department === department.name);
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
    >
      <div className="space-y-8">
        <section className="relative overflow-hidden rounded-2xl border border-teal-200/40 bg-gradient-to-br from-slate-900 via-teal-900 to-cyan-950 p-8 text-white shadow-xl shadow-teal-900/30">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-cyan-400/15 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-1/4 h-32 w-32 rounded-full bg-violet-500/20 blur-3xl" />
          <div className="absolute top-6 right-6 hidden text-white/10 md:block">
            <Building2 size={120} strokeWidth={1} />
          </div>
          
          <div className="relative flex flex-col items-start gap-8 md:flex-row md:items-center">
            <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-400 to-cyan-500 text-3xl font-bold text-white shadow-lg ring-4 ring-white/10">
              {deptInitial}
            </div>
            
            <div className="min-w-0 flex-1 space-y-4">
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-teal-100 backdrop-blur-sm">
                    {department.type || "Department"}
                  </span>
                  <StatusBadge status={department.status || "ACTIVE"} />
                </div>
                <h2 className="text-2xl font-bold tracking-tight md:text-3xl">{department.name}</h2>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-cyan-200">
                    <UserCircle2 size={20} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-teal-200/90">Head</p>
                    <p className="truncate text-sm font-semibold">{headRecord?.fullName || department.head || "Unassigned"}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-violet-200">
                    <ShieldCheck size={20} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-teal-200/90">Title</p>
                    <p className="truncate text-sm font-semibold">{department.headTitle || "Head of department"}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm sm:col-span-2 lg:col-span-1">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-teal-200">
                    <Calendar size={20} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-teal-200/90">Focus</p>
                    <p className="truncate text-sm text-white/90" title={department.headResponsibility}>
                      {department.headResponsibility || "Strategic leadership"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-50/90 to-white p-5 shadow-sm ring-1 ring-teal-500/10">
            <div className="mb-2 flex items-start justify-between">
              <Users size={18} className="text-teal-600" strokeWidth={1.75} />
              <TrendingUp size={14} className="text-cyan-500" />
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-teal-700/80">People</p>
            <p className="mt-1 text-3xl font-bold tabular-nums text-slate-900">{deptEmployees.length}</p>
            <p className="mt-1 text-[11px] text-slate-500">In this department</p>
          </div>

          <div className="rounded-2xl border border-cyan-100 bg-gradient-to-br from-cyan-50/90 to-white p-5 shadow-sm ring-1 ring-cyan-500/10">
            <div className="mb-2 flex items-start justify-between">
              <LayoutDashboard size={18} className="text-cyan-600" strokeWidth={1.75} />
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-cyan-800/80">Active</p>
            <p className="mt-1 text-3xl font-bold tabular-nums text-cyan-700">
              {deptEmployees.length > 0 ? Math.round((activeCount / deptEmployees.length) * 100) : 0}%
            </p>
            <p className="mt-1 text-[11px] text-slate-500">{activeCount} active now</p>
          </div>

          <div className="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50/90 to-white p-5 shadow-sm ring-1 ring-violet-500/10">
            <div className="mb-2 flex items-start justify-between">
              <Building2 size={18} className="text-violet-600" strokeWidth={1.75} />
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-800/80">Teams</p>
            <p className="mt-1 text-3xl font-bold tabular-nums text-slate-900">{(department.teams || []).length}</p>
            <p className="mt-1 text-[11px] text-slate-500">Sub-units</p>
          </div>

          <div className="rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50/90 to-white p-5 shadow-sm ring-1 ring-sky-500/10">
            <div className="mb-2 flex items-start justify-between">
              <Briefcase size={18} className="text-sky-600" strokeWidth={1.75} />
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-800/80">Roles</p>
            <p className="mt-1 text-3xl font-bold tabular-nums text-slate-900">{(department.positions || []).length}</p>
            <p className="mt-1 text-[11px] text-slate-500">Defined positions</p>
          </div>
        </div>

        {/* --- Phase 3: Detailed Organizational Units --- */}
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Sub-units Grid */}
          <section className="space-y-4">
            <h3 className="flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-teal-800">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-teal-100 text-teal-700">
                <TrendingUp size={14} />
              </span>
              Teams
            </h3>
            <div className="grid gap-4">
              {(department.teams || []).map(team => (
                <div key={team.id} className="group relative overflow-hidden rounded-2xl border border-violet-100/90 bg-white p-5 shadow-sm ring-1 ring-violet-500/5 transition hover:border-teal-200 hover:shadow-md">
                  <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-teal-400 via-cyan-400 to-violet-400 opacity-0 transition group-hover:opacity-100" />
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-lg font-bold tracking-tight text-slate-900 transition group-hover:text-teal-800">
                        {team.name}
                      </h4>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-[10px] font-bold py-0.5 px-1.5 bg-zinc-50 border border-zinc-100 text-zinc-600 rounded">
                          {team.leaderTitle || "Lead"}: {team.leaderEmail || "Not Assigned"}
                        </span>
                        <span className="rounded-md bg-gradient-to-r from-teal-600 to-cyan-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
                          {(team.members || []).length} people
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-4 flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                    <UserCircle2 size={12} className="text-zinc-400" />
                    <span className="text-[10px] text-zinc-500 font-medium">Headcount assigned to this sub-unit.</span>
                  </div>
                  
                  <div className="mt-3 flex -space-x-2">
                    {(team.members || []).slice(0, 8).map((email, idx) => (
                      <div key={idx} className="h-7 w-7 rounded-full border-2 border-white bg-zinc-100 flex items-center justify-center text-[10px] font-bold text-zinc-500 uppercase">
                        {email[0]}
                      </div>
                    ))}
                    {(team.members || []).length > 8 && (
                      <div className="h-7 w-7 rounded-full border-2 border-white bg-zinc-50 flex items-center justify-center text-[8px] font-bold text-zinc-400">
                        +{(team.members || []).length - 8}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {(department.teams || []).length === 0 && (
                <div className="p-8 border border-dashed border-zinc-200 rounded-2xl text-center text-zinc-400 text-sm italic">
                  No sub-units defined for this department structure.
                </div>
              )}
            </div>
          </section>

          {/* Job Architecture (Positions) */}
          <section className="space-y-4">
             <h3 className="flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-violet-900">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
                <Briefcase size={14} />
              </span>
              Roles
            </h3>
            <div className="overflow-hidden rounded-2xl border border-violet-100/80 bg-white shadow-sm ring-1 ring-violet-500/10">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-teal-100 bg-gradient-to-r from-teal-50/80 to-cyan-50/50">
                    <th className="px-6 py-3.5 font-semibold uppercase tracking-wide text-teal-900/80">Role</th>
                    <th className="px-6 py-3.5 text-center font-semibold uppercase tracking-wide text-teal-900/80">Level</th>
                    <th className="px-6 py-3.5 text-right font-semibold uppercase tracking-wide text-teal-900/80">Filled</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {(department.positions || []).map((pos, idx) => {
                    const count = deptEmployees.filter(e => e.position === pos.title).length;
                    return (
                      <tr key={idx} className="hover:bg-zinc-50/30 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-slate-900 group-hover:text-teal-800">{pos.title}</div>
                          <div className="text-[10px] text-zinc-500 font-medium">{pos.responsibility || "General task scope"}</div>
                        </td>
                        <td className="px-6 py-4 text-center font-black text-zinc-400 italic">
                          {pos.level}
                        </td>
                        <td className="px-6 py-4 text-right pr-10">
                           <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                             count > 0 ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-zinc-50 text-zinc-400 border border-zinc-100 italic"
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
             <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-700">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-cyan-100 text-cyan-800">
                <Users size={14} />
              </span>
              People in this department
            </h3>
            <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
              {department.name}
            </span>
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-lg shadow-slate-200/40 ring-1 ring-teal-500/5">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-teal-700/30 bg-gradient-to-r from-slate-900 via-teal-900 to-cyan-900 text-white">
                    <th className="px-6 py-4 font-semibold uppercase tracking-wide text-teal-50/95">Name</th>
                    <th className="px-6 py-4 font-semibold uppercase tracking-wide text-teal-50/95">Role</th>
                    <th className="px-6 py-4 font-semibold uppercase tracking-wide text-teal-50/95">Email</th>
                    <th className="px-6 py-4 text-right font-semibold uppercase tracking-wide text-teal-50/95">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {deptEmployees.map(emp => (
                    <tr key={emp.id} className="group cursor-default transition-colors hover:bg-teal-50/40">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-teal-100 bg-gradient-to-br from-teal-50 to-cyan-50 text-sm font-semibold text-teal-800 shadow-sm transition group-hover:border-teal-200 group-hover:from-teal-100 group-hover:to-cyan-100">
                            {(emp.fullName?.trim()?.[0] || "?").toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-slate-900">{emp.fullName}</div>
                            <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">Profile</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                         <div className="font-medium text-slate-800">{emp.position}</div>
                         <div className="mt-0.5 text-[10px] text-slate-400">Position</div>
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-600 underline decoration-teal-200 decoration-dotted underline-offset-4 transition group-hover:text-teal-800">
                        {emp.email}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <StatusBadge status={emp.status} />
                      </td>
                    </tr>
                  ))}
                  {deptEmployees.length === 0 && (
                    <tr>
                      <td colSpan="4" className="px-8 py-16 text-center text-slate-500">
                         <p className="mb-1 text-base font-semibold text-slate-700">No people yet</p>
                         <p className="text-sm">Assign employees to this department to see them listed here.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Floating Action Button for Admins */}
        <div className="fixed bottom-8 right-8 z-40 flex gap-3">
          <Link 
            to={`/departments/${departmentId}/edit`}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-teal-600 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-white shadow-xl shadow-teal-900/25 transition hover:from-violet-500 hover:to-teal-500 hover:shadow-2xl"
          >
            <Briefcase size={16} strokeWidth={1.75} /> Edit department
          </Link>
        </div>
      </div>
    </Layout>
  );
}
