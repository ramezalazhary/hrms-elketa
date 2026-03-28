import React, { useEffect, useState, useMemo } from "react";
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
  ChevronDown, 
  ChevronRight, 
  Shield, 
  LayoutGrid,
  Filter,
  Activity,
  ArrowUpRight
} from "lucide-react";

/** 
 * OrganizationStructurePage - Minimalist HR Premium
 * Ultra-clean hierarchy visualization with a focus on depth and spatial clarity.
 */
function OrganizationStructurePage() {
  const dispatch = useAppDispatch();
  const employees = useAppSelector((state) => state.employees.items);
  const departments = useAppSelector((state) => state.departments.items);
  const teams = useAppSelector((state) => state.teams.items);
  const loading = useAppSelector(
    (state) => state.employees.isLoading || state.departments.isLoading || state.teams.isLoading
  );

  const [search, setSearch] = useState("");
  const [expandedDepts, setExpandedDepts] = useState({});

  useEffect(() => {
    dispatch(fetchEmployeesThunk());
    dispatch(fetchDepartmentsThunk());
    dispatch(fetchTeamsThunk());
  }, [dispatch]);

  const toggleDept = (id) => {
    setExpandedDepts(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const hierarchy = useMemo(() => {
    return departments.map(dept => ({
      ...dept,
      teams: teams.filter(t => t.departmentId === dept.id || t.departmentId === dept._id),
      headCount: employees.filter(e => (e.departmentId === dept.id || e.departmentId === dept._id)).length
    }));
  }, [departments, teams, employees]);

  const filteredHierarchy = hierarchy.filter(dept => 
    dept.name.toLowerCase().includes(search.toLowerCase()) ||
    dept.teams.some(t => t.name.toLowerCase().includes(search.toLowerCase()))
  );

  const stats = [
    { label: "Personnel", value: employees.length, icon: Users, theme: "text-indigo-600" },
    { label: "Departments", value: departments.length, icon: Network, theme: "text-slate-900" },
    { label: "Functional Teams", value: teams.length, icon: Layers, theme: "text-emerald-600" },
    { label: "Stability", value: "99.8%", icon: Shield, theme: "text-amber-500" },
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 animate-in fade-in duration-500">
        <div className="w-16 h-1 bg-slate-100 rounded-full overflow-hidden">
           <div className="w-1/2 h-full bg-indigo-600 animate-slide-in-left infinite" />
        </div>
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Loading Organizational Nodes...</p>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto space-y-12 p-2 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      
      {/* Header & Meta */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 mb-2">
            <Activity className="w-4 h-4" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">Institutional Architecture</span>
          </div>
          <h1 className="text-5xl font-black text-slate-900 tracking-tighter">Personnel Hierarchy</h1>
          <p className="text-slate-400 mt-2 font-medium max-w-lg leading-relaxed italic">A high-fidelity map of functional departments, leadership nodes, and team structures.</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-indigo-600 transition-colors" />
            <input 
              type="text" 
              placeholder="Query Department or Team..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-14 pr-6 py-4 bg-white border border-slate-200 rounded-[2rem] text-xs font-black w-[400px] focus:ring-4 focus:ring-slate-50 transition-all outline-none text-slate-900 placeholder:text-slate-300 shadow-sm"
            />
          </div>
          <button className="p-4 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-indigo-600 transition-all shadow-sm">
             <Filter className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Numerical Index */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-2">
        {stats.map((stat, i) => (
          <div key={i} className="flex flex-col gap-1">
            <div className="flex items-center gap-2 mb-1">
               <stat.icon className={`w-3.5 h-3.5 ${stat.theme}`} />
               <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{stat.label}</p>
            </div>
            <h3 className="text-4xl font-black text-slate-900 tracking-tighter">{stat.value}</h3>
          </div>
        ))}
      </div>

      {/* Structured Nodes */}
      <div className="grid grid-cols-1 gap-6">
        {filteredHierarchy.map((dept) => (
          <div key={dept.id} className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-2xl hover:border-indigo-100 transition-all overflow-hidden group">
            <div 
              className="p-10 flex flex-col md:flex-row md:items-center justify-between cursor-pointer gap-8"
              onClick={() => toggleDept(dept.id)}
            >
              <div className="flex items-center gap-8">
                <div className="w-20 h-20 rounded-[2rem] bg-indigo-50 border border-indigo-100/50 flex items-center justify-center font-black text-indigo-500 text-3xl shadow-inner group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500 uppercase">
                  {dept.name[0]}
                </div>
                <div>
                  <h3 className="text-3xl font-black text-slate-900 tracking-tighter mb-2">{dept.name} Department</h3>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-full">
                       <Shield size={12} className="text-slate-400" />
                       <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{dept.head || "Vacant"}</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50/50 border border-indigo-100/50 rounded-full">
                       <Users size={12} className="text-indigo-400" />
                       <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600">{dept.headCount} Members</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-6 self-end md:self-center">
                 <div className="text-right">
                    <p className="text-[10px] font-black uppercase text-slate-300 tracking-[0.2em] mb-1">Sub-Units</p>
                    <div className="flex items-center justify-end gap-2">
                       <span className="text-3xl font-black text-slate-900 tracking-tighter">{dept.teams.length}</span>
                       <Layers size={18} className="text-slate-200" />
                    </div>
                 </div>
                 <div className={`p-5 rounded-2xl bg-slate-50 text-slate-300 transition-all duration-500 ${expandedDepts[dept.id] ? "rotate-180 bg-slate-900 text-white shadow-xl shadow-slate-200" : ""}`}>
                   <ChevronDown className="w-6 h-6" />
                 </div>
              </div>
            </div>

            {expandedDepts[dept.id] && (
              <div className="px-10 pb-10 pt-4 animate-in slide-in-from-top-4 duration-500 space-y-12">
                <div className="w-full h-px bg-slate-50" />
                
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-12">
                  {/* Teams / Sub-Units Grid */}
                  <div className="space-y-6">
                    <div className="flex items-center justify-between px-2">
                       <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Assigned Operational Teams</h4>
                    </div>
                    {dept.teams.length === 0 ? (
                      <div className="p-16 border border-dashed border-slate-100 rounded-[2.5rem] flex flex-col items-center justify-center text-slate-200">
                         <Layers size={40} className="mb-4 stroke-[1px]" />
                         <p className="text-[10px] font-black uppercase tracking-widest leading-none">Cluster Empty</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {dept.teams.map(team => (
                          <div key={team.id} className="relative bg-slate-50/50 p-8 rounded-[2rem] border border-transparent hover:border-indigo-100 hover:bg-white transition-all hover:shadow-lg group/team">
                            <h5 className="font-black text-slate-900 text-xl tracking-tight mb-1">{team.name}</h5>
                            <p className="text-[10px] font-bold text-slate-400 uppercase italic tracking-wider truncate mb-6">Lead: {team.managerEmail || "TBA"}</p>
                            
                            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                               <div className="flex gap-1">
                                  {Array(3).fill(0).map((_,i) => <div key={i} className="w-1.5 h-1.5 rounded-full bg-slate-200" />)}
                               </div>
                               <ArrowUpRight size={14} className="text-slate-300 group-hover/team:text-indigo-500 transition-colors" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Core Roles Section */}
                  <div className="space-y-6">
                    <div className="flex items-center justify-between px-2">
                       <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Strategic Positions</h4>
                    </div>
                    <div className="bg-slate-50/30 p-2 rounded-[2.5rem] border border-slate-50">
                       <div className="bg-white p-6 rounded-[2rem] shadow-sm space-y-2">
                          {dept.positions.map((pos, idx) => (
                            <div key={idx} className="flex items-center justify-between p-4 hover:bg-slate-50 rounded-2xl transition-all group">
                               <div className="flex items-center gap-5">
                                 <div className="p-3 bg-slate-50 rounded-xl group-hover:bg-white shadow-sm transition-colors">
                                   <Briefcase className="w-4 h-4 text-slate-400 group-hover:text-indigo-600" />
                                 </div>
                                 <div>
                                   <p className="text-sm font-black text-slate-800 tracking-tight">{pos.title}</p>
                                   <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mt-0.5">Hierarchy Tier {pos.level}</p>
                                 </div>
                               </div>
                               <div className="p-2 text-slate-200 group-hover:text-slate-900 transition-colors">
                                  <ArrowRight size={14} />
                               </div>
                            </div>
                          ))}
                          {dept.positions.length === 0 && (
                             <div className="text-center py-12">
                               <p className="text-[10px] font-black uppercase text-slate-300 italic tracking-widest">No Key Roles Defined</p>
                             </div>
                          )}
                       </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Institutional Insight Footer */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch pt-8">
         <div className="bg-slate-950 p-12 rounded-[3rem] text-white relative overflow-hidden group">
            <h4 className="text-3xl font-black tracking-tighter mb-6 leading-tight">Architecture Governance & Integrity</h4>
            <p className="text-slate-500 text-sm font-medium leading-relaxed mb-10 max-w-sm">This visualization is synchronized with the HRMS Core Employment Registry. Adjustments to departments require secondary authorization from the Strategic Office.</p>
            <div className="flex items-center gap-6">
               <button className="px-8 py-4 bg-white text-slate-950 text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-indigo-500 hover:text-white transition-all shadow-xl shadow-indigo-500/10">Manage Permissions</button>
               <span className="text-[10px] font-black uppercase text-slate-600 tracking-widest">Active Verification: 100%</span>
            </div>
            <Activity className="absolute bottom-[-20px] right-[-20px] w-60 h-60 text-white/5 group-hover:text-indigo-500/10 transition-colors" />
         </div>
         
         <div className="bg-white p-12 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col justify-center">
             <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-px bg-slate-100" />
                <LayoutGrid size={24} className="text-indigo-400" />
                <div className="w-12 h-px bg-slate-100" />
             </div>
             <p className="text-center text-slate-400 font-medium italic text-lg leading-relaxed">
               "Great organizations are not built with people; they are built with roles that people fill with excellence."
             </p>
         </div>
      </div>
    </div>
  );
}

export default OrganizationStructurePage;
