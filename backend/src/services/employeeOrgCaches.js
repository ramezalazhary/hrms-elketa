import { Department } from "../models/Department.js";
import { Team } from "../models/Team.js";
import { Position } from "../models/Position.js";
import { Branch } from "../models/Branch.js";

/**
 * Aligns denormalized org strings on Employee from authoritative ids.
 * @param {import("mongoose").Document} employee
 */
export async function syncEmployeeOrgCaches(employee) {
  if (!employee) return;

  if (employee.departmentId) {
    const d = await Department.findById(employee.departmentId).select("name").lean();
    if (d?.name) employee.department = d.name;
  }

  if (employee.teamId) {
    const t = await Team.findById(employee.teamId).select("name").lean();
    if (t?.name) employee.team = t.name;
  }

  if (employee.positionId) {
    const p = await Position.findById(employee.positionId).select("title").lean();
    employee.position = p?.title ?? employee.position;
  }

  if (employee.branchId) {
    const b = await Branch.findById(employee.branchId).select("name").lean();
    if (b?.name) employee.workLocation = b.name;
  }
}
