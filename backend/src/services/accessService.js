import { Department } from '../models/Department.js';
import { Team } from '../models/Team.js';
import { Employee } from '../models/Employee.js';
import mongoose from 'mongoose';
import { isAdminRole } from '../utils/roles.js';

const HR_DEPARTMENT_NAME = process.env.HR_DEPARTMENT_NAME || "HR";

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

  if (user.role === "HR_MANAGER") {
    return {
      scope: "all",
      actions: ["view", "create", "edit", "delete", "export"],
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
  if (isDeptHead || user.role === "MANAGER" || user.role === 2) {
    return {
      scope: "department",
      actions: ["view", "create", "edit", "delete", "export"],
    };
  }

  const managedTeamNames = [];

  const deptsWithTeams = await Department.find({ "teams.leaderEmail": user.email });
  deptsWithTeams.forEach((d) => {
    d.teams.forEach((t) => {
      if (t.leaderEmail === user.email) managedTeamNames.push(t.name);
    });
  });

  const standaloneTeamsEmail = await Team.find({ leaderEmail: user.email, status: "ACTIVE" });
  standaloneTeamsEmail.forEach((t) => {
    if (!managedTeamNames.includes(t.name)) managedTeamNames.push(t.name);
  });

  if (oid) {
    const standaloneTeamsId = await Team.find({ leaderId: oid, status: "ACTIVE" });
    standaloneTeamsId.forEach((t) => {
      if (!managedTeamNames.includes(t.name)) managedTeamNames.push(t.name);
    });
  }

  if (user.role === "TEAM_LEADER" || managedTeamNames.length > 0) {
    return {
      scope: "team",
      actions: ["view", "edit"],
      teams: managedTeamNames,
    };
  }

  return { scope: "self", actions: ["view"] };
}
