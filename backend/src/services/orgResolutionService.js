/**
 * @file Resolves default reporting lines from Department / Team structure and syncs
 * employee rows from department rosters (teams + position templates).
 */
import { Department } from "../models/Department.js";
import { Team } from "../models/Team.js";
import { Position } from "../models/Position.js";
import { Employee } from "../models/Employee.js";

/**
 * @param {import("mongoose").Document | object} team
 * @returns {string}
 */
function teamLeaderEmailFrom(team) {
  if (!team) return "";
  return (
    team.leaderEmail ||
    team.manager ||
    team.managerEmail ||
    ""
  ).trim();
}

/**
 * Merges embedded `Department.teams` with standalone `Team` docs (same rules as GET /departments).
 * @param {import("mongoose").Document} department
 * @returns {Promise<{ mergedTeams: object[], standaloneTeams: import("mongoose").Document[] }>}
 */
export async function getMergedTeamsForDepartment(department) {
  const standalone = await Team.find({
    departmentId: department._id,
    status: "ACTIVE",
  });
  const standaloneIds = new Set(standalone.map((t) => t._id.toString()));
  const embedded = department.teams || [];
  const embeddedFiltered = embedded.filter((t) => {
    const tid = t._id?.toString?.();
    return !tid || !standaloneIds.has(tid);
  });
  const mergedTeams = [
    ...embeddedFiltered.map((t) =>
      typeof t.toObject === "function" ? t.toObject() : { ...t },
    ),
    ...standalone.map((t) => t.toObject()),
  ];
  return { mergedTeams, standaloneTeams: standalone };
}

/**
 * Default manager (department head) and team leader for an employee from org structure.
 * @param {object} employee — lean or plain employee with `email`, `departmentId`, `department`
 * @param {object | null} department — lean department doc
 * @param {object[]} mergedTeams — from `getMergedTeamsForDepartment`
 * @param {Map<string, object | null>} [emailCache] — optional cache email -> Employee lean
 * @returns {Promise<{ defaultManager: object | null, defaultTeamLeader: object | null, matchedTeam: object | null }>}
 */
export async function resolveDefaultReporting(
  employee,
  department,
  mergedTeams,
  emailCache,
) {
  const cache = emailCache || new Map();

  async function getByEmail(em) {
    if (!em) return null;
    const key = String(em).trim();
    if (!key) return null;
    if (cache.has(key)) return cache.get(key);
    const doc = await Employee.findOne({ email: key }).lean();
    cache.set(key, doc);
    return doc;
  }

  if (!department || !employee?.email) {
    return {
      defaultManager: null,
      defaultTeamLeader: null,
      matchedTeam: null,
    };
  }

  const email = employee.email.trim();
  let headEmp = null;
  if (department.head && department.head !== email) {
    headEmp = await getByEmail(department.head);
  }

  let matchedTeam = null;
  for (const t of mergedTeams) {
    const members = Array.isArray(t.members) ? t.members : [];
    const le = teamLeaderEmailFrom(t);
    if (members.includes(email) || le === email) {
      matchedTeam = t;
      break;
    }
  }

  let defaultTeamLeader = null;
  if (matchedTeam) {
    const le = teamLeaderEmailFrom(matchedTeam);
    if (le && le !== email) {
      defaultTeamLeader = await getByEmail(le);
    }
  }

  return {
    defaultManager: headEmp,
    defaultTeamLeader,
    matchedTeam,
  };
}

/**
 * Computes display reporting for API payloads (effective* fields).
 * @param {object} employee — populated or lean; may include populated managerId/teamLeaderId
 * @param {object | null} department
 * @param {object[]} mergedTeams
 * @returns {Promise<object>}
 */
export async function computeEffectiveReportingPayload(
  employee,
  department,
  mergedTeams,
  emailCache,
) {
  const useDefault = employee.useDefaultReporting !== false;
  const { defaultManager, defaultTeamLeader } = await resolveDefaultReporting(
    employee,
    department,
    mergedTeams,
    emailCache,
  );

  function mini(emp) {
    if (!emp) return null;
    const id = emp._id?.toString?.() || emp.id;
    return {
      id,
      fullName: emp.fullName,
      email: emp.email,
      workEmail: emp.workEmail,
    };
  }

  if (useDefault) {
    return {
      effectiveManager: mini(defaultManager),
      effectiveTeamLeader: mini(defaultTeamLeader),
      reportingSource: "default",
    };
  }

  const mgr =
    employee.managerId && typeof employee.managerId === "object"
      ? employee.managerId
      : employee.managerId
        ? await Employee.findById(employee.managerId).lean()
        : null;
  const tl =
    employee.teamLeaderId && typeof employee.teamLeaderId === "object"
      ? employee.teamLeaderId
      : employee.teamLeaderId
        ? await Employee.findById(employee.teamLeaderId).lean()
        : null;

  return {
    effectiveManager: mini(mgr),
    effectiveTeamLeader: mini(tl),
    reportingSource: "override",
  };
}

/**
 * Sync employees that belong to a department from merged team rosters + position templates.
 * Clears team when employee is not in any merged team roster (still in department).
 * Updates position when listed in `department.positions[].members` (first title wins).
 * When `useDefaultReporting` is not false, sets `managerId` / `teamLeaderId` from defaults.
 *
 * @param {import("mongoose").Types.ObjectId | string} departmentId
 * @returns {Promise<{ updated: number }>}
 */
export async function syncEmployeesWithDepartment(departmentId) {
  const department = await Department.findById(departmentId);
  if (!department) return { updated: 0 };

  const { mergedTeams } = await getMergedTeamsForDepartment(department);
  const deptName = department.name;

  /** @type {Map<string, { teamName: string, teamObjectId: import("mongoose").Types.ObjectId | null }>} */
  const emailToTeam = new Map();

  for (const t of mergedTeams) {
    const teamName = (t.name || "").trim();
    const oid = t._id
      ? typeof t._id === "object" && t._id.toString
        ? t._id
        : t._id
      : null;
    const teamObjectId =
      oid && String(oid).length === 24 ? oid : null;

    const le = teamLeaderEmailFrom(t);
    const members = Array.isArray(t.members) ? [...t.members] : [];
    if (le) members.push(le);

    for (const raw of members) {
      const em = String(raw).trim();
      if (!em) continue;
      if (!emailToTeam.has(em)) {
        emailToTeam.set(em, {
          teamName,
          teamObjectId: teamObjectId || null,
        });
      }
    }
  }

  /** @type {Map<string, string>} email -> position title */
  const emailToPositionTitle = new Map();
  for (const p of department.positions || []) {
    const title = (p.title || "").trim();
    if (!title) continue;
    for (const raw of p.members || []) {
      const em = String(raw).trim();
      if (!em) continue;
      if (!emailToPositionTitle.has(em)) emailToPositionTitle.set(em, title);
    }
  }

  const positionsInDept = await Position.find({
    departmentId: department._id,
    status: "ACTIVE",
  }).lean();

  const employees = await Employee.find({
    $or: [{ departmentId: department._id }, { department: deptName }],
  });

  let updated = 0;

  for (const emp of employees) {
    let changed = false;

    if (
      emp.departmentId?.toString() !== department._id.toString() ||
      emp.department !== deptName
    ) {
      emp.departmentId = department._id;
      emp.department = deptName;
      changed = true;
    }

    const teamInfo = emailToTeam.get(emp.email);
    if (teamInfo) {
      let teamObjectId = teamInfo.teamObjectId;
      if (!teamObjectId && teamInfo.teamName) {
        const found = await Team.findOne({
          departmentId: department._id,
          name: teamInfo.teamName,
          status: "ACTIVE",
        })
          .select("_id")
          .lean();
        teamObjectId = found?._id || null;
      }
      if (emp.team !== teamInfo.teamName) {
        emp.team = teamInfo.teamName;
        changed = true;
      }
      const newTid = teamObjectId || null;
      if (String(emp.teamId || "") !== String(newTid || "")) {
        emp.teamId = newTid;
        changed = true;
      }
    } else if (
      emp.departmentId?.toString() === department._id.toString() &&
      mergedTeams.length > 0
    ) {
      if (emp.team != null || emp.teamId != null) {
        emp.team = null;
        emp.teamId = null;
        changed = true;
      }
    }

    const posTitle = emailToPositionTitle.get(emp.email);
    if (posTitle) {
      const posDoc = positionsInDept.find((p) => p.title === posTitle);
      if (posDoc) {
        if (emp.position !== posTitle) {
          emp.position = posTitle;
          changed = true;
        }
        if (String(emp.positionId || "") !== String(posDoc._id)) {
          emp.positionId = posDoc._id;
          changed = true;
        }
      } else {
        if (emp.position !== posTitle) {
          emp.position = posTitle;
          changed = true;
        }
      }
    }

    if (emp.useDefaultReporting !== false) {
      const syncCache = new Map();
      const { defaultManager, defaultTeamLeader } = await resolveDefaultReporting(
        emp,
        department,
        mergedTeams,
        syncCache,
      );

      const nextMgrId = defaultManager?._id || null;
      const nextTlId = defaultTeamLeader?._id || null;

      if (String(emp.managerId || "") !== String(nextMgrId || "")) {
        emp.managerId = nextMgrId;
        changed = true;
      }
      if (String(emp.teamLeaderId || "") !== String(nextTlId || "")) {
        emp.teamLeaderId = nextTlId;
        changed = true;
      }
    }

    if (changed) {
      await emp.save();
      updated += 1;
    }
  }

  return { updated };
}

/**
 * Enrich one employee object for API (adds effectiveManager, effectiveTeamLeader, reportingSource).
 * @param {object} employee — plain object or mongoose doc with optional populated refs
 * @returns {Promise<object>}
 */
export async function enrichEmployeeForResponse(employee) {
  const plain =
    employee?.toObject?.() ?? (typeof employee === "object" ? { ...employee } : {});

  let department = null;
  let mergedTeams = [];

  if (plain.departmentId) {
    department = await Department.findById(plain.departmentId).lean();
  }
  if (!department && plain.department) {
    department = await Department.findOne({ name: plain.department }).lean();
  }

  if (department) {
    const deptDoc = await Department.findById(department._id);
    if (deptDoc) {
      const out = await getMergedTeamsForDepartment(deptDoc);
      mergedTeams = out.mergedTeams;
    }
  }

  const effective = await computeEffectiveReportingPayload(
    plain,
    department,
    mergedTeams,
    new Map(),
  );

  return {
    ...plain,
    ...effective,
  };
}

/**
 * Batch-enrich employees (reduces duplicate department loads).
 * @param {object[]} employees — array of plain or mongoose docs
 * @returns {Promise<object[]>}
 */
export async function enrichEmployeesForResponse(employees) {
  if (!Array.isArray(employees) || employees.length === 0) return [];

  const deptCache = new Map();
  async function getDeptData(departmentId) {
    const key = departmentId?.toString?.() || String(departmentId);
    if (deptCache.has(key)) return deptCache.get(key);
    const deptDoc = await Department.findById(departmentId);
    if (!deptDoc) {
      deptCache.set(key, { department: null, mergedTeams: [] });
      return deptCache.get(key);
    }
    const { mergedTeams } = await getMergedTeamsForDepartment(deptDoc);
    const data = { department: deptDoc.toObject(), mergedTeams };
    deptCache.set(key, data);
    return data;
  }

  const emailCache = new Map();
  const out = [];
  for (const emp of employees) {
    const plain =
      emp?.toObject?.() ?? (typeof emp === "object" ? { ...emp } : {});
    let department = null;
    let mergedTeams = [];

    if (plain.departmentId) {
      const d = await getDeptData(plain.departmentId);
      department = d.department;
      mergedTeams = d.mergedTeams;
    } else if (plain.department) {
      const d = await Department.findOne({ name: plain.department }).lean();
      if (d) {
        const full = await getDeptData(d._id);
        department = full.department;
        mergedTeams = full.mergedTeams;
      }
    }

    const effective = await computeEffectiveReportingPayload(
      plain,
      department,
      mergedTeams,
      emailCache,
    );
    out.push({ ...plain, ...effective });
  }
  return out;
}
