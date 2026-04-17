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
  resolveEffectiveExcuseMonthlyEntitlementMinutes,
  resolveMaxExcuseMinutesPerRequest,
} from "./leavePolicyService.js";
import { Attendance } from "../models/Attendance.js";
import {
  parseTimeToMinutes,
  excuseCoversLateCheckIn,
} from "../utils/excuseAttendance.js";
import { weeklyRestDaySet } from "../utils/weeklyRestDays.js";
import { ApiError } from "../utils/ApiError.js";
import { OrganizationPolicy } from "../models/OrganizationPolicy.js";
import { createAuditLog } from "./auditService.js";
import { mongoSupportsTransactions } from "../utils/mongoTransactions.js";
import { resolveEmployeeScopeIds } from "./scopeService.js";

const HR_ROLES = new Set(["HR", "HR_STAFF", "HR_MANAGER", "ADMIN"]);
const FORCE_APPROVE_ROLES = new Set(["HR_MANAGER", "ADMIN"]);
const DIRECT_RECORD_ROLES = new Set(["HR_MANAGER", "ADMIN"]);
const APPROVED_CANCEL_ROLES = new Set(["HR_MANAGER"]);
const ESCALATION_RESOLVER_ROLES = new Set(["HR_MANAGER", "ADMIN"]);

function roleKey(role) {
  return String(role || "").trim().toUpperCase();
}

function hasRole(roleSet, role) {
  return roleSet.has(roleKey(role));
}

function isHrEmployeeRole(role) {
  const key = roleKey(role);
  return key === "HR" || key === "HR_STAFF" || key === "HR_MANAGER";
}

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

function resolveExcuseAllowanceMinutes(leaveDoc) {
  const computedMinutes = Number(leaveDoc?.computed?.minutes) || 0;
  const rules = leaveDoc?.policySnapshot?.excuseRules || {};
  const maxHours = Number(rules.maxHoursPerExcuse);
  const maxMinutesPerRequest = Number(rules.maxMinutesPerRequest);
  const policyMinutes = Number.isFinite(maxHours) && maxHours > 0
    ? maxHours * 60
    : (Number.isFinite(maxMinutesPerRequest) && maxMinutesPerRequest > 0
      ? maxMinutesPerRequest
      : 0);
  return Math.max(0, computedMinutes, policyMinutes);
}

function mapExcuseOverageToDeductionFraction(overageMinutes, workdayMinutes = 8 * 60) {
  if (!Number.isFinite(overageMinutes) || overageMinutes <= 0) return 0;
  const quarter = workdayMinutes / 4;
  const half = workdayMinutes / 2;
  if (overageMinutes > half) return 0.5;
  if (overageMinutes > quarter) return 0.25;
  return 0;
}

function normalizeDecisionSource(value) {
  const v = String(value || "").toUpperCase();
  return v === "SALARY" || v === "VACATION_BALANCE" ? v : undefined;
}

function normalizeExcuseLimitPeriod(er) {
  const p = String(er.excuseLimitPeriod || "MONTH").toUpperCase();
  if (p === "WEEK" || p === "MONTH" || p === "YEAR") return p;
  return "MONTH";
}

/**
 * Soft check: returns { exceeded, reason } instead of throwing.
 */
async function checkExcusePeriodCapacity(
  employeeId,
  excuseDate,
  er,
  excludeId,
  companyMonthStartDay,
) {
  const maxN = Math.max(0, Number(er.maxExcusesPerPeriod) || 0);
  if (maxN <= 0) return { exceeded: false };
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
    return { exceeded: true, reason: "COUNT_LIMIT" };
  }
  return { exceeded: false };
}

/**
 * Soft check: returns true if the requested excuse minutes exceed the remaining monthly entitlement.
 */
async function checkExcuseMinutesExceeded(employeeId, doc, er, companyMonthStartDay) {
  const entitlementMinutes = resolveEffectiveExcuseMonthlyEntitlementMinutes(er);
  const usage = await aggregateUsage(employeeId, doc._id, {
    filterExcuseToFiscalMonth: true,
    companyMonthStartDay,
    balanceAnchorDate: new Date(),
  });
  const remainingMinutes =
    entitlementMinutes - usage.usedApprovedMinutes - usage.pendingReservedMinutes;
  const requestedMinutes = doc.computed?.minutes ?? 0;
  return remainingMinutes < requestedMinutes;
}

/**
 * @param {import("../models/Employee.js").Employee} employee
 */
export async function resolveApproverEmails(employee) {
  const dept = employee.departmentId
    ? await Department.findById(employee.departmentId)
    : await Department.findOne({ name: employee.department });
  let teamLeaderEmail = "";
  let managerEmail = (dept?.head || "").trim();
  if (!managerEmail && dept?.headId) {
    const head = await Employee.findById(dept.headId).select("email").lean();
    managerEmail = (head?.email || "").trim();
  }

  const teamId = employee.teamId;
  const teamName = employee.team;

  if (dept && (teamId || teamName)) {
    const teamDoc = teamId
      ? await Team.findById(teamId)
      : await Team.findOne({ departmentId: dept._id, name: teamName });

    if (teamDoc) {
      if (teamDoc.leaderEmail) {
        teamLeaderEmail = teamDoc.leaderEmail.trim();
      } else if (teamDoc.leaderId) {
        const leader = await Employee.findById(teamDoc.leaderId).select("email").lean();
        if (leader?.email) teamLeaderEmail = leader.email.trim();
      }
    }

    if (!teamLeaderEmail) {
      const nested = (dept.teams || []).find(
        (t) => t.name === (teamName || teamDoc?.name),
      );
      if (nested?.leaderEmail) teamLeaderEmail = nested.leaderEmail.trim();
    }
  }

  // Fallback: some legacy rows have team name but mismatched/missing department link.
  // In that case, resolve by team name globally so TEAM_LEADER can still approve team requests.
  if (!teamLeaderEmail && teamName) {
    const fallbackTeam = await Team.findOne({ name: teamName });
    if (fallbackTeam?.leaderEmail) {
      teamLeaderEmail = fallbackTeam.leaderEmail.trim();
    } else if (fallbackTeam?.leaderId) {
      const leader = await Employee.findById(fallbackTeam.leaderId).select("email").lean();
      if (leader?.email) teamLeaderEmail = leader.email.trim();
    }
  }

  return { teamLeaderEmail, managerEmail };
}

/**
 * ObjectIds of employees whose leave requests this user may oversee as department head or team leader
 * (same emails as {@link resolveApproverEmails}).
 * @param {string} userEmail
 * @returns {Promise<import("mongoose").Types.ObjectId[]>}
 */
async function listManagedEmployeeObjectIdsForApprover(userEmail, userId = null) {
  const u = normEmail(userEmail);
  if (!u && !userId) return [];

  const depts = await Department.find({}).select("_id name head headId").lean();
  const headedDeptIds = [];
  const headedDeptNames = [];
  for (const d of depts) {
    const byEmail = u && normEmail(d.head) === u;
    const byId = userId && d.headId && String(d.headId) === String(userId);
    if (byEmail || byId) {
      headedDeptIds.push(d._id);
      headedDeptNames.push(d.name);
    }
  }

  const teams = await Team.find({}).select("departmentId name leaderEmail leaderId").lean();

  const leaderIdToEmail = new Map();
  const teamsNeedingLeaderLookup = teams.filter(
    (t) => !t.leaderEmail && t.leaderId,
  );
  if (teamsNeedingLeaderLookup.length) {
    const leaderIds = teamsNeedingLeaderLookup.map((t) => t.leaderId);
    const leaders = await Employee.find({ _id: { $in: leaderIds } })
      .select("_id email")
      .lean();
    for (const l of leaders) {
      leaderIdToEmail.set(String(l._id), normEmail(l.email));
    }
  }

  /** @type {{ _id: import("mongoose").Types.ObjectId, departmentId: import("mongoose").Types.ObjectId, name: string, deptName?: string }[]} */
  const ledTeams = [];
  for (const t of teams) {
    const resolvedEmail = normEmail(t.leaderEmail)
      || (t.leaderId && leaderIdToEmail.get(String(t.leaderId))) || "";
    const byEmail = Boolean(u) && resolvedEmail === u;
    const byId = Boolean(userId) && t.leaderId && String(t.leaderId) === String(userId);
    if (!byEmail && !byId) continue;
    const dept = depts.find((d) => String(d._id) === String(t.departmentId));
    ledTeams.push({
      _id: t._id,
      departmentId: t.departmentId,
      name: t.name,
      deptName: dept?.name,
    });
  }

  const orConds = [];

  if (headedDeptIds.length) {
    orConds.push({ departmentId: { $in: headedDeptIds } });
  }
  if (headedDeptNames.length) {
    orConds.push({
      $and: [
        { department: { $in: headedDeptNames } },
        {
          $or: [
            { departmentId: null },
            { departmentId: { $exists: false } },
          ],
        },
      ],
    });
  }

  for (const spec of ledTeams) {
    orConds.push({ teamId: spec._id });

    const teamOr = [{ departmentId: spec.departmentId }];
    if (spec.deptName) {
      teamOr.push({
        $and: [
          { department: spec.deptName },
          {
            $or: [
              { departmentId: null },
              { departmentId: { $exists: false } },
            ],
          },
        ],
      });
    }
    orConds.push({
      team: spec.name,
      $or: teamOr,
    });
  }

  if (!orConds.length) return [];

  const rows = await Employee.find({ $or: orConds }).select("_id").lean();
  const seen = new Set();
  const out = [];
  for (const r of rows) {
    const s = String(r._id);
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(r._id);
  }
  return out;
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

function buildApprovalPipelineForEmployee(employee, teamLeaderEmail, managerEmail) {
  // HR employees are approved by HR manager or HR team leader directly.
  if (isHrEmployeeRole(employee?.role)) {
    const emp = normEmail(employee?.email);
    const tlOk = teamLeaderEmail && normEmail(teamLeaderEmail) !== emp;
    const mgrOk = managerEmail && normEmail(managerEmail) !== emp;
    if (tlOk || mgrOk) {
      return [{ role: "MANAGEMENT", status: "PENDING" }];
    }
    // Fallback to HR step so requests are not blocked when org links are missing.
    return [{ role: "HR", status: "PENDING" }];
  }
  return buildApprovalPipeline(teamLeaderEmail, managerEmail, employee?.email);
}

function syncDocumentStatus(doc) {
  if (doc.status === "CANCELLED") return;
  const approvals = Array.isArray(doc.approvals) ? doc.approvals : [];
  const approvedCount = approvals.filter((a) => a.status === "APPROVED").length;
  const rejectedCount = approvals.filter((a) => a.status === "REJECTED").length;
  const pendingCount = approvals.filter((a) => a.status === "PENDING").length;

  if (!approvals.length) {
    doc.status = "PENDING";
    return;
  }
  if (pendingCount > 0) {
    doc.status = "PENDING";
    return;
  }
  if (approvedCount > 0 && rejectedCount > 0) {
    doc.status = "ESCALATED";
    return;
  }
  if (approvedCount === approvals.length) {
    doc.status = "APPROVED";
    return;
  }
  if (rejectedCount > 0) {
    doc.status = "REJECTED";
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

    if (r.quotaExceeded && r.status === "APPROVED"
        && r.excessDeductionMethod === "VACATION_BALANCE" && r.excessDeductionAmount > 0) {
      usedApprovedDays += r.excessDeductionAmount;
      continue;
    }

    if (r.effectivePaymentType === "UNPAID") continue;
    if (r.quotaExceeded) continue;
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
 * Determine whether an approved vacation should be PAID (balance deduction) or UNPAID (salary deduction).
 * @param {import("mongoose").Types.ObjectId | string} employeeId
 * @param {object} doc LeaveRequest document
 * @returns {Promise<{ type: "PAID"|"UNPAID", reason?: string }>}
 */
async function determineVacationPaymentType(employeeId, doc) {
  if (doc.preEligibility) {
    return { type: "UNPAID", reason: "NOT_ELIGIBLE" };
  }
  const employee = await Employee.findById(employeeId);
  if (!employee) return { type: "UNPAID", reason: "NO_BALANCE" };

  const policyDoc = await getDefaultPolicyDoc();
  const active = resolveActiveLeavePolicy(policyDoc?.leavePolicies || []);
  const vr = active.vacationRules;
  const baseEntitlementDays = resolveAnnualDaysForEmployee(employee, vr);
  const bonusDays = sumAnnualLeaveCreditDays(employee.toObject?.() ?? employee);
  const entitlementDays = baseEntitlementDays + bonusDays;

  const companyMonthStartDay = getCompanyMonthStartDay(policyDoc);
  const usage = await aggregateUsage(employeeId, doc._id, {
    filterExcuseToFiscalMonth: true,
    companyMonthStartDay,
    balanceAnchorDate: new Date(),
  });
  const remainingDays = entitlementDays - usage.usedApprovedDays - usage.pendingReservedDays;
  const requestedDays = doc.computed?.days ?? 0;

  if (remainingDays < requestedDays) {
    return { type: "UNPAID", reason: "NO_BALANCE" };
  }
  return { type: "PAID" };
}

/**
 * Determine final payment type for approved excuse.
 * Policy: if employee is not yet eligible, excuse is approved as UNPAID.
 * If quota exceeded and deduction is SALARY => UNPAID, otherwise PAID.
 * @param {object} doc LeaveRequest document
 * @returns {{ type: "PAID"|"UNPAID", reason?: string }}
 */
function determineExcusePaymentType(doc) {
  if (doc.preEligibility) {
    return { type: "UNPAID", reason: "NOT_ELIGIBLE" };
  }
  if (doc.quotaExceeded && doc.excessDeductionMethod === "SALARY") {
    return { type: "UNPAID", reason: "EXCESS_EXCUSE_SALARY" };
  }
  return { type: "PAID" };
}

/**
 * Determine whether an approved excuse exceeds the employee's remaining quota.
 * @param {import("mongoose").Types.ObjectId | string} employeeId
 * @param {object} doc LeaveRequest document
 * @returns {Promise<{ exceeded: boolean }>}
 */
async function determineExcuseQuotaStatus(employeeId, doc) {
  const policyDoc = await getDefaultPolicyDoc();
  const active = resolveActiveLeavePolicy(policyDoc?.leavePolicies || []);
  const er = active.excuseRules;
  const companyMonthStartDay = getCompanyMonthStartDay(policyDoc);

  const entitlementMinutes = resolveEffectiveExcuseMonthlyEntitlementMinutes(er);
  const usage = await aggregateUsage(employeeId, doc._id, {
    filterExcuseToFiscalMonth: true,
    companyMonthStartDay,
    balanceAnchorDate: new Date(),
  });

  const remainingMinutes =
    entitlementMinutes - usage.usedApprovedMinutes - usage.pendingReservedMinutes;
  const requestedMinutes = doc.computed?.minutes ?? 0;

  if (remainingMinutes < requestedMinutes) {
    return { exceeded: true };
  }

  const maxN = Math.max(0, Number(er.maxExcusesPerPeriod) || 0);
  if (maxN > 0) {
    const period = normalizeExcuseLimitPeriod(er);
    const newKey = excusePeriodKeyUtc(doc.excuseDate, period, companyMonthStartDay);
    const others = await LeaveRequest.find({
      employeeId,
      kind: "EXCUSE",
      status: { $in: ["PENDING", "APPROVED"] },
      _id: { $ne: doc._id },
    }).lean();
    let n = 0;
    for (const r of others) {
      if (!r.excuseDate) continue;
      if (excusePeriodKeyUtc(r.excuseDate, period, companyMonthStartDay) === newKey) {
        n += 1;
      }
    }
    if (n >= maxN) {
      return { exceeded: true };
    }
  }

  return { exceeded: false };
}

const MAX_ANNUAL_LEAVE_CREDIT_DAYS = 365;
const MAX_CREDIT_REASON_LENGTH = 500;

/**
 * HR-only: append a manual vacation day credit (formal / extra entitlement).
 * @param {{ id: string, email: string, role: string }} user
 * @param {{ employeeId: string, days: number, reason: string }} body
 */
export async function addAnnualLeaveCredit(user, body) {
  if (!hasRole(HR_ROLES, user.role)) {
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

  await createAuditLog({
    entityType: "LeaveRequest",
    entityId: employee._id,
    operation: "BALANCE_CREDIT",
    newValues: { employeeId, days: daysInt, reason, recordedBy: user.email },
    performedBy: user.email,
    ipAddress: user._ip,
    userAgent: user._ua,
  });

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
  if (!hasRole(HR_ROLES, user.role)) {
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
    const filter = { _id: { $in: chunk }, ...activeStatusFilter };
    const res = await Employee.updateMany(filter, {
      $push: { annualLeaveCredits: entry },
    });
    updatedCount += res.modifiedCount ?? 0;
  }

  await createAuditLog({
    entityType: "LeaveRequest",
    entityId: new mongoose.Types.ObjectId(),
    operation: "BULK_BALANCE_CREDIT",
    newValues: {
      scopeKind,
      scopeDetail,
      days: daysInt,
      reason,
      updatedCount,
    },
    performedBy: user.email,
    ipAddress: user._ip,
    userAgent: user._ua,
  });

  return {
    updatedCount,
    scopeKind,
    scopeDetail,
    days: daysInt,
  };
}

export async function assertCanViewEmployeeLeaveBalance(user, employeeId) {
  if (String(user.id) === String(employeeId)) return;
  if (hasRole(HR_ROLES, user.role)) return;
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
  const entitlementMinutes = resolveEffectiveExcuseMonthlyEntitlementMinutes(
    active.excuseRules,
  );
  const companyMonthStartDay = getCompanyMonthStartDay(policyDoc);

  const now = new Date();
  const usage = await aggregateUsage(employeeId, null, {
    filterExcuseToFiscalMonth: true,
    companyMonthStartDay,
    balanceAnchorDate: now,
  });
  const remainingDays =
    entitlementDays - usage.usedApprovedDays - usage.pendingReservedDays;
  const remainingMinutes =
    entitlementMinutes -
    usage.usedApprovedMinutes -
    usage.pendingReservedMinutes;

  const er = active.excuseRules;
  const maxExcusesPerPeriod = Math.max(0, Number(er.maxExcusesPerPeriod) || 0);
  let excusesUsedInPeriod = 0;
  if (maxExcusesPerPeriod > 0) {
    const period = normalizeExcuseLimitPeriod(er);
    const currentKey = excusePeriodKeyUtc(now, period, companyMonthStartDay);
    const approved = await LeaveRequest.find({
      employeeId,
      kind: "EXCUSE",
      status: { $in: ["PENDING", "APPROVED"] },
    }).lean();
    for (const r of approved) {
      if (!r.excuseDate) continue;
      if (excusePeriodKeyUtc(r.excuseDate, period, companyMonthStartDay) === currentKey) {
        excusesUsedInPeriod += 1;
      }
    }
  }

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
      hasBalance: remainingDays > 0,
      credits,
      firstVacationYear,
      entitlementVariesByYear: Boolean(vr?.entitlementVariesByYear),
    },
    excuse: {
      entitlementMinutes,
      approvedMinutes: usage.usedApprovedMinutes,
      pendingMinutes: usage.pendingReservedMinutes,
      remainingMinutes,
      hasQuota: remainingMinutes > 0,
      excusesUsedInPeriod,
      excusesAllowedInPeriod: maxExcusesPerPeriod,
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
    return hasRole(HR_ROLES, userRole);
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
  if (!att) return;

  const SYNCABLE = new Set(["LATE", "EXCUSED", "PARTIAL_EXCUSED", "ABSENT"]);
  if (!SYNCABLE.has(att.status)) return;

  if ((att.status === "EXCUSED" || att.status === "PARTIAL_EXCUSED") && att.excuseLeaveRequestId
      && String(att.excuseLeaveRequestId) !== String(leaveDoc._id)) {
    return;
  }

  let standardStartTime = "09:00";
  let gracePeriod = 15;
  let hoursPerDay = 8;
  try {
    const orgPolicy = await OrganizationPolicy.findOne({ name: "default" }).lean();
    const ar = orgPolicy?.attendanceRules;
    if (ar) {
      standardStartTime = ar.standardStartTime || standardStartTime;
      gracePeriod = ar.gracePeriodMinutes ?? gracePeriod;
    }
    hoursPerDay = Number(orgPolicy?.payrollConfig?.hoursPerDay) || 8;
  } catch (_) { /* use defaults */ }
  const shiftStartMin = parseTimeToMinutes(standardStartTime);
  const es = parseTimeToMinutes(leaveDoc.startTime);
  const ee = parseTimeToMinutes(leaveDoc.endTime);
  if (shiftStartMin == null || es == null || ee == null) {
    return;
  }

  if (att.status === "LATE") {
    const checkInMin = parseTimeToMinutes(att.checkIn);
    const excuseCoversShiftStart = ee > shiftStartMin;
    const excuseCoversCheckIn =
      checkInMin != null &&
      excuseCoversLateCheckIn(checkInMin, es, ee, shiftStartMin, gracePeriod);
    if (!excuseCoversShiftStart && !excuseCoversCheckIn) {
      return;
    }
  }

  const oldAttStatus = att.status;
  if (!att.originalStatus) {
    att.originalStatus = att.status;
  }
  let nextStatus = "EXCUSED";
  let overageMinutes = 0;
  att.excuseCovered = true;
  att.excuseLeaveRequestId = leaveDoc._id;
  att.unpaidLeave = leaveDoc.effectivePaymentType === "UNPAID";

  const excuseMinutes = leaveDoc.computed?.minutes || 0;
  att.excusedMinutes = (att.excusedMinutes || 0) + excuseMinutes;

  const checkInMin = parseTimeToMinutes(att.checkIn);
  const lateFromShiftStart =
    shiftStartMin != null && checkInMin != null
      ? Math.max(0, checkInMin - shiftStartMin)
      : 0;
  const allowanceMinutes = resolveExcuseAllowanceMinutes(leaveDoc);
  overageMinutes = Math.max(0, lateFromShiftStart - allowanceMinutes);

  if (overageMinutes > 0) {
    nextStatus = "PARTIAL_EXCUSED";
    att.excessExcuse = true;
    att.excuseOverageMinutes = overageMinutes;
    const persistedSource = normalizeDecisionSource(att.deductionSource);
    const persistedType = String(att.deductionValueType || "").toUpperCase();
    const persistedValue = Number(att.deductionValue);
    const persistedResolved = Boolean(att.deductionDecisionAt) || Boolean(persistedSource);
    if (persistedResolved) {
      att.requiresDeductionDecision = !persistedSource;
      att.deductionSource = persistedSource;
      att.deductionValueType = persistedType === "AMOUNT" ? "AMOUNT" : "DAYS";
      att.deductionValue = Number.isFinite(persistedValue) && persistedValue > 0
        ? persistedValue
        : mapExcuseOverageToDeductionFraction(overageMinutes, hoursPerDay * 60);
    } else {
      att.requiresDeductionDecision = true;
      att.deductionSource = undefined;
      att.deductionValueType = "DAYS";
      att.deductionValue = mapExcuseOverageToDeductionFraction(overageMinutes, hoursPerDay * 60);
    }
    att.excessExcuseFraction = leaveDoc.excessDeductionAmount
      || mapExcuseOverageToDeductionFraction(overageMinutes, hoursPerDay * 60);
  } else if (leaveDoc.quotaExceeded && leaveDoc.excessDeductionMethod === "SALARY") {
    att.excessExcuse = true;
    att.excuseOverageMinutes = 0;
    att.requiresDeductionDecision = false;
    att.deductionSource = leaveDoc.excessDeductionMethod;
    att.deductionValueType = "DAYS";
    att.deductionValue = leaveDoc.excessDeductionAmount || (excuseMinutes / (hoursPerDay * 60));
    att.excessExcuseFraction = leaveDoc.excessDeductionAmount || (excuseMinutes / (hoursPerDay * 60));
  } else {
    att.excessExcuse = false;
    att.excuseOverageMinutes = 0;
    att.requiresDeductionDecision = false;
    att.deductionSource = undefined;
    att.deductionValueType = undefined;
    att.deductionValue = undefined;
    att.excessExcuseFraction = 0;
  }
  att.status = nextStatus;

  await att.save();

  await createAuditLog({
    entityType: "LeaveRequest",
    entityId: leaveDoc._id,
    operation: "ATTENDANCE_SYNC",
    newValues: {
      attendanceId: att._id,
      oldStatus: oldAttStatus,
      newStatus: nextStatus,
      excuseDate: leaveDoc.excuseDate,
      excusedMinutes: excuseMinutes,
      excuseOverageMinutes: overageMinutes || undefined,
      quotaExceeded: leaveDoc.quotaExceeded || undefined,
      excessExcuseFraction: att.excessExcuseFraction || undefined,
    },
    performedBy: "system",
  });
}

async function revertExcuseAttendanceRow(leaveDoc) {
  if (leaveDoc.kind !== "EXCUSE") return;
  const att = await Attendance.findOne({
    employeeId: leaveDoc.employeeId,
    excuseLeaveRequestId: leaveDoc._id,
  });
  if (!att) return;

  const excuseMinutes = leaveDoc.computed?.minutes || 0;
  att.excusedMinutes = Math.max(0, (att.excusedMinutes || 0) - excuseMinutes);
  att.excuseLeaveRequestId = undefined;
  att.excuseCovered = false;
  att.unpaidLeave = false;
  att.excessExcuse = false;
  att.excuseOverageMinutes = 0;
  att.requiresDeductionDecision = false;
  att.deductionSource = undefined;
  att.deductionValueType = undefined;
  att.deductionValue = undefined;
  att.excessExcuseFraction = 0;

  if (att.originalStatus) {
    att.status = att.originalStatus;
    att.originalStatus = undefined;
  } else {
    att.status = "LATE";
  }
  await att.save();
}

async function syncApprovedVacationToAttendance(leaveDoc) {
  if (leaveDoc.kind !== "VACATION" || leaveDoc.status !== "APPROVED") return;
  if (!leaveDoc.startDate || !leaveDoc.endDate) return;

  const start = new Date(leaveDoc.startDate);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(leaveDoc.endDate);
  end.setUTCHours(0, 0, 0, 0);

  const emp = await Employee.findById(leaveDoc.employeeId).lean();
  const empCode = emp?.employeeCode || "";

  const orgPolicy = await OrganizationPolicy.findOne({ name: "default" })
    .select("attendanceRules.weeklyRestDays")
    .lean();
  const weeklyRest = weeklyRestDaySet(orgPolicy?.attendanceRules?.weeklyRestDays);

  const cursor = new Date(start);
  while (cursor <= end) {
    const dow = cursor.getUTCDay();
    if (weeklyRest.has(dow)) {
      cursor.setUTCDate(cursor.getUTCDate() + 1);
      continue;
    }

    const dayStart = new Date(cursor);
    const existing = await Attendance.findOne({
      employeeId: leaveDoc.employeeId,
      date: dayStart,
    });

    const isUnpaid = leaveDoc.effectivePaymentType === "UNPAID";
    const typeLabel = isUnpaid ? "unpaid" : (leaveDoc.leaveType || "ANNUAL");

    if (!existing) {
      await Attendance.create({
        employeeId: leaveDoc.employeeId,
        employeeCode: empCode,
        date: dayStart,
        status: "ON_LEAVE",
        checkIn: "",
        checkOut: "",
        leaveRequestId: leaveDoc._id,
        unpaidLeave: isUnpaid,
        remarks: `Auto: approved ${typeLabel} leave`,
      });
    } else if (!existing.leaveRequestId) {
      existing.originalStatus = existing.status;
      existing.status = "ON_LEAVE";
      existing.leaveRequestId = leaveDoc._id;
      existing.onApprovedLeave = true;
      existing.unpaidLeave = isUnpaid;
      existing.remarks = (existing.remarks || "") +
        ` [on approved ${typeLabel} leave]`;
      await existing.save();
    } else if (String(existing.leaveRequestId) === String(leaveDoc._id)) {
      // Keep attendance row in sync if payment classification changes.
      existing.unpaidLeave = isUnpaid;
      await existing.save();
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
}

async function revertVacationAttendanceRows(leaveDoc) {
  if (leaveDoc.kind !== "VACATION") return;
  const linkedDeleted = await Attendance.deleteMany({
    employeeId: leaveDoc.employeeId,
    leaveRequestId: leaveDoc._id,
    originalStatus: { $exists: false },
    status: "ON_LEAVE",
  });
  const overlays = await Attendance.find({
    employeeId: leaveDoc.employeeId,
    leaveRequestId: leaveDoc._id,
    originalStatus: { $exists: true },
  });
  for (const att of overlays) {
    att.status = att.originalStatus;
    att.originalStatus = undefined;
    att.leaveRequestId = undefined;
    att.onApprovedLeave = undefined;
    att.unpaidLeave = false;
    await att.save();
  }

  if ((linkedDeleted.deletedCount || 0) === 0 && overlays.length === 0
      && leaveDoc.startDate && leaveDoc.endDate) {
    const start = new Date(leaveDoc.startDate);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(leaveDoc.endDate);
    end.setUTCHours(23, 59, 59, 999);
    const orphans = await Attendance.find({
      employeeId: leaveDoc.employeeId,
      date: { $gte: start, $lte: end },
      status: "ON_LEAVE",
      $or: [{ leaveRequestId: null }, { leaveRequestId: { $exists: false } }],
    });
    for (const att of orphans) {
      if (att.originalStatus) {
        att.status = att.originalStatus;
        att.originalStatus = undefined;
      } else {
        att.status = "ABSENT";
      }
      att.onApprovedLeave = false;
      att.unpaidLeave = false;
      await att.save();
    }
  }
}

/**
 * @param {{ id: string, email: string, role: string }} user
 */
export async function createLeaveRequest(user, body) {
  let employee;
  let isOnBehalf = false;

  if (body.employeeId && String(body.employeeId) !== String(user.id)) {
    if (!hasRole(HR_ROLES, user.role)) {
      throw new ApiError(403, "Only HR can create leave requests on behalf of another employee");
    }
    employee = await Employee.findById(body.employeeId);
    if (!employee) {
      throw new ApiError(404, "Target employee not found");
    }
    isOnBehalf = true;
  } else {
    employee = await Employee.findById(user.id);
    if (!employee) {
      throw new ApiError(404, "Employee not found");
    }
  }

  const LEAVE_ELIGIBLE_STATUSES = new Set(["ACTIVE", "ON_LEAVE"]);
  if (!LEAVE_ELIGIBLE_STATUSES.has(employee.status)) {
    throw new ApiError(400, `Cannot create leave request: employee status is ${employee.status}`);
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
    const maxR = resolveMaxExcuseMinutesPerRequest(er);
    if (computed.minutes > maxR) {
      const hours = (maxR / 60).toFixed(maxR % 60 === 0 ? 0 : 1);
      throw new ApiError(400, `Excuse exceeds max length for one request (${hours} hour(s) / ${maxR} minutes per policy).`,);
    }
  }

  const firstDay = kind === "VACATION" ? startDate : excuseDate;
  const eligibility = computeEligibility(employee, kind, firstDay, vr, er);
  const preEligibility = !eligibility.eligible;

  const { teamLeaderEmail, managerEmail } =
    await resolveApproverEmails(employee);
  const approvals = buildApprovalPipelineForEmployee(
    employee,
    teamLeaderEmail,
    managerEmail,
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

  const buildAndSave = async (session) => {
    await assertNoOverlap(employee._id, draft, null);

    let excuseQuotaExceeded = false;
    if (kind === "EXCUSE") {
      const capacityResult = await checkExcusePeriodCapacity(
        employee._id, excuseDate, er, null, companyMonthStartDay,
      );
      if (capacityResult.exceeded) excuseQuotaExceeded = true;

      const minutesExceeded = await checkExcuseMinutesExceeded(
        employee._id, draft, er, companyMonthStartDay,
      );
      if (minutesExceeded) excuseQuotaExceeded = true;
    }

    const usage = await aggregateUsage(employee._id, null, {
      filterExcuseToFiscalMonth: true,
      companyMonthStartDay,
      balanceAnchorDate: new Date(),
    });
    const baseEntitlementDays = resolveAnnualDaysForEmployee(employee, vr);
    const bonusDays = sumAnnualLeaveCreditDays(employee);
    const entitlementDays = baseEntitlementDays + bonusDays;
    const entitlementMinutes = resolveEffectiveExcuseMonthlyEntitlementMinutes(er);
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
      quotaExceeded: excuseQuotaExceeded || undefined,
      createdBy: user.email,
      onBehalf: isOnBehalf,
      lastUpdatedAt: new Date(),
      lastUpdatedBy: user.email,
    });

    syncDocumentStatus(doc);
    await doc.save(session ? { session } : undefined);
    return doc;
  };

  let doc;
  const txSupported = await mongoSupportsTransactions();
  if (txSupported) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        doc = await buildAndSave(session);
      });
    } finally {
      await session.endSession();
    }
  } else {
    doc = await buildAndSave(null);
  }

  await createAuditLog({
    entityType: "LeaveRequest",
    entityId: doc._id,
    operation: "CREATE",
    newValues: {
      kind: doc.kind,
      leaveType: doc.leaveType,
      startDate: doc.startDate,
      endDate: doc.endDate,
      excuseDate: doc.excuseDate,
      startTime: doc.startTime,
      endTime: doc.endTime,
      computed: doc.computed,
      policyVersion: policySnapshot.policyVersion,
      preEligibility: doc.preEligibility,
      balanceContext: doc.balanceContext,
      onBehalf: isOnBehalf,
      targetEmployee: isOnBehalf ? employee.email : undefined,
    },
    performedBy: user.email,
    ipAddress: user._ip,
    userAgent: user._ua,
  });

  return sanitizeLeaveRequest(doc, user);
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
  if (query.kind) filter.kind = query.kind;

  if (query.mine === "true" || query.mine === "1") {
    filter.employeeId = user.id;
    const total = await LeaveRequest.countDocuments(filter);
    const list = await LeaveRequest.find(filter)
      .sort({ submittedAt: -1 })
      .skip(skip)
      .limit(limit);
    return {
      requests: list.map((r) => sanitizeLeaveRequest(r, user)),
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
      status: { $in: ["PENDING", "ESCALATED"] },
    })
      .sort({ submittedAt: 1 })
      .lean();

    const actionable = [];
    for (const r of allPending) {
      if (r.status === "ESCALATED") {
        if (hasRole(ESCALATION_RESOLVER_ROLES, user.role)) {
          actionable.push(r._id);
        }
        continue;
      }
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
      requests: list.map((r) => sanitizeLeaveRequest(r, user)),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      balanceByEmployeeId,
    };
  }

  // managed_hr=1 is used by HR users who are ALSO department heads / team leaders.
  // We resolve their actual department/team scope (like a MANAGER would get),
  // instead of the default HR "company-wide" access.
  if (query.managed_hr === "true" || query.managed_hr === "1") {
    if (hasRole(HR_ROLES, user.role)) {
      // Temporarily resolve their real employee scope (bypass HR shortcut in scopeService).
      const actor = await Employee.findById(user.id)
        .select("_id email departmentId")
        .lean();
      if (!actor) {
        return {
          requests: [],
          pagination: { page, limit, total: 0, totalPages: 1 },
        };
      }
      // Build a fake non-HR user object to call resolveEmployeeScopeIds without HR bypass.
      const fakeUser = { ...user, role: "MANAGER" };
      const scoped = await resolveEmployeeScopeIds(fakeUser);
      const managedIds =
        scoped.scope === "all"
          ? []
          : Array.isArray(scoped.employeeIds)
          ? scoped.employeeIds
          : [];
      if (managedIds.length === 0) {
        return {
          requests: [],
          pagination: { page, limit, total: 0, totalPages: 1 },
        };
      }
      filter.employeeId = { $in: managedIds };
      const total = await LeaveRequest.countDocuments(filter);
      const list = await LeaveRequest.find(filter)
        .sort({ submittedAt: -1 })
        .skip(skip)
        .limit(limit);
      return {
        requests: list.map((r) => sanitizeLeaveRequest(r, user)),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
      };
    }
  }

  if (
    (query.managed === "true" || query.managed === "1") &&
    !hasRole(HR_ROLES, user.role)
  ) {
    const scoped = await resolveEmployeeScopeIds(user);
    const managedIds =
      scoped.scope === "all"
        ? []
        : (Array.isArray(scoped.employeeIds) ? scoped.employeeIds : []);
    if (managedIds.length === 0) {
      return {
        requests: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 1,
        },
      };
    }
    filter.employeeId = { $in: managedIds };
    const total = await LeaveRequest.countDocuments(filter);
    const list = await LeaveRequest.find(filter)
      .sort({ submittedAt: -1 })
      .skip(skip)
      .limit(limit);
    return {
      requests: list.map((r) => sanitizeLeaveRequest(r, user)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
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
      requests: list.map((r) => sanitizeLeaveRequest(r, user)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  if (hasRole(HR_ROLES, user.role)) {
    const total = await LeaveRequest.countDocuments(filter);
    const list = await LeaveRequest.find(filter)
      .sort({ submittedAt: -1 })
      .skip(skip)
      .limit(limit);
    return {
      requests: list.map((r) => sanitizeLeaveRequest(r, user)),
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
    requests: list.map((r) => sanitizeLeaveRequest(r, user)),
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
export async function applyLeaveRequestAction(requestId, user, action, comment, extras = {}) {
  const doc = await LeaveRequest.findById(requestId);
  if (!doc) {
    throw new ApiError(404, "Leave request not found");
  }
  const versionAtRead = doc.__v;

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

  const previousStatus = doc.status;
  if (doc.status === "ESCALATED") {
    if (!hasRole(ESCALATION_RESOLVER_ROLES, user.role)) {
      throw new ApiError(403, "Only HR_MANAGER or ADMIN can resolve escalated requests");
    }

    if (act === "APPROVE" && doc.kind === "EXCUSE") {
      const qs = await determineExcuseQuotaStatus(doc.employeeId, doc);
      const exceeded = qs.exceeded || doc.quotaExceeded;
      doc.quotaExceeded = exceeded;
      if (exceeded) {
        const method = extras.excessDeductionMethod || doc.excessDeductionMethod;
        const amount = Number(extras.excessDeductionAmount ?? doc.excessDeductionAmount);
        const invalidMethod = !method || !["SALARY", "VACATION_BALANCE"].includes(method);
        const invalidAmount = !Number.isFinite(amount) || amount <= 0;
        if (invalidMethod || invalidAmount) {
          throw new ApiError(400, "Escalated excuse requires excess deduction method and amount");
        }
        doc.excessDeductionMethod = method;
        doc.excessDeductionAmount = amount;
      }
    }

    doc.status = act === "APPROVE" ? "APPROVED" : "REJECTED";
    doc.lastUpdatedAt = new Date();
    doc.lastUpdatedBy = user.email;
    doc.finalResolver = user.email;
    if (!doc.escalationReason) {
      doc.escalationReason = "Conflicting HR and management decisions";
    }

    const setFields = {
      status: doc.status,
      lastUpdatedAt: doc.lastUpdatedAt,
      lastUpdatedBy: doc.lastUpdatedBy,
      finalResolver: doc.finalResolver,
      escalationReason: doc.escalationReason,
    };
    if (doc.quotaExceeded != null) setFields.quotaExceeded = doc.quotaExceeded;
    if (doc.excessDeductionMethod) {
      setFields.excessDeductionMethod = doc.excessDeductionMethod;
      setFields.excessDeductionAmount = doc.excessDeductionAmount;
    }
    const savedEscalation = await LeaveRequest.findOneAndUpdate(
      { _id: doc._id, __v: versionAtRead, status: "ESCALATED" },
      { $set: setFields, $inc: { __v: 1 } },
      { new: true },
    );
    if (!savedEscalation) {
      throw new ApiError(409, "This request was modified concurrently — please reload and try again");
    }
    Object.assign(doc, savedEscalation.toObject());

    await createAuditLog({
      entityType: "LeaveRequest",
      entityId: doc._id,
      operation: act === "APPROVE" ? "APPROVE" : "REJECT",
      previousValues: { status: previousStatus },
      newValues: {
        action: `ESCALATION_${act}`,
        processedBy: user.email,
        comment: (comment || "").trim() || undefined,
        resultingStatus: doc.status,
      },
      performedBy: user.email,
      ipAddress: user._ip,
      userAgent: user._ua,
    });

    if (doc.status === "APPROVED") {
      if (doc.kind === "VACATION") {
        const pt = await determineVacationPaymentType(doc.employeeId, doc);
        doc.effectivePaymentType = pt.type;
        doc.unpaidReason = pt.reason || undefined;
        await doc.save();
        await syncApprovedVacationToAttendance(doc);
      } else if (doc.kind === "EXCUSE") {
        const pt = determineExcusePaymentType(doc);
        doc.effectivePaymentType = pt.type;
        doc.unpaidReason = pt.reason || undefined;
        await doc.save();
        await syncApprovedExcuseToAttendance(doc);
      }
    }
    return doc;
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

  let forceApproved = false;
  if (!userCanActOnPendingStep(user.email, user.role, step.role, ctx)) {
    if (hasRole(FORCE_APPROVE_ROLES, user.role) && act === "APPROVE") {
      forceApproved = true;
    } else {
      throw new ApiError(403, "Not authorized for this approval step");
    }
  }

  const trimmedComment = (comment || "").trim();
  if (act === "APPROVE") {
    step.status = "APPROVED";
    step.processedBy = user.email;
    step.processedAt = new Date();
    step.comment = forceApproved
      ? `[HR force-approved]${trimmedComment ? ` ${trimmedComment}` : ""}`
      : trimmedComment || undefined;
  } else {
    step.status = "REJECTED";
    step.processedBy = user.email;
    step.processedAt = new Date();
    step.comment = trimmedComment;
  }

  syncDocumentStatus(doc);
  doc.lastUpdatedAt = new Date();
  doc.lastUpdatedBy = user.email;
  if (doc.status === "ESCALATED" && previousStatus !== "ESCALATED") {
    doc.escalatedAt = new Date();
    doc.escalatedBy = user.email;
    doc.escalationReason = "Conflicting HR and management decisions";
  }

  if (act === "APPROVE" && doc.kind === "EXCUSE" && doc.quotaExceeded) {
    const method = extras.excessDeductionMethod;
    const amount = Number(extras.excessDeductionAmount);
    const hasValidExtras = method && ["SALARY", "VACATION_BALANCE"].includes(method)
      && Number.isFinite(amount) && amount > 0;
    if (hasValidExtras && !doc.excessDeductionMethod) {
      doc.excessDeductionMethod = method;
      doc.excessDeductionAmount = amount;
    }
  }

  if (doc.status === "APPROVED" && doc.kind === "EXCUSE") {
    const qs = await determineExcuseQuotaStatus(doc.employeeId, doc);
    const willExceed = qs.exceeded || doc.quotaExceeded;
    doc.quotaExceeded = willExceed;
    if (willExceed) {
      const method = extras.excessDeductionMethod || doc.excessDeductionMethod;
      const amount = Number(extras.excessDeductionAmount ?? doc.excessDeductionAmount);
      const needsExtras = !method || !["SALARY", "VACATION_BALANCE"].includes(method)
        || !Number.isFinite(amount) || amount <= 0;
      if (needsExtras) {
        await LeaveRequest.updateOne({ _id: doc._id }, { $set: { quotaExceeded: true } });
        throw new ApiError(400, "Excuse quota exceeded — please choose a deduction method and amount to approve");
      }
      doc.excessDeductionMethod = method;
      doc.excessDeductionAmount = amount;
    }
  }

  const setFields = {
    approvals: doc.approvals,
    status: doc.status,
    lastUpdatedAt: doc.lastUpdatedAt,
    lastUpdatedBy: doc.lastUpdatedBy,
  };
  const unsetFields = {};
  if (doc.quotaExceeded != null) setFields.quotaExceeded = doc.quotaExceeded;
  if (doc.excessDeductionMethod) {
    setFields.excessDeductionMethod = doc.excessDeductionMethod;
    setFields.excessDeductionAmount = doc.excessDeductionAmount;
  }
  if (doc.escalatedAt) setFields.escalatedAt = doc.escalatedAt;
  if (doc.escalatedBy) setFields.escalatedBy = doc.escalatedBy;
  if (doc.escalationReason) setFields.escalationReason = doc.escalationReason;
  if (doc.finalResolver) setFields.finalResolver = doc.finalResolver;
  if (doc.status !== "ESCALATED") {
    unsetFields.escalatedAt = "";
    unsetFields.escalatedBy = "";
    unsetFields.escalationReason = "";
  }

  const saved = await LeaveRequest.findOneAndUpdate(
    { _id: doc._id, __v: versionAtRead },
    { $set: setFields, ...(Object.keys(unsetFields).length ? { $unset: unsetFields } : {}), $inc: { __v: 1 } },
    { new: true },
  );
  if (!saved) {
    throw new ApiError(409, "This request was modified concurrently — please reload and try again");
  }
  Object.assign(doc, { status: saved.status, approvals: saved.approvals, __v: saved.__v });

  await createAuditLog({
    entityType: "LeaveRequest",
    entityId: doc._id,
    operation: act === "APPROVE" ? "APPROVE" : "REJECT",
    previousValues: { status: previousStatus },
    newValues: {
      stepRole: step.role,
      stepIndex: idx,
      action: act,
      processedBy: user.email,
      comment: step.comment || undefined,
      resultingStatus: doc.status,
      forceApproved: forceApproved || undefined,
      escalatedAt: doc.status === "ESCALATED" ? doc.escalatedAt : undefined,
    },
    performedBy: user.email,
    ipAddress: user._ip,
    userAgent: user._ua,
  });

  if (doc.status === "APPROVED") {
    if (doc.kind === "VACATION") {
      const pt = await determineVacationPaymentType(doc.employeeId, doc);
      doc.effectivePaymentType = pt.type;
      doc.unpaidReason = pt.reason || undefined;
      await doc.save();
      await syncApprovedVacationToAttendance(doc);
    } else if (doc.kind === "EXCUSE") {
      const pt = determineExcusePaymentType(doc);
      doc.effectivePaymentType = pt.type;
      doc.unpaidReason = pt.reason || undefined;
      await doc.save();
      await syncApprovedExcuseToAttendance(doc);
    }
  }
  return sanitizeLeaveRequest(doc, user);
}

/**
 * HR/Admin only: approve and record leave immediately from HR approvals page
 * without waiting for remaining approval steps.
 */
export async function recordLeaveRequestDirect(requestId, user, comment, extras = {}) {
  if (!hasRole(DIRECT_RECORD_ROLES, user.role)) {
    throw new ApiError(403, "Only HR_MANAGER or ADMIN can directly record requests");
  }

  const doc = await LeaveRequest.findById(requestId);
  if (!doc) throw new ApiError(404, "Leave request not found");
  if (doc.status === "CANCELLED" || doc.status === "REJECTED") return doc;
  if (doc.status === "APPROVED") return doc;

  const previousStatus = doc.status;
  const now = new Date();
  const directComment = (comment || "").trim() || undefined;

  for (const step of doc.approvals) {
    if (step.status === "PENDING") {
      step.status = "APPROVED";
      step.processedBy = user.email;
      step.processedAt = now;
      step.comment = "[Direct record by HR]";
    }
  }

  doc.status = "APPROVED";
  doc.lastUpdatedAt = now;
  doc.lastUpdatedBy = user.email;
  doc.directRecorded = true;
  doc.directRecordedBy = user.email;
  doc.directRecordedAt = now;
  doc.directRecordComment = directComment;
  doc.finalResolver = undefined;
  doc.escalatedAt = undefined;
  doc.escalatedBy = undefined;
  doc.escalationReason = undefined;

  if (doc.kind === "VACATION") {
    const pt = await determineVacationPaymentType(doc.employeeId, doc);
    doc.effectivePaymentType = pt.type;
    doc.unpaidReason = pt.reason || undefined;
  } else if (doc.kind === "EXCUSE") {
    const qs = await determineExcuseQuotaStatus(doc.employeeId, doc);
    const exceeded = qs.exceeded || doc.quotaExceeded;
    doc.quotaExceeded = exceeded;

    if (exceeded) {
      const method = extras.excessDeductionMethod || doc.excessDeductionMethod;
      const amount = Number(extras.excessDeductionAmount ?? doc.excessDeductionAmount);
      if (!method || !["SALARY", "VACATION_BALANCE"].includes(method)) {
        throw new ApiError(400, "Excuse quota exceeded — excessDeductionMethod (SALARY or VACATION_BALANCE) is required");
      }
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new ApiError(400, "Excuse quota exceeded — excessDeductionAmount must be a positive number");
      }
      doc.excessDeductionMethod = method;
      doc.excessDeductionAmount = amount;

    }
    const pt = determineExcusePaymentType(doc);
    doc.effectivePaymentType = pt.type;
    doc.unpaidReason = pt.reason || undefined;
  }
  await doc.save();

  if (doc.kind === "VACATION") {
    await syncApprovedVacationToAttendance(doc);
  } else if (doc.kind === "EXCUSE") {
    await syncApprovedExcuseToAttendance(doc);
  }

  await createAuditLog({
    entityType: "LeaveRequest",
    entityId: doc._id,
    operation: "APPROVE",
    previousValues: { status: previousStatus },
    newValues: {
      action: "DIRECT_RECORD",
      processedBy: user.email,
      comment: directComment,
      resultingStatus: doc.status,
      directRecord: true,
    },
    performedBy: user.email,
    ipAddress: user._ip,
    userAgent: user._ua,
  });

  return sanitizeLeaveRequest(doc, user);
}

/**
 * @param {{ id: string, email: string, role: string }} user
 */
export async function cancelLeaveRequest(requestId, user, reason) {
  const doc = await LeaveRequest.findById(requestId);
  if (!doc) {
    throw new ApiError(404, "Leave request not found");
  }

  if (doc.status === "CANCELLED") {
    return doc;
  }

  const isOwner = String(doc.employeeId) === String(user.id);
  const isHr = hasRole(HR_ROLES, user.role);

  if (doc.status === "PENDING") {
    if (!isOwner && !isHr) {
      throw new ApiError(403, "Only the employee or HR can cancel a pending request");
    }
  } else if (doc.status === "APPROVED") {
    if (!APPROVED_CANCEL_ROLES.has(roleKey(user.role))) {
      throw new ApiError(403, "Only HR_MANAGER can cancel an approved request");
    }
    const r = (reason || "").trim();
    if (!r) {
      throw new ApiError(400, "Reason is required when cancelling an approved request");
    }
  } else {
    throw new ApiError(400, "Request cannot be cancelled");
  }

  const previousStatus = doc.status;
  const wasApprovedVacation = previousStatus === "APPROVED" && doc.kind === "VACATION";
  doc.status = "CANCELLED";
  doc.cancelledBy = user.email;
  doc.cancelledAt = new Date();
  doc.cancellationReason = (reason || "").trim() || undefined;
  doc.lastUpdatedAt = new Date();
  doc.lastUpdatedBy = user.email;
  await doc.save();

  if (wasApprovedVacation) {
    await revertVacationAttendanceRows(doc);
  }
  const wasApprovedExcuse = previousStatus === "APPROVED" && doc.kind === "EXCUSE";
  if (wasApprovedExcuse) {
    await revertExcuseAttendanceRow(doc);
  }

  await createAuditLog({
    entityType: "LeaveRequest",
    entityId: doc._id,
    operation: "CANCEL",
    previousValues: { status: previousStatus },
    newValues: {
      cancelledBy: user.email,
      previousStatus,
      reason: doc.cancellationReason,
    },
    performedBy: user.email,
    ipAddress: user._ip,
    userAgent: user._ua,
  });

  return sanitizeLeaveRequest(doc, user);
}

export async function getLeaveRequestById(requestId, user) {
  const doc = await LeaveRequest.findById(requestId);
  if (!doc) {
    throw new ApiError(404, "Leave request not found");
  }
  if (String(doc.employeeId) === String(user.id)) return sanitizeLeaveRequest(doc, user);
  if (hasRole(HR_ROLES, user.role)) return sanitizeLeaveRequest(doc, user);
  const scoped = await resolveEmployeeScopeIds(user);
  if (scoped.scope === "all") return sanitizeLeaveRequest(doc, user);
  if (Array.isArray(scoped.employeeIds)) {
    const allowed = scoped.employeeIds.some((id) => String(id) === String(doc.employeeId));
    if (allowed) return sanitizeLeaveRequest(doc, user);
  }

  throw new ApiError(403, "Forbidden");
}

export function sanitizeLeaveRequest(doc, user) {
  if (!doc) return doc;
  if (!user || hasRole(HR_ROLES, user.role)) {
    return doc; // HR and Admins see everything
  }

  const obj = typeof doc.toObject === "function" ? doc.toObject() : { ...doc };

  delete obj.policySnapshot;
  delete obj.excessDeductionMethod;
  delete obj.excessDeductionAmount;
  delete obj.directRecordedBy;
  delete obj.unpaidReason;
  delete obj.quotaExceeded;

  return obj;
}
