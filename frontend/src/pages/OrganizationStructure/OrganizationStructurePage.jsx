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
  Shield,
  LayoutGrid,
  Filter,
  ChevronRight,
} from "lucide-react";
import { DepartmentBadge } from "@/shared/components/EntityBadges";

/**
 * Organization hierarchy: departments, teams, and positions in a flat, readable layout.
 */
function OrganizationStructurePage() {
  const dispatch = useAppDispatch();
  const employees = useAppSelector((state) => state.employees.items);
  const departments = useAppSelector((state) => state.departments.items);
  const teams = useAppSelector((state) => state.teams.items);
  const loading = useAppSelector(
    (state) => state.employees.isLoading || state.departments.isLoading || state.teams.isLoading,
  );

  const [search, setSearch] = useState("");
  const [expandedDepts, setExpandedDepts] = useState({});

  useEffect(() => {
    dispatch(fetchEmployeesThunk());
    dispatch(fetchDepartmentsThunk());
    dispatch(fetchTeamsThunk());
  }, [dispatch]);

  const toggleDept = (id) => {
    setExpandedDepts((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const hierarchy = useMemo(() => {
    return departments.map((dept) => ({
      ...dept,
      teams: teams.filter((t) => t.departmentId === dept.id || t.departmentId === dept._id),
      headCount: employees.filter(
        (e) => e.departmentId === dept.id || e.departmentId === dept._id,
      ).length,
    }));
  }, [departments, teams, employees]);

  const filteredHierarchy = hierarchy.filter(
    (dept) =>
      dept.name.toLowerCase().includes(search.toLowerCase()) ||
      dept.teams.some((t) => t.name.toLowerCase().includes(search.toLowerCase())),
  );

  const stats = [
    { label: "People", value: employees.length, icon: Users },
    { label: "Departments", value: departments.length, icon: Network },
    { label: "Teams", value: teams.length, icon: Layers },
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3">
        <div className="w-12 h-0.5 bg-zinc-100 rounded-full overflow-hidden">
          <div className="w-1/3 h-full bg-zinc-400 animate-pulse" />
        </div>
        <p className="text-xs text-zinc-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 p-2">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-zinc-200">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400 mb-1">
            Organization
          </p>
          <h1 className="text-xl font-medium text-zinc-900 tracking-tight">Structure</h1>
          <p className="text-sm text-zinc-500 mt-2 max-w-md leading-relaxed">
            Departments, teams, and roles from your HR directory.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full lg:w-auto">
          <div className="relative flex-1 lg:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Search department or team…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white border border-zinc-200 rounded-md text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400"
            />
          </div>
          <button
            type="button"
            className="p-2 bg-white border border-zinc-200 rounded-md text-zinc-400 hover:text-zinc-700"
            aria-label="Filter"
          >
            <Filter className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {stats.map((stat, i) => (
          <div key={i} className="rounded-lg border border-zinc-200 bg-white p-4 shadow-card">
            <div className="flex items-center gap-2 text-zinc-500 mb-2">
              <stat.icon className="w-4 h-4" />
              <p className="text-[11px] font-medium uppercase tracking-wide">{stat.label}</p>
            </div>
            <p className="text-2xl font-medium text-zinc-900 tabular-nums">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filteredHierarchy.map((dept) => (
          <div
            key={dept.id}
            className="rounded-lg border border-zinc-200 bg-white shadow-card overflow-hidden"
          >
            <button
              type="button"
              className="w-full p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 text-left hover:bg-zinc-50/80 transition-colors"
              onClick={() => toggleDept(dept.id)}
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-12 h-12 rounded-md border border-zinc-200 bg-zinc-50 flex items-center justify-center text-sm font-medium text-zinc-700 uppercase shrink-0">
                  {dept.name[0]}
                </div>
                <div className="min-w-0">
                  <DepartmentBadge name={dept.name} className="font-medium" />
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="inline-flex items-center gap-1.5 text-[11px] text-zinc-500 border border-zinc-100 rounded px-2 py-0.5">
                      <Shield size={10} />
                      {dept.head || "—"}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[11px] text-zinc-500 border border-zinc-100 rounded px-2 py-0.5">
                      <Users size={10} />
                      {dept.headCount}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
                <span className="text-xs text-zinc-500 tabular-nums">{dept.teams.length} teams</span>
                <div
                  className={`p-1.5 rounded-md border border-zinc-200 text-zinc-400 transition-transform ${
                    expandedDepts[dept.id] ? "rotate-180" : ""
                  }`}
                >
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
            </button>

            {expandedDepts[dept.id] && (
              <div className="px-5 pb-5 pt-0 border-t border-zinc-100">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 pt-5">
                  <div className="space-y-3">
                    <h4 className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                      Teams
                    </h4>
                    {dept.teams.length === 0 ? (
                      <div className="p-8 border border-dashed border-zinc-200 rounded-md text-center text-sm text-zinc-400">
                        No teams
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {dept.teams.map((team) => (
                          <div
                            key={team.id}
                            className="p-4 rounded-md border border-zinc-100 bg-zinc-50/50 hover:border-zinc-200 transition-colors"
                          >
                            <h5 className="font-medium text-zinc-900 text-sm">{team.name}</h5>
                            <p className="text-xs text-zinc-500 mt-1">
                              Lead: {team.managerEmail || "—"}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                      Positions
                    </h4>
                    <div className="rounded-md border border-zinc-100 divide-y divide-zinc-100 bg-white">
                      {dept.positions.map((pos, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3 gap-3 hover:bg-zinc-50/80"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="p-2 rounded border border-zinc-100 bg-zinc-50">
                              <Briefcase className="w-3.5 h-3.5 text-zinc-500" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-zinc-800 truncate">{pos.title}</p>
                              <p className="text-[10px] text-zinc-400 uppercase tracking-wide">
                                Level {pos.level}
                              </p>
                            </div>
                          </div>
                          <ChevronRight size={14} className="text-zinc-300 shrink-0" />
                        </div>
                      ))}
                      {dept.positions.length === 0 && (
                        <div className="p-6 text-center text-xs text-zinc-400">No positions</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <LayoutGrid size={18} className="text-zinc-400" />
          <p className="text-sm text-zinc-600 max-w-md">
            Edits to departments and teams are managed from Departments and related admin screens.
          </p>
        </div>
      </div>
    </div>
  );
}

export default OrganizationStructurePage;
