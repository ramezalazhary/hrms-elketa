/**
 * @file Admin UI for login accounts (`/admin/users`): loads users when actor is Admin or Head of HR,
 * employee directory for broader roles, permission matrix modal, and HR-only onboarding actions.
 * Data flow: Redux `identity` → parallel REST (`getUsersApi`, `getDepartmentsApi`, `getEmployeesApi`) →
 * local React state for filters, tabs, selected user, permission rows → save via users/permissions APIs.
 */
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
import {
  RoleBadge,
  RoleStatCard,
  ROLE_CONFIG,
  normaliseRoleKey,
  DepartmentBadge,
} from "@/shared/components/EntityBadges";

// ─── Helpers ────────────────────────────────────────────────────────────────

function Avatar({ email }) {
  const letter = (email || "?")[0].toUpperCase();
  const shades = [
    "bg-zinc-700",
    "bg-zinc-600",
    "bg-zinc-500",
    "bg-zinc-800",
  ];
  const idx = email ? email.charCodeAt(0) % shades.length : 0;
  return (
    <div
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-xs font-medium text-white ${shades[idx]}`}
    >
      {letter}
    </div>
  );
}

const MODULES = ["employees", "departments", "attendance", "recruitment", "payroll"];
const ACTIONS  = ["view","create","edit","delete","approve","export"];

// ─── Main component ──────────────────────────────────────────────────────────

export function UsersAdminPage() {
  const { showToast } = useToast();
  const currentRole  = useAppSelector(s => s.identity.currentUser?.role);
  const currentEmail = useAppSelector(s => s.identity.currentUser?.email);
  const isFullAdmin  = currentRole === 3 || currentRole === "ADMIN";

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

  /* ── Head of HR (email matches HR department head), independent of admin role ── */
  const isHrHead = useMemo(() => {
    if (!currentEmail || !departments.length) return false;
    return departments.some(d => d.name === "HR" && d.head === currentEmail);
  }, [currentEmail, departments]);

  const canLoadUsers = isFullAdmin || (currentRole === "HR_STAFF" && isHrHead);
  const showAccountsTab = canLoadUsers;
  const showAdminNav =
    showAccountsTab || ["MANAGER", "HR_STAFF"].includes(currentRole);
  /** HR Heads (without system Admin) cannot assign roles — backend enforces the same. */
  const hideRoleControls = isHrHead && !isFullAdmin;

  /* ── load ── */
  useEffect(() => {
    if (canLoadUsers) {
      setLoading(true);
      getUsersApi()
        .then(d => setUsers(d))
        .catch(e => { console.error(e); showToast("Failed to load users","error"); })
        .finally(() => setLoading(false));
    } else {
      setUsers([]);
    }
  }, [canLoadUsers, showToast]);

  useEffect(() => {
    if (!showAccountsTab && tab === "users") setTab("directory");
  }, [showAccountsTab, tab]);

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
      const matchRole   = filterRole === "ALL" || normaliseRoleKey(u.effectiveRole) === filterRole;
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
      showToast(`Role updated to ${ROLE_CONFIG[normaliseRoleKey(resp.user.role)]?.label}`, "success");
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
      {showAccountsTab && !isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          {Object.keys(ROLE_CONFIG).map((key) => {
            const count = users.filter((u) => normaliseRoleKey(u.role) === key).length;
            return (
              <RoleStatCard
                key={key}
                roleKey={key}
                selected={filterRole === key}
                count={count}
                onToggle={() => setFilterRole((old) => (old === key ? "ALL" : key))}
              />
            );
          })}
        </div>
      )}

      {/* ── Tabs + Search ── */}
      {showAdminNav && (
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <div className="flex rounded-md border border-zinc-200 bg-zinc-50/80 p-0.5 gap-0.5">
            {[
              ...(showAccountsTab ? [["users", "Accounts"]] : []),
              ["directory", "Directory"],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                  tab === id
                    ? "bg-white text-zinc-900 shadow-sm border border-zinc-200"
                    : "text-zinc-600 hover:text-zinc-900"
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
              className="w-full rounded-md border border-zinc-200 bg-white py-2 pl-9 pr-4 text-sm text-zinc-900 placeholder-zinc-400 shadow-card focus:outline-none focus:ring-1 focus:ring-zinc-400"
            />
          </div>

          {/* Role filter (users tab) */}
          {tab === "users" && (
            <select
              value={filterRole}
              onChange={e => setFilterRole(e.target.value)}
              className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-800 shadow-card focus:outline-none focus:ring-1 focus:ring-zinc-400"
            >
              <option value="ALL">All Roles</option>
              {Object.entries(ROLE_CONFIG).map(([key, m]) => (
                <option key={key} value={key}>{m.label}</option>
              ))}
            </select>
          )}

          {/* Dept filter (directory tab) */}
          {tab === "directory" && (
            <select
              value={filterDept}
              onChange={e => setFilterDept(e.target.value)}
              className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-800 shadow-card focus:outline-none focus:ring-1 focus:ring-zinc-400"
            >
              <option value="all">{deptLoading ? "Loading…" : "All Departments"}</option>
              {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
            </select>
          )}
        </div>
      )}

      {/* ── ACCOUNTS TAB ── */}
      {showAccountsTab && tab === "users" && (
        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-card">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3">
                <div className="h-7 w-7 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-800" />
                <p className="text-sm text-zinc-500">Loading accounts…</p>
              </div>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="font-medium text-zinc-800">No users match</p>
              <p className="text-sm text-slate-500 mt-1">Try a different search or filter.</p>
            </div>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80">
                  <th className="px-5 py-3.5 text-left font-semibold text-slate-600">Account</th>
                  <th className="px-5 py-3.5 text-left font-semibold text-slate-600">Current Role</th>
                  {!hideRoleControls && <th className="px-5 py-3.5 text-left font-semibold text-slate-600">Change Role</th>}
                  <th className="px-5 py-3.5 text-right font-semibold text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/80">
                {filteredUsers.map(row => {
                  const isDirty = row.effectiveRole !== row.role;
                  return (
                    <tr key={row.id} className="group transition-colors hover:bg-zinc-50/80">
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
                      {!hideRoleControls && (
                        <td className="px-5 py-3.5">
                          <select
                            className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-800 shadow-card focus:outline-none focus:ring-1 focus:ring-zinc-400"
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
                          {!hideRoleControls && (
                            <button
                              type="button"
                              disabled={!isDirty}
                              onClick={() => handleSaveRole(row)}
                              className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              Save
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleOpenPermissions(row.id)}
                            className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 hover:border-zinc-300"
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
                <button type="button" onClick={() => setFilterRole("ALL")} className="text-zinc-600 hover:underline text-xs font-medium">
                  Clear filter
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── DIRECTORY TAB ── */}
      {tab === "directory" && (
        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-card">
          {empLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3">
                <div className="h-7 w-7 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-800" />
                <p className="text-sm text-zinc-500">Loading directory…</p>
              </div>
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="font-medium text-zinc-800">No employees found</p>
              <p className="text-sm text-slate-500 mt-1">Try a different search or department.</p>
            </div>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80">
                  <th className="px-5 py-3.5 text-left font-semibold text-slate-600">Employee</th>
                  <th className="px-5 py-3.5 text-left font-semibold text-slate-600">Department</th>
                  <th className="px-5 py-3.5 text-left font-semibold text-slate-600">Position</th>
                  {(isFullAdmin || isHrHead) && filterDept === "HR" && (
                    <th className="px-5 py-3.5 text-right font-semibold text-slate-600">HR Permissions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/80">
                {filteredEmployees.map(emp => {
                  const userId = emailToUserId.get(emp.email);
                  return (
                    <tr key={emp.id} className="group transition-colors hover:bg-zinc-50/80">
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
                        <DepartmentBadge name={emp.department || "—"} />
                      </td>
                      <td className="px-5 py-3.5 text-slate-600">{emp.position || "—"}</td>
                      {(isFullAdmin || isHrHead) && filterDept === "HR" && (
                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              disabled={!userId}
                              onClick={() => userId && handleOpenPermissions(userId)}
                              className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-card transition hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed"
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
                className="rounded-md bg-zinc-900 px-5 py-2 text-sm font-medium text-white shadow-card transition hover:bg-zinc-800"
              >
                Save Changes
              </button>
            </div>
          </div>

          {permissionsLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-800" />
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
                        <tr key={m} className="transition-colors hover:bg-zinc-50/80 group">
                          <td className="px-5 py-4">
                            <span className="inline-flex items-center gap-2 font-semibold text-slate-800 capitalize">
                              <span className="h-2 w-2 rounded-full bg-zinc-400 opacity-70 group-hover:opacity-100 transition-opacity" />
                              {m}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <select
                              className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 focus:outline-none focus:ring-1 focus:ring-zinc-400"
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
                                    className="h-4 w-4 rounded border-zinc-300 text-zinc-900 shadow-sm focus:ring-zinc-400 disabled:opacity-40 disabled:cursor-not-allowed"
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
