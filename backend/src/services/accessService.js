import { Department } from '../models/Department.js';
import { Employee } from '../models/Employee.js';

/**
 * Computes { scope, actions[, teams] } for listing/mutating employees or metrics.
 */
export async function resolveEmployeeAccess(user) {
  if (user.role === "ADMIN" || user.role === 3) {
    return {
      scope: "all",
      actions: ["view", "create", "edit", "delete", "export"],
    };
  }

  // Find HR Department head
  const hrDept = await Department.findOne({ code: "HR" });
  if (!hrDept) {
     // fallback for early systems without code "HR"
     const hrAlt = await Department.findOne({ name: "HR" });
     if (hrAlt && hrAlt.head === user.email) {
        return { scope: "all", actions: ["view", "create", "edit", "delete", "export"] };
     }
  } else if (hrDept.head === user.email) {
    return {
      scope: "all",
      actions: ["view", "create", "edit", "delete", "export"],
    };
  }

  const isDeptHead = await Department.findOne({ head: user.email });
  if (isDeptHead || user.role === "MANAGER" || user.role === 2) {
    return {
      scope: "department",
      actions: ["view", "create", "edit", "delete", "export"],
    };
  }

  const deptsWithTeams = await Department.find({ "teams.leaderEmail": user.email });
  const managedTeamNames = [];
  deptsWithTeams.forEach((d) => {
    d.teams.forEach((t) => {
      if (t.leaderEmail === user.email) managedTeamNames.push(t.name);
    });
  });

  if (user.role === "TEAM_LEADER" || managedTeamNames.length > 0) {
    return {
      scope: "team",
      actions: ["view", "edit"],
      teams: managedTeamNames,
    };
  }

  return { scope: "self", actions: ["view"] };
}
