import { Department } from '../models/Department.js';
import { Team } from '../models/Team.js';
import { Employee } from '../models/Employee.js';
import mongoose from 'mongoose';
import { isAdminRole, normalizeRole } from '../utils/roles.js';

const HR_DEPARTMENT_NAME = process.env.HR_DEPARTMENT_NAME || "HR";

function escapeRegex(s) {
  return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Case-insensitive exact match for stored leader emails. */
function leaderEmailRegex(email) {
  const t = String(email || "").trim();
  if (!t) return null;
  return new RegExp(`^${escapeRegex(t)}$`, "i");
}

function actorObjectId(user) {
  if (!user?.id) return null;
  try {
    return new mongoose.Types.ObjectId(String(user.id));
  } catch {
    return null;
  }
}

/**
 * Computes { scope, actions[, teams] } for listing/mutating employees or metrics.
 */
export async function resolveEmployeeAccess(user) {
  if (isAdminRole(user.role)) {
    return {
      scope: "all",
      actions: ["view", "create", "edit", "delete", "export"],
    };
  }

  const actorRole = normalizeRole(user.role);
  if (actorRole === "HR_MANAGER") {
    return {
      scope: "all",
      actions: ["view", "create", "edit", "delete", "export"],
    };
  }

  if (actorRole === "HR_STAFF") {
    return {
      scope: "all",
      actions: ["view", "create", "edit", "export"],
    };
  }

  let actor = null;
  if (user.id) {
    actor = await Employee.findById(user.id).select("_id email").lean();
  }
  if (!actor && user.email) {
    actor = await Employee.findOne({ email: user.email }).select("_id email").lean();
  }
  const oid = actor?._id ?? actorObjectId(user);

  const hrDept = await Department.findOne({ code: HR_DEPARTMENT_NAME });
  if (!hrDept) {
    const hrAlt = await Department.findOne({ name: HR_DEPARTMENT_NAME });
    if (
      hrAlt &&
      (hrAlt.head === user.email || (oid && hrAlt.headId && hrAlt.headId.equals(oid)))
    ) {
      return { scope: "all", actions: ["view", "create", "edit", "delete", "export"] };
    }
  } else if (hrDept.head === user.email || (oid && hrDept.headId && hrDept.headId.equals(oid))) {
    return {
      scope: "all",
      actions: ["view", "create", "edit", "delete", "export"],
    };
  }

  const deptHeadOr = [{ head: user.email }];
  if (oid) deptHeadOr.push({ headId: oid });

  const isDeptHead = await Department.findOne({ $or: deptHeadOr });
  if (isDeptHead || actorRole === "MANAGER") {
    return {
      scope: "department",
      actions: ["view", "create", "edit", "delete", "export"],
    };
  }

  const managedTeamNames = [];

  const leaderRe = leaderEmailRegex(user.email);
  const deptsWithTeams = leaderRe
    ? await Department.find({
        teams: { $elemMatch: { leaderEmail: leaderRe } },
      })
    : [];
  deptsWithTeams.forEach((d) => {
    d.teams.forEach((t) => {
      if (leaderRe && leaderRe.test(String(t.leaderEmail || ""))) {
        managedTeamNames.push(t.name);
      }
    });
  });

  const standaloneTeamsEmail = leaderRe
    ? await Team.find({ leaderEmail: leaderRe, status: "ACTIVE" })
    : [];
  standaloneTeamsEmail.forEach((t) => {
    if (!managedTeamNames.includes(t.name)) managedTeamNames.push(t.name);
  });

  if (oid) {
    const standaloneTeamsId = await Team.find({ leaderId: oid, status: "ACTIVE" });
    standaloneTeamsId.forEach((t) => {
      if (!managedTeamNames.includes(t.name)) managedTeamNames.push(t.name);
    });
  }

  if (actorRole === "TEAM_LEADER" || managedTeamNames.length > 0) {
    return {
      scope: "team",
      actions: ["view", "edit"],
      teams: managedTeamNames,
    };
  }

  return { scope: "self", actions: ["view"] };
}
