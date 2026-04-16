import { Employee } from "../models/Employee.js";
import { Department } from "../models/Department.js";
import { PageAccessOverride } from "../models/PageAccessOverride.js";
import { Team } from "../models/Team.js";
import { normalizeRole, ROLE } from "../utils/roles.js";
import { ROLE_SCOPE } from "./authorizationPolicyService.js";

function normalizeScope(role) {
  const r = normalizeRole(role);
  return ROLE_SCOPE[r] || "self";
}

function normEmail(v) {
  return String(v || "").trim().toLowerCase();
}

function addId(set, value) {
  if (!value) return;
  set.add(String(value));
}

function toObjectIdStrings(rows) {
  const out = new Set();
  for (const row of rows || []) {
    if (!row) continue;
    addId(out, row._id ?? row.id ?? row);
  }
  return out;
}

export function inScope(user, target) {
  if (!user || !target) return false;
  const scope = normalizeScope(user.role);
  if (scope === "company") return true;
  if (scope === "self") return String(user.id) === String(target._id || target.id);
  if (scope === "department") {
    return (
      String(user.departmentId || "") !== "" &&
      String(user.departmentId) === String(target.departmentId || "")
    );
  }
  if (scope === "team") {
    return (
      String(user.teamId || "") !== "" &&
      String(user.teamId) === String(target.teamId || "")
    );
  }
  return false;
}

export async function resolveTargetEmployee(req) {
  const explicit =
    req.params?.employeeId ||
    req.params?.id ||
    req.body?.employeeId ||
    req.body?.targetUserId;
  if (explicit) {
    return Employee.findById(explicit)
      .select("_id departmentId teamId role email")
      .lean();
  }
  return null;
}

export async function resolveEmployeeScopeIds(user) {
  const role = normalizeRole(user?.role);
  if (
    role === ROLE.ADMIN ||
    role === ROLE.HR ||
    role === ROLE.HR_STAFF ||
    role === ROLE.HR_MANAGER
  ) {
    return { scope: "all", employeeIds: null };
  }

  const actor =
    user?.id != null
      ? await Employee.findById(user.id).select("_id email departmentId").lean()
      : await Employee.findOne({ email: user?.email }).select("_id email departmentId").lean();
  if (!actor?._id) {
    return { scope: "self", employeeIds: [] };
  }

  const actorId = String(actor._id);
  const actorEmail = normEmail(actor.email || user?.email);
  const ids = new Set([actorId]);

  // Department headed scope (hybrid manager scope component)
  const headedDepartments = await Department.find({
    $or: [
      ...(actorEmail ? [{ head: new RegExp(`^${actorEmail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") }] : []),
      { headId: actor._id },
    ],
  })
    .select("_id name")
    .lean();

  const headedDeptIds = toObjectIdStrings(headedDepartments.map((d) => d._id));
  const headedDeptNames = new Set(
    headedDepartments.map((d) => String(d?.name || "").trim()).filter(Boolean),
  );

  if (headedDeptIds.size || headedDeptNames.size) {
    const deptRows = await Employee.find({
      $or: [
        ...(headedDeptIds.size ? [{ departmentId: { $in: [...headedDeptIds] } }] : []),
        ...(headedDeptNames.size ? [{ department: { $in: [...headedDeptNames] } }] : []),
      ],
    })
      .select("_id")
      .lean();
    for (const r of deptRows) addId(ids, r._id);
  }

  // Direct reports scope (hybrid manager scope component)
  const directRows = await Employee.find({
    managerId: actor._id,
  })
    .select("_id")
    .lean();
  for (const r of directRows) addId(ids, r._id);

  // Team-led scope
  const ledTeams = await Team.find({
    status: "ACTIVE",
    $or: [
      ...(actorEmail ? [{ leaderEmail: new RegExp(`^${actorEmail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") }] : []),
      { leaderId: actor._id },
    ],
  })
    .select("_id name memberIds members")
    .lean();

  const teamIds = toObjectIdStrings(ledTeams.map((t) => t._id));
  const teamNames = new Set(
    ledTeams.map((t) => String(t?.name || "").trim()).filter(Boolean),
  );
  const memberEmails = new Set();

  for (const t of ledTeams) {
    for (const mid of t.memberIds || []) {
      addId(ids, mid?._id ?? mid);
    }
    for (const em of t.members || []) {
      const key = normEmail(em);
      if (key) memberEmails.add(key);
    }
  }

  const teamRows = await Employee.find({
    $or: [
      ...(teamIds.size ? [{ teamId: { $in: [...teamIds] } }] : []),
      ...(teamNames.size ? [{ team: { $in: [...teamNames] } }] : []),
      ...(memberEmails.size ? [{ email: { $in: [...memberEmails] } }] : []),
    ],
  })
    .select("_id")
    .lean();
  for (const r of teamRows) addId(ids, r._id);

  return { scope: "scoped", employeeIds: [...ids] };
}

export async function hydrateUserScopeContext(user) {
  if (!user?.id) return user;
  const [employee, pageOverrides] = await Promise.all([
    Employee.findById(user.id)
      .select("_id role departmentId teamId hrTemplates hrLevel email authzVersion isActive")
      .lean(),
    PageAccessOverride.find({ userId: user.id }).select("pageId level").lean(),
  ]);
  if (!employee) return null;
  return {
    ...user,
    _hydrated: true,
    role: employee.role || user.role,
    departmentId: employee.departmentId || null,
    teamId: employee.teamId || null,
    hrTemplates: Array.isArray(employee.hrTemplates) ? employee.hrTemplates : [],
    hrLevel: employee.hrLevel || "STAFF",
    email: employee.email || user.email,
    authzVersion: Number(employee.authzVersion ?? 0),
    isActive: employee.isActive !== false,
    pageAccessOverrides: Array.isArray(pageOverrides)
      ? pageOverrides.map((row) => ({
          pageId: String(row.pageId),
          level: String(row.level || "NONE").toUpperCase(),
        }))
      : [],
  };
}

export async function isOnLeaderTeam(user, target) {
  if (!target?._id) return false;
  const actor =
    user?.id != null
      ? await Employee.findById(user.id).select("_id email").lean()
      : await Employee.findOne({ email: user?.email }).select("_id email").lean();
  if (!actor?._id) return false;
  const actorEmail = normEmail(actor.email || user?.email);
  const teams = await Team.find({
    status: "ACTIVE",
    $or: [
      ...(actorEmail ? [{ leaderEmail: new RegExp(`^${actorEmail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") }] : []),
      { leaderId: actor._id },
    ],
  })
    .select("_id memberIds members")
    .lean();
  for (const team of teams) {
    if (team._id && String(team._id) === String(target.teamId || "")) return true;
    for (const memberId of team.memberIds || []) {
      const id = memberId?._id || memberId;
      if (String(id) === String(target._id)) return true;
    }
    for (const email of team.members || []) {
      if (String(email).toLowerCase() === String(target.email || "").toLowerCase()) {
        return true;
      }
    }
  }
  return false;
}

export async function inScopeWithLeadership(user, target) {
  const role = normalizeRole(user?.role);
  if (role === ROLE.TEAM_LEADER && (await isOnLeaderTeam(user, target))) return true;
  if (role === ROLE.MANAGER) {
    const resolved = await resolveEmployeeScopeIds(user);
    if (resolved.scope === "all") return true;
    return resolved.employeeIds.includes(String(target._id || target.id));
  }
  return inScope(user, target);
}
