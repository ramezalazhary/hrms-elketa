/**
 * Who may submit or view another employee's performance assessments.
 *
 * R1 — HR / Admin: HR_STAFF, HR_MANAGER, ADMIN (and legacy numeric admin).
 * R2 — Direct manager: target.managerId === evaluator employee id.
 * R3 — Team-leader field fallback: target.teamLeaderId === evaluator id.
 * R4 — Teams the evaluator leads (roster: members, memberIds, employee.team name).
 * R5 — Department head: target on roster of any merged team in a department the evaluator heads.
 *
 * Self-assessment is denied for non-global roles.
 */
import mongoose from "mongoose";
import { Department } from "../models/Department.js";
import { Team } from "../models/Team.js";
import { Employee } from "../models/Employee.js";
import { getMergedTeamsForDepartment } from "./orgResolutionService.js";
import { isAdminRole, isHrOrAdmin } from "../utils/roles.js";

function normEmail(s) {
  return String(s || "").toLowerCase().trim();
}

/**
 * @param {object} employee — lean or plain employee
 * @param {object} team — plain team (embedded or Team collection)
 */
export function employeeOnTeamRoster(employee, team) {
  if (!team || !employee) return false;
  const empEmail = normEmail(employee.email);
  const teamName = String(team.name || "").trim();
  const empTeam = String(employee.team || "").trim();
  if (teamName && empTeam && teamName.toLowerCase() === empTeam.toLowerCase()) {
    return true;
  }
  const members = Array.isArray(team.members) ? team.members : [];
  for (const m of members) {
    if (normEmail(m) === empEmail) return true;
  }
  const memberIds = Array.isArray(team.memberIds) ? team.memberIds : [];
  const eid =
    employee._id?.toString?.() ?? employee.id?.toString?.() ?? String(employee.id || "");
  for (const mid of memberIds) {
    const id = mid?.toString?.() ?? mid;
    if (eid && id && String(eid) === String(id)) return true;
  }
  return false;
}

async function resolveActor(evaluatorUser) {
  let actor = null;
  if (evaluatorUser.id) {
    actor = await Employee.findById(evaluatorUser.id).select("_id email").lean();
  }
  if (!actor && evaluatorUser.email) {
    actor = await Employee.findOne({ email: evaluatorUser.email })
      .select("_id email")
      .lean();
  }
  const oid = actor?._id?.toString?.() ?? String(evaluatorUser.id || "");
  const email = evaluatorUser.email || actor?.email || "";
  return { actor, oid, email };
}

async function getHeadedDepartmentIds(userEmail, oidStr) {
  const or = [{ head: userEmail }];
  if (oidStr) {
    try {
      or.push({ headId: new mongoose.Types.ObjectId(String(oidStr)) });
    } catch {
      /* ignore invalid id */
    }
  }
  const depts = await Department.find({ $or: or }).select("_id").lean();
  return depts.map((d) => d._id);
}

/**
 * Teams (plain objects) the user leads — embedded department teams + standalone Team docs.
 */
async function collectTeamsLedByUser(userEmail, oidStr) {
  const out = [];
  const em = normEmail(userEmail);

  const deptsByEmail = await Department.find({ "teams.leaderEmail": userEmail });
  for (const d of deptsByEmail) {
    for (const t of d.teams || []) {
      const tObj = typeof t.toObject === "function" ? t.toObject() : { ...t };
      if (normEmail(tObj.leaderEmail) === em) out.push(tObj);
    }
  }

  const leaderOr = [{ leaderEmail: userEmail }];
  if (oidStr) {
    try {
      leaderOr.push({ leaderId: new mongoose.Types.ObjectId(String(oidStr)) });
    } catch {
      /* ignore */
    }
  }
  const standalone = await Team.find({
    status: "ACTIVE",
    $or: leaderOr,
  }).lean();
  for (const t of standalone) out.push(t);

  return out;
}

/**
 * @param {import("mongoose").Document | object} targetEmployee
 * @param {{ id?: string, email?: string, role?: string|number }} evaluatorUser — req.user
 */
export async function canAssessEmployee(evaluatorUser, targetEmployee) {
  if (!evaluatorUser || !targetEmployee) return false;

  const target =
    typeof targetEmployee.toObject === "function"
      ? targetEmployee.toObject()
      : { ...targetEmployee };

  const targetId =
    target._id?.toString?.() ?? target.id?.toString?.() ?? String(target.id || "");
  const evalId = evaluatorUser.id ? String(evaluatorUser.id) : "";

  if (isHrOrAdmin(evaluatorUser) || isAdminRole(evaluatorUser.role)) {
    return true;
  }

  if (targetId && evalId && targetId === evalId) {
    return false;
  }

  const mgrRaw = target.managerId;
  const mgrId =
    mgrRaw?.toString?.() ??
    (typeof mgrRaw === "object" && mgrRaw !== null
      ? mgrRaw._id?.toString?.() ?? mgrRaw.id
      : mgrRaw);
  if (mgrId && evalId && String(mgrId) === evalId) {
    return true;
  }

  const tlRaw = target.teamLeaderId;
  const tlId =
    tlRaw?.toString?.() ??
    (typeof tlRaw === "object" && tlRaw !== null
      ? tlRaw._id?.toString?.() ?? tlRaw.id
      : tlRaw);
  if (tlId && evalId && String(tlId) === evalId) {
    return true;
  }

  const { oid, email } = await resolveActor(evaluatorUser);
  if (!oid && !email) {
    return false;
  }

  const ledTeams = await collectTeamsLedByUser(email, oid);
  for (const team of ledTeams) {
    if (employeeOnTeamRoster(target, team)) {
      return true;
    }
  }

  const headedIds = await getHeadedDepartmentIds(email, oid);
  for (const deptId of headedIds) {
    const dept = await Department.findById(deptId);
    if (!dept) continue;
    const { mergedTeams } = await getMergedTeamsForDepartment(dept);
    for (const team of mergedTeams) {
      if (employeeOnTeamRoster(target, team)) {
        return true;
      }
    }
  }

  return false;
}
