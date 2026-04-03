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
    await Department.updateOne(
      { _id: deptId },
      { $set: { head: email } },
    );
  } else {
    await Department.updateMany(
      { _id: deptId, head: email },
      { $set: { head: "", headTitle: "Vacant" } },
    );
  }

  if (employee.role === "TEAM_LEADER" && employee.team) {
    await Team.updateMany(
      {
        departmentId: deptId,
        leaderEmail: email,
        name: { $ne: employee.team },
      },
      { $set: { leaderEmail: null } },
    );

    const teamDoc = await Team.findOne({
      name: employee.team,
      departmentId: deptId,
    });
    if (teamDoc) {
      if (teamDoc.leaderEmail && teamDoc.leaderEmail !== email) {
        const prev = await Employee.findOne({ email: teamDoc.leaderEmail });
        if (prev && prev.role === "TEAM_LEADER") {
          prev.role = "EMPLOYEE";
          await prev.save();
        }
      }
      teamDoc.leaderEmail = email;
      await teamDoc.save();
    }

    await Department.updateOne(
      { _id: deptId, "teams.name": employee.team },
      { $set: { "teams.$.leaderEmail": email } },
    );
  } else {
    await Team.updateMany(
      { departmentId: deptId, leaderEmail: email },
      { $set: { leaderEmail: null } },
    );
    await Department.updateMany(
      { _id: deptId, "teams.leaderEmail": email },
      {
        $set: {
          "teams.$[t].leaderEmail": "",
          "teams.$[t].leaderTitle": "Vacant",
        },
      },
      { arrayFilters: [{ "t.leaderEmail": email }] },
    );
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
