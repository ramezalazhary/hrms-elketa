/**
 * @file Admin UI for login accounts (`/admin/users`): loads users when actor is Admin or Head of HR,
 * employee directory for broader roles, permission matrix modal, and HR-only onboarding actions.
 * Data flow: Redux `identity` → parallel REST (`getUsersApi`, `getDepartmentsApi`, `getEmployeesApi`) →
 * local React state for filters, tabs, selected user, and policy preview inputs.
 */
import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
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
  getPageCatalogApi,
  getPageOverridesApi,
  resolvePagePreviewApi,
  updatePageOverridesApi,
  updateHrTemplatesApi,
} from "@/modules/permissions/api";
import {
  RoleBadge,
  RoleStatCard,
  ROLE_CONFIG,
  normaliseRoleKey,
  DepartmentBadge,
} from "@/shared/components/EntityBadges";
import {
  canManagePermissions,
  getAccessLevelLabel,
  isHrDepartmentMember,
  getPermissionsAccessLevel,
} from "@/shared/utils/accessControl";

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

const ROLE_OPTIONS = ["EMPLOYEE", "TEAM_LEADER", "MANAGER", "HR", "HR_STAFF", "HR_MANAGER", "ADMIN"];
const POLICY_ASSIGNABLE_ROLE_KEYS = new Set(["ADMIN", "HR", "HR_STAFF", "HR_MANAGER"]);
const HR_MANAGER_ONLY_TEMPLATES = new Set(["PERMISSIONS_MANAGER"]);
const HR_ROLE_KEYS = new Set(["HR", "HR_STAFF", "HR_MANAGER"]);
const ACCESS_LEVEL_OPTIONS = [
  { value: "NONE", label: "No access" },
  { value: "VIEW", label: "Viewer" },
  { value: "EDIT", label: "Editor" },
  { value: "ADMIN", label: "Admin" },
];
const TEMPLATE_IMPACT_ROWS = [
  {
    key: "ATTENDANCE_CREATOR",
    title: "Attendance Operations",
    hint: "Attendance page editing and imports.",
    pageIds: ["attendance"],
  },
  {
    key: "ATTENDANCE_REVIEWER",
    title: "Attendance Analysis",
    hint: "Monthly attendance analysis and reviewer flows.",
    pageIds: ["attendance_analysis", "attendance"],
  },
  {
    key: "EMPLOYEE_VIEWER",
    title: "Employees Directory",
    hint: "Employee list/profile visibility and onboarding queue.",
    pageIds: ["employees", "onboarding"],
  },
  {
    key: "LEAVES_MANAGER",
    title: "Leave Approvals",
    hint: "Approve/review time-off requests.",
    pageIds: ["leave_approvals"],
  },
  {
    key: "FINANCE",
    title: "Finance & Payroll",
    hint: "Payroll management and finance-related approvals.",
    pageIds: ["payroll", "advances", "bonus_approvals"],
  },
  {
    key: "PERMISSIONS_MANAGER",
    title: "Permissions Admin",
    hint: "Manage Users & Permissions page access.",
    managerOnly: true,
    pageIds: ["permissions_admin"],
  },
  {
    key: "FULL_VIEW",
    title: "FULL_VIEW (broad access)",
    hint: "Wide view template across key management pages.",
    pageIds: ["reports", "employees", "attendance", "payroll", "holidays"],
  },
];

const SCOPE_DOCS = {
  self:       { label: "Self",       desc: "Only the user's own records." },
  department: { label: "Department", desc: "All records within the user's department." },
  all:        { label: "Enterprise", desc: "Full access across the entire organization." },
};

const ROLE_IMPACT = {
  EMPLOYEE: "Self-only operational access.",
  TEAM_LEADER: "Team-level operational access where configured.",
  MANAGER: "Department leadership level with reporting responsibilities.",
  HR_STAFF: "HR workflows and limited administrative tools.",
  HR_MANAGER: "HR-wide access including users and permissions management.",
  ADMIN: "Full system access across modules and policy controls.",
};

// ─── Main component ──────────────────────────────────────────────────────────

export function UsersAdminPage() {
  const { showToast } = useToast();
  const currentUser = useAppSelector((s) => s.identity.currentUser);
  const currentRole  = currentUser?.role;
  const roleKey = normaliseRoleKey(currentRole);
  const isFullAdmin  = roleKey === "ADMIN";
  const actorIsHrDepartmentMember = isHrDepartmentMember(currentUser);
  const canManagePermissionsPage = canManagePermissions(currentUser);
  const permissionsAccessLevel = getPermissionsAccessLevel(currentUser);

  /* ── data ── */
  const [isLoading,        setLoading]        = useState(false);
  const [users,            setUsers]           = useState([]);
  const [pendingRoles,     setPendingRoles]    = useState({});
  const [selectedUserId,   setSelectedUserId]  = useState(null);
  const [showGuide, setShowGuide] = useState(false);
  const [draftHrTemplates, setDraftHrTemplates] = useState([]);
  const [draftHrLevel, setDraftHrLevel] = useState("STAFF");
  const [savedHrTemplates, setSavedHrTemplates] = useState([]);
  const [savedHrLevel, setSavedHrLevel] = useState("STAFF");
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewDirty, setPreviewDirty] = useState(false);
  const [pageCatalog, setPageCatalog] = useState([]);
  const [resolvedPagePreview, setResolvedPagePreview] = useState([]);
  const [pageLevelOverrides, setPageLevelOverrides] = useState({});
  const [overrideSearch, setOverrideSearch] = useState("");
  const [overrideLevelFilter, setOverrideLevelFilter] = useState("ALL");

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

  const canLoadUsers = canManagePermissionsPage;
  const showAccountsTab = canLoadUsers;
  const showAdminNav =
    showAccountsTab || ["MANAGER", "HR_STAFF", "HR_MANAGER"].includes(roleKey);
  /** Only system Admin can assign roles — backend enforces the same. */
  const hideRoleControls = !isFullAdmin;

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
  const employeeByEmail = useMemo(() => {
    const map = new Map();
    for (const emp of employees) {
      const emailKey = String(emp?.email || "").trim().toLowerCase();
      if (!emailKey) continue;
      map.set(emailKey, emp);
    }
    return map;
  }, [employees]);

  function canAssignRoleToUser(userEmail, roleValue) {
    const roleKey = normaliseRoleKey(roleValue || "EMPLOYEE");
    if (!HR_ROLE_KEYS.has(roleKey)) return true;
    const employee = employeeByEmail.get(String(userEmail || "").trim().toLowerCase());
    const departmentKey = String(employee?.department || "").trim().toUpperCase();
    return departmentKey === "HR";
  }

  /* ── handlers ── */
  async function handleSaveRole(row) {
    if (!canAssignRoleToUser(row.email, row.effectiveRole)) {
      showToast("Cannot assign HR role to an employee outside HR department", "error");
      return;
    }
    try {
      const resp = await updateUserRoleApi(row.id, row.effectiveRole);
      setUsers(prev => prev.map(u => u.id === resp.user.id ? resp.user : u));
      setPendingRoles(prev => { const n = { ...prev }; delete n[row.id]; return n; });
      showToast(`Role updated to ${ROLE_CONFIG[normaliseRoleKey(resp.user.role)]?.label}`, "success");
    } catch(err) { console.error(err); showToast(err?.message || "Failed to update role","error"); }
  }

  async function handleOpenPermissions(userId) {
    const targetUser = users.find((u) => u.id === userId);
    const targetRole = normaliseRoleKey(targetUser?.role || "EMPLOYEE");
    if (!POLICY_ASSIGNABLE_ROLE_KEYS.has(targetRole)) {
      showToast(
        "لا يمكن إعطاء صلاحيات لهذا الدور. لازم الأول يكون HR_STAFF أو HR_MANAGER أو ADMIN.",
        "error",
      );
      return;
    }
    setSelectedUserId(userId);
    setShowGuide(false);
    setResolvedPagePreview([]);
    setPageLevelOverrides({});
    try {
      const targetEmp = employees.find((e) => e.email === targetUser?.email);
      const initialTemplates = Array.isArray(targetEmp?.hrTemplates) ? targetEmp.hrTemplates : [];
      const initialLevel = String(targetEmp?.hrLevel || "STAFF").toUpperCase() === "MANAGER"
          ? "MANAGER"
          : "STAFF";
      setDraftHrTemplates(initialTemplates);
      setDraftHrLevel(initialLevel);
      setSavedHrTemplates(initialTemplates);
      setSavedHrLevel(initialLevel);
      setPreviewDirty(false);
      if (!Array.isArray(pageCatalog) || pageCatalog.length === 0) {
        const catalogResp = await getPageCatalogApi();
        setPageCatalog(Array.isArray(catalogResp?.pages) ? catalogResp.pages : []);
      }
      const overridesResp = await getPageOverridesApi(userId);
      const overridesList = Array.isArray(overridesResp?.overrides)
        ? overridesResp.overrides
        : [];
      const next = {};
      for (const row of overridesList) {
        const id = String(row?.pageId || "").trim();
        const level = String(row?.level || "NONE").toUpperCase();
        if (id) next[id] = level;
      }
      setPageLevelOverrides(next);
      const response = await resolvePagePreviewApi({
        role: targetRole,
        hrLevel: targetRole === "HR_MANAGER" || targetRole === "HR_STAFF" || targetRole === "HR"
          ? initialLevel
          : "STAFF",
        hrTemplates: targetRole === "HR_MANAGER" || targetRole === "HR_STAFF" || targetRole === "HR"
          ? initialTemplates
          : [],
        pageAccessOverrides: Object.entries(next).map(([pageId, level]) => ({ pageId, level })),
      });
      setResolvedPagePreview(Array.isArray(response?.pages) ? response.pages : []);
    } catch(err) { console.error(err); showToast("Failed to load access data","error"); }
  }

  async function handlePreviewTemplates() {
    if (!selectedUserId) return;
    setIsPreviewLoading(true);
    try {
      const response = await resolvePagePreviewApi({
        role: selectedUserRole,
        hrLevel: selectedIsHr ? draftHrLevel : "STAFF",
        hrTemplates: selectedIsHr ? draftHrTemplates : [],
        pageAccessOverrides: Object.entries(pageLevelOverrides).map(([pageId, level]) => ({
          pageId,
          level,
        })),
      });
      setResolvedPagePreview(Array.isArray(response?.pages) ? response.pages : []);
      setPreviewDirty(false);
    } catch (error) {
      console.error(error);
      showToast("Failed to preview template impact", "error");
    } finally {
      setIsPreviewLoading(false);
    }
  }

  async function handleSaveHrTemplates() {
    try {
      await updateHrTemplatesApi(selectedUserId, {
        templates: draftHrTemplates,
        hrLevel: draftHrLevel,
      });
      showToast("HR templates updated", "success");
      setSavedHrTemplates(draftHrTemplates);
      setSavedHrLevel(draftHrLevel);
      setPreviewDirty(false);
      setEmployees((prev) =>
        prev.map((e) => {
          const user = users.find((u) => u.id === selectedUserId);
          if (!user || e.email !== user.email) return e;
          return {
            ...e,
            hrTemplates: draftHrTemplates,
            hrLevel: draftHrLevel,
          };
        }),
      );
    } catch (err) {
      console.error(err);
      showToast("Failed to update HR templates", "error");
    }
  }

  const selectedUserEmail = users.find(u => u.id === selectedUserId)?.email ?? selectedUserId;
  const selectedUserRole = normaliseRoleKey(
    users.find((u) => u.id === selectedUserId)?.role || "EMPLOYEE",
  );
  const selectedIsHr =
    selectedUserRole === "HR" ||
    selectedUserRole === "HR_STAFF" ||
    selectedUserRole === "HR_MANAGER";

  const hasSelectedTemplate = (templateKey) =>
    draftHrTemplates.includes(templateKey);

  const toggleSelectedTemplate = (templateKey) => {
    setDraftHrTemplates((prev) =>
      prev.includes(templateKey)
        ? prev.filter((x) => x !== templateKey)
        : [...prev, templateKey],
    );
    setPreviewDirty(true);
  };

  const dynamicImpactItems = useMemo(() => {
    if (!Array.isArray(pageCatalog) || pageCatalog.length === 0) return [];
    const managementPages = pageCatalog.filter((p) => p?.managementMode);
    if (!Array.isArray(resolvedPagePreview) || resolvedPagePreview.length === 0) {
      return managementPages.map((page) => ({
        key: page.pageId,
        label: page.label || "Unnamed page",
        path: page.path || "—",
        level: "NONE",
        summary:
          page?.capabilitiesByLevel?.NONE ||
          "No page access.",
      }));
    }
    const resolvedByPageId = new Map(
      resolvedPagePreview.map((row) => [String(row?.pageId || ""), row]),
    );
    return managementPages.map((page) => {
      const item = resolvedByPageId.get(String(page.pageId)) || {};
      const level = String(item?.level || "NONE").toUpperCase();
      const summary = item?.summary || page?.capabilitiesByLevel?.[level] || (level === "NONE"
        ? "No page access."
        : "Access granted by current policy.");
      return {
        key: page.pageId,
        label: page.label || item?.label || "Unnamed page",
        path: page.path || item?.path || "—",
        level,
        summary,
      };
    });
  }, [resolvedPagePreview, pageCatalog]);
  const resolvedByPageId = useMemo(
    () => new Map(dynamicImpactItems.map((item) => [String(item.key), item])),
    [dynamicImpactItems],
  );
  const hasDraftChanges = useMemo(() => {
    const a = [...draftHrTemplates].sort().join("|");
    const b = [...savedHrTemplates].sort().join("|");
    return a !== b || draftHrLevel !== savedHrLevel;
  }, [draftHrTemplates, savedHrTemplates, draftHrLevel, savedHrLevel]);
  const managementPages = useMemo(
    () => (Array.isArray(pageCatalog) ? pageCatalog.filter((page) => page?.managementMode) : []),
    [pageCatalog],
  );
  const filteredManagementPages = useMemo(() => {
    const q = String(overrideSearch || "").trim().toLowerCase();
    return managementPages.filter((page) => {
      const pageLevel = String(pageLevelOverrides?.[page.pageId] || "NONE").toUpperCase();
      const matchLevel = overrideLevelFilter === "ALL" || pageLevel === overrideLevelFilter;
      const matchQuery =
        !q ||
        String(page?.label || "").toLowerCase().includes(q) ||
        String(page?.path || "").toLowerCase().includes(q);
      return matchLevel && matchQuery;
    });
  }, [managementPages, pageLevelOverrides, overrideSearch, overrideLevelFilter]);
  const overrideCounts = useMemo(() => {
    const counts = { NONE: 0, VIEW: 0, EDIT: 0, ADMIN: 0 };
    for (const page of managementPages) {
      const level = String(pageLevelOverrides?.[page.pageId] || "NONE").toUpperCase();
      if (Object.prototype.hasOwnProperty.call(counts, level)) counts[level] += 1;
    }
    return counts;
  }, [managementPages, pageLevelOverrides]);

  async function handleSavePageOverrides() {
    if (!selectedUserId) return;
    try {
      const payload = (Array.isArray(pageCatalog) ? pageCatalog : [])
        .filter((p) => p?.managementMode)
        .map((p) => ({
        pageId: p.pageId,
        level: String(pageLevelOverrides?.[p.pageId] || "NONE").toUpperCase(),
      }));
      await updatePageOverridesApi(selectedUserId, payload);
      showToast("Page access overrides updated", "success");
    } catch (error) {
      console.error(error);
      showToast("Failed to update page access overrides", "error");
    }
  }

  /* ─────────────────────────────────────────── render ── */
  if (!canManagePermissionsPage) {
    return <Navigate to="/" replace />;
  }

  return (
    <Layout
      title="Users & Permissions"
      description={`Access: ${getAccessLevelLabel(permissionsAccessLevel)} · Manage system accounts, roles, and policy-driven access.`}
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
          <div className="flex w-full sm:w-auto rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-800/50 p-0.5 gap-0.5">
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
                    ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm border border-zinc-200 dark:border-zinc-800"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative w-full sm:flex-1 min-w-0 sm:min-w-48 max-w-none sm:max-w-sm">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder={tab === "users" ? "Search by email…" : "Search by name or email…"}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 py-2 pl-9 pr-4 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 shadow-card focus:outline-none focus:ring-1 focus:ring-zinc-400"
            />
          </div>

          {/* Role filter (users tab) */}
          {tab === "users" && (
            <select
              value={filterRole}
              onChange={e => setFilterRole(e.target.value)}
              className="w-full sm:w-auto rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-medium text-zinc-800 dark:text-zinc-200 shadow-card focus:outline-none focus:ring-1 focus:ring-zinc-400"
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
              className="w-full sm:w-auto rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-medium text-zinc-800 dark:text-zinc-200 shadow-card focus:outline-none focus:ring-1 focus:ring-zinc-400"
            >
              <option value="all">{deptLoading ? "Loading…" : "All Departments"}</option>
              {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
            </select>
          )}
        </div>
      )}

      {/* ── ACCOUNTS TAB ── */}
      {showAccountsTab && tab === "users" && (
        <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-card">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3">
                <div className="h-7 w-7 animate-spin rounded-full border-2 border-zinc-200 dark:border-zinc-800 border-t-zinc-800" />
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading accounts…</p>
              </div>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="font-medium text-zinc-800 dark:text-zinc-200">No users match</p>
              <p className="text-sm text-slate-500 mt-1">Try a different search or filter.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
            <table className="min-w-[860px] w-full border-collapse text-sm">
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
                  const targetRoleKey = normaliseRoleKey(row.role);
                  const canOpenPolicyForRow = POLICY_ASSIGNABLE_ROLE_KEYS.has(targetRoleKey);
                  const selectedRoleAllowed = canAssignRoleToUser(row.email, row.effectiveRole);
                  return (
                    <tr key={row.id} className="group transition-colors hover:bg-zinc-50/80 dark:hover:bg-zinc-800/50">
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
                            className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-medium text-zinc-800 dark:text-zinc-200 shadow-card focus:outline-none focus:ring-1 focus:ring-zinc-400"
                            value={row.effectiveRole}
                            onChange={e => setPendingRoles(prev => ({ ...prev, [row.id]: e.target.value }))}
                          >
                            {ROLE_OPTIONS.map((role) => (
                              <option
                                key={role}
                                value={role}
                                disabled={!canAssignRoleToUser(row.email, role)}
                              >
                                {ROLE_CONFIG[normaliseRoleKey(role)]?.label || role}
                              </option>
                            ))}
                          </select>
                          {!selectedRoleAllowed && (
                            <p className="mt-1 text-xs text-rose-600">
                              HR roles are allowed only for employees inside HR department.
                            </p>
                          )}
                          {isDirty && (
                            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                              {ROLE_IMPACT[normaliseRoleKey(row.effectiveRole)]}
                            </p>
                          )}
                        </td>
                      )}

                      {/* Actions */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-2">
                          {!hideRoleControls && (
                            <button
                              type="button"
                              disabled={!isDirty || !selectedRoleAllowed}
                              onClick={() => handleSaveRole(row)}
                              className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              Save
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleOpenPermissions(row.id)}
                            disabled={!canOpenPolicyForRow}
                            className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 transition hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:border-zinc-300"
                            title={
                              canOpenPolicyForRow
                                ? "Manage access policy"
                                : "Available for HR_STAFF / HR_MANAGER / ADMIN only"
                            }
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
            </div>
          )}
          {/* Footer count */}
          {!isLoading && (
          <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-400 flex flex-col sm:flex-row items-start sm:items-center gap-2 justify-between">
              <span>Showing <strong className="text-slate-600">{filteredUsers.length}</strong> of <strong className="text-slate-600">{users.length}</strong> accounts</span>
              {filterRole !== "ALL" && (
                <button type="button" onClick={() => setFilterRole("ALL")} className="text-zinc-600 dark:text-zinc-400 hover:underline text-xs font-medium">
                  Clear filter
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── DIRECTORY TAB ── */}
      {tab === "directory" && (
        <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-card">
          {empLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3">
                <div className="h-7 w-7 animate-spin rounded-full border-2 border-zinc-200 dark:border-zinc-800 border-t-zinc-800" />
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading directory…</p>
              </div>
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="font-medium text-zinc-800 dark:text-zinc-200">No employees found</p>
              <p className="text-sm text-slate-500 mt-1">Try a different search or department.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
            <table className="min-w-[760px] w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80">
                  <th className="px-5 py-3.5 text-left font-semibold text-slate-600">Employee</th>
                  <th className="px-5 py-3.5 text-left font-semibold text-slate-600">Department</th>
                  <th className="px-5 py-3.5 text-left font-semibold text-slate-600">Position</th>
                  {(isFullAdmin || actorIsHrDepartmentMember) && filterDept === "HR" && (
                    <th className="px-5 py-3.5 text-right font-semibold text-slate-600">HR Permissions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/80">
                {filteredEmployees.map(emp => {
                  const userId = emailToUserId.get(emp.email);
                  const linkedUser = users.find((u) => u.id === userId);
                  const linkedRoleKey = normaliseRoleKey(linkedUser?.role || "EMPLOYEE");
                  const canOpenPolicyForLinkedUser = POLICY_ASSIGNABLE_ROLE_KEYS.has(linkedRoleKey);
                  return (
                    <tr key={emp.id} className="group transition-colors hover:bg-zinc-50/80 dark:hover:bg-zinc-800/50">
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
                      {(isFullAdmin || actorIsHrDepartmentMember) && filterDept === "HR" && (
                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              disabled={!userId || !canOpenPolicyForLinkedUser}
                              onClick={() => userId && handleOpenPermissions(userId)}
                              className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 shadow-card transition hover:bg-zinc-50 dark:hover:bg-zinc-800/50 disabled:opacity-40 disabled:cursor-not-allowed"
                              title={
                                !userId
                                  ? "Create login first"
                                  : canOpenPolicyForLinkedUser
                                    ? "Manage access policy"
                                    : "Available for HR_STAFF / HR_MANAGER / ADMIN only"
                              }
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
            </div>
          )}
          <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-400">
            Showing <strong className="text-slate-600">{filteredEmployees.length}</strong> of <strong className="text-slate-600">{employees.length}</strong> employees
          </div>
        </div>
      )}

      {/* ── Permissions modal ── */}
      <Modal
        open={!!selectedUserId}
        title="Access Policy"
        maxWidth="max-w-5xl"
        onClose={() => {
          setSelectedUserId(null);
          setShowGuide(false);
        }}
      >
        <div className="flex flex-col gap-5">
          {/* Header */}
          <div className="flex flex-wrap items-start sm:items-center justify-between gap-3 rounded-2xl bg-slate-50 border border-slate-100 p-4">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Avatar email={selectedUserEmail} />
              <div className="min-w-0">
                <p className="text-xs text-slate-500 font-medium">Configuring permissions for</p>
                <p className="font-bold text-slate-900 truncate">{selectedUserEmail}</p>
              </div>
            </div>
            <div className="flex w-full sm:w-auto flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowGuide(g => !g)}
                className={`w-full sm:w-auto rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                  showGuide
                    ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                    : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                }`}
              >
                {showGuide ? "Hide Guide" : "Help Guide"}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Page-level overrides (primary access control)
              </p>
              <button
                type="button"
                onClick={handleSavePageOverrides}
                className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800"
              >
                Save Page Overrides
              </button>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Set exact page access per user: Viewer = read only, Editor = read + edit, Admin = read + edit + advanced actions.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300">No access: <span className="font-semibold">{overrideCounts.NONE}</span></div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">Viewer: <span className="font-semibold">{overrideCounts.VIEW}</span></div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">Editor: <span className="font-semibold">{overrideCounts.EDIT}</span></div>
              <div className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-700">Admin: <span className="font-semibold">{overrideCounts.ADMIN}</span></div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={overrideSearch}
                onChange={(e) => setOverrideSearch(e.target.value)}
                placeholder="Search page by name or path..."
                className="min-w-[230px] flex-1 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-xs text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200"
              />
              <select
                value={overrideLevelFilter}
                onChange={(e) => setOverrideLevelFilter(e.target.value)}
                className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-200"
              >
                <option value="ALL">All levels</option>
                <option value="NONE">No access</option>
                <option value="VIEW">Viewer</option>
                <option value="EDIT">Editor</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {filteredManagementPages.map((page) => {
                const current = String(pageLevelOverrides?.[page.pageId] || "NONE").toUpperCase();
                const levelTone =
                  current === "ADMIN"
                    ? "border-violet-200 bg-violet-50/40"
                    : current === "EDIT"
                      ? "border-amber-200 bg-amber-50/40"
                      : current === "VIEW"
                        ? "border-emerald-200 bg-emerald-50/40"
                        : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900";
                return (
                  <div
                    key={page.pageId}
                    className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 transition ${levelTone}`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-zinc-800 dark:text-zinc-200">{page.label}</p>
                      <p className="truncate text-[10px] text-zinc-500 dark:text-zinc-400">{page.path}</p>
                    </div>
                    <select
                      value={current}
                      onChange={(e) =>
                        setPageLevelOverrides((prev) => ({
                          ...prev,
                          [page.pageId]: String(e.target.value || "NONE").toUpperCase(),
                        }))
                      }
                      className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-2 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300"
                    >
                      {ACCESS_LEVEL_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </div>

          

          {/* ── Inline Reference Guide ── */}
          {showGuide && (
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-5 space-y-5">
              <div>
                <h4 className="text-sm font-bold text-indigo-900 mb-1">How permissions work</h4>
                <p className="text-xs text-indigo-800 leading-relaxed">
                  Access is page-based. Assign Viewer/Editor/Admin per page from Page-level overrides.
                  HR templates are optional presets to speed up setup, then review impact and save.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl bg-white dark:bg-zinc-900 border border-indigo-100 p-4">
                  <h5 className="text-xs font-bold text-indigo-700 uppercase tracking-wide mb-2">Scope</h5>
                  <p className="text-[11px] text-slate-500 mb-3">What each access range means.</p>
                  <ul className="space-y-2">
                    {Object.entries(SCOPE_DOCS).map(([key, doc]) => (
                      <li key={key} className="flex items-start gap-2">
                        <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                          key === "self" ? "bg-zinc-400" :
                          key === "department" ? "bg-blue-400" : "bg-emerald-400"
                        }`} />
                        <div>
                          <span className="text-xs font-semibold text-slate-800">{doc.label}</span>
                          <p className="text-[11px] text-slate-500 leading-snug">{doc.desc}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <h5 className="text-xs font-bold uppercase tracking-wide text-amber-800 mb-2">Important</h5>
                  <p className="text-xs leading-relaxed text-amber-900">
                    Legacy module-level manual grants were removed because they are not the active
                    source of truth after the policy updates.
                  </p>
                </div>
              </div>

              <div className="rounded-xl bg-white dark:bg-zinc-900 border border-indigo-100 p-4">
                <h5 className="text-xs font-bold text-indigo-700 uppercase tracking-wide mb-2">Role defaults (what each role gets automatically)</h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {ROLE_OPTIONS.map(r => (
                    <div key={r} className="flex items-start gap-2 rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
                      <RoleBadge role={r} />
                      <span className="text-[11px] text-slate-600 leading-snug">{ROLE_IMPACT[r]}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-800/50 px-4 py-3 text-xs text-zinc-600 dark:text-zinc-400">
            Source of truth: Page-level overrides. Templates are optional presets only.
          </div>
        </div>
      </Modal>
    </Layout>
  );
}
