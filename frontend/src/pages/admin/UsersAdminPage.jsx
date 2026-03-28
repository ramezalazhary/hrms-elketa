import { useEffect, useMemo, useState } from "react";
import { Layout } from "@/shared/components/Layout";
import { Modal } from "@/shared/components/Modal";
import { useToast } from "@/shared/components/ToastProvider";
import {
  createUserApi,
  getUsersApi,
  updateUserRoleApi,
} from "@/modules/users/api";
import { getDepartmentsApi } from "@/modules/departments/api";
import { getEmployeesApi } from "@/modules/employees/api";
import { useAppSelector } from "@/shared/hooks/reduxHooks";
import {
  getUserPermissionsApi,
  deleteUserPermissionsApi,
  replaceUserPermissionsApi,
} from "@/modules/permissions/api";
import { getPasswordRequestsApi, forceResetPasswordApi } from "@/modules/users/api";

// ─── Helpers ────────────────────────────────────────────────────────────────

const ROLE_META = {
  ADMIN:       { label: "Admin",       color: "bg-violet-100 text-violet-700 border-violet-200",  dot: "bg-violet-500" },
  HR_STAFF:    { label: "HR Staff",    color: "bg-emerald-100 text-emerald-700 border-emerald-200",dot: "bg-emerald-500" },
  MANAGER:     { label: "Manager",     color: "bg-blue-100 text-blue-700 border-blue-200",         dot: "bg-blue-500" },
  TEAM_LEADER: { label: "Team Leader", color: "bg-amber-100 text-amber-700 border-amber-200",      dot: "bg-amber-500" },
  EMPLOYEE:    { label: "Employee",    color: "bg-slate-100 text-slate-600 border-slate-200",      dot: "bg-slate-400" },
};

function normaliseRole(r) {
  if (r === 3 || r === "ADMIN")    return "ADMIN";
  if (r === 2 || r === "MANAGER")  return "MANAGER";
  if (r === "HR_STAFF")            return "HR_STAFF";
  if (r === "TEAM_LEADER")         return "TEAM_LEADER";
  return "EMPLOYEE";
}

function RoleBadge({ role }) {
  const key  = normaliseRole(role);
  const meta = ROLE_META[key] ?? ROLE_META.EMPLOYEE;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.color}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

function Avatar({ email }) {
  const letter = (email || "?")[0].toUpperCase();
  const colors = [
    "bg-violet-500","bg-blue-500","bg-emerald-500","bg-amber-500",
    "bg-rose-500","bg-cyan-500","bg-indigo-500","bg-pink-500",
  ];
  const idx   = email ? email.charCodeAt(0) % colors.length : 0;
  return (
    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-sm ${colors[idx]}`}>
      {letter}
    </div>
  );
}

const MODULES = ["employees","departments","recruitment","payroll","attendance"];
const ACTIONS  = ["view","create","edit","delete","approve","export"];

// ─── Main component ──────────────────────────────────────────────────────────

export function UsersAdminPage() {
  const { showToast } = useToast();
  const currentRole  = useAppSelector(s => s.identity.currentUser?.role);
  const currentEmail = useAppSelector(s => s.identity.currentUser?.email);
  const isAdmin      = currentRole === 3 || currentRole === "ADMIN";

  /* ── data ── */
  const [isLoading,        setLoading]        = useState(false);
  const [users,            setUsers]           = useState([]);
  const [pendingRoles,     setPendingRoles]    = useState({});
  const [selectedUserId,   setSelectedUserId]  = useState(null);
  const [permissionsLoading, setPermLoading]  = useState(false);
  const [permissions,      setPermissions]     = useState([]);

  const [departments, setDepartments] = useState([]);
  const [employees,   setEmployees]   = useState([]);
  const [deptLoading, setDeptLoading] = useState(false);
  const [empLoading,  setEmpLoading]  = useState(false);

  /* ── filters ── */
  const [search,      setSearch]      = useState("");
  const [filterRole,  setFilterRole]  = useState("ALL");
  const [filterDept,  setFilterDept]  = useState("all");

  /* ── tabs ── */
  const [tab, setTab] = useState("users"); // "users" | "directory"

  /* ── HR head check ── */
  const isHrHead = useMemo(() => {
    if (!isAdmin || !currentEmail) return false;
    return departments.some(d => d.name === "HR" && d.head === currentEmail);
  }, [currentEmail, departments, isAdmin]);

  /* ── load ── */
  useEffect(() => {
    if (isAdmin) {
      setLoading(true);
      getUsersApi()
        .then(d => setUsers(d))
        .catch(e => { console.error(e); showToast("Failed to load users","error"); })
        .finally(() => setLoading(false));
    }
  }, [isAdmin, showToast]);

  useEffect(() => {
    setDeptLoading(true);
    getDepartmentsApi()
      .then(d => setDepartments(d))
      .catch(e => { console.error(e); showToast("Failed to load departments","error"); })
      .finally(() => setDeptLoading(false));
  }, [showToast]);

  useEffect(() => {
    setEmpLoading(true);
    getEmployeesApi()
      .then(d => setEmployees(d))
      .catch(e => { console.error(e); showToast("Failed to load employees","error"); })
      .finally(() => setEmpLoading(false));
  }, [showToast]);

  /* ── derived ── */
  const rows = useMemo(() =>
    users.map(u => ({ ...u, effectiveRole: pendingRoles[u.id] ?? u.role })),
    [pendingRoles, users]
  );

  const filteredUsers = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter(u => {
      const matchSearch = !q || u.email.toLowerCase().includes(q);
      const matchRole   = filterRole === "ALL" || normaliseRole(u.effectiveRole) === filterRole;
      return matchSearch && matchRole;
    });
  }, [rows, search, filterRole]);

  const filteredEmployees = useMemo(() => {
    const q = search.toLowerCase();
    return employees.filter(e => {
      const matchSearch = !q || e.fullName?.toLowerCase().includes(q) || e.email?.toLowerCase().includes(q);
      const matchDept   = filterDept === "all" || e.department === filterDept;
      return matchSearch && matchDept;
    });
  }, [employees, search, filterDept]);

  const emailToUserId = useMemo(() => {
    const map = new Map();
    for (const u of users) map.set(u.email, u.id);
    return map;
  }, [users]);

  /* ── handlers ── */
  async function handleSaveRole(row) {
    try {
      const resp = await updateUserRoleApi(row.id, row.effectiveRole);
      setUsers(prev => prev.map(u => u.id === resp.user.id ? resp.user : u));
      setPendingRoles(prev => { const n = { ...prev }; delete n[row.id]; return n; });
      showToast(`Role updated to ${ROLE_META[normaliseRole(resp.user.role)]?.label}`, "success");
    } catch(err) { console.error(err); showToast("Failed to update role","error"); }
  }

  async function handleOpenPermissions(userId) {
    setSelectedUserId(userId);
    setPermLoading(true);
    try {
      const data = await getUserPermissionsApi(userId);
      setPermissions(data);
    } catch(err) { console.error(err); showToast("Failed to load permissions","error"); }
    finally { setPermLoading(false); }
  }

  async function handleSavePermissions() {
    try {
      await replaceUserPermissionsApi(selectedUserId, permissions.map(p => ({
        module: p.module, actions: p.actions, scope: p.scope,
      })));
      showToast("Permissions saved","success");
      setSelectedUserId(null);
    } catch(err) { console.error(err); showToast("Failed to save permissions","error"); }
  }

  async function handleClearPermissions() {
    if (!window.confirm("Remove all permissions for this user?")) return;
    try {
      await deleteUserPermissionsApi(selectedUserId);
      setPermissions([]);
      showToast("Permissions cleared","success");
    } catch(err) { console.error(err); showToast("Failed to clear permissions","error"); }
  }

  function togglePermAction(module, action) {
    setPermissions(prev => {
      const existing = prev.find(p => p.module === module) ?? { module, actions: [], scope: "self" };
      const hasAction = existing.actions.includes(action);
      const nextActions = hasAction
        ? existing.actions.filter(a => a !== action)
        : [...existing.actions, action];
      const others = prev.filter(p => p.module !== module);
      return [...others, { ...existing, module, actions: nextActions }];
    });
  }

  const selectedUserEmail = users.find(u => u.id === selectedUserId)?.email ?? selectedUserId;

  /* ─────────────────────────────────────────── render ── */
  return (
    <Layout
      title="Users & Permissions"
      description="Manage system accounts, roles and granular module permissions."
    >
      {/* ── Stats bar ── */}
      {isAdmin && !isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          {Object.entries(ROLE_META).map(([key, meta]) => {
            const count = users.filter(u => normaliseRole(u.role) === key).length;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setFilterRole(old => old === key ? "ALL" : key)}
                className={`group flex flex-col gap-1 rounded-2xl border p-4 text-left transition-all duration-200 hover:shadow-md active:scale-95 ${
                  filterRole === key
                    ? "border-slate-900 bg-slate-900 shadow-md"
                    : "border-white/60 bg-white/70 backdrop-blur hover:border-slate-200"
                }`}
              >
                <span className={`text-2xl font-extrabold ${filterRole === key ? "text-white" : "text-slate-900"}`}>
                  {count}
                </span>
                <span className={`text-xs font-semibold ${filterRole === key ? "text-slate-300" : "text-slate-500"}`}>
                  {meta.label}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Tabs + Search ── */}
      {isAdmin && (
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <div className="flex rounded-xl border border-slate-200 bg-white/70 backdrop-blur p-1 gap-1">
            {[["users","👥 Accounts"],["directory","🏢 Directory"]].map(([id,label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                  tab === id
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-48 max-w-sm">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder={tab === "users" ? "Search by email…" : "Search by name or email…"}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white/80 py-2 pl-9 pr-4 text-sm text-slate-800 placeholder-slate-400 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
            />
          </div>

          {/* Role filter (users tab) */}
          {tab === "users" && (
            <select
              value={filterRole}
              onChange={e => setFilterRole(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm font-medium text-slate-700 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
            >
              <option value="ALL">All Roles</option>
              {Object.entries(ROLE_META).map(([key,m]) => (
                <option key={key} value={key}>{m.label}</option>
              ))}
            </select>
          )}

          {/* Dept filter (directory tab) */}
          {tab === "directory" && (
            <select
              value={filterDept}
              onChange={e => setFilterDept(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm font-medium text-slate-700 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
            >
              <option value="all">{deptLoading ? "Loading…" : "All Departments"}</option>
              {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
            </select>
          )}
        </div>
      )}

      {/* ── ACCOUNTS TAB ── */}
      {isAdmin && tab === "users" && (
        <div className="overflow-hidden rounded-2xl border border-white/60 bg-white/70 backdrop-blur shadow-sm">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
                <p className="text-sm text-slate-500">Loading accounts…</p>
              </div>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="text-4xl mb-3">🔍</div>
              <p className="font-semibold text-slate-700">No users match</p>
              <p className="text-sm text-slate-500 mt-1">Try a different search or filter.</p>
            </div>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80">
                  <th className="px-5 py-3.5 text-left font-semibold text-slate-600">Account</th>
                  <th className="px-5 py-3.5 text-left font-semibold text-slate-600">Current Role</th>
                  {!isHrHead && <th className="px-5 py-3.5 text-left font-semibold text-slate-600">Change Role</th>}
                  <th className="px-5 py-3.5 text-right font-semibold text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/80">
                {filteredUsers.map(row => {
                  const isDirty = row.effectiveRole !== row.role;
                  return (
                    <tr key={row.id} className="group transition-colors hover:bg-blue-50/40">
                      {/* Account */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <Avatar email={row.email} />
                          <span className="font-medium text-slate-800">{row.email}</span>
                          {isDirty && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
                              Unsaved
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Current badge */}
                      <td className="px-5 py-3.5">
                        <RoleBadge role={row.role} />
                      </td>

                      {/* Dropdown */}
                      {!isHrHead && (
                        <td className="px-5 py-3.5">
                          <select
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
                            value={row.effectiveRole}
                            onChange={e => setPendingRoles(prev => ({ ...prev, [row.id]: e.target.value }))}
                          >
                            <option value="EMPLOYEE">Employee</option>
                            <option value="TEAM_LEADER">Team Leader</option>
                            <option value="MANAGER">Manager</option>
                            <option value="HR_STAFF">HR Staff</option>
                            <option value="ADMIN">Admin</option>
                          </select>
                        </td>
                      )}

                      {/* Actions */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-2">
                          {!isHrHead && (
                            <button
                              type="button"
                              disabled={!isDirty}
                              onClick={() => handleSaveRole(row)}
                              className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-600 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              Save
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleOpenPermissions(row.id)}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                          >
                            Permissions
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {/* Footer count */}
          {!isLoading && (
            <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-400 flex items-center justify-between">
              <span>Showing <strong className="text-slate-600">{filteredUsers.length}</strong> of <strong className="text-slate-600">{users.length}</strong> accounts</span>
              {filterRole !== "ALL" && (
                <button type="button" onClick={() => setFilterRole("ALL")} className="text-blue-500 hover:underline font-medium">
                  Clear filter
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── DIRECTORY TAB ── */}
      {tab === "directory" && (
        <div className="overflow-hidden rounded-2xl border border-white/60 bg-white/70 backdrop-blur shadow-sm">
          {empLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
                <p className="text-sm text-slate-500">Loading directory…</p>
              </div>
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="text-4xl mb-3">📭</div>
              <p className="font-semibold text-slate-700">No employees found</p>
              <p className="text-sm text-slate-500 mt-1">Try a different search or department.</p>
            </div>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80">
                  <th className="px-5 py-3.5 text-left font-semibold text-slate-600">Employee</th>
                  <th className="px-5 py-3.5 text-left font-semibold text-slate-600">Department</th>
                  <th className="px-5 py-3.5 text-left font-semibold text-slate-600">Position</th>
                  {isAdmin && filterDept === "HR" && (
                    <th className="px-5 py-3.5 text-right font-semibold text-slate-600">HR Permissions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/80">
                {filteredEmployees.map(emp => {
                  const userId = emailToUserId.get(emp.email);
                  return (
                    <tr key={emp.id} className="group transition-colors hover:bg-blue-50/40">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <Avatar email={emp.email} />
                          <div>
                            <p className="font-semibold text-slate-800">{emp.fullName}</p>
                            <p className="text-xs text-slate-500">{emp.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                          {emp.department || "—"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-600">{emp.position || "—"}</td>
                      {isAdmin && filterDept === "HR" && (
                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              disabled={!userId}
                              onClick={() => userId && handleOpenPermissions(userId)}
                              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed"
                              title={userId ? "Manage permissions" : "Create login first"}
                            >
                              Permissions
                            </button>
                            {!userId && (
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    const resp = await createUserApi({ email: emp.email, password: "Welcome123!" });
                                    setUsers(prev => [resp.user, ...prev]);
                                    showToast(`Login created — password: Welcome123!`, "success");
                                  } catch(err) {
                                    console.error(err);
                                    showToast("Failed to create login","error");
                                  }
                                }}
                                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 transition"
                              >
                                Create Login
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-400">
            Showing <strong className="text-slate-600">{filteredEmployees.length}</strong> of <strong className="text-slate-600">{employees.length}</strong> employees
          </div>
        </div>
      )}

      {/* ── Permissions modal ── */}
      <Modal
        open={!!selectedUserId}
        title="Module Permissions"
        maxWidth="max-w-5xl"
        onClose={() => setSelectedUserId(null)}
      >
        <div className="flex flex-col gap-5">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 border border-slate-100 p-4">
            <div className="flex items-center gap-3">
              <Avatar email={selectedUserEmail} />
              <div>
                <p className="text-xs text-slate-500 font-medium">Configuring permissions for</p>
                <p className="font-bold text-slate-900">{selectedUserEmail}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClearPermissions}
                className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
              >
                Clear All
              </button>
              <button
                type="button"
                onClick={handleSavePermissions}
                className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600"
              >
                Save Changes
              </button>
            </div>
          </div>

          {permissionsLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-100 shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-5 py-3.5 text-left font-semibold text-slate-700 w-36">Module</th>
                      <th className="px-5 py-3.5 text-left font-semibold text-slate-700 w-36">Scope</th>
                      {ACTIONS.map(a => (
                        <th key={a} className="px-4 py-3.5 font-semibold text-slate-700 capitalize text-center">{a}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 bg-white">
                    {MODULES.map(m => {
                      const row = permissions.find(p => p.module === m) ?? {
                        id: `${selectedUserId}:${m}`, userId: selectedUserId,
                        module: m, actions: [], scope: "self",
                      };
                      const systemEditOnly = isHrHead && (m === "employees" || m === "departments");
                      return (
                        <tr key={m} className="transition-colors hover:bg-blue-50/30 group">
                          <td className="px-5 py-4">
                            <span className="inline-flex items-center gap-2 font-semibold text-slate-800 capitalize">
                              <span className="h-2 w-2 rounded-full bg-blue-500 opacity-70 group-hover:opacity-100 transition-opacity" />
                              {m}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <select
                              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
                              value={row.scope}
                              onChange={e => {
                                const scope = e.target.value;
                                setPermissions(prev => {
                                  const others = prev.filter(p => p.module !== m);
                                  return [...others, { ...row, scope, module: m }];
                                });
                              }}
                            >
                              <option value="self">Self</option>
                              <option value="department">Department</option>
                              <option value="all">Enterprise</option>
                            </select>
                          </td>
                          {ACTIONS.map(a => {
                            const disabled = systemEditOnly && a !== "view" && a !== "edit";
                            const checked  = row.actions.includes(a);
                            return (
                              <td key={a} className="px-4 py-4 text-center">
                                <label className="inline-flex cursor-pointer items-center justify-center">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    disabled={disabled}
                                    onChange={() => togglePermAction(m, a)}
                                    className="h-4 w-4 rounded border-slate-300 text-blue-600 shadow-sm focus:ring-blue-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                  />
                                </label>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </Layout>
  );
}
