import { Department } from "../models/Department.js";
import { Team } from "../models/Team.js";
import { Employee } from "../models/Employee.js";

/**
 * After an employee document is saved, keep Department.head and Team.leaderEmail
 * aligned with role (MANAGER = department head, TEAM_LEADER = team leader).
 */
export async function syncEmployeeLeadershipAfterSave(employee) {
  const email = employee.email;
  if (!email || !employee.departmentId) return;

  const deptId = employee.departmentId;

  if (employee.role === "MANAGER") {
    const dept = await Department.findById(deptId);
    if (dept?.head && dept.head !== email) {
      const prevHead = await Employee.findOne({ email: dept.head });
      if (prevHead && prevHead.role === "MANAGER") {
        prevHead.role = "EMPLOYEE";
        await prevHead.save();
      }
    }
    // Sync BOTH legacy email AND normalized ObjectId
    await Department.updateOne(
      { _id: deptId },
      { $set: { head: email, headId: employee._id } },
    );
  } else {
    await Department.updateMany(
      { _id: deptId, head: email },
      { $set: { head: "", headId: null, headTitle: "Vacant" } },
    );
  }

  if (employee.role === "TEAM_LEADER" && employee.teamId) {
    // Use teamId (ObjectId) as primary key — more reliable than team name
    await Team.updateMany(
      { departmentId: deptId, leaderId: employee._id, _id: { $ne: employee.teamId } },
      { $set: { leaderEmail: null, leaderId: null } },
    );
    await Team.updateMany(
      { departmentId: deptId, leaderEmail: email, _id: { $ne: employee.teamId } },
      { $set: { leaderEmail: null, leaderId: null } },
    );

    const teamDoc = await Team.findById(employee.teamId);
    if (teamDoc) {
      if (teamDoc.leaderEmail && teamDoc.leaderEmail !== email) {
        const prev = await Employee.findOne({ email: teamDoc.leaderEmail });
        if (prev && prev.role === "TEAM_LEADER") {
          prev.role = "EMPLOYEE";
          await prev.save();
        }
      }
      // Sync BOTH legacy email AND normalized ObjectId
      teamDoc.leaderEmail = email;
      teamDoc.leaderId = employee._id;
      await teamDoc.save();
    }

    // FROZEN: legacy write to Department.teams[] removed.
    // Team collection (standalone) is the single source of truth.
  } else if (employee.role !== "TEAM_LEADER") {
    await Team.updateMany(
      { departmentId: deptId, leaderEmail: email },
      { $set: { leaderEmail: null, leaderId: null } },
    );
    // FROZEN: legacy cleanup of Department.teams[] removed.
    // Team collection (standalone) is the single source of truth.
  }
}

/**
 * When department.head is updated via Department API, align the affected employees' roles.
 */
export async function syncDepartmentHeadRoles(previousHeadEmail, newHeadEmail) {
  if (previousHeadEmail && previousHeadEmail !== newHeadEmail) {
    const prev = await Employee.findOne({ email: previousHeadEmail });
    if (prev && prev.role === "MANAGER") {
      prev.role = "EMPLOYEE";
      await prev.save();
    }
  }
  if (newHeadEmail) {
    const next = await Employee.findOne({ email: newHeadEmail });
    if (
      next &&
      ["EMPLOYEE", "TEAM_LEADER", "MANAGER"].includes(next.role)
    ) {
      next.role = "MANAGER";
      await next.save();
    }
  }
}

/**
 * After department teams are saved, set TEAM_LEADER on leaders and demote removed leaders.
 */
export async function syncTeamLeaderRolesFromDepartmentTeams(
  departmentId,
  teams,
  previousTeamsSnapshot,
) {
  if (!Array.isArray(teams)) return;

  const prevLeaders = new Set();
  if (Array.isArray(previousTeamsSnapshot)) {
    for (const t of previousTeamsSnapshot) {
      const le = t.leaderEmail || t.manager || t.managerEmail;
      if (le) prevLeaders.add(le);
    }
  }

  const newLeaders = new Set();
  for (const t of teams) {
    const le = t.leaderEmail || t.manager || t.managerEmail;
    if (le) newLeaders.add(le);
  }

  for (const em of prevLeaders) {
    if (!newLeaders.has(em)) {
      const emp = await Employee.findOne({ email: em });
      if (emp && emp.role === "TEAM_LEADER") {
        emp.role = "EMPLOYEE";
        await emp.save();
      }
    }
  }

  for (const em of newLeaders) {
    const emp = await Employee.findOne({ email: em });
    if (
      emp &&
      emp.departmentId?.toString() === departmentId.toString() &&
      ["EMPLOYEE", "TEAM_LEADER"].includes(emp.role)
    ) {
      emp.role = "TEAM_LEADER";
      await emp.save();
    }
  }
}
