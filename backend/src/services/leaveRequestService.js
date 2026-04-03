/**
 * LeaveRequest business logic: pipeline, overlap, balance context, status sync.
 * Top-level `status` is updated only here.
 */
import mongoose from "mongoose";
import { Employee } from "../models/Employee.js";
import { Department } from "../models/Department.js";
import { Team } from "../models/Team.js";
import { LeaveRequest } from "../models/LeaveRequest.js";
import {
  buildPolicySnapshot,
  getDefaultPolicyDoc,
  resolveActiveLeavePolicy,
} from "./leavePolicyService.js";

const HR_ROLES = new Set(["HR_STAFF", "HR_MANAGER", "ADMIN"]);

function normEmail(e) {
  return (e || "").trim().toLowerCase();
}

function parseYmdToUtcNoon(s) {
  if (!s) return null;
  const d = new Date(String(s).slice(0, 10) + "T12:00:00.000Z");
  return Number.isNaN(d.getTime()) ? null : d;
}

function utcDayStart(d) {
  const x = new Date(d);
  return Date.UTC(
    x.getUTCFullYear(),
    x.getUTCMonth(),
    x.getUTCDate(),
  );
}

function inclusiveVacationDays(startDate, endDate) {
  const a = utcDayStart(startDate);
  const b = utcDayStart(endDate);
  if (b < a) return 0;
  return Math.round((b - a) / 86400000) + 1;
}

/** Whole calendar days from hire date (UTC day) to target day (UTC day); same day = 0. */
function calendarDaysFromHireToDate(hireDate, targetDate) {
  if (!hireDate || !targetDate) return null;
  const h = utcDayStart(hireDate);
  const t = utcDayStart(targetDate);
  return Math.floor((t - h) / 86400000);
}

/**
 * Enforce minDaysAfterHire from policy (per kind). Each employee uses their own dateOfHire.
 */
function assertEligibleByHireDate(employee, kind, firstRequestDay, vacationRules, excuseRules) {
  if (employee.dateOfHire && utcDayStart(firstRequestDay) < utcDayStart(employee.dateOfHire)) {
    const err = new Error(
      kind === "VACATION"
        ? "Vacation cannot start before your hire date."
        : "Excuse date cannot be before your hire date.",
    );
    err.status = 400;
    throw err;
  }

  const minV = Math.max(0, Number(vacationRules?.minDaysAfterHire) || 0);
  const minE = Math.max(0, Number(excuseRules?.minDaysAfterHire) || 0);
  const min = kind === "VACATION" ? minV : minE;
  if (min <= 0) return;

  if (!employee.dateOfHire) {
    const err = new Error(
      "No hire date on your profile; HR must set date of hire before requests are allowed under this policy.",
    );
    err.status = 400;
    throw err;
  }

  const days = calendarDaysFromHireToDate(employee.dateOfHire, firstRequestDay);
  if (days == null || days < min) {
    const err = new Error(
      kind === "VACATION"
        ? `Vacation requests are allowed only after ${min} full calendar day(s) from your hire date (organization policy).`
        : `Excuse requests are allowed only after ${min} full calendar day(s) from your hire date (organization policy).`,
    );
    err.status = 400;
    throw err;
  }
}

function parseHHMM(s) {
  if (!s || typeof s !== "string") return null;
  const m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

function computeExcuseMinutes(startTime, endTime, roundingMinutes) {
  const a = parseHHMM(startTime);
  const b = parseHHMM(endTime);
  if (a == null || b == null || b <= a) return 0;
  let diff = b - a;
  const r = Math.max(1, Number(roundingMinutes) || 1);
  diff = Math.ceil(diff / r) * r;
  return diff;
}

/** Effective cap for one excuse: `maxHoursPerExcuse` (hours) wins over legacy `maxMinutesPerRequest`. */
function getMaxExcuseMinutesPerRequest(er) {
  const h = Number(er.maxHoursPerExcuse);
  if (Number.isFinite(h) && h > 0) return Math.round(h * 60);
  const m = Number(er.maxMinutesPerRequest);
  if (Number.isFinite(m) && m > 0) return m;
  return 8 * 60;
}

/**
 * Stable period key for counting excuses (UTC). WEEK = Monday-start week.
 * @param {Date} excuseDate
 * @param {string} periodRaw WEEK | MONTH | YEAR
 */
function excusePeriodKey(excuseDate, periodRaw) {
  const d = new Date(excuseDate);
  const p = String(periodRaw || "MONTH").toUpperCase();
  const y = d.getUTCFullYear();
  const mo = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  if (p === "YEAR") return `Y|${y}`;
  if (p === "MONTH") return `M|${y}-${String(mo).padStart(2, "0")}`;
  if (p === "WEEK") {
    const x = new Date(Date.UTC(y, mo - 1, day));
    const dow = x.getUTCDay();
    const mondayDelta = dow === 0 ? -6 : 1 - dow;
    x.setUTCDate(x.getUTCDate() + mondayDelta);
    return `W|${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, "0")}-${String(x.getUTCDate()).padStart(2, "0")}`;
  }
  return `M|${y}-${String(mo).padStart(2, "0")}`;
}

function normalizeExcuseLimitPeriod(er) {
  const p = String(er.excuseLimitPeriod || "MONTH").toUpperCase();
  if (p === "WEEK" || p === "MONTH" || p === "YEAR") return p;
  return "MONTH";
}

async function assertExcusePeriodCapacity(employeeId, excuseDate, er, excludeId) {
  const maxN = Math.max(0, Number(er.maxExcusesPerPeriod) || 0);
  if (maxN <= 0) return;
  const period = normalizeExcuseLimitPeriod(er);
  const newKey = excusePeriodKey(excuseDate, period);
  const others = await LeaveRequest.find({
    employeeId,
    kind: "EXCUSE",
    status: { $in: ["PENDING", "APPROVED"] },
  }).lean();
  let n = 0;
  for (const r of others) {
    if (excludeId && String(r._id) === String(excludeId)) continue;
    if (!r.excuseDate) continue;
    if (excusePeriodKey(r.excuseDate, period) === newKey) n += 1;
  }
  if (n >= maxN) {
    const err = new Error(
      `Excuse limit reached: maximum ${maxN} request(s) per ${period} (organization policy).`,
    );
    err.status = 400;
    throw err;
  }
}

/**
 * @param {import("../models/Employee.js").Employee} employee
 */
export async function resolveApproverEmails(employee) {
  const dept = await Department.findOne({ name: employee.department });
  let teamLeaderEmail = "";
  let managerEmail = (dept?.head || "").trim();

  if (dept && employee.team) {
    const teamDoc = await Team.findOne({
      departmentId: dept._id,
      name: employee.team,
    });
    if (teamDoc?.leaderEmail) teamLeaderEmail = teamDoc.leaderEmail.trim();
    else {
      const nested = (dept.teams || []).find(
        (t) => t.name === employee.team,
      );
      if (nested?.leaderEmail) teamLeaderEmail = nested.leaderEmail.trim();
    }
  }

  return { teamLeaderEmail, managerEmail };
}

function buildApprovalPipeline(
  teamLeaderEmail,
  managerEmail,
  employeeEmail,
) {
  const emp = normEmail(employeeEmail);
  const steps = [];
  if (teamLeaderEmail && normEmail(teamLeaderEmail) !== emp) {
    steps.push({
      role: "TEAM_LEADER",
      status: "PENDING",
    });
  }
  if (managerEmail && normEmail(managerEmail) !== emp) {
    steps.push({
      role: "MANAGER",
      status: "PENDING",
    });
  }
  steps.push({ role: "HR", status: "PENDING" });
  return steps;
}

function syncDocumentStatus(doc) {
  if (doc.status === "CANCELLED") return;
  if (doc.approvals.some((a) => a.status === "REJECTED")) {
    doc.status = "REJECTED";
    return;
  }
  if (doc.approvals.length && doc.approvals.every((a) => a.status === "APPROVED")) {
    doc.status = "APPROVED";
    return;
  }
  doc.status = "PENDING";
}

function vacationRange(doc) {
  if (doc.kind !== "VACATION" || !doc.startDate || !doc.endDate) return null;
  return {
    start: utcDayStart(doc.startDate),
    end: utcDayStart(doc.endDate),
  };
}

function excuseWindow(doc) {
  if (
    doc.kind !== "EXCUSE" ||
    !doc.excuseDate ||
    !doc.startTime ||
    !doc.endTime
  )
    return null;
  const day = utcDayStart(doc.excuseDate);
  const sm = parseHHMM(doc.startTime);
  const em = parseHHMM(doc.endTime);
  if (sm == null || em == null) return null;
  return { day, startMin: sm, endMin: em };
}

function rangesOverlapVacation(a, b) {
  if (!a || !b) return false;
  return a.start <= b.end && b.start <= a.end;
}

function excuseOverlapsExcuse(a, b) {
  if (!a || !b || a.day !== b.day) return false;
  return a.startMin < b.endMin && b.startMin < a.endMin;
}

function vacationOverlapsExcuse(v, e) {
  if (!v || !e) return false;
  if (e.day < v.start || e.day > v.end) return false;
  return true;
}

function requestsConflict(A, B) {
  const terminal = new Set(["REJECTED", "CANCELLED"]);
  if (terminal.has(A.status) || terminal.has(B.status)) return false;

  if (A.kind === "VACATION" && B.kind === "VACATION") {
    return rangesOverlapVacation(vacationRange(A), vacationRange(B));
  }
  if (A.kind === "EXCUSE" && B.kind === "EXCUSE") {
    return excuseOverlapsExcuse(excuseWindow(A), excuseWindow(B));
  }
  if (A.kind === "VACATION" && B.kind === "EXCUSE") {
    return vacationOverlapsExcuse(vacationRange(A), excuseWindow(B));
  }
  if (A.kind === "EXCUSE" && B.kind === "VACATION") {
    return vacationOverlapsExcuse(vacationRange(B), excuseWindow(A));
  }
  return false;
}

async function assertNoOverlap(employeeId, draft, excludeId) {
  const others = await LeaveRequest.find({
    employeeId,
    status: { $in: ["PENDING", "APPROVED"] },
  }).lean();
  for (const o of others) {
    if (excludeId && String(o._id) === String(excludeId)) continue;
    if (requestsConflict(draft, o)) {
      const err = new Error("Request overlaps an existing pending or approved request");
      err.status = 409;
      throw err;
    }
  }
}

/**
 * Sum HR-added annual leave credit days on an employee document or lean object.
 * @param {object} employee
 * @returns {number}
 */
export function sumAnnualLeaveCreditDays(employee) {
  const list = employee?.annualLeaveCredits;
  if (!Array.isArray(list) || list.length === 0) return 0;
  let s = 0;
  for (const c of list) {
    const n = Number(c?.days);
    if (Number.isFinite(n) && n > 0) s += n;
  }
  return Math.round(s);
}

async function aggregateUsage(employeeId, excludeId) {
  const reqs = await LeaveRequest.find({
    employeeId,
    status: { $in: ["PENDING", "APPROVED"] },
  }).lean();
  let usedApprovedDays = 0;
  let pendingReservedDays = 0;
  let usedApprovedMinutes = 0;
  let pendingReservedMinutes = 0;
  for (const r of reqs) {
    if (excludeId && String(r._id) === String(excludeId)) continue;
    const days = r.computed?.days ?? 0;
    const mins = r.computed?.minutes ?? 0;
    if (r.kind === "VACATION") {
      if (r.status === "APPROVED") usedApprovedDays += days;
      else pendingReservedDays += days;
    } else if (r.kind === "EXCUSE") {
      if (r.status === "APPROVED") usedApprovedMinutes += mins;
      else pendingReservedMinutes += mins;
    }
  }
  return {
    usedApprovedDays,
    pendingReservedDays,
    usedApprovedMinutes,
    pendingReservedMinutes,
  };
}

/**
 * @param {{ id: string, email: string, role: string }} user
 * @param {import("mongoose").Types.ObjectId | string} employeeId
 */
const MAX_ANNUAL_LEAVE_CREDIT_DAYS = 365;
const MAX_CREDIT_REASON_LENGTH = 500;

/**
 * HR-only: append a manual vacation day credit (formal / extra entitlement).
 * @param {{ id: string, email: string, role: string }} user
 * @param {{ employeeId: string, days: number, reason: string }} body
 */
export async function addAnnualLeaveCredit(user, body) {
  if (!HR_ROLES.has(user.role)) {
    const err = new Error("Forbidden: only HR or Admin can add leave credits");
    err.status = 403;
    throw err;
  }
  const employeeId = body?.employeeId;
  if (!employeeId) {
    const err = new Error("employeeId is required");
    err.status = 400;
    throw err;
  }
  const daysInt = Math.floor(Number(body?.days));
  if (
    !Number.isFinite(daysInt) ||
    daysInt < 1 ||
    daysInt > MAX_ANNUAL_LEAVE_CREDIT_DAYS
  ) {
    const err = new Error(
      `days must be an integer from 1 to ${MAX_ANNUAL_LEAVE_CREDIT_DAYS}`,
    );
    err.status = 400;
    throw err;
  }
  const reason = String(body?.reason ?? "").trim();
  if (!reason) {
    const err = new Error("reason is required");
    err.status = 400;
    throw err;
  }
  if (reason.length > MAX_CREDIT_REASON_LENGTH) {
    const err = new Error(
      `reason must be at most ${MAX_CREDIT_REASON_LENGTH} characters`,
    );
    err.status = 400;
    throw err;
  }

  const employee = await Employee.findById(employeeId);
  if (!employee) {
    const err = new Error("Employee not found");
    err.status = 404;
    throw err;
  }
  if (!employee.annualLeaveCredits) employee.annualLeaveCredits = [];
  employee.annualLeaveCredits.push({
    days: daysInt,
    reason,
    recordedBy: user.email,
    recordedAt: new Date(),
  });
  await employee.save();
  return getLeaveBalanceSnapshot(employeeId);
}

const MAX_BULK_EMPLOYEE_IDS = 500;
const MAX_BULK_TOTAL_TARGETS = 5000;
const BULK_ACTIVE_STATUSES = ["ACTIVE", "ON_LEAVE"];

/**
 * @param {unknown} body
 * @returns {{ daysInt: number, reason: string }}
 */
function parseAnnualLeaveCreditDaysAndReason(body) {
  const daysInt = Math.floor(Number(body?.days));
  if (
    !Number.isFinite(daysInt) ||
    daysInt < 1 ||
    daysInt > MAX_ANNUAL_LEAVE_CREDIT_DAYS
  ) {
    const err = new Error(
      `days must be an integer from 1 to ${MAX_ANNUAL_LEAVE_CREDIT_DAYS}`,
    );
    err.status = 400;
    throw err;
  }
  const reason = String(body?.reason ?? "").trim();
  if (!reason) {
    const err = new Error("reason is required");
    err.status = 400;
    throw err;
  }
  if (reason.length > MAX_CREDIT_REASON_LENGTH) {
    const err = new Error(
      `reason must be at most ${MAX_CREDIT_REASON_LENGTH} characters`,
    );
    err.status = 400;
    throw err;
  }
  return { daysInt, reason };
}

/**
 * HR: bulk manual vacation credits by department, explicit employee IDs, or (ADMIN only) all active staff.
 * @param {{ id: string, email: string, role: string }} user
 * @param {{
 *   days: number,
 *   reason: string,
 *   departmentId?: string,
 *   employeeIds?: string[],
 *   scope?: string,
 *   confirmAllEmployees?: boolean,
 * }} body
 */
export async function addAnnualLeaveCreditBulk(user, body) {
  if (!HR_ROLES.has(user.role)) {
    const err = new Error("Forbidden: only HR or Admin can add leave credits");
    err.status = 403;
    throw err;
  }
  const { daysInt, reason } = parseAnnualLeaveCreditDaysAndReason(body);

  const employeeIdsRaw = body?.employeeIds;
  const hasExplicitIds =
    Array.isArray(employeeIdsRaw) && employeeIdsRaw.length > 0;

  const entry = {
    days: daysInt,
    reason,
    recordedBy: user.email,
    recordedAt: new Date(),
  };

  const activeStatusFilter = { status: { $in: BULK_ACTIVE_STATUSES } };
  /** @type {string[]} */
  let targetIds = [];
  let scopeKind = "";
  let scopeDetail = "";

  if (hasExplicitIds) {
    const seen = new Set();
    for (const x of employeeIdsRaw) {
      const s = String(x ?? "").trim();
      if (!s || !mongoose.Types.ObjectId.isValid(s)) continue;
      seen.add(s);
    }
    targetIds = [...seen];
    if (targetIds.length === 0) {
      const err = new Error(
        "employeeIds must contain at least one valid MongoDB id",
      );
      err.status = 400;
      throw err;
    }
    if (targetIds.length > MAX_BULK_EMPLOYEE_IDS) {
      const err = new Error(
        `At most ${MAX_BULK_EMPLOYEE_IDS} employee ids per bulk credit request`,
      );
      err.status = 400;
      throw err;
    }
    scopeKind = "EMPLOYEE_IDS";
    scopeDetail = `${targetIds.length} selected`;
  } else if (body?.departmentId) {
    const dept = await Department.findById(body.departmentId);
    if (!dept) {
      const err = new Error("Department not found");
      err.status = 404;
      throw err;
    }
    const rows = await Employee.find({
      ...activeStatusFilter,
      $or: [
        { departmentId: dept._id },
        {
          $and: [
            {
              $or: [
                { departmentId: null },
                { departmentId: { $exists: false } },
              ],
            },
            { department: dept.name },
          ],
        },
      ],
    })
      .select("_id")
      .lean();
    targetIds = rows.map((r) => String(r._id));
    scopeKind = "DEPARTMENT";
    scopeDetail = dept.name || String(dept._id);
  } else if (body?.scope === "ALL" && body?.confirmAllEmployees === true) {
    if (user.role !== "ADMIN") {
      const err = new Error(
        "Forbidden: only Admin can credit all employees at once",
      );
      err.status = 403;
      throw err;
    }
    const rows = await Employee.find(activeStatusFilter).select("_id").lean();
    targetIds = rows.map((r) => String(r._id));
    scopeKind = "ALL";
    scopeDetail = "all active employees";
  } else {
    const err = new Error(
      "Provide departmentId, non-empty employeeIds, or scope ALL with confirmAllEmployees true",
    );
    err.status = 400;
    throw err;
  }

  if (targetIds.length > MAX_BULK_TOTAL_TARGETS) {
    const err = new Error(
      `Too many employees (${targetIds.length}). Maximum ${MAX_BULK_TOTAL_TARGETS} per request.`,
    );
    err.status = 400;
    throw err;
  }

  if (targetIds.length === 0) {
    return {
      updatedCount: 0,
      scopeKind,
      scopeDetail,
      message: "No matching employees",
    };
  }

  const CHUNK = 250;
  let updatedCount = 0;
  for (let i = 0; i < targetIds.length; i += CHUNK) {
    const chunk = targetIds.slice(i, i + CHUNK).map((id) => new mongoose.Types.ObjectId(id));
    const filter =
      scopeKind === "EMPLOYEE_IDS"
        ? { _id: { $in: chunk } }
        : { _id: { $in: chunk }, ...activeStatusFilter };
    const res = await Employee.updateMany(filter, {
      $push: { annualLeaveCredits: entry },
    });
    updatedCount += res.modifiedCount ?? 0;
  }

  return {
    updatedCount,
    scopeKind,
    scopeDetail,
    days: daysInt,
  };
}

export async function assertCanViewEmployeeLeaveBalance(user, employeeId) {
  if (String(user.id) === String(employeeId)) return;
  if (HR_ROLES.has(user.role)) return;
  const subject = await Employee.findById(employeeId);
  if (!subject) {
    const err = new Error("Employee not found");
    err.status = 404;
    throw err;
  }
  const ctx = await resolveApproverEmails(subject);
  if (normEmail(ctx.teamLeaderEmail) === normEmail(user.email)) return;
  if (normEmail(ctx.managerEmail) === normEmail(user.email)) return;
  const err = new Error("Forbidden");
  err.status = 403;
  throw err;
}

/**
 * Soft-balance snapshot from policy entitlements minus approved + pending LeaveRequests.
 * @param {import("mongoose").Types.ObjectId | string} employeeId
 */
export async function getLeaveBalanceSnapshot(employeeId) {
  const employee = await Employee.findById(employeeId);
  if (!employee) {
    const err = new Error("Employee not found");
    err.status = 404;
    throw err;
  }
  const policyDoc = await getDefaultPolicyDoc();
  const active = resolveActiveLeavePolicy(policyDoc?.leavePolicies || []);
  const baseEntitlementDays = Number(active.vacationRules.annualDays) || 21;
  const bonusDays = sumAnnualLeaveCreditDays(employee.toObject?.() ?? employee);
  const entitlementDays = baseEntitlementDays + bonusDays;
  const entitlementMinutes = Number(active.excuseRules.maxMinutesPerMonth) || 40 * 60;

  const usage = await aggregateUsage(employeeId, null);
  const remainingDays =
    entitlementDays - usage.usedApprovedDays - usage.pendingReservedDays;
  const remainingMinutes =
    entitlementMinutes -
    usage.usedApprovedMinutes -
    usage.pendingReservedMinutes;

  const MAX_CREDIT_HISTORY = 200;
  const credits = [...(employee.annualLeaveCredits || [])]
    .sort(
      (a, b) =>
        new Date(b.recordedAt || 0).getTime() -
        new Date(a.recordedAt || 0).getTime(),
    )
    .slice(0, MAX_CREDIT_HISTORY)
    .map((c) => ({
      days: c.days,
      reason: c.reason,
      recordedBy: c.recordedBy,
      recordedAt: c.recordedAt,
    }));

  return {
    employeeId: String(employeeId),
    vacation: {
      baseEntitlementDays,
      bonusDays,
      entitlementDays,
      approvedDays: usage.usedApprovedDays,
      pendingDays: usage.pendingReservedDays,
      remainingDays,
      credits,
    },
    excuse: {
      entitlementMinutes,
      approvedMinutes: usage.usedApprovedMinutes,
      pendingMinutes: usage.pendingReservedMinutes,
      remainingMinutes,
    },
  };
}

function userCanActOnPendingStep(userEmail, userRole, stepRole, ctx) {
  const u = normEmail(userEmail);
  if (stepRole === "TEAM_LEADER") {
    return ctx.teamLeaderEmail && normEmail(ctx.teamLeaderEmail) === u;
  }
  if (stepRole === "MANAGER") {
    return ctx.managerEmail && normEmail(ctx.managerEmail) === u;
  }
  if (stepRole === "HR") {
    return HR_ROLES.has(userRole);
  }
  return false;
}

function firstPendingIndex(approvals) {
  return approvals.findIndex((a) => a.status === "PENDING");
}

/**
 * @param {{ id: string, email: string, role: string }} user
 */
export async function createLeaveRequest(user, body) {
  const employee = await Employee.findById(user.id);
  if (!employee) {
    const err = new Error("Employee not found");
    err.status = 404;
    throw err;
  }

  const kind = body.kind;
  if (kind !== "VACATION" && kind !== "EXCUSE") {
    const err = new Error("Invalid kind");
    err.status = 400;
    throw err;
  }

  const policyDoc = await getDefaultPolicyDoc();
  if (!policyDoc) {
    const err = new Error("Organization policy not configured");
    err.status = 500;
    throw err;
  }

  const policySnapshot = buildPolicySnapshot(policyDoc, kind);
  const vr = policySnapshot.vacationRules;
  const er = policySnapshot.excuseRules;

  let startDate;
  let endDate;
  let excuseDate;
  let leaveType;
  let computed = { days: 0, minutes: 0 };

  if (kind === "VACATION") {
    leaveType = body.leaveType || "ANNUAL";
    startDate = parseYmdToUtcNoon(body.startDate);
    endDate = parseYmdToUtcNoon(body.endDate);
    if (!startDate || !endDate) {
      const err = new Error("startDate and endDate are required (YYYY-MM-DD)");
      err.status = 400;
      throw err;
    }
    if (utcDayStart(endDate) < utcDayStart(startDate)) {
      const err = new Error("endDate must be on or after startDate");
      err.status = 400;
      throw err;
    }
    computed.days = inclusiveVacationDays(startDate, endDate);
    const maxC = Number(vr.maxConsecutiveDays) || 365;
    if (computed.days > maxC) {
      const err = new Error(`Vacation exceeds max consecutive days (${maxC})`);
      err.status = 400;
      throw err;
    }
  } else {
    excuseDate = parseYmdToUtcNoon(body.excuseDate || body.date);
    if (!excuseDate) {
      const err = new Error("excuseDate is required (YYYY-MM-DD)");
      err.status = 400;
      throw err;
    }
    if (!body.startTime || !body.endTime) {
      const err = new Error("startTime and endTime are required (HH:mm)");
      err.status = 400;
      throw err;
    }
    computed.minutes = computeExcuseMinutes(
      body.startTime,
      body.endTime,
      er.roundingMinutes,
    );
    if (computed.minutes <= 0) {
      const err = new Error("Invalid excuse time range");
      err.status = 400;
      throw err;
    }
    const maxR = getMaxExcuseMinutesPerRequest(er);
    if (computed.minutes > maxR) {
      const hours = (maxR / 60).toFixed(maxR % 60 === 0 ? 0 : 1);
      const err = new Error(
        `Excuse exceeds max length for one request (${hours} hour(s) / ${maxR} minutes per policy).`,
      );
      err.status = 400;
      throw err;
    }
    await assertExcusePeriodCapacity(employee._id, excuseDate, er, null);
  }

  const firstDay = kind === "VACATION" ? startDate : excuseDate;
  assertEligibleByHireDate(employee, kind, firstDay, vr, er);

  const { teamLeaderEmail, managerEmail } =
    await resolveApproverEmails(employee);
  const approvals = buildApprovalPipeline(
    teamLeaderEmail,
    managerEmail,
    employee.email,
  );

  const draft = {
    kind,
    startDate,
    endDate,
    excuseDate,
    startTime: body.startTime,
    endTime: body.endTime,
    status: "PENDING",
    computed,
  };

  await assertNoOverlap(employee._id, draft, null);

  const usage = await aggregateUsage(employee._id, null);
  const baseEntitlementDays = Number(vr.annualDays) || 21;
  const bonusDays = sumAnnualLeaveCreditDays(employee);
  const entitlementDays = baseEntitlementDays + bonusDays;
  const entitlementMinutes = Number(er.maxMinutesPerMonth) || 40 * 60;

  const doc = new LeaveRequest({
    employeeId: employee._id,
    employeeEmail: employee.email,
    kind,
    leaveType: kind === "VACATION" ? leaveType : undefined,
    startDate: kind === "VACATION" ? startDate : undefined,
    endDate: kind === "VACATION" ? endDate : undefined,
    excuseDate: kind === "EXCUSE" ? excuseDate : undefined,
    startTime: kind === "EXCUSE" ? body.startTime : undefined,
    endTime: kind === "EXCUSE" ? body.endTime : undefined,
    computed,
    status: "PENDING",
    approvals,
    policySnapshot,
    balanceContext: {
      baseEntitlementDays,
      bonusDays,
      entitlementDays,
      entitlementMinutes,
      usedApprovedDays: usage.usedApprovedDays,
      usedApprovedMinutes: usage.usedApprovedMinutes,
      pendingReservedDays: usage.pendingReservedDays + computed.days,
      pendingReservedMinutes:
        usage.pendingReservedMinutes + computed.minutes,
    },
    createdBy: user.email,
    lastUpdatedAt: new Date(),
    lastUpdatedBy: user.email,
  });

  syncDocumentStatus(doc);
  await doc.save();
  return doc;
}

/**
 * @param {{ id: string, email: string, role: string }} user
 * @param {{ status?: string, queue?: string, page?: number, limit?: number, employeeId?: string }} query
 */
export async function listLeaveRequests(user, query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const filter = {};
  if (query.status) filter.status = query.status;

  if (query.mine === "true" || query.mine === "1") {
    filter.employeeId = user.id;
    const total = await LeaveRequest.countDocuments(filter);
    const list = await LeaveRequest.find(filter)
      .sort({ submittedAt: -1 })
      .skip(skip)
      .limit(limit);
    return {
      requests: list,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  if (query.queue === "true" || query.queue === "1") {
    const employee = await Employee.findById(user.id);
    if (!employee) {
      const err = new Error("Employee not found");
      err.status = 404;
      throw err;
    }
    const ctx = await resolveApproverEmails(employee);

    const allPending = await LeaveRequest.find({
      ...filter,
      status: "PENDING",
    })
      .sort({ submittedAt: 1 })
      .lean();

    const actionable = [];
    for (const r of allPending) {
      const idx = firstPendingIndex(r.approvals || []);
      if (idx < 0) continue;
      const step = r.approvals[idx];
      const emp = await Employee.findById(r.employeeId).lean();
      const empCtx = emp
        ? await resolveApproverEmails(emp)
        : { teamLeaderEmail: "", managerEmail: "" };
      if (
        userCanActOnPendingStep(
          user.email,
          user.role,
          step.role,
          empCtx,
        )
      ) {
        actionable.push(r._id);
      }
    }

    const list = await LeaveRequest.find({
      _id: { $in: actionable },
    })
      .sort({ submittedAt: 1 })
      .skip(skip)
      .limit(limit);

    const total = actionable.length;
    const balanceByEmployeeId = {};
    const seen = new Set();
    for (const doc of list) {
      const eid = String(doc.employeeId);
      if (seen.has(eid)) continue;
      seen.add(eid);
      try {
        balanceByEmployeeId[eid] = await getLeaveBalanceSnapshot(eid);
      } catch {
        /* skip if employee missing */
      }
    }
    return {
      requests: list,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      balanceByEmployeeId,
    };
  }

  if (query.employeeId) {
    await assertCanViewEmployeeLeaveBalance(user, query.employeeId);
    filter.employeeId = query.employeeId;
    const total = await LeaveRequest.countDocuments(filter);
    const list = await LeaveRequest.find(filter)
      .sort({ submittedAt: -1 })
      .skip(skip)
      .limit(limit);
    return {
      requests: list,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  if (HR_ROLES.has(user.role)) {
    const total = await LeaveRequest.countDocuments(filter);
    const list = await LeaveRequest.find(filter)
      .sort({ submittedAt: -1 })
      .skip(skip)
      .limit(limit);
    return {
      requests: list,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  filter.employeeId = user.id;
  const total = await LeaveRequest.countDocuments(filter);
  const list = await LeaveRequest.find(filter)
    .sort({ submittedAt: -1 })
    .skip(skip)
    .limit(limit);

  return {
    requests: list,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

/**
 * @param {{ id: string, email: string, role: string }} user
 */
export async function applyLeaveRequestAction(requestId, user, action, comment) {
  const doc = await LeaveRequest.findById(requestId);
  if (!doc) {
    const err = new Error("Leave request not found");
    err.status = 404;
    throw err;
  }

  if (doc.status === "CANCELLED" || doc.status === "REJECTED") {
    return doc;
  }
  if (doc.status === "APPROVED") {
    return doc;
  }

  const act = String(action || "").toUpperCase();
  if (act !== "APPROVE" && act !== "REJECT") {
    const err = new Error("Invalid action");
    err.status = 400;
    throw err;
  }

  if (act === "REJECT") {
    const c = (comment || "").trim();
    if (!c) {
      const err = new Error("comment is required for rejection");
      err.status = 400;
      throw err;
    }
  }

  const idx = firstPendingIndex(doc.approvals);
  if (idx < 0) {
    return doc;
  }

  const step = doc.approvals[idx];
  if (step.status !== "PENDING") {
    return doc;
  }

  const subject = await Employee.findById(doc.employeeId);
  if (!subject) {
    const err = new Error("Subject employee not found");
    err.status = 404;
    throw err;
  }
  const ctx = await resolveApproverEmails(subject);

  if (!userCanActOnPendingStep(user.email, user.role, step.role, ctx)) {
    const err = new Error("Not authorized for this approval step");
    err.status = 403;
    throw err;
  }

  if (act === "APPROVE") {
    step.status = "APPROVED";
    step.processedBy = user.email;
    step.processedAt = new Date();
  } else {
    step.status = "REJECTED";
    step.processedBy = user.email;
    step.processedAt = new Date();
    step.comment = (comment || "").trim();
  }

  syncDocumentStatus(doc);
  doc.lastUpdatedAt = new Date();
  doc.lastUpdatedBy = user.email;
  await doc.save();
  return doc;
}

/**
 * @param {{ id: string, email: string, role: string }} user
 */
export async function cancelLeaveRequest(requestId, user) {
  const doc = await LeaveRequest.findById(requestId);
  if (!doc) {
    const err = new Error("Leave request not found");
    err.status = 404;
    throw err;
  }

  if (doc.status === "CANCELLED") {
    return doc;
  }

  const isOwner = String(doc.employeeId) === String(user.id);
  const isHr = HR_ROLES.has(user.role);

  if (doc.status === "PENDING") {
    if (!isOwner && !isHr) {
      const err = new Error("Only the employee or HR can cancel a pending request");
      err.status = 403;
      throw err;
    }
  } else if (doc.status === "APPROVED") {
    if (!isHr) {
      const err = new Error("Only HR can cancel an approved request");
      err.status = 403;
      throw err;
    }
  } else {
    const err = new Error("Request cannot be cancelled");
    err.status = 400;
    throw err;
  }

  doc.status = "CANCELLED";
  doc.lastUpdatedAt = new Date();
  doc.lastUpdatedBy = user.email;
  await doc.save();
  return doc;
}

export async function getLeaveRequestById(requestId, user) {
  const doc = await LeaveRequest.findById(requestId);
  if (!doc) {
    const err = new Error("Leave request not found");
    err.status = 404;
    throw err;
  }
  if (String(doc.employeeId) === String(user.id)) return doc;
  if (HR_ROLES.has(user.role)) return doc;

  const subject = await Employee.findById(doc.employeeId);
  if (!subject) {
    const err = new Error("Forbidden");
    err.status = 403;
    throw err;
  }
  const ctx = await resolveApproverEmails(subject);
  if (normEmail(ctx.teamLeaderEmail) === normEmail(user.email)) return doc;
  if (normEmail(ctx.managerEmail) === normEmail(user.email)) return doc;

  const err = new Error("Forbidden");
  err.status = 403;
  throw err;
}
