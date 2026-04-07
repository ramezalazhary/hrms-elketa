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
  resolveAnnualDaysForEmployee,
  isFirstVacationYear,
  getCompanyMonthStartDay,
  excusePeriodKeyUtc,
} from "./leavePolicyService.js";
import { Attendance } from "../models/Attendance.js";
import {
  parseTimeToMinutes,
  excuseCoversLateCheckIn,
} from "../utils/excuseAttendance.js";
import { ApiError } from "../utils/ApiError.js";

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
 * Informational only — requests are never blocked; HR decides. `preEligibility` mirrors `!eligible`.
 */
function computeEligibility(employee, kind, firstRequestDay, vacationRules, excuseRules) {
  if (employee.dateOfHire && utcDayStart(firstRequestDay) < utcDayStart(employee.dateOfHire)) {
    return {
      eligible: false,
      reason:
        kind === "VACATION"
          ? "Dates cannot start before hire date."
          : "Excuse date cannot be before hire date.",
      eligibleAfterDate: employee.dateOfHire,
      daysUntilEligible: null,
    };
  }

  const minV = Math.max(0, Number(vacationRules?.minDaysAfterHire) || 0);
  const minE = Math.max(0, Number(excuseRules?.minDaysAfterHire) || 0);
  const min = kind === "VACATION" ? minV : minE;
  if (min <= 0) {
    return {
      eligible: true,
      reason: "",
      eligibleAfterDate: null,
      daysUntilEligible: null,
    };
  }

  if (!employee.dateOfHire) {
    return {
      eligible: false,
      reason:
        "No hire date on profile; policy requires days after hire — HR can still review.",
      eligibleAfterDate: null,
      daysUntilEligible: null,
    };
  }

  const days = calendarDaysFromHireToDate(employee.dateOfHire, firstRequestDay);
  if (days == null || days < min) {
    const hire = new Date(employee.dateOfHire);
    const eligibleAfter = new Date(hire);
    eligibleAfter.setUTCDate(eligibleAfter.getUTCDate() + min);
    const need = min - (days ?? 0);
    return {
      eligible: false,
      reason: `Policy: ${min} full calendar day(s) after hire before ${kind === "VACATION" ? "vacation" : "excuse"} (informational).`,
      eligibleAfterDate: eligibleAfter,
      daysUntilEligible: need > 0 ? need : 0,
    };
  }

  return {
    eligible: true,
    reason: "",
    eligibleAfterDate: null,
    daysUntilEligible: null,
  };
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

function normalizeExcuseLimitPeriod(er) {
  const p = String(er.excuseLimitPeriod || "MONTH").toUpperCase();
  if (p === "WEEK" || p === "MONTH" || p === "YEAR") return p;
  return "MONTH";
}

async function assertExcusePeriodCapacity(
  employeeId,
  excuseDate,
  er,
  excludeId,
  companyMonthStartDay,
) {
  const maxN = Math.max(0, Number(er.maxExcusesPerPeriod) || 0);
  if (maxN <= 0) return;
  const period = normalizeExcuseLimitPeriod(er);
  const newKey = excusePeriodKeyUtc(excuseDate, period, companyMonthStartDay);
  const others = await LeaveRequest.find({
    employeeId,
    kind: "EXCUSE",
    status: { $in: ["PENDING", "APPROVED"] },
  }).lean();
  let n = 0;
  for (const r of others) {
    if (excludeId && String(r._id) === String(excludeId)) continue;
    if (!r.excuseDate) continue;
    if (
      excusePeriodKeyUtc(r.excuseDate, period, companyMonthStartDay) === newKey
    ) {
      n += 1;
    }
  }
  if (n >= maxN) {
    throw new ApiError(400, `Excuse limit reached: maximum ${maxN} request(s) per ${period} (organization policy).`,);
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

/** HR first; then one MANAGEMENT step (team leader OR manager may act). */
function buildApprovalPipeline(teamLeaderEmail, managerEmail, employeeEmail) {
  const emp = normEmail(employeeEmail);
  const tlOk = teamLeaderEmail && normEmail(teamLeaderEmail) !== emp;
  const mgrOk = managerEmail && normEmail(managerEmail) !== emp;
  const hasMgmt = tlOk || mgrOk;
  const steps = [{ role: "HR", status: "PENDING" }];
  if (hasMgmt) {
    steps.push({ role: "MANAGEMENT", status: "PENDING" });
  }
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
      throw new ApiError(409, "Request overlaps an existing pending or approved request");
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

/**
 * @param {object} [usageOpts]
 * @param {boolean} [usageOpts.filterExcuseToFiscalMonth] Only count EXCUSE minutes in the fiscal month of `balanceAnchorDate`
 * @param {number} [usageOpts.companyMonthStartDay]
 * @param {Date} [usageOpts.balanceAnchorDate]
 */
async function aggregateUsage(employeeId, excludeId, usageOpts = {}) {
  const reqs = await LeaveRequest.find({
    employeeId,
    status: { $in: ["PENDING", "APPROVED"] },
  }).lean();
  let usedApprovedDays = 0;
  let pendingReservedDays = 0;
  let usedApprovedMinutes = 0;
  let pendingReservedMinutes = 0;

  const filterExcuse = Boolean(usageOpts.filterExcuseToFiscalMonth);
  const monthStart = getCompanyMonthStartDay({
    companyMonthStartDay: usageOpts.companyMonthStartDay,
  });
  const anchor = usageOpts.balanceAnchorDate
    ? new Date(usageOpts.balanceAnchorDate)
    : new Date();
  const currentExcuseMonthKey = filterExcuse
    ? excusePeriodKeyUtc(anchor, "MONTH", monthStart)
    : null;

  for (const r of reqs) {
    if (excludeId && String(r._id) === String(excludeId)) continue;
    if (r.preEligibility) continue;
    const days = r.computed?.days ?? 0;
    const mins = r.computed?.minutes ?? 0;
    if (r.kind === "VACATION") {
      if (r.status === "APPROVED") usedApprovedDays += days;
      else pendingReservedDays += days;
    } else if (r.kind === "EXCUSE") {
      if (filterExcuse) {
        const rk = excusePeriodKeyUtc(r.excuseDate, "MONTH", monthStart);
        if (rk !== currentExcuseMonthKey) continue;
      }
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
    throw new ApiError(403, "Forbidden: only HR or Admin can add leave credits");
  }
  const employeeId = body?.employeeId;
  if (!employeeId) {
    throw new ApiError(400, "employeeId is required");
  }
  const daysInt = Math.floor(Number(body?.days));
  if (
    !Number.isFinite(daysInt) ||
    daysInt < 1 ||
    daysInt > MAX_ANNUAL_LEAVE_CREDIT_DAYS
  ) {
    throw new ApiError(400, `days must be an integer from 1 to ${MAX_ANNUAL_LEAVE_CREDIT_DAYS}`,);
  }
  const reason = String(body?.reason ?? "").trim();
  if (!reason) {
    throw new ApiError(400, "reason is required");
  }
  if (reason.length > MAX_CREDIT_REASON_LENGTH) {
    throw new ApiError(400, `reason must be at most ${MAX_CREDIT_REASON_LENGTH} characters`,);
  }

  const employee = await Employee.findById(employeeId);
  if (!employee) {
    throw new ApiError(404, "Employee not found");
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
    throw new ApiError(400, `days must be an integer from 1 to ${MAX_ANNUAL_LEAVE_CREDIT_DAYS}`,);
  }
  const reason = String(body?.reason ?? "").trim();
  if (!reason) {
    throw new ApiError(400, "reason is required");
  }
  if (reason.length > MAX_CREDIT_REASON_LENGTH) {
    throw new ApiError(400, `reason must be at most ${MAX_CREDIT_REASON_LENGTH} characters`,);
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
    throw new ApiError(403, "Forbidden: only HR or Admin can add leave credits");
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
      throw new ApiError(400, "employeeIds must contain at least one valid MongoDB id",);
    }
    if (targetIds.length > MAX_BULK_EMPLOYEE_IDS) {
      throw new ApiError(400, `At most ${MAX_BULK_EMPLOYEE_IDS} employee ids per bulk credit request`,);
    }
    scopeKind = "EMPLOYEE_IDS";
    scopeDetail = `${targetIds.length} selected`;
  } else if (body?.departmentId) {
    const dept = await Department.findById(body.departmentId);
    if (!dept) {
      throw new ApiError(404, "Department not found");
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
      throw new ApiError(403, "Forbidden: only Admin can credit all employees at once",);
    }
    const rows = await Employee.find(activeStatusFilter).select("_id").lean();
    targetIds = rows.map((r) => String(r._id));
    scopeKind = "ALL";
    scopeDetail = "all active employees";
  } else {
    throw new ApiError(400, "Provide departmentId, non-empty employeeIds, or scope ALL with confirmAllEmployees true",);
  }

  if (targetIds.length > MAX_BULK_TOTAL_TARGETS) {
    throw new ApiError(400, `Too many employees (${targetIds.length}). Maximum ${MAX_BULK_TOTAL_TARGETS} per request.`,);
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
    throw new ApiError(404, "Employee not found");
  }
  const ctx = await resolveApproverEmails(subject);
  if (normEmail(ctx.teamLeaderEmail) === normEmail(user.email)) return;
  if (normEmail(ctx.managerEmail) === normEmail(user.email)) return;
  throw new ApiError(403, "Forbidden");
}

/**
 * Soft-balance snapshot from policy entitlements minus approved + pending LeaveRequests.
 * @param {import("mongoose").Types.ObjectId | string} employeeId
 */
export async function getLeaveBalanceSnapshot(employeeId) {
  const employee = await Employee.findById(employeeId);
  if (!employee) {
    throw new ApiError(404, "Employee not found");
  }
  const policyDoc = await getDefaultPolicyDoc();
  const active = resolveActiveLeavePolicy(policyDoc?.leavePolicies || []);
  const vr = active.vacationRules;
  const baseEntitlementDays = resolveAnnualDaysForEmployee(employee, vr);
  const bonusDays = sumAnnualLeaveCreditDays(employee.toObject?.() ?? employee);
  const entitlementDays = baseEntitlementDays + bonusDays;
  const firstVacationYear = isFirstVacationYear(employee, vr);
  const entitlementMinutes = Number(active.excuseRules.maxMinutesPerMonth) || 40 * 60;
  const companyMonthStartDay = getCompanyMonthStartDay(policyDoc);

  const usage = await aggregateUsage(employeeId, null, {
    filterExcuseToFiscalMonth: true,
    companyMonthStartDay,
    balanceAnchorDate: new Date(),
  });
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
      firstVacationYear,
      entitlementVariesByYear: Boolean(vr?.entitlementVariesByYear),
    },
    excuse: {
      entitlementMinutes,
      approvedMinutes: usage.usedApprovedMinutes,
      pendingMinutes: usage.pendingReservedMinutes,
      remainingMinutes,
      companyMonthStartDay,
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
  if (stepRole === "MANAGEMENT") {
    const tl = ctx.teamLeaderEmail && normEmail(ctx.teamLeaderEmail) === u;
    const mgr = ctx.managerEmail && normEmail(ctx.managerEmail) === u;
    return tl || mgr;
  }
  if (stepRole === "HR") {
    return HR_ROLES.has(userRole);
  }
  return false;
}

function firstPendingIndex(approvals) {
  return approvals.findIndex((a) => a.status === "PENDING");
}

async function syncApprovedExcuseToAttendance(leaveDoc) {
  if (leaveDoc.kind !== "EXCUSE" || leaveDoc.status !== "APPROVED") return;
  const day = new Date(leaveDoc.excuseDate);
  day.setUTCHours(0, 0, 0, 0);
  const att = await Attendance.findOne({
    employeeId: leaveDoc.employeeId,
    date: day,
  });
  if (!att || att.status !== "LATE") return;
  const emp = await Employee.findById(leaveDoc.employeeId).populate(
    "departmentId",
  );
  if (!emp) return;
  const dept = emp.departmentId;
  const standardStartTime = dept?.standardStartTime || "09:00";
  const gracePeriod = dept?.gracePeriod ?? 15;
  const shiftStartMin = parseTimeToMinutes(standardStartTime);
  const checkInMin = parseTimeToMinutes(att.checkIn);
  const es = parseTimeToMinutes(leaveDoc.startTime);
  const ee = parseTimeToMinutes(leaveDoc.endTime);
  if (
    shiftStartMin == null ||
    checkInMin == null ||
    es == null ||
    ee == null
  ) {
    return;
  }
  if (
    !excuseCoversLateCheckIn(
      checkInMin,
      es,
      ee,
      shiftStartMin,
      gracePeriod,
    )
  ) {
    return;
  }
  att.status = "EXCUSED";
  att.excuseCovered = true;
  att.excuseLeaveRequestId = leaveDoc._id;
  await att.save();
}

/**
 * @param {{ id: string, email: string, role: string }} user
 */
export async function createLeaveRequest(user, body) {
  const employee = await Employee.findById(user.id);
  if (!employee) {
    throw new ApiError(404, "Employee not found");
  }

  const kind = body.kind;
  if (kind !== "VACATION" && kind !== "EXCUSE") {
    throw new ApiError(400, "Invalid kind");
  }

  const policyDoc = await getDefaultPolicyDoc();
  if (!policyDoc) {
    throw new ApiError(500, "Organization policy not configured");
  }

  const policySnapshot = buildPolicySnapshot(policyDoc, kind);
  const vr = policySnapshot.vacationRules;
  const er = policySnapshot.excuseRules;
  const companyMonthStartDay = getCompanyMonthStartDay(policyDoc);

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
      throw new ApiError(400, "startDate and endDate are required (YYYY-MM-DD)");
    }
    if (utcDayStart(endDate) < utcDayStart(startDate)) {
      throw new ApiError(400, "endDate must be on or after startDate");
    }
    computed.days = inclusiveVacationDays(startDate, endDate);
    const maxC = Number(vr.maxConsecutiveDays) || 365;
    if (computed.days > maxC) {
      throw new ApiError(400, `Vacation exceeds max consecutive days (${maxC})`);
    }
  } else {
    excuseDate = parseYmdToUtcNoon(body.excuseDate || body.date);
    if (!excuseDate) {
      throw new ApiError(400, "excuseDate is required (YYYY-MM-DD)");
    }
    if (!body.startTime || !body.endTime) {
      throw new ApiError(400, "startTime and endTime are required (HH:mm)");
    }
    computed.minutes = computeExcuseMinutes(
      body.startTime,
      body.endTime,
      er.roundingMinutes,
    );
    if (computed.minutes <= 0) {
      throw new ApiError(400, "Invalid excuse time range");
    }
    const maxR = getMaxExcuseMinutesPerRequest(er);
    if (computed.minutes > maxR) {
      const hours = (maxR / 60).toFixed(maxR % 60 === 0 ? 0 : 1);
      throw new ApiError(400, `Excuse exceeds max length for one request (${hours} hour(s) / ${maxR} minutes per policy).`,);
    }
    await assertExcusePeriodCapacity(
      employee._id,
      excuseDate,
      er,
      null,
      companyMonthStartDay,
    );
  }

  const firstDay = kind === "VACATION" ? startDate : excuseDate;
  const eligibility = computeEligibility(employee, kind, firstDay, vr, er);
  const preEligibility = !eligibility.eligible;

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

  const usage = await aggregateUsage(employee._id, null, {
    filterExcuseToFiscalMonth: true,
    companyMonthStartDay,
    balanceAnchorDate: new Date(),
  });
  const baseEntitlementDays = resolveAnnualDaysForEmployee(employee, vr);
  const bonusDays = sumAnnualLeaveCreditDays(employee);
  const entitlementDays = baseEntitlementDays + bonusDays;
  const entitlementMinutes = Number(er.maxMinutesPerMonth) || 40 * 60;
  const pendingAddDays =
    kind === "VACATION" && !preEligibility ? computed.days : 0;
  const pendingAddMins =
    kind === "EXCUSE" && !preEligibility ? computed.minutes : 0;

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
    eligibility,
    preEligibility,
    balanceContext: {
      baseEntitlementDays,
      bonusDays,
      entitlementDays,
      entitlementMinutes,
      usedApprovedDays: usage.usedApprovedDays,
      usedApprovedMinutes: usage.usedApprovedMinutes,
      pendingReservedDays: usage.pendingReservedDays + pendingAddDays,
      pendingReservedMinutes:
        usage.pendingReservedMinutes + pendingAddMins,
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
      throw new ApiError(404, "Employee not found");
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
    throw new ApiError(404, "Leave request not found");
  }

  if (doc.status === "CANCELLED" || doc.status === "REJECTED") {
    return doc;
  }
  if (doc.status === "APPROVED") {
    return doc;
  }

  const act = String(action || "").toUpperCase();
  if (act !== "APPROVE" && act !== "REJECT") {
    throw new ApiError(400, "Invalid action");
  }

  if (act === "REJECT") {
    const c = (comment || "").trim();
    if (!c) {
      throw new ApiError(400, "comment is required for rejection");
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
    throw new ApiError(404, "Subject employee not found");
  }
  const ctx = await resolveApproverEmails(subject);

  if (!userCanActOnPendingStep(user.email, user.role, step.role, ctx)) {
    throw new ApiError(403, "Not authorized for this approval step");
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
  if (doc.status === "APPROVED" && doc.kind === "EXCUSE") {
    await syncApprovedExcuseToAttendance(doc);
  }
  return doc;
}

/**
 * @param {{ id: string, email: string, role: string }} user
 */
export async function cancelLeaveRequest(requestId, user) {
  const doc = await LeaveRequest.findById(requestId);
  if (!doc) {
    throw new ApiError(404, "Leave request not found");
  }

  if (doc.status === "CANCELLED") {
    return doc;
  }

  const isOwner = String(doc.employeeId) === String(user.id);
  const isHr = HR_ROLES.has(user.role);

  if (doc.status === "PENDING") {
    if (!isOwner && !isHr) {
      throw new ApiError(403, "Only the employee or HR can cancel a pending request");
    }
  } else if (doc.status === "APPROVED") {
    if (!isHr) {
      throw new ApiError(403, "Only HR can cancel an approved request");
    }
  } else {
    throw new ApiError(400, "Request cannot be cancelled");
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
    throw new ApiError(404, "Leave request not found");
  }
  if (String(doc.employeeId) === String(user.id)) return doc;
  if (HR_ROLES.has(user.role)) return doc;

  const subject = await Employee.findById(doc.employeeId);
  if (!subject) {
    throw new ApiError(403, "Forbidden");
  }
  const ctx = await resolveApproverEmails(subject);
  if (normEmail(ctx.teamLeaderEmail) === normEmail(user.email)) return doc;
  if (normEmail(ctx.managerEmail) === normEmail(user.email)) return doc;

  throw new ApiError(403, "Forbidden");
}
