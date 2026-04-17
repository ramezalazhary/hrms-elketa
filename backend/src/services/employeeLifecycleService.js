import mongoose from "mongoose";
import { Department } from "../models/Department.js";
import { Team } from "../models/Team.js";
import { Position } from "../models/Position.js";
import { Employee } from "../models/Employee.js";
import { UserPermission } from "../models/Permission.js";
import { PageAccessOverride } from "../models/PageAccessOverride.js";

const HR_DEPARTMENT_NAME = String(process.env.HR_DEPARTMENT_NAME || "HR")
  .trim()
  .toLowerCase();

function normalizeDepartmentName(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export function isHrDepartmentName(value) {
  return normalizeDepartmentName(value) === HR_DEPARTMENT_NAME;
}

async function isCodeReservedByAnotherEmployee(code, ownerEmployeeId) {
  if (!code) return false;
  const query = {
    _id: { $ne: ownerEmployeeId },
    $or: [
      { employeeCode: code },
      { "employeeCodeHistory.code": code },
    ],
  };
  const found = await Employee.findOne(query).select("_id").lean();
  return Boolean(found);
}

function makeCode(departmentCode, serial) {
  return `#${departmentCode}-${String(serial).padStart(3, "0")}`;
}

function sameDepartment(historyItem, departmentDoc) {
  if (!historyItem || !departmentDoc) return false;
  const historyDepartmentId = historyItem.departmentId
    ? String(historyItem.departmentId)
    : null;
  if (historyDepartmentId && String(departmentDoc._id) === historyDepartmentId) {
    return true;
  }
  return normalizeDepartmentName(historyItem.departmentName) ===
    normalizeDepartmentName(departmentDoc.name);
}

export function findOwnedCodeForDepartment(employee, departmentDoc) {
  const history = Array.isArray(employee?.employeeCodeHistory)
    ? employee.employeeCodeHistory
    : [];
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const item = history[i];
    if (!item?.code) continue;
    if (sameDepartment(item, departmentDoc)) return item.code;
  }
  return null;
}

export async function generateDepartmentScopedCode({
  departmentDoc,
  ownerEmployeeId = null,
}) {
  if (!departmentDoc?.code) {
    throw new Error("Department code is required for employee code generation");
  }

  const baseCount = await Employee.countDocuments({
    departmentId: departmentDoc._id,
  });
  let serial = Math.max(baseCount + 1, 1);
  let attempts = 0;

  while (attempts < 10000) {
    const candidate = makeCode(departmentDoc.code, serial);
    const reservedElsewhere = await isCodeReservedByAnotherEmployee(
      candidate,
      ownerEmployeeId,
    );
    if (!reservedElsewhere) return candidate;
    serial += 1;
    attempts += 1;
  }

  throw new Error("Unable to allocate a unique employee code for department");
}

export async function resolveEmployeeCodeForDepartment({
  employee,
  departmentDoc,
}) {
  const ownedCode = findOwnedCodeForDepartment(employee, departmentDoc);
  if (ownedCode) {
    const reservedElsewhere = await isCodeReservedByAnotherEmployee(
      ownedCode,
      employee?._id,
    );
    if (!reservedElsewhere) return ownedCode;
  }
  return generateDepartmentScopedCode({
    departmentDoc,
    ownerEmployeeId: employee?._id || null,
  });
}

export function recordEmployeeCodeOwnership(employee, { code, departmentDoc, at }) {
  if (!employee || !code || !departmentDoc) return;
  if (!Array.isArray(employee.employeeCodeHistory)) {
    employee.employeeCodeHistory = [];
  }
  const history = employee.employeeCodeHistory;
  const now = at || new Date();
  const existingIndex = history.findIndex((item) => String(item?.code) === String(code));

  const payload = {
    code,
    departmentId: departmentDoc._id,
    departmentName: departmentDoc.name,
    reservedAt: existingIndex >= 0 ? history[existingIndex]?.reservedAt || now : now,
    lastUsedAt: now,
  };

  if (existingIndex >= 0) {
    history[existingIndex] = {
      ...history[existingIndex],
      ...payload,
    };
  } else {
    history.push(payload);
  }
}

export async function ensureEmployeeCodeAvailableForOwner({ code, ownerEmployeeId }) {
  const reservedElsewhere = await isCodeReservedByAnotherEmployee(code, ownerEmployeeId);
  if (reservedElsewhere) {
    throw new Error("Employee code is reserved by another employee");
  }
}

export async function deprovisionEmployeeAccess(employee, { forceEmployeeRole = true } = {}) {
  if (!employee?._id) return false;
  const hadTemplates = Array.isArray(employee.hrTemplates) && employee.hrTemplates.length > 0;
  const hadLevel = String(employee.hrLevel || "STAFF") !== "STAFF";
  const hadPrivilegedRole = String(employee.role || "") !== "EMPLOYEE";

  employee.hrTemplates = [];
  employee.hrLevel = "STAFF";
  if (forceEmployeeRole) {
    employee.role = "EMPLOYEE";
  }

  await UserPermission.deleteMany({ userId: employee._id });
  await PageAccessOverride.deleteMany({ userId: employee._id });

  return hadTemplates || hadLevel || hadPrivilegedRole || forceEmployeeRole;
}

export function captureTerminationSnapshot(employee, { status, at } = {}) {
  if (!employee) return;
  employee.lastAssignmentBeforeTermination = {
    departmentId: employee.departmentId || null,
    departmentName: employee.department || null,
    teamId: employee.teamId || null,
    teamName: employee.team || null,
    positionId: employee.positionId || null,
    positionName: employee.position || null,
    managerId: employee.managerId || null,
    teamLeaderId: employee.teamLeaderId || null,
    employeeCode: employee.employeeCode || null,
    capturedAt: at || new Date(),
    previousStatus: status || employee.status || null,
  };
}

export async function restoreAssignmentFromSnapshot(employee) {
  const snapshot = employee?.lastAssignmentBeforeTermination;
  if (!employee || !snapshot) return false;

  let departmentDoc = null;
  if (snapshot.departmentId && mongoose.Types.ObjectId.isValid(String(snapshot.departmentId))) {
    departmentDoc = await Department.findById(snapshot.departmentId).select("_id name").lean();
  }
  if (!departmentDoc && snapshot.departmentName) {
    departmentDoc = await Department.findOne({ name: snapshot.departmentName })
      .select("_id name")
      .lean();
  }
  if (!departmentDoc) return false;

  employee.departmentId = departmentDoc._id;
  employee.department = departmentDoc.name;
  employee.managerId = snapshot.managerId || null;
  employee.teamLeaderId = snapshot.teamLeaderId || null;

  let restoredTeam = null;
  if (snapshot.teamId && mongoose.Types.ObjectId.isValid(String(snapshot.teamId))) {
    restoredTeam = await Team.findOne({
      _id: snapshot.teamId,
      departmentId: departmentDoc._id,
      status: "ACTIVE",
    })
      .select("_id name")
      .lean();
  }
  if (!restoredTeam && snapshot.teamName) {
    restoredTeam = await Team.findOne({
      name: snapshot.teamName,
      departmentId: departmentDoc._id,
      status: "ACTIVE",
    })
      .select("_id name")
      .lean();
  }
  employee.teamId = restoredTeam?._id || null;
  employee.team = restoredTeam?.name || null;

  let restoredPosition = null;
  if (snapshot.positionId && mongoose.Types.ObjectId.isValid(String(snapshot.positionId))) {
    restoredPosition = await Position.findOne({
      _id: snapshot.positionId,
      departmentId: departmentDoc._id,
    })
      .select("_id title")
      .lean();
  }
  if (!restoredPosition && snapshot.positionName) {
    restoredPosition = await Position.findOne({
      title: snapshot.positionName,
      departmentId: departmentDoc._id,
    })
      .select("_id title")
      .lean();
  }
  employee.positionId = restoredPosition?._id || null;
  employee.position = restoredPosition?.title || null;

  const restoredCode = snapshot.employeeCode
    ? snapshot.employeeCode
    : await resolveEmployeeCodeForDepartment({ employee, departmentDoc });

  await ensureEmployeeCodeAvailableForOwner({
    code: restoredCode,
    ownerEmployeeId: employee._id,
  });
  employee.employeeCode = restoredCode;
  recordEmployeeCodeOwnership(employee, {
    code: restoredCode,
    departmentDoc,
    at: new Date(),
  });

  return true;
}
