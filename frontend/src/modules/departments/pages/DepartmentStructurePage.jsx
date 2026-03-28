import { useEffect, useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { Layout } from "@/shared/components/Layout";
import { StatusBadge } from "@/shared/components/EntityBadges";
import { fetchWithAuth } from "@/shared/api/fetchWithAuth";
import { 
  Building2, 
  Users, 
  UserCircle2, 
  Briefcase, 
  ChevronRight, 
  LayoutDashboard,
  Calendar,
  ShieldCheck,
  TrendingUp,
  MapPin
} from "lucide-react";

export function DepartmentStructurePage() {
  const { departmentId } = useParams();
  const [department, setDepartment] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

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
  }, [departmentId, API_URL]);

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

  return (
    <Layout 
      title={department.name} 
      description={`${department.code} — Organizational Intelligence & Structure`}
      backButton
    >
      <div className="space-y-8">
        {/* --- Phase 1: Leadership & Identity Banner --- */}
        <section className="relative overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm p-8">
          <div className="absolute top-0 right-0 p-8 text-zinc-50 opacity-20 hidden md:block">
            <Building2 size={160} />
          </div>
          
          <div className="relative flex flex-col md:flex-row items-start md:items-center gap-8">
            <div className="h-28 w-28 rounded-2xl bg-zinc-900 flex items-center justify-center text-white text-4xl font-black shadow-lg">
              {department.code[0]}
            </div>
            
            <div className="flex-1 space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-widest rounded border border-emerald-100 italic">
                    {department.type || "ORGANIZATION"}
                  </span>
                  <StatusBadge status={department.status || "ACTIVE"} />
                </div>
                <h2 className="text-3xl font-black text-zinc-900 tracking-tight">{department.name}</h2>
              </div>

              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-zinc-50 border border-zinc-100 flex items-center justify-center text-zinc-400">
                    <UserCircle2 size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Department Head</p>
                    <p className="text-sm font-bold text-zinc-900">{headRecord?.fullName || department.head || "Unassigned"}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-zinc-50 border border-zinc-100 flex items-center justify-center text-zinc-400">
                    <ShieldCheck size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Formal Title</p>
                    <p className="text-sm font-bold text-zinc-900">{department.headTitle || "Head of Department"}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-zinc-50 border border-zinc-100 flex items-center justify-center text-zinc-400">
                    <Calendar size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Leadership Responsibility</p>
                    <p className="text-sm font-medium text-zinc-600 truncate max-w-[200px]" title={department.headResponsibility}>
                      {department.headResponsibility || "Strategic lead"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* --- Phase 2: Structural Insights (Headcount & Density) --- */}
        <div className="grid gap-6 md:grid-cols-4">
          <div className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm">
            <div className="flex justify-between items-start mb-2">
              <Users size={16} className="text-zinc-400" />
              <TrendingUp size={12} className="text-emerald-500" />
            </div>
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Total Staffing</p>
            <p className="mt-1 text-3xl font-black text-zinc-900 leading-none">{deptEmployees.length}</p>
            <p className="mt-2 text-[10px] font-bold text-emerald-600 uppercase tracking-tighter italic">Headcount Capacity Full</p>
          </div>

          <div className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm">
            <div className="flex justify-between items-start mb-2">
              <LayoutDashboard size={16} className="text-zinc-400" />
            </div>
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Active Ratio</p>
            <p className="mt-1 text-3xl font-black text-emerald-600 leading-none">
              {deptEmployees.length > 0 ? Math.round((activeCount / deptEmployees.length) * 100) : 0}%
            </p>
            <p className="mt-2 text-[10px] font-bold text-zinc-400 uppercase tracking-tighter italic">{activeCount} staff present</p>
          </div>

          <div className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm">
            <div className="flex justify-between items-start mb-2">
              <Building2 size={16} className="text-zinc-400" />
            </div>
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Structural Units</p>
            <p className="mt-1 text-3xl font-black text-zinc-900 leading-none">{(department.teams || []).length}</p>
            <p className="mt-2 text-[10px] font-bold text-zinc-400 uppercase tracking-tighter italic">Managed Teams</p>
          </div>

          <div className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm">
            <div className="flex justify-between items-start mb-2">
              <Briefcase size={16} className="text-zinc-400" />
            </div>
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Defined Roles</p>
            <p className="mt-1 text-3xl font-black text-zinc-900 leading-none">{(department.positions || []).length}</p>
            <p className="mt-2 text-[10px] font-bold text-zinc-400 uppercase tracking-tighter italic">Job Architectures</p>
          </div>
        </div>

        {/* --- Phase 3: Detailed Organizational Units --- */}
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Sub-units Grid */}
          <section className="space-y-4">
            <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2 px-2">
              <TrendingUp size={14} /> Team Structures & Sub-Units
            </h3>
            <div className="grid gap-4">
              {(department.teams || []).map(team => (
                <div key={team.id} className="group relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:shadow-md">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-black text-zinc-900 text-lg tracking-tight group-hover:text-emerald-700 transition-colors">
                        {team.name}
                      </h4>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-[10px] font-bold py-0.5 px-1.5 bg-zinc-50 border border-zinc-100 text-zinc-600 rounded">
                          {team.leaderTitle || "Lead"}: {team.leaderEmail || "Not Assigned"}
                        </span>
                        <span className="text-[10px] font-bold py-0.5 px-1.5 bg-zinc-900 text-white rounded">
                          {(team.members || []).length} Staff
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
             <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2 px-2">
              <Briefcase size={14} /> Roles & Job Architecture
            </h3>
            <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-zinc-50/50 border-b border-zinc-100">
                    <th className="px-6 py-4 font-black text-zinc-400 uppercase tracking-widest">Role Title</th>
                    <th className="px-6 py-4 font-black text-zinc-400 uppercase tracking-widest text-center">Level</th>
                    <th className="px-6 py-4 font-black text-zinc-400 uppercase tracking-widest text-right">Occupancy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {(department.positions || []).map((pos, idx) => {
                    const count = deptEmployees.filter(e => e.position === pos.title).length;
                    return (
                      <tr key={idx} className="hover:bg-zinc-50/30 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="font-bold text-zinc-900 group-hover:text-emerald-700">{pos.title}</div>
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
             <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
              <Users size={14} /> Full Personnel Register
            </h3>
            <span className="text-[10px] font-black text-zinc-400 uppercase italic">
              Filtered for {department.name}
            </span>
          </div>
          <div className="rounded-3xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-zinc-900 text-white border-b border-zinc-800">
                    <th className="px-8 py-4 font-black uppercase tracking-widest">Global Name / Digital Identity</th>
                    <th className="px-6 py-4 font-black uppercase tracking-widest">Active Role</th>
                    <th className="px-6 py-4 font-black uppercase tracking-widest">Work Email / Auth</th>
                    <th className="px-8 py-4 font-black uppercase tracking-widest text-right">Operational Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {deptEmployees.map(emp => (
                    <tr key={emp.id} className="hover:bg-zinc-50 transition-all cursor-default group">
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-xl bg-zinc-50 border border-zinc-100 flex items-center justify-center text-zinc-400 font-black text-sm group-hover:bg-zinc-900 group-hover:text-white transition-all shadow-inner">
                            {emp.fullName[0].toUpperCase()}
                          </div>
                          <div>
                            <div className="font-black text-zinc-900 text-sm tracking-tight">{emp.fullName}</div>
                            <div className="text-[10px] font-bold text-zinc-400 uppercase italic mt-0.5 tracking-tighter">Human Resource Profile</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                         <div className="font-bold text-zinc-700">{emp.position}</div>
                         <div className="text-[10px] text-zinc-400 italic mt-0.5 tracking-tighter italic font-medium">Verified Active Role</div>
                      </td>
                      <td className="px-6 py-5 font-bold text-zinc-400 hover:text-emerald-700 transition-colors underline decoration-dotted underline-offset-4 decoration-zinc-200">
                        {emp.email}
                      </td>
                      <td className="px-8 py-5 text-right">
                        <StatusBadge status={emp.status} />
                      </td>
                    </tr>
                  ))}
                  {deptEmployees.length === 0 && (
                    <tr>
                      <td colSpan="4" className="px-12 py-20 text-center text-zinc-400">
                         <p className="text-xl font-black mb-2 uppercase italic tracking-widest">Null Record</p>
                         <p className="text-sm italic">No employees are currently assigned to this department across all structural units.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Floating Action Button for Admins */}
        <div className="fixed bottom-8 right-8 flex gap-3">
          <Link 
            to={`/departments/${departmentId}/edit`}
            className="flex items-center gap-2 px-6 py-3 bg-zinc-900 text-white rounded-full font-black text-[12px] uppercase tracking-widest shadow-xl hover:bg-emerald-700 hover:scale-105 active:scale-95 transition-all"
          >
            <Briefcase size={16} /> Re-Architect Structure
          </Link>
        </div>
      </div>
    </Layout>
  );
}
