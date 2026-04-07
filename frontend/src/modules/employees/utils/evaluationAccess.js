/**
 * Client-side gates for showing "Evaluate" (mirrors backend assessment rules where possible).
 * Authoritative check remains POST /api/assessments and GET .../eligibility/:id.
 */
import {
  employeeOnTeamRosterClient,
  mergeTeamsForDepartment,
} from "@/shared/utils/mergeDepartmentTeams";

/** Mirrors backend `isHrOrAdmin` / assessment global assessors. */
export function isHrOrAdminRole(role) {
  return (
    role === "ADMIN" ||
    role === 3 ||
    role === "HR_MANAGER" ||
    role === "HR_STAFF"
  );
}

/** Department is headed by this user (legacy `head` email or `headId`). */
export function departmentHeadedByUser(dept, currentUser) {
  if (!dept || !currentUser) return false;
  const em = (currentUser.email || "").trim().toLowerCase();
  const head = (dept.head || "").trim().toLowerCase();
  if (em && head && head === em) return true;
  const hid = dept.headId?.id ?? dept.headId?._id ?? dept.headId;
  const uid = currentUser.id;
  if (hid != null && uid != null && String(hid) === String(uid)) return true;
  return false;
}

function refMatches(ref, userId) {
  if (ref == null || !userId) return false;
  if (typeof ref === "object") {
    const rid = ref.id ?? ref._id;
    return rid != null && String(rid) === String(userId);
  }
  return String(ref) === String(userId);
}

/** `teamNames` — normalized lowercased comparison to `emp.team` */
export function employeeMatchesTeamName(emp, teamNames) {
  if (!emp || !teamNames?.length) return false;
  const t = (emp.team || "").trim().toLowerCase();
  if (!t) return false;
  return teamNames.some((n) => (n || "").trim().toLowerCase() === t);
}

/**
 * @param {object} options
 * @param {boolean} [options.allowGlobalRoles=true] — HR/Admin may assess anyone (set false on employee list if only TL/manager buttons).
 * @param {string[]} [options.ledTeamNames] — team names the user leads (standalone + embedded names).
 * @param {string[]} [options.deptHeadTeamNames] — team names under departments this user heads.
 */
export function canAssessEmployeeSync(emp, currentUser, options = {}) {
  const {
    allowGlobalRoles = true,
    ledTeamNames = [],
    deptHeadTeamNames = [],
  } = options;

  if (!emp || !currentUser) return false;

  if (allowGlobalRoles && isHrOrAdminRole(currentUser.role)) {
    return true;
  }

  if (!currentUser.id) return false;

  const uid = String(currentUser.id);
  const empId = emp.id ?? emp._id;
  if (empId != null && String(empId) === uid) {
    return false;
  }

  if (
    refMatches(emp.managerId, uid) ||
    refMatches(emp.effectiveManager, uid)
  ) {
    return true;
  }
  if (
    refMatches(emp.teamLeaderId, uid) ||
    refMatches(emp.effectiveTeamLeader, uid)
  ) {
    return true;
  }

  const led = ledTeamNames
    .map((n) => (n || "").trim().toLowerCase())
    .filter(Boolean);
  if (led.length && employeeMatchesTeamName(emp, led)) {
    return true;
  }

  const dept = deptHeadTeamNames
    .map((n) => (n || "").trim().toLowerCase())
    .filter(Boolean);
  if (dept.length && employeeMatchesTeamName(emp, dept)) {
    return true;
  }

  return false;
}

/**
 * Dept head: employee on merged team roster (members / memberIds / `emp.team` name) even if
 * `deptHeadTeamNames` name-match alone missed (e.g. stale `emp.team`).
 */
/**
 * Team leader / manager paths: user leads a team (standalone or embedded) and target is on that
 * team's roster. Mirrors backend `collectTeamsLedByUser` + `employeeOnTeamRoster` — not only
 * `emp.team` string match (which misses empty/stale `emp.team` with valid `members[]`).
 */
function canLedTeamsEvaluateEmployeeByRosters(
  emp,
  currentUser,
  departments,
  allOrgTeams,
) {
  if (!emp || !currentUser?.id) return false;
  if (!Array.isArray(allOrgTeams) || !Array.isArray(departments)) return false;
  const uid = String(currentUser.id);
  const empId = emp.id ?? emp._id;
  if (empId != null && String(empId) === uid) return false;
  const ue = (currentUser.email || "").toLowerCase().trim();

  for (const t of allOrgTeams) {
    if (!t || (t.status && t.status !== "ACTIVE")) continue;
    const le = (t.leaderEmail || "").toLowerCase().trim();
    const lid = t.leaderId?.id ?? t.leaderId?._id ?? t.leaderId;
    const isLed =
      (ue && le === ue) || (uid && lid != null && String(lid) === uid);
    if (isLed && employeeOnTeamRosterClient(emp, t)) return true;
  }

  for (const d of departments) {
    for (const t of d.teams || []) {
      if (!t || (t.status && t.status !== "ACTIVE")) continue;
      const le = (t.leaderEmail || "").toLowerCase().trim();
      if (!ue || le !== ue) continue;
      if (employeeOnTeamRosterClient(emp, t)) return true;
    }
  }

  return false;
}

function canDeptHeadEvaluateEmployeeByMergedRosters(
  emp,
  currentUser,
  departments,
  teamsByDepartmentId,
) {
  if (
    !emp ||
    !currentUser?.id ||
    !Array.isArray(departments) ||
    !(teamsByDepartmentId instanceof Map)
  ) {
    return false;
  }
  const uid = String(currentUser.id);
  const empId = emp.id ?? emp._id;
  if (empId != null && String(empId) === uid) return false;

  for (const d of departments) {
    if (!departmentHeadedByUser(d, currentUser)) continue;
    const did = String(d.id ?? d._id ?? "");
    const standalone = did ? teamsByDepartmentId.get(did) || [] : [];
    const merged = mergeTeamsForDepartment(d, standalone);
    for (const team of merged) {
      if (employeeOnTeamRosterClient(emp, team)) return true;
    }
  }
  return false;
}

/**
 * @param {{
 *   excludeHrAdminRoles?: boolean,
 *   ledTeamNames?: string[],
 *   deptHeadTeamNames?: string[],
 *   departments?: object[] | null,
 *   teamsByDepartmentId?: Map<string, object[]> | null,
 *   allOrgTeams?: object[] | null — full `getTeamsApi()` list for led-team roster checks (e.g. employees list).
 * }} [opts]
 */
export function canManagerOrTeamLeaderEvaluateEmployee(emp, currentUser, opts = {}) {
  const {
    excludeHrAdminRoles = false,
    ledTeamNames = [],
    deptHeadTeamNames = [],
    departments = null,
    teamsByDepartmentId = null,
    allOrgTeams = null,
  } = opts;
  if (
    canAssessEmployeeSync(emp, currentUser, {
      allowGlobalRoles: !excludeHrAdminRoles,
      ledTeamNames,
      deptHeadTeamNames,
    })
  ) {
    return true;
  }
  if (departments != null && teamsByDepartmentId != null) {
    if (
      canDeptHeadEvaluateEmployeeByMergedRosters(
        emp,
        currentUser,
        departments,
        teamsByDepartmentId,
      )
    ) {
      return true;
    }
  }
  if (departments != null && allOrgTeams != null) {
    if (
      canLedTeamsEvaluateEmployeeByRosters(
        emp,
        currentUser,
        departments,
        allOrgTeams,
      )
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Team leader dashboard row: user leads `team` and `emp` is on that roster (email in members or same team name).
 */
export function canTeamLeaderEvaluateRosterMember(emp, team, currentUser) {
  if (!emp || !team || !currentUser) return false;
  if (currentUser.role !== "TEAM_LEADER") return false;
  const empId = emp.id ?? emp._id;
  if (empId != null && String(empId) === String(currentUser.id)) return false;
  const em = (emp.email || "").toLowerCase().trim();
  const ue = (currentUser.email || "").toLowerCase().trim();
  if (em && ue && em === ue) return false;

  const le = (team.leaderEmail || "").toLowerCase().trim();
  if (ue && le === ue) return true;
  const lid = team.leaderId?.id ?? team.leaderId?._id ?? team.leaderId;
  const uid = currentUser.id ? String(currentUser.id) : "";
  if (uid && lid != null && String(lid) === uid) return true;
  return false;
}
