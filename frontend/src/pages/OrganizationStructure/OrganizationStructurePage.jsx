import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/reduxHooks";
import { fetchDepartmentsThunk } from "@/modules/departments/store";
import { fetchEmployeesThunk } from "@/modules/employees/store";
import { fetchTeamsThunk } from "@/modules/teams/store";
import {
  Network,
  Users,
  Layers,
  Briefcase,
  Search,
  Shield,
  LayoutGrid,
  TrendingUp,
  ExternalLink,
  ChevronRight,
  Building2
} from "lucide-react";
import { DepartmentBadge } from "@/shared/components/EntityBadges";

/**
 * Global Organization Hierarchy: Premium Grid Dashboard for all departments.
 */
function OrganizationStructurePage() {
  const dispatch = useAppDispatch();
  const employees = useAppSelector((state) => state.employees.items);
  const departments = useAppSelector((state) => state.departments.items);
  const teams = useAppSelector((state) => state.teams.items);
  const role = useAppSelector((state) => state.identity.currentUser?.role);
  const loading = useAppSelector(
    (state) => state.employees.isLoading || state.departments.isLoading || state.teams.isLoading,
  );

  const [search, setSearch] = useState("");

  useEffect(() => {
    dispatch(fetchEmployeesThunk());
    dispatch(fetchDepartmentsThunk());
    dispatch(fetchTeamsThunk());
  }, [dispatch]);

  const hierarchy = useMemo(() => {
    return departments.map((dept) => ({
      ...dept,
      subUnits: (dept.teams || []).length,
      headCount: employees.filter(
        (e) => e.departmentId === dept.id || e.department === dept.name,
      ).length,
      activeDensity: employees.filter(
        (e) => (e.departmentId === dept.id || e.department === dept.name) && e.status === 'ACTIVE'
      ).length,
    }));
  }, [departments, employees]);

  const filteredHierarchy = hierarchy.filter(
    (dept) =>
      dept.name.toLowerCase().includes(search.toLowerCase()) ||
      (dept.teams || []).some((t) => t.name.toLowerCase().includes(search.toLowerCase())),
  );

  const totalTeamsCount = useMemo(() => {
     return departments.reduce((sum, d) => sum + (d.teams?.length || 0), 0);
  }, [departments]);

  const stats = [
    { label: "Organization Strength", value: employees.length, sub: "Total Personnel", icon: Users, color: "text-zinc-900" },
    { label: "Structural Hubs", value: departments.length, sub: "Departments", icon: Network, color: "text-emerald-600" },
    { label: "Operational Units", value: totalTeamsCount, sub: "Sub-Teams", icon: Layers, color: "text-indigo-600" },
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3">
        <div className="w-12 h-1 bg-zinc-100 rounded-full overflow-hidden">
          <div className="w-1/3 h-full bg-zinc-900 animate-pulse" />
        </div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Syncing Architecture…</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-10 p-4">
      {/* Header section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 pb-10 border-b border-zinc-200">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <p className="text-[11px] font-black uppercase tracking-widest text-emerald-600">
              Operational Roadmap
            </p>
          </div>
          <h1 className="text-4xl font-black text-zinc-900 tracking-tighter uppercase italic">
            Elkheta <span className="text-zinc-400">Structure</span>
          </h1>
          <p className="text-sm text-zinc-500 mt-3 max-w-xl leading-relaxed font-medium">
            Global structural map representing institutional departments, dedicated sub-units, and leadership assignments.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full lg:w-auto">
          <div className="relative flex-1 lg:min-w-[400px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Search across the architecture…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border border-zinc-200 rounded-2xl text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 shadow-sm transition-all hover:border-zinc-300"
            />
          </div>
        </div>
      </div>

      {/* Stats Board */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="group relative overflow-hidden rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm hover:shadow-md transition-all">
            <div className={`p-3 rounded-2xl bg-zinc-50 inline-block mb-4 group-hover:bg-zinc-900 group-hover:text-white transition-all`}>
              <stat.icon size={20} />
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-1 leading-none">{stat.label}</p>
            <div className="flex items-baseline gap-2">
              <p className={`text-4xl font-black tracking-tighter tabular-nums ${stat.color}`}>{stat.value}</p>
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest italic">{stat.sub}</p>
            </div>
            <div className="absolute top-0 right-0 p-8 text-zinc-50 opacity-10 group-hover:opacity-20 transition-opacity">
               <stat.icon size={80} />
            </div>
          </div>
        ))}
      </div>

      {/* Hierarchy Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {filteredHierarchy.map((dept) => (
          <article
            key={dept.id}
            className="group flex flex-col rounded-[2.5rem] border border-zinc-200 bg-white shadow-sm overflow-hidden hover:shadow-xl hover:scale-[1.01] transition-all duration-300"
          >
            {/* Card Header: Identity */}
            <div className="p-8 pb-4">
              <div className="flex justify-between items-start mb-6">
                <div className="h-16 w-16 rounded-3xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-zinc-900/10">
                  {dept.name[0]}
                </div>
                <Link 
                  to={`/departments/${dept.id}`}
                  className="p-3 rounded-2xl bg-zinc-50 border border-zinc-100 text-zinc-400 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 transition-all"
                  title="Detailed View"
                >
                  <ExternalLink size={20} />
                </Link>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-1">
                   <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[9px] font-black uppercase tracking-widest rounded italic border border-emerald-100">
                    {dept.type || "PERMANENT"}
                   </span>
                </div>
                <h3 className="text-xl font-black text-zinc-900 tracking-tight leading-7 group-hover:text-emerald-700 transition-colors">
                  {dept.name}
                </h3>
              </div>
            </div>

            {/* Card Body: Highlights */}
            <div className="px-8 flex-1">
              <div className="py-6 border-y border-zinc-100 space-y-6">
                {/* Leader Bit */}
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-zinc-50 border border-zinc-100 flex items-center justify-center text-zinc-400 shadow-inner">
                    <Shield size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest leading-none mb-1">Lead Directivity</p>
                    <p className="text-sm font-bold text-zinc-900 truncate">{dept.head || "Not Appointed"}</p>
                    <p className="text-[10px] text-zinc-400 font-medium italic truncate">{dept.headTitle || "Department Lead"}</p>
                  </div>
                </div>

                {/* Micro Metric Units */}
                <div className="grid grid-cols-2 gap-3">
                   <div className="p-4 rounded-3xl bg-zinc-50/50 border border-zinc-100">
                      <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">Headcount</p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-lg font-black text-zinc-900">{dept.headCount}</span>
                        <span className="text-[8px] font-bold text-zinc-400 uppercase italic">Staff</span>
                      </div>
                   </div>
                   <div className="p-4 rounded-3xl bg-zinc-50/50 border border-zinc-100">
                      <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">Active</p>
                      <div className="flex items-baseline gap-1 font-black text-emerald-600">
                        <span className="text-lg">{dept.activeDensity}</span>
                        <span className="text-[8px] uppercase italic">Presence</span>
                      </div>
                   </div>
                </div>

                {/* Team Previews */}
                <div className="space-y-3">
                   <div className="flex justify-between items-center px-1">
                      <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Structural Units</p>
                      <span className="text-[10px] font-black text-zinc-900 uppercase italic">{(dept.teams || []).length} Units</span>
                   </div>
                   <div className="flex flex-wrap gap-2">
                      {(dept.teams || []).slice(0, 3).map(team => (
                        <div key={team.id || team.name} className="px-3 py-1.5 rounded-xl bg-white border border-zinc-200 text-[10px] font-bold text-zinc-600 shadow-sm flex items-center gap-1.5">
                           <div className="h-1 w-1 rounded-full bg-emerald-500" />
                           {team.name}
                        </div>
                      ))}
                      {(dept.teams || []).length > 3 && (
                        <div className="px-3 py-1.5 rounded-xl bg-zinc-900 text-white text-[9px] font-black uppercase tracking-tighter">
                          +{(dept.teams || []).length - 3} Units
                        </div>
                      )}
                      {(dept.teams || []).length === 0 && (
                        <p className="text-[10px] text-zinc-400 italic px-1">No sub-units currently defined.</p>
                      )}
                   </div>
                </div>
              </div>
            </div>

            {/* Card Footer: Action */}
            <div className="p-6">
              <Link 
                to={`/departments/${dept.id}`}
                className="w-full py-4 rounded-3xl bg-zinc-50 border border-zinc-100 group-hover:bg-zinc-900 group-hover:text-white transition-all flex items-center justify-center gap-2 text-[11px] font-black uppercase tracking-widest shadow-inner group-hover:shadow-lg"
              >
                Inspect Blueprints <ChevronRight size={14} />
              </Link>
            </div>
          </article>
        ))}

        {filteredHierarchy.length === 0 && (
          <div className="col-span-full py-32 text-center rounded-[3rem] border border-dashed border-zinc-200 bg-zinc-50/20">
             <div className="p-6 rounded-3xl bg-white border border-zinc-100 inline-block mb-6 shadow-sm text-zinc-400">
                <Search size={40} />
             </div>
             <p className="text-xl font-black text-zinc-900 uppercase tracking-widest italic mb-2">Null Architecture</p>
             <p className="text-sm text-zinc-500 font-medium">No components match your current query.</p>
          </div>
        )}
      </div>

      {/* Administrative Footer Visibility */}
      <div className="pt-10 border-t border-zinc-100">
        <div className="p-8 rounded-[3rem] bg-zinc-50 border border-zinc-200 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
           <div className="flex items-center gap-5">
              <div className="h-14 w-14 rounded-3xl bg-white border border-zinc-200 flex items-center justify-center text-zinc-400 shadow-sm shrink-0">
                 <Building2 size={24} />
              </div>
              <div className="text-center md:text-left">
                 <h4 className="text-sm font-black text-zinc-900 uppercase tracking-tight">Resource Management Overview</h4>
                 <p className="text-xs text-zinc-500 font-medium mt-1">This blueprint represents formal staffing assignments across defined organizational units.</p>
              </div>
           </div>
           <Link 
             to="/departments"
             className="px-10 py-4 bg-white border border-zinc-200 text-zinc-900 rounded-full font-black text-[12px] uppercase tracking-widest hover:bg-zinc-900 hover:text-white hover:border-zinc-900 transition-all shadow-sm"
           >
              Structure Management
           </Link>
        </div>
      </div>
    </div>
  );
}

export default OrganizationStructurePage;
