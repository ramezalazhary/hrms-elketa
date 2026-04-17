/**
 * Unified Payroll & Attendance Computation Engine.
 *
 * Merges the previous `attendanceAnalysisService.js` and `payrollComputationService.js`
 * into a single coherent pipeline with three targeted fixes:
 *
 *   Fix #1: Unified rounding — both attendance and payroll use `roundMoney` from
 *           `payrollMath.js` (was hardcoded `r2` with 2dp in attendance).
 *
 *   Fix #2: Single policy read — `OrganizationPolicy` is read once per pipeline run
 *           and passed through (was read twice: once in attendance, once in payroll).
 *
 *   Fix #3: Validation at boundaries — attendance summary is validated before payroll
 *           consumes it, and payroll lines are validated before persistence.
 *
 * Consumes: Employee profile, Attendance module, Assessment module, payrollConfig.
 * Produces: PayrollRecord documents with full line-item breakdown.
 */

// ═══════════════════════════════════════════════════════
// IMPORTS
// ═══════════════════════════════════════════════════════

import { PayrollRun } from "../../models/PayrollRun.js";
import { PayrollRecord } from "../../models/PayrollRecord.js";
import { PayrollComputeSnapshot } from "../../models/PayrollComputeSnapshot.js";
import { Employee } from "../../models/Employee.js";
import { EmployeeAdvance } from "../../models/EmployeeAdvance.js";
import { OrganizationPolicy } from "../../models/OrganizationPolicy.js";
import { Attendance } from "../../models/Attendance.js";
import { Assessment } from "../../models/Assessment.js";
import { PerformanceReview } from "../../models/PerformanceReview.js";
import { LeaveRequest } from "../../models/LeaveRequest.js";
import { CompanyHoliday } from "../../models/CompanyHoliday.js";
import { createAuditLog } from "../auditService.js";
import mongoose from "mongoose";
import { mongoSupportsTransactions } from "../../utils/mongoTransactions.js";
import { parseTimeToMinutes } from "../../utils/excuseAttendance.js";
import { weeklyRestDaySet } from "../../utils/weeklyRestDays.js";
import {
  resolveWorkingDaysPerMonth,
  DEFAULT_WORKING_DAYS_PER_MONTH,
} from "../../utils/orgPolicyWorkingDays.js";
import { isHolidayForEmployee } from "../../utils/isHolidayForEmployee.js";
import {
  calculateTimingStatus,
  countMonthlyGraceUsesBeforeTarget,
  deductionForLateWithMonthlyGraceExhaustion,
  effectiveLateGraceAddMinutes,
  lateMinutesForTiers,
  lateSecondsAfterShiftStart,
  tierIntervalsSecondsFromPolicy,
} from "../../utils/attendanceTimingCore.js";
import {
  getCompanyMonthStartDay,
  fiscalMonthPeriodStartUtc,
} from "../leavePolicyService.js";

import {
  roundMoney,
  clampDecimalPlaces,
  computeProgressiveTax,
  DEFAULT_PAYROLL_CONFIG,
} from "./payrollMath.js";
import {
  validateAttendanceSummary,
  validatePayrollLine,
} from "./payrollSchemas.js";


// ═══════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════

const DEFAULT_ATTENDANCE_RULES = {
  standardStartTime: "09:00",
  standardEndTime: "17:00",
  gracePeriodMinutes: 15,
  monthlyGraceUsesEnabled: false,
  monthlyGraceUsesAllowed: 3,
  workingDaysPerMonth: 22,
  lateDeductionTiers: [],
  absenceDeductionDays: 1,
  earlyDepartureDeductionDays: 0,
  incompleteRecordDeductionDays: 0,
  unpaidLeaveDeductionDays: 1,
  weeklyRestDays: [5, 6],
};

const SNAPSHOT_COMPARISON_FIELDS = [
  "grossSalary",
  "totalAdditions",
  "totalDeductions",
  "employeeInsurance",
  "monthlyTax",
  "attendanceDeduction",
  "advanceAmount",
  "overtimePay",
  "extraDaysPay",
  "assessmentBonus",
  "netSalary",
];

const EDITABLE_RECORD_FIELDS = [
  "baseSalary",
  "allowances",
  "workingDays",
  "daysPresent",
  "daysAbsent",
  "overtimeHours",
  "fixedBonus",
  "assessmentBonus",
  "attendanceDeduction",
  "fixedDeduction",
  "advanceAmount",
  "isInsured",
  "subscriptionWage",
];

const UNPAID_LEAVE_TYPES = new Set(["UNPAID"]);


// ═══════════════════════════════════════════════════════
// SECTION A: PERIOD & POLICY RESOLUTION
// ═══════════════════════════════════════════════════════

/**
 * Resolve fiscal month date range [start, end) using company month start day.
 * Unified — was duplicated as `resolveMonthRange` and `resolveRunPeriodRange`.
 */
function resolveMonthRange(year, month, companyMonthStartDay) {
  const refDate = new Date(Date.UTC(year, month - 1, 15));
  const periodStart = fiscalMonthPeriodStartUtc(refDate, companyMonthStartDay);

  const nextMonthIdx = periodStart.getUTCMonth() + 1;
  const nextYear =
    nextMonthIdx > 11
      ? periodStart.getUTCFullYear() + 1
      : periodStart.getUTCFullYear();
  const normalizedNextMonth = nextMonthIdx > 11 ? 0 : nextMonthIdx;

  const nextMonthLastDay = new Date(
    Date.UTC(nextYear, normalizedNextMonth + 1, 0),
  ).getUTCDate();
  const nextAnchorDay = Math.min(companyMonthStartDay, nextMonthLastDay);
  const periodEnd = new Date(
    Date.UTC(nextYear, normalizedNextMonth, nextAnchorDay, 0, 0, 0, 0),
  );

  return { periodStart, periodEnd };
}

function buildPayrollConfigFromOrgPolicy(orgPolicy) {
  const config = { ...DEFAULT_PAYROLL_CONFIG, ...(orgPolicy?.payrollConfig || {}) };
  if (orgPolicy?.payrollConfig?.insuranceRates) {
    config.insuranceRates = { ...DEFAULT_PAYROLL_CONFIG.insuranceRates, ...orgPolicy.payrollConfig.insuranceRates };
  }
  if (!config.taxBrackets?.length) {
    config.taxBrackets = DEFAULT_PAYROLL_CONFIG.taxBrackets;
  }
  config.workingDaysPerMonth = resolveWorkingDaysPerMonth(orgPolicy);
  return config;
}

export async function resolvePayrollConfig() {
  const orgPolicy = await OrganizationPolicy.findOne({ name: "default" }).lean();
  return buildPayrollConfigFromOrgPolicy(orgPolicy);
}


// ═══════════════════════════════════════════════════════
// SECTION B: ATTENDANCE ANALYSIS
// ═══════════════════════════════════════════════════════

/**
 * Generate the set of expected working dates in the period.
 * Excludes configured weekly rest days (UTC weekdays).
 */
function expectedWorkingDates(periodStart, periodEnd, weeklyRestDays) {
  const rest = weeklyRestDaySet(weeklyRestDays);
  const dates = [];
  const d = new Date(periodStart);
  while (d < periodEnd) {
    const dow = d.getUTCDay();
    if (!rest.has(dow)) {
      dates.push(new Date(d));
    }
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return dates;
}

function lateMinutes(checkInStr, policy, lateGraceAddMinutes) {
  const baseGrace = policy.gracePeriodMinutes ?? policy.gracePeriod ?? 15;
  const add = lateGraceAddMinutes !== undefined ? lateGraceAddMinutes : baseGrace;
  return lateMinutesForTiers(checkInStr, policy, { lateGraceAddMinutes: add });
}

/** Human-readable lateness for logs. */
function formatLateDurationForNote(minutesLate) {
  if (minutesLate == null || !Number.isFinite(minutesLate) || minutesLate <= 0) return "0 min";
  const totalSec = Math.round(minutesLate * 60);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (s === 0) return `${m} min`;
  return `${m} min ${s} s`;
}

function leaveCoversDate(leaves, dateStr) {
  const dt = new Date(dateStr + "T00:00:00.000Z").getTime();
  for (const lr of leaves) {
    if (lr.kind === "VACATION") {
      const s = new Date(lr.startDate).setUTCHours(0, 0, 0, 0);
      const e = new Date(lr.endDate).setUTCHours(23, 59, 59, 999);
      if (dt >= s && dt <= e) return {
        covered: true,
        leaveType: lr.leaveType || "ANNUAL",
        effectivePaymentType: lr.effectivePaymentType,
        kind: "VACATION",
      };
    } else if (lr.kind === "EXCUSE" && lr.excuseDate) {
      const ed = new Date(lr.excuseDate).toISOString().slice(0, 10);
      if (ed === dateStr) return {
        covered: true,
        leaveType: null,
        effectivePaymentType: lr.effectivePaymentType,
        kind: "EXCUSE",
        quotaExceeded: lr.quotaExceeded,
        excessDeductionMethod: lr.excessDeductionMethod,
        excessDeductionAmount: lr.excessDeductionAmount,
      };
    }
  }
  return { covered: false };
}

/**
 * Core monthly attendance analysis.
 *
 * FIX #2: Accepts pre-loaded orgPolicy to avoid duplicate DB reads when called
 *         from the payroll pipeline. Falls back to reading from DB when called
 *         standalone (e.g. from attendance routes).
 *
 * FIX #1: Uses `roundMoney(v, dp)` from payrollMath.js instead of the old
 *         hardcoded `r2 = (v) => Math.round(v * 100) / 100`. This ensures
 *         attendance and payroll use the same rounding precision.
 *
 * @param {number} year
 * @param {number} month 1-12
 * @param {string} [departmentId]
 * @param {object} [options]
 * @param {object} [options._orgPolicy] - pre-loaded policy (internal use)
 */
export async function computeMonthlyAnalysis(year, month, departmentId, options = {}) {
  const includeDetails = options.includeDetails !== false;

  // FIX #2: Use pre-loaded policy if available, otherwise read from DB
  const orgPolicy = options._orgPolicy
    || await OrganizationPolicy.findOne({ name: "default" }).lean();

  const rules = orgPolicy?.attendanceRules
    ? { ...DEFAULT_ATTENDANCE_RULES, ...orgPolicy.attendanceRules }
    : { ...DEFAULT_ATTENDANCE_RULES };
  rules.workingDaysPerMonth = resolveWorkingDaysPerMonth(orgPolicy);

  // FIX #1: Resolve decimal places from policy config, use unified rounding
  const dp = clampDecimalPlaces(orgPolicy?.payrollConfig?.decimalPlaces);
  const rnd = (v) => roundMoney(v, dp);

  const companyStartDay = getCompanyMonthStartDay(orgPolicy);
  const { periodStart, periodEnd } = resolveMonthRange(year, month, companyStartDay);

  const attendanceIds = await Attendance.distinct("employeeId", {
    date: { $gte: periodStart, $lt: periodEnd },
  });
  const leaveIds = await LeaveRequest.distinct("employeeId", {
    status: "APPROVED",
    $or: [
      { kind: "VACATION", startDate: { $lt: periodEnd }, endDate: { $gte: periodStart } },
      { kind: "EXCUSE", excuseDate: { $gte: periodStart, $lt: periodEnd } },
    ],
  });
  const assessmentIds = await Assessment.distinct("employeeId", {
    "assessment.period.year": year,
    "assessment.period.month": month,
    "assessment.bonusStatus": "APPROVED",
  });

  // Also check new PerformanceReview model
  const prAssessmentIds = await PerformanceReview.distinct("employeeId", {
    "period.year": year,
    "period.month": month,
    bonusStatus: "APPROVED",
  });

  const activityIds = [...new Set([
    ...attendanceIds.map((id) => String(id)),
    ...leaveIds.map((id) => String(id)),
    ...assessmentIds.map((id) => String(id)),
    ...prAssessmentIds.map((id) => String(id)),
  ])];

  const empFilter = {
    $or: [
      // Active employees: both flags must agree to avoid desync edge-cases
      { isActive: true, status: { $nin: ["TERMINATED", "RESIGNED"] } },
      // Include separated employees that have activity in this period
      { _id: { $in: activityIds } },
    ],
  };
  if (departmentId) empFilter.departmentId = departmentId;
  const employees = await Employee.find(empFilter)
    .select("_id fullName email employeeCode department departmentId financial dateOfHire")
    .lean();

  const empIds = employees.map((e) => e._id);

  const assessmentPayrollRules = orgPolicy?.assessmentPayrollRules || {};

  // Legacy Assessment model
  const assessmentDocs = await Assessment.find({
    employeeId: { $in: empIds },
    "assessment.period.year": year,
    "assessment.period.month": month,
    "assessment.bonusStatus": "APPROVED",
  }).lean();

  const assessmentByEmp = new Map();
  for (const doc of assessmentDocs) {
    const eid = String(doc.employeeId);
    for (const a of doc.assessment) {
      if (
        a.period?.year === year &&
        a.period?.month === month &&
        a.bonusStatus === "APPROVED"
      ) {
        if (!assessmentByEmp.has(eid)) assessmentByEmp.set(eid, []);
        assessmentByEmp.get(eid).push(a);
      }
    }
  }

  // New PerformanceReview model — merge into same map
  const prDocs = await PerformanceReview.find({
    employeeId: { $in: empIds },
    "period.year": year,
    "period.month": month,
    bonusStatus: "APPROVED",
  }).lean();

  for (const pr of prDocs) {
    const eid = String(pr.employeeId);
    if (!assessmentByEmp.has(eid)) assessmentByEmp.set(eid, []);
    assessmentByEmp.get(eid).push({
      _id: pr._id,
      _sourceModel: "PerformanceReview",
      daysBonus: pr.daysBonus || 0,
      overtime: pr.overtime || 0,
      deduction: pr.deduction || 0,
      deductionType: pr.deductionType || "AMOUNT",
      bonusStatus: pr.bonusStatus,
      period: pr.period,
      evaluatorId: pr.evaluatorId,
    });
  }

  const attendanceRecords = await Attendance.find({
    employeeId: { $in: empIds },
    date: { $gte: periodStart, $lt: periodEnd },
  }).lean();

  const leaveRequests = await LeaveRequest.find({
    employeeId: { $in: empIds },
    status: "APPROVED",
    $or: [
      { kind: "VACATION", startDate: { $lt: periodEnd }, endDate: { $gte: periodStart } },
      { kind: "EXCUSE", excuseDate: { $gte: periodStart, $lt: periodEnd } },
    ],
  }).lean();

  // Declared company holidays that overlap this period.
  const declaredHolidays = await CompanyHoliday.find({
    startDate: { $lte: periodEnd },
    endDate: { $gte: periodStart },
  }).lean();

  const workDates = expectedWorkingDates(periodStart, periodEnd, rules.weeklyRestDays);
  const workDateStrings = new Set(workDates.map((d) => d.toISOString().slice(0, 10)));

  const attByEmp = new Map();
  for (const rec of attendanceRecords) {
    const eid = String(rec.employeeId);
    if (!attByEmp.has(eid)) attByEmp.set(eid, []);
    attByEmp.get(eid).push(rec);
  }

  const leaveByEmp = new Map();
  for (const lr of leaveRequests) {
    const eid = String(lr.employeeId);
    if (!leaveByEmp.has(eid)) leaveByEmp.set(eid, []);
    leaveByEmp.get(eid).push(lr);
  }

  const summary = [];
  const details = [];

  for (const emp of employees) {
    const eid = String(emp._id);
    const empAttendance = attByEmp.get(eid) || [];
    const empLeaves = leaveByEmp.get(eid) || [];
    const hireDate = emp.dateOfHire ? new Date(emp.dateOfHire) : null;
    if (hireDate && !Number.isNaN(hireDate.getTime())) {
      hireDate.setUTCHours(0, 0, 0, 0);
    }

    const effectiveStart =
      hireDate && hireDate > periodStart ? hireDate : periodStart;
    const empWorkDates = workDates.filter((d) => d >= effectiveStart);

    const calendarDaysInPeriod = Math.round((periodEnd - periodStart) / 86400000);
    const employeeCalendarDays = Math.round((periodEnd - effectiveStart) / 86400000);
    const isPartialPeriod = effectiveStart > periodStart;

    const attByDate = new Map();
    for (const rec of empAttendance) {
      const ds = new Date(rec.date).toISOString().slice(0, 10);
      attByDate.set(ds, rec);
    }

    const empSortedMonthAsc = [...empAttendance].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    let presentDays = 0;
    let lateDays = 0;
    let absentDays = 0;
    let onLeaveDays = 0;
    let paidLeaveDays = 0;
    let unpaidLeaveDays = 0;
    let excusedDays = 0;
    let partialExcusedDays = 0;
    let earlyDepartureDays = 0;
    let incompleteDays = 0;
    let holidayDays = 0;
    let totalHoursWorked = 0;
    let totalExcusedMinutes = 0;
    let lateDeductionTotal = 0;
    let absenceDeductionTotal = 0;
    let earlyDepartureDeductionTotal = 0;
    let incompleteDeductionTotal = 0;
    let unpaidLeaveDeductionTotal = 0;
    let excessExcuseDeductionTotal = 0;
    let excessExcuseAmountDeductionTotal = 0;
    let vacationBalanceDeductionTotal = 0;

    const dailyRows = [];

    for (const wd of empWorkDates) {
      const ds = wd.toISOString().slice(0, 10);
      const rec = attByDate.get(ds);
      const notes = [];

      // Declared holiday check has the highest priority.
      const holidayMatch = isHolidayForEmployee(declaredHolidays, ds, emp._id, emp.departmentId);
      if (holidayMatch.isHoliday) {
        holidayDays++;
        dailyRows.push({
          date: ds,
          status: "HOLIDAY",
          checkIn: rec?.checkIn ?? null,
          checkOut: rec?.checkOut ?? null,
          rawHours: rec?.totalHours ?? 0,
          excusedMinutes: 0,
          effectiveHours: rec?.totalHours ?? 0,
          mergedPunches: rec?.rawPunches ?? 0,
          deduction: 0,
          notes: [`Declared holiday: ${holidayMatch.title}`],
        });
        continue;
      }

      if (rec) {
        const hrs = rec.totalHours || 0;
        const excMin = rec.excusedMinutes || 0;
        totalHoursWorked += hrs;
        totalExcusedMinutes += excMin;

        let dayDeduction = 0;

        const baseGrace = rules.gracePeriodMinutes ?? rules.gracePeriod ?? 15;
        const monthlyAllowed = Math.floor(Number(rules.monthlyGraceUsesAllowed)) || 0;
        const monthlyOn = rules.monthlyGraceUsesEnabled === true && monthlyAllowed > 0;
        const usesBefore = monthlyOn
          ? countMonthlyGraceUsesBeforeTarget({
            sortedMonthRowsAsc: empSortedMonthAsc,
            targetUtcMidnight: wd,
            shiftStartStr: rules.standardStartTime || "09:00",
            baseGraceMinutes: baseGrace,
            monthlyGraceUsesEnabled: true,
            monthlyGraceUsesAllowed: monthlyAllowed,
            weeklyRestDays: rules.weeklyRestDays,
            holidays: declaredHolidays,
            employeeId: emp._id,
            departmentId: emp.departmentId,
          })
          : 0;
        const lateGraceAdd = effectiveLateGraceAddMinutes({
          monthlyGraceUsesEnabled: monthlyOn,
          monthlyGraceUsesAllowed: monthlyAllowed,
          graceUsesBeforeTargetDate: usesBefore,
          baseGraceMinutes: baseGrace,
        });

        let effectiveStatus = rec.status;
        if (monthlyOn) {
          const preserveTimingOverride =
            rec.status === "OVERTIME"
            || rec.status === "ON_LEAVE"
            || rec.onApprovedLeave
            || rec.status === "HOLIDAY"
            || (rec.status === "EXCUSED" && rec.originalStatus === "LATE")
            || (rec.status === "EXCUSED" && !rec.originalStatus)
            || rec.status === "PARTIAL_EXCUSED";
          if (!preserveTimingOverride) {
            const core = calculateTimingStatus(rec.checkIn, rec.checkOut, rules, {
              lateGraceAddMinutes: lateGraceAdd,
            });
            if (["PRESENT", "LATE", "EARLY_DEPARTURE", "INCOMPLETE"].includes(core.status)) {
              effectiveStatus = core.status;
            }
          }
        }

        switch (effectiveStatus) {
          case "PRESENT":
            presentDays++;
            break;
          case "LATE": {
            lateDays++;
            const mins = lateMinutes(rec.checkIn, rules, lateGraceAdd);
            const shiftStr = rules.standardStartTime || "09:00";
            const ded = deductionForLateWithMonthlyGraceExhaustion(
              rec.checkIn,
              shiftStr,
              rules.lateDeductionTiers,
              baseGrace,
              lateGraceAdd,
            );
            lateDeductionTotal += ded;
            dayDeduction = ded;
            const lateSec = lateSecondsAfterShiftStart(rec.checkIn, shiftStr);
            const firstIv = tierIntervalsSecondsFromPolicy(rules.lateDeductionTiers || [])[0];
            const baseGraceSec = Math.max(0, Math.floor(baseGrace * 60));
            const graceBandNote =
              lateGraceAdd === 0 &&
              baseGrace > 0 &&
              lateSec > 0 &&
              firstIv &&
              (lateSec <= baseGraceSec || lateSec < firstIv.lo)
                ? " (grace quota exhausted — first tier rate for early lateness)"
                : "";
            notes.push(
              `Late by ${formatLateDurationForNote(mins)} after shift start — ${ded} day(s) deducted${graceBandNote}`,
            );
            break;
          }
          case "EXCUSED": {
            excusedDays++;
            presentDays++;
            const excessEnabled = rules.excessExcuseDeductionEnabled !== false;
            if (excessEnabled && rec.excessExcuse && rec.excessExcuseFraction > 0) {
              const frac = rec.excessExcuseFraction;
              excessExcuseDeductionTotal += frac;
              dayDeduction = frac;
              notes.push(`Excuse covers lateness but quota exceeded — ${frac.toFixed(2)} day(s) deducted from salary`);
            } else {
              notes.push("Lateness covered by approved excuse");
            }
            break;
          }
          case "PARTIAL_EXCUSED": {
            partialExcusedDays++;
            excusedDays++;
            presentDays++;
            const source = rec.deductionSource;
            const validSource = source === "SALARY" || source === "VACATION_BALANCE";
            const pendingDecision = rec.requiresDeductionDecision || !validSource;
            const valueType = String(rec.deductionValueType || "").toUpperCase();
            const value = Number(rec.deductionValue);
            const fallbackDays = Number(rec.excessExcuseFraction) || 0;
            const resolvedDays = valueType === "DAYS" && Number.isFinite(value) && value > 0
              ? value
              : fallbackDays;
            const resolvedAmount = valueType === "AMOUNT" && Number.isFinite(value) && value > 0
              ? value
              : 0;

            if (resolvedDays > 0 || resolvedAmount > 0) {
              if (pendingDecision) {
                notes.push(
                  "Partial excuse overage pending HR deduction source decision (no deduction applied)",
                );
              } else if (source === "VACATION_BALANCE") {
                vacationBalanceDeductionTotal += resolvedDays;
                notes.push(`Partial excuse overage — ${resolvedDays.toFixed(2)} day(s) routed to vacation balance`);
              } else {
                if (valueType === "AMOUNT" && resolvedAmount > 0) {
                  excessExcuseAmountDeductionTotal += resolvedAmount;
                  notes.push(`Partial excuse overage — ${resolvedAmount.toFixed(2)} salary amount deducted`);
                } else {
                  excessExcuseDeductionTotal += resolvedDays;
                  dayDeduction = resolvedDays;
                  notes.push(`Partial excuse overage — ${resolvedDays.toFixed(2)} day(s) deducted from salary`);
                }
              }
            } else {
              notes.push("Partial excuse overage with no HR deduction value configured");
            }
            if (pendingDecision) {
              notes.push("HR deduction source decision pending");
            }
            break;
          }
          case "EARLY_DEPARTURE":
            earlyDepartureDays++;
            earlyDepartureDeductionTotal += rules.earlyDepartureDeductionDays;
            dayDeduction = rules.earlyDepartureDeductionDays;
            notes.push(`Early departure — ${rules.earlyDepartureDeductionDays} day(s) deducted`);
            break;
          case "INCOMPLETE":
            incompleteDays++;
            incompleteDeductionTotal += rules.incompleteRecordDeductionDays;
            dayDeduction = rules.incompleteRecordDeductionDays;
            notes.push("Check-in only — no checkout recorded");
            break;
          case "ON_LEAVE": {
            onLeaveDays++;
            const lm = leaveCoversDate(empLeaves, ds);
            if (!lm.covered) {
              notes.push("On leave (no matching leave request — 0 deduction)");
            } else if (lm.effectivePaymentType === "UNPAID" || UNPAID_LEAVE_TYPES.has(lm.leaveType)) {
              unpaidLeaveDays++;
              const ded = rules.unpaidLeaveDeductionDays ?? 1;
              unpaidLeaveDeductionTotal += ded;
              dayDeduction = ded;
              notes.push(`Unpaid leave — ${ded} day(s) deducted`);
            } else {
              paidLeaveDays++;
              notes.push("On approved leave (paid)");
            }
            break;
          }
          case "ABSENT":
            absentDays++;
            absenceDeductionTotal += rules.absenceDeductionDays;
            dayDeduction = rules.absenceDeductionDays;
            notes.push("Absent — no approved leave");
            break;
          default:
            presentDays++;
        }

        if (excMin > 0) {
          notes.push(`${excMin} min credited from mid-day excuse`);
        }

        dailyRows.push({
          date: ds,
          status: effectiveStatus,
          checkIn: rec.checkIn,
          checkOut: rec.checkOut,
          rawHours: hrs,
          excusedMinutes: excMin,
          effectiveHours: hrs + excMin / 60,
          mergedPunches: rec.rawPunches || 1,
          deduction: dayDeduction,
          notes,
        });
      } else {
        const leaveMatch = leaveCoversDate(empLeaves, ds);
        if (leaveMatch.covered) {
          if (leaveMatch.kind === "EXCUSE") {
            excusedDays++;
            let excDeduction = 0;
            const notesList = ["Approved excuse (no attendance record)"];
            if (leaveMatch.quotaExceeded && leaveMatch.excessDeductionMethod === "SALARY") {
               excDeduction = leaveMatch.excessDeductionAmount || 0;
               if (excDeduction > 0) {
                 excessExcuseDeductionTotal += excDeduction;
                 notesList.push(`Excess excuse deduction applied (${excDeduction} days)`);
               }
            }
            dailyRows.push({
              date: ds, status: "EXCUSED", checkIn: null, checkOut: null,
              rawHours: 0, excusedMinutes: 0, effectiveHours: 0,
              mergedPunches: 0, deduction: excDeduction, leaveType: null,
              notes: notesList,
            });
          } else {
            const isUnpaid = leaveMatch.effectivePaymentType === "UNPAID" || UNPAID_LEAVE_TYPES.has(leaveMatch.leaveType);
            onLeaveDays++;
            if (isUnpaid) {
              unpaidLeaveDays++;
              const ded = rules.unpaidLeaveDeductionDays ?? 1;
              unpaidLeaveDeductionTotal += ded;
              dailyRows.push({
                date: ds, status: "ON_LEAVE", checkIn: null, checkOut: null,
                rawHours: 0, excusedMinutes: 0, effectiveHours: 0,
                mergedPunches: 0, deduction: ded, leaveType: leaveMatch.leaveType,
                notes: [`Unpaid leave — ${ded} day(s) deducted`],
              });
            } else {
              paidLeaveDays++;
              dailyRows.push({
                date: ds, status: "ON_LEAVE", checkIn: null, checkOut: null,
                rawHours: 0, excusedMinutes: 0, effectiveHours: 0,
                mergedPunches: 0, deduction: 0, leaveType: leaveMatch.leaveType,
                notes: [`On approved ${leaveMatch.leaveType} leave (paid)`],
              });
            }
          }
        } else {
          absentDays++;
          absenceDeductionTotal += rules.absenceDeductionDays;
          dailyRows.push({
            date: ds, status: "ABSENT", checkIn: null, checkOut: null,
            rawHours: 0, excusedMinutes: 0, effectiveHours: 0,
            mergedPunches: 0, deduction: rules.absenceDeductionDays,
            notes: ["No record — marked ABSENT"],
          });
        }
      }
    }

    const totalDeductionDays =
      lateDeductionTotal +
      absenceDeductionTotal +
      earlyDepartureDeductionTotal +
      incompleteDeductionTotal +
      unpaidLeaveDeductionTotal +
      excessExcuseDeductionTotal;

    const workingDays = empWorkDates.length;
    const daysWithHours = presentDays + lateDays + excusedDays + earlyDepartureDays + incompleteDays;
    const avgDailyHours = daysWithHours > 0 ? totalHoursWorked / daysWithHours : 0;

    const baseSalary = Number(emp.financial?.baseSalary) || 0;
    const allowances = Number(emp.financial?.allowances) || 0;
    const grossSalary = baseSalary + allowances;
    const wdpm = rules.workingDaysPerMonth;
    // FIX #1: Use unified rounding `rnd` from payrollMath instead of hardcoded r2
    const rawDailyRate = grossSalary > 0 ? grossSalary / wdpm : 0;
    const dailyRate = rnd(rawDailyRate);

    const lateDeductionAmount = rnd(lateDeductionTotal * rawDailyRate);
    const absenceDeductionAmount = rnd(absenceDeductionTotal * rawDailyRate);
    const unpaidLeaveDeductionAmount = rnd(unpaidLeaveDeductionTotal * rawDailyRate);
    const earlyDepartureDeductionAmount = rnd(earlyDepartureDeductionTotal * rawDailyRate);
    const incompleteDeductionAmount = rnd(incompleteDeductionTotal * rawDailyRate);
    const excessExcuseDeductionAmount = rnd(excessExcuseDeductionTotal * rawDailyRate);
    const excessExcuseAmountDeductionAmount = rnd(excessExcuseAmountDeductionTotal);
    const totalDeductionAmount = rnd(
      lateDeductionAmount + absenceDeductionAmount + unpaidLeaveDeductionAmount +
      earlyDepartureDeductionAmount + incompleteDeductionAmount +
      excessExcuseDeductionAmount + excessExcuseAmountDeductionAmount,
    );

    let assessmentBonusAmount = 0;
    let assessmentOvertimeAmount = 0;
    let assessmentDeductionAmount = 0;
    let assessmentRawBonusDays = 0;
    let assessmentRawOvertimeUnits = 0;
    let assessmentRawDeductionEgp = 0;
    let assessmentApprovedOvertimeUnits = 0;
    const empAssessments = assessmentByEmp.get(eid) || [];
    for (const a of empAssessments) {
      assessmentApprovedOvertimeUnits += Math.max(0, Number(a.overtime) || 0);
      if (assessmentPayrollRules.bonusDaysEnabled && a.daysBonus > 0) {
        const mult = assessmentPayrollRules.bonusDayMultiplier ?? 1;
        assessmentBonusAmount += rnd(a.daysBonus * mult * rawDailyRate);
        assessmentRawBonusDays += Number(a.daysBonus) || 0;
      }
      if (assessmentPayrollRules.overtimeEnabled && a.overtime > 0) {
        const mult = assessmentPayrollRules.overtimeDayMultiplier ?? 1.5;
        assessmentOvertimeAmount += rnd(a.overtime * mult * rawDailyRate);
        assessmentRawOvertimeUnits += Number(a.overtime) || 0;
      }
      if (assessmentPayrollRules.deductionEnabled && a.deduction > 0) {
        const mult = assessmentPayrollRules.deductionDayMultiplier ?? 1;
        // deductionType="DAYS": convert to EGP using dailyRate (mirrors daysBonus logic)
        // deductionType="AMOUNT" (default/legacy): use value directly as EGP
        const isInDays = a.deductionType === "DAYS";
        assessmentDeductionAmount += isInDays
          ? rnd(a.deduction * mult * rawDailyRate)
          : rnd(a.deduction * mult);
        assessmentRawDeductionEgp += Number(a.deduction) || 0;
      }
    }
    // Build snapshot list for PayrollRecord (preserves data even if assessment is later deleted)
    const assessmentSnapshotList = empAssessments.map(a => ({
      assessmentId: a._id,
      sourceModel: a._sourceModel || "PerformanceReview",
      evaluatorId: a.evaluatorId,
      period: a.period,
      daysBonus: a.daysBonus || 0,
      overtime: a.overtime || 0,
      deduction: a.deduction || 0,
      deductionType: a.deductionType || "AMOUNT",
      bonusStatus: a.bonusStatus,
      snapshotAt: new Date(),
    }));
    const assessmentNetAmount = rnd(assessmentBonusAmount + assessmentOvertimeAmount - assessmentDeductionAmount);

    const netSalary = rnd(Math.max(0, grossSalary - totalDeductionAmount + assessmentNetAmount));

    const summaryRow = {
      employeeId: emp._id,
      employeeCode: emp.employeeCode,
      fullName: emp.fullName,
      department: emp.department,
      workingDays,
      calendarDaysInPeriod,
      employeeCalendarDays,
      isPartialPeriod,
      presentDays,
      lateDays,
      absentDays,
      onLeaveDays,
      paidLeaveDays,
      unpaidLeaveDays,
      excusedDays,
      partialExcusedDays,
      earlyDepartureDays,
      incompleteDays,
      holidayDays,
      totalHoursWorked: rnd(totalHoursWorked),
      totalExcusedMinutes,
      avgDailyHours: rnd(avgDailyHours),
      deductions: {
        // ── Authoritative counts (consumed by payroll engine to compute EGP) ──
        lateDays: rnd(lateDeductionTotal),
        absenceDays: rnd(absenceDeductionTotal),
        unpaidLeaveDays: rnd(unpaidLeaveDeductionTotal),
        earlyDepartureDays: rnd(earlyDepartureDeductionTotal),
        incompleteDays: rnd(incompleteDeductionTotal),
        excessExcuseDays: rnd(excessExcuseDeductionTotal),
        excessExcuseAmount: excessExcuseAmountDeductionAmount,
        vacationBalanceDays: rnd(vacationBalanceDeductionTotal),
        totalDeductionDays: rnd(totalDeductionDays),
        // ── Display-only EGP estimates (UI / attendance report) — NOT read by payroll ──
        lateAmount: lateDeductionAmount,
        absenceAmount: absenceDeductionAmount,
        unpaidLeaveAmount: unpaidLeaveDeductionAmount,
        earlyDepartureAmount: earlyDepartureDeductionAmount,
        incompleteAmount: incompleteDeductionAmount,
        excessExcuseAmount: rnd(excessExcuseDeductionAmount + excessExcuseAmountDeductionAmount),
        excessExcuseAmountFromDays: excessExcuseDeductionAmount,
        excessExcuseAmountDirect: excessExcuseAmountDeductionAmount,
        totalAmount: totalDeductionAmount,
      },
      netEffectiveDays: rnd(workingDays - totalDeductionDays),
      baseSalary,
      allowances,
      grossSalary,
      dailyRate,
      assessmentBonus: assessmentBonusAmount,
      assessmentOvertime: assessmentOvertimeAmount,
      assessmentDeduction: assessmentDeductionAmount,
      assessmentNet: assessmentNetAmount,
      assessmentRawBonusDays: rnd(assessmentRawBonusDays),
      assessmentRawOvertimeUnits: rnd(assessmentRawOvertimeUnits),
      assessmentRawDeductionEgp: rnd(assessmentRawDeductionEgp),
      assessmentCount: empAssessments.length,
      assessmentSnapshotList,   // ← carries per-assessment details to payroll engine
      netSalary,
      assessmentApprovedOvertimeUnits: rnd(assessmentApprovedOvertimeUnits),
    };

    // FIX #3: Validate attendance summary before payroll consumes it
    validateAttendanceSummary(summaryRow, { strict: false });

    summary.push(summaryRow);

    if (includeDetails) {
      details.push({
        employeeId: emp._id,
        employeeCode: emp.employeeCode,
        fullName: emp.fullName,
        department: emp.department,
        days: dailyRows,
      });
    }
  }

  return {
    period: {
      year,
      month,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      expectedWorkingDays: workDates.length,
    },
    policySnapshot: rules,
    summary,
    details: includeDetails ? details : [],
  };
}


// ═══════════════════════════════════════════════════════
// SECTION C: PAYROLL LINE MATH
// ═══════════════════════════════════════════════════════

/**
 * Core payroll line math (used by batch compute and manual record edits).
 * @param {object} input
 * @param {object} config - merged org payroll config
 */
export function computePayrollLineFromInputs(input, config) {
  const dp = clampDecimalPlaces(config?.decimalPlaces);
  const rnd = (v) => roundMoney(v, dp);

  const baseSalary = rnd(Number(input.baseSalary) || 0);
  const allowances = rnd(Number(input.allowances) || 0);
  const grossSalary = rnd(baseSalary + allowances);

  const wdpm = config.workingDaysPerMonth || DEFAULT_WORKING_DAYS_PER_MONTH;
  const hpd = config.hoursPerDay || 8;
  const rawDailyRate = grossSalary > 0 ? grossSalary / wdpm : 0;
  const rawHourlyRate = rawDailyRate > 0 ? rawDailyRate / hpd : 0;
  const salaryPerDay = rnd(rawDailyRate);
  const salaryPerHour = rnd(rawHourlyRate);

  // Pro-rate for partial-period employees (mid-month hire).
  const empCalDays = Number(input.employeeCalendarDays) || 0;
  const periodCalDays = Number(input.calendarDaysInPeriod) || 0;
  const isPartialPeriod = Boolean(input.isPartialPeriod);
  const proRateFactor = isPartialPeriod && periodCalDays > 0
    ? Math.min(empCalDays / periodCalDays, 1)
    : 1;
  const effectiveGross = rnd(grossSalary * proRateFactor);

  const overtimeHrs = rnd(Number(input.overtimeHours) || 0);
  const extraDays = Number(input.extraDaysWorked) || 0;
  const overtimePay = rnd(overtimeHrs * rawHourlyRate * (config.overtimeMultiplier || 1.5));
  const extraDaysPay = rnd(extraDays * rawDailyRate);
  const fixedBonus = rnd(Number(input.fixedBonus) || 0);
  const assessmentBonus = rnd(Number(input.assessmentBonus) || 0);
  const totalAdditions = rnd(overtimePay + extraDaysPay + fixedBonus + assessmentBonus);

  const workingDays = Number(input.workingDays) || 0;
  const daysAbsent = Number(input.daysAbsent) || 0;
  const rawAbsentDeduction = rnd(daysAbsent * rawDailyRate);
  const absentDeduction = (daysAbsent >= workingDays && workingDays > 0)
    ? effectiveGross
    : rawAbsentDeduction;
  const attendanceDeduction = rnd(Number(input.attendanceDeduction) || 0);
  const fixedDeduction = rnd(Number(input.fixedDeduction) || 0);
  const requestedAdvance = rnd(Number(input.advanceAmount) || 0);
  const grossPool = rnd(effectiveGross + totalAdditions);
  const nonAdvanceDeductions = rnd(absentDeduction + attendanceDeduction + fixedDeduction);
  const maxAdvanceDeduction = rnd(Math.max(0, grossPool - nonAdvanceDeductions));
  const advanceAmount = rnd(Math.min(requestedAdvance, maxAdvanceDeduction));
  const totalDeductions = rnd(nonAdvanceDeductions + advanceAmount);

  const dueBeforeInsurance = rnd(effectiveGross + totalAdditions - totalDeductions);

  const isInsured = Boolean(input.isInsured);
  let insuredWage = 0;
  let employeeInsurance = 0;
  let companyInsurance = 0;
  let taxableMonthly = 0;
  let taxableAnnual = 0;
  let annualTax = 0;
  let monthlyTax = 0;
  let martyrsFundDeduction = 0;
  let netSalary = 0;

  if (isInsured) {
    const ir = config.insuranceRates || {};
    const rawWage =
      Number(input.subscriptionWage) > 0 ? Number(input.subscriptionWage) : baseSalary;
    insuredWage = Math.min(Math.max(rawWage, ir.minInsurableWage || 2700), ir.maxInsurableWage || 16700);
    employeeInsurance = rnd(insuredWage * (ir.employeeShare || 0.11));
    companyInsurance = rnd(insuredWage * (ir.companyShare || 0.1875));

    const exemptionMonthly = rnd((config.personalExemptionAnnual || 20000) / 12);
    taxableMonthly = rnd(Math.max(0, dueBeforeInsurance - employeeInsurance - exemptionMonthly));
    taxableAnnual = rnd(taxableMonthly * 12);
    annualTax = computeProgressiveTax(
      taxableAnnual,
      config.taxBrackets || DEFAULT_PAYROLL_CONFIG.taxBrackets,
      dp,
    );
    monthlyTax = rnd(annualTax / 12);

    martyrsFundDeduction = rnd(insuredWage * (config.martyrsFundRate || 0.0005));

    netSalary = rnd(Math.max(0, dueBeforeInsurance - employeeInsurance - monthlyTax - martyrsFundDeduction));
  } else {
    netSalary = rnd(Math.max(0, dueBeforeInsurance));
  }

  return {
    baseSalary,
    allowances,
    grossSalary,
    effectiveGross,
    isPartialPeriod,
    employeeCalendarDays: empCalDays,
    calendarDaysInPeriod: periodCalDays,
    salaryPerDay,
    salaryPerHour,
    workingDays,
    daysPresent: Number(input.daysPresent) || 0,
    daysAbsent,
    overtimeHours: overtimeHrs,
    extraDaysWorked: extraDays,
    overtimePay,
    extraDaysPay,
    fixedBonus,
    assessmentBonus,
    totalAdditions,
    absentDeduction,
    attendanceDeduction,
    fixedDeduction,
    advanceRequested: requestedAdvance,
    advanceAmount,
    totalDeductions,
    dueBeforeInsurance,
    insuredWage,
    employeeInsurance,
    companyInsurance,
    taxableMonthly,
    taxableAnnual,
    annualTax,
    monthlyTax,
    martyrsFundDeduction,
    netSalary,
    isInsured,
  };
}

/**
 * Compute a single employee's payroll record.
 */
function computeEmployeeRecord(
  emp,
  attendanceSummary,
  config,
  overtimeHrs,
  extraDays,
  advanceTotal,
  assessmentNet,
  advanceBreakdown = [],
  inclusionMeta = {},
) {
  const baseSalary = Number(emp.financial?.baseSalary) || 0;
  const allowances = Number(emp.financial?.allowances) || 0;
  const subscriptionWage =
    Number(emp.socialInsurance?.subscriptionWage) > 0
      ? Number(emp.socialInsurance.subscriptionWage)
      : baseSalary;

  const wdpm = config.workingDaysPerMonth || DEFAULT_WORKING_DAYS_PER_MONTH;
  const grossForRate = baseSalary + allowances;
  const rawDailyRate = grossForRate > 0 ? grossForRate / wdpm : 0;

  const lateDeductionDays       = attendanceSummary?.deductions?.lateDays || 0;
  const earlyDepartureDeductionDays = attendanceSummary?.deductions?.earlyDepartureDays || 0;
  const incompleteDeductionDays = attendanceSummary?.deductions?.incompleteDays || 0;
  const unpaidLeaveDeductionDays = attendanceSummary?.deductions?.unpaidLeaveDays || 0;
  const excessExcuseDeductionDays = attendanceSummary?.deductions?.excessExcuseDays || 0;
  const excessExcuseDeductionAmountDirect =
    Number(attendanceSummary?.deductions?.excessExcuseAmountDirect) || 0;

  const nonAbsenceDeductionDays =
    lateDeductionDays +
    earlyDepartureDeductionDays +
    incompleteDeductionDays +
    unpaidLeaveDeductionDays +
    excessExcuseDeductionDays;

  const input = {
    baseSalary,
    allowances,
    overtimeHours: overtimeHrs,
    extraDaysWorked: extraDays,
    fixedBonus: Number(emp.financial?.fixedBonus) || 0,
    assessmentBonus: assessmentNet || 0,
    daysAbsent: attendanceSummary?.absentDays || 0,
    attendanceDeduction: (nonAbsenceDeductionDays * rawDailyRate) + excessExcuseDeductionAmountDirect,
    fixedDeduction: Number(emp.financial?.fixedDeduction) || 0,
    advanceAmount: advanceTotal,
    workingDays: attendanceSummary?.workingDays || 0,
    daysPresent: attendanceSummary?.presentDays || 0,
    isInsured: emp.socialInsurance?.status === "INSURED",
    subscriptionWage,
    calendarDaysInPeriod: attendanceSummary?.calendarDaysInPeriod || 0,
    employeeCalendarDays: attendanceSummary?.employeeCalendarDays || 0,
    isPartialPeriod: attendanceSummary?.isPartialPeriod || false,
  };

  const line = computePayrollLineFromInputs(input, config);
  const dp = clampDecimalPlaces(config?.decimalPlaces);
  const allocatedAdvanceBreakdown = allocateAdvanceBreakdown(advanceBreakdown, line.advanceAmount, dp);

  // FIX #3: Validate payroll line
  validatePayrollLine(line, { strict: false });

  return {
    employeeId: emp._id,
    employeeCode: emp.employeeCode,
    fullName: emp.fullName,
    fullNameArabic: emp.fullNameArabic || "",
    department: emp.department,
    nationalId: emp.idNumber || "",
    insuranceNumber: emp.socialInsurance?.insuranceNumber || "",
    paymentMethod: emp.financial?.paymentMethod || "CASH",
    bankAccount: emp.financial?.bankAccount || "",
    employeeStatus: emp.status || "ACTIVE",
    payrollInclusionReason: inclusionMeta.payrollInclusionReason || "",
    ...line,
    // Attendance status counts
    lateDays: attendanceSummary?.lateDays || 0,
    excusedDays: attendanceSummary?.excusedDays || 0,
    onLeaveDays: attendanceSummary?.onLeaveDays || 0,
    paidLeaveDays: attendanceSummary?.paidLeaveDays || 0,
    unpaidLeaveDays: attendanceSummary?.unpaidLeaveDays || 0,
    earlyDepartureDays: attendanceSummary?.earlyDepartureDays || 0,
    incompleteDays: attendanceSummary?.incompleteDays || 0,
    holidayDays: attendanceSummary?.holidayDays || 0,
    // Penalty-day breakdown
    lateDeductionDays,
    earlyDepartureDeductionDays,
    incompleteDeductionDays,
    unpaidLeaveDeductionDays,
    excessExcuseDeductionDays,
    // Assessment detail
    assessmentBonusDays: attendanceSummary?.assessmentRawBonusDays || 0,
    assessmentBonusAmount: attendanceSummary?.assessmentBonus || 0,
    assessmentOvertimeUnits: attendanceSummary?.assessmentRawOvertimeUnits || 0,
    assessmentOvertimeAmount: attendanceSummary?.assessmentOvertime || 0,
    assessmentDeductionEgp: attendanceSummary?.assessmentRawDeductionEgp || 0,
    assessmentDeductionAmount: attendanceSummary?.assessmentDeduction || 0,
    assessmentCount: attendanceSummary?.assessmentCount || 0,
    advanceBreakdown: allocatedAdvanceBreakdown,
  };
}


// ═══════════════════════════════════════════════════════
// SECTION D: ADVANCES & OVERTIME
// ═══════════════════════════════════════════════════════

/**
 * Compute overtime hours from attendance records.
 */
export async function getOvertimeHours(
  employeeId, periodStart, periodEnd, standardEndTime, decimalPlaces
) {
  const records = await Attendance.find({
    employeeId,
    date: { $gte: periodStart, $lt: periodEnd },
    checkOut: { $exists: true, $ne: null },
  })
    .select("checkOut")
    .lean();

  const endMin = parseTimeToMinutes(standardEndTime || "17:00");
  if (endMin == null) return 0;

  let totalOvertimeMinutes = 0;
  for (const rec of records) {
    if (!rec.checkOut) continue;
    const coMin = parseTimeToMinutes(rec.checkOut);
    if (coMin != null && coMin > endMin) {
      totalOvertimeMinutes += coMin - endMin;
    }
  }
  return roundMoney(totalOvertimeMinutes / 60, decimalPlaces ?? DEFAULT_PAYROLL_CONFIG.decimalPlaces);
}

/**
 * Count attendance records on configured weekly rest days.
 */
export async function getExtraDaysWorked(employeeId, periodStart, periodEnd, weeklyRestDays) {
  const rest = weeklyRestDaySet(weeklyRestDays);
  const records = await Attendance.find({
    employeeId,
    date: { $gte: periodStart, $lt: periodEnd },
    status: { $in: ["PRESENT", "LATE", "EXCUSED"] },
    restDayWorkApproved: true,
  })
    .select("date")
    .lean();

  let count = 0;
  for (const rec of records) {
    const dow = new Date(rec.date).getUTCDay();
    if (rest.has(dow)) count++;
  }
  return count;
}

/**
 * Sum active (un-deducted) advances for an employee.
 */
async function getActiveAdvanceTotal(employeeId, runYear, runMonth) {
  const advances = await EmployeeAdvance.find({
    employeeId,
    status: { $in: ["APPROVED", "ACTIVE"] },
    remainingAmount: { $gt: 0 },
    // Idempotency standard: exclude if already deducted in this EXACT period
    $or: [
      { lastDeductedPeriod: { $exists: false } }, // fallback for old records
      { "lastDeductedPeriod.year": { $ne: runYear } },
      { "lastDeductedPeriod.month": { $ne: runMonth } },
    ],
  }).lean();

  let total = 0;
  const advancesToDeduct = [];
  const advanceBreakdown = [];

  for (const a of advances) {
    if (a.startYear && a.startMonth) {
      if (runYear < a.startYear) continue;
      if (runYear === a.startYear && runMonth < a.startMonth) continue;
    }

    let deduct = a.remainingAmount;
    if (a.paymentType === "INSTALLMENTS" && a.monthlyDeduction > 0) {
      deduct = Math.min(a.monthlyDeduction, a.remainingAmount);
    } else if (!a.paymentType) {
      deduct = a.amount;
    }

    if (deduct > 0) {
      total += deduct;
      advancesToDeduct.push({ id: a._id, amount: deduct });
      advanceBreakdown.push({
        advanceId: a._id,
        reason: a.reason || "",
        paymentType: a.paymentType || "ONE_TIME",
        totalAmount: a.amount || 0,
        remainingBefore: a.remainingAmount || 0,
        deductedThisMonth: deduct,
      });
    }
  }

  return { total, advancesToDeduct, advanceBreakdown };
}

/**
 * Split `cappedTotal` across advance rows (FCFS).
 */
function allocateAdvanceBreakdown(breakdown, cappedTotal, decimalPlaces) {
  const dp = clampDecimalPlaces(decimalPlaces);
  const rnd = (v) => roundMoney(v, dp);
  const cap = rnd(Math.max(0, Number(cappedTotal) || 0));
  if (!Array.isArray(breakdown) || breakdown.length === 0 || cap <= 0) return [];

  const wants = breakdown.map((row) => rnd(Number(row.deductedThisMonth) || 0));
  const totalWant = rnd(wants.reduce((s, w) => s + w, 0));
  if (totalWant <= 0) return [];

  const budget = rnd(Math.min(cap, totalWant));
  let remaining = budget;
  const out = [];

  for (let i = 0; i < breakdown.length; i++) {
    const row = breakdown[i];
    const want = wants[i];
    if (want <= 0 || remaining <= 0) continue;
    const take = rnd(Math.min(want, remaining));
    remaining = rnd(remaining - take);
    out.push({
      advanceId: row.advanceId,
      reason: row.reason,
      paymentType: row.paymentType,
      totalAmount: row.totalAmount,
      remainingBefore: row.remainingBefore,
      deductedThisMonth: take,
    });
  }

  const sumOut = rnd(out.reduce((s, r) => s + r.deductedThisMonth, 0));
  const drift = rnd(budget - sumOut);
  if (out.length > 0 && drift !== 0) {
    const last = out[out.length - 1];
    last.deductedThisMonth = rnd(last.deductedThisMonth + drift);
  }
  return out;
}

/**
 * Mark advances as deducted after payroll finalization.
 */
export async function markAdvancesDeducted(actualDeductions, runId, options = {}) {
  if (!actualDeductions?.length) return;
  const { session = null, decimalPlaces = DEFAULT_PAYROLL_CONFIG.decimalPlaces, period } = options;
  const dp = clampDecimalPlaces(decimalPlaces);
  const tolerance = 1 / 10 ** dp;

  for (const adv of actualDeductions) {
    let q = EmployeeAdvance.findById(adv.id);
    if (session) q = q.session(session);
    const record = await q;
    if (!record) continue;

    const deductedAmount = roundMoney(adv.amount, dp);
    if (deductedAmount <= 0) continue;
    if ((record.remainingAmount || 0) + tolerance < deductedAmount) {
      throw new Error(
        `Advance drift detected for ${String(record._id)}: remaining ${record.remainingAmount} is below payroll deduction ${deductedAmount}.`,
      );
    }

    record.remainingAmount = Math.max(0, record.remainingAmount - deductedAmount);
    if (record.remainingAmount === 0) {
      record.status = "COMPLETED";
    } else {
      record.status = "ACTIVE";
    }

    record.deductedInRunId = runId;
    if (period && period.year && period.month) {
      record.lastDeductedPeriod = { year: period.year, month: period.month };
    }
    record.deductionHistory.push({
      runId,
      amountDeducted: deductedAmount,
      date: new Date()
    });

    await record.save(session ? { session } : undefined);
  }
}


// ═══════════════════════════════════════════════════════
// SECTION E: SNAPSHOTS & DIFF
// ═══════════════════════════════════════════════════════

function buildSnapshotRecord(rec) {
  return {
    employeeId: rec.employeeId,
    employeeCode: rec.employeeCode || "",
    fullName: rec.fullName || "",
    grossSalary: Number(rec.grossSalary) || 0,
    totalAdditions: Number(rec.totalAdditions) || 0,
    totalDeductions: Number(rec.totalDeductions) || 0,
    monthlyTax: Number(rec.monthlyTax) || 0,
    employeeInsurance: Number(rec.employeeInsurance) || 0,
    netSalary: Number(rec.netSalary) || 0,
    attendanceDeduction: Number(rec.attendanceDeduction) || 0,
    advanceAmount: Number(rec.advanceAmount) || 0,
    overtimePay: Number(rec.overtimePay) || 0,
    extraDaysPay: Number(rec.extraDaysPay) || 0,
    assessmentBonus: Number(rec.assessmentBonus) || 0,
  };
}

function sumRecordAdvanceBreakdown(record, decimalPlaces) {
  const dp = clampDecimalPlaces(decimalPlaces);
  const total = (record.advanceBreakdown || []).reduce(
    (sum, row) => sum + (Number(row?.deductedThisMonth) || 0),
    0,
  );
  return roundMoney(total, dp);
}

function buildDeterministicAdvanceDeductions(records, decimalPlaces) {
  const dp = clampDecimalPlaces(decimalPlaces);
  const tolerance = 1 / 10 ** dp;
  const byAdvance = new Map();

  for (const rec of records) {
    const expected = roundMoney(Number(rec.advanceAmount) || 0, dp);
    const breakdownSum = sumRecordAdvanceBreakdown(rec, dp);
    if (Math.abs(expected - breakdownSum) > tolerance) {
      throw new Error(
        `Advance breakdown drift for employee ${rec.employeeCode || rec.fullName || rec.employeeId}: expected ${expected}, breakdown ${breakdownSum}.`,
      );
    }
    for (const row of rec.advanceBreakdown || []) {
      const id = row?.advanceId ? String(row.advanceId) : "";
      if (!id) continue;
      const amount = roundMoney(Number(row.deductedThisMonth) || 0, dp);
      if (amount <= 0) continue;
      byAdvance.set(id, roundMoney((byAdvance.get(id) || 0) + amount, dp));
    }
  }

  return [...byAdvance.entries()].map(([id, amount]) => ({ id, amount }));
}

function toSnapshotMap(snapshot) {
  const map = new Map();
  for (const row of snapshot?.records || []) {
    map.set(String(row.employeeId), row);
  }
  return map;
}

export async function getPayrollRunDiff(runId) {
  const run = await PayrollRun.findById(runId)
    .select("_id status computeVersion currentSnapshotId previousSnapshotId")
    .populate("currentSnapshotId")
    .populate("previousSnapshotId")
    .lean();
  if (!run) throw new Error("Payroll run not found");
  if (!run.currentSnapshotId) {
    return {
      runId: String(run._id),
      hasBaseline: false,
      computeVersion: run.computeVersion || 0,
      baselineVersion: null,
      summary: { added: 0, removed: 0, changed: 0, unchanged: 0, netDelta: 0 },
      changes: [],
      unchangedCount: 0,
    };
  }

  const current = run.currentSnapshotId;
  const previous = run.previousSnapshotId || null;
  if (!previous) {
    return {
      runId: String(run._id),
      hasBaseline: false,
      computeVersion: current.computeVersion,
      baselineVersion: null,
      summary: {
        added: (current.records || []).length,
        removed: 0, changed: 0, unchanged: 0,
        netDelta: roundMoney((current.totals?.totalNet || 0), DEFAULT_PAYROLL_CONFIG.decimalPlaces),
      },
      changes: (current.records || []).map((rec) => ({
        employeeId: String(rec.employeeId),
        employeeCode: rec.employeeCode,
        fullName: rec.fullName,
        type: "ADDED",
        before: null,
        after: rec,
        changedFields: [],
      })),
      unchangedCount: 0,
    };
  }

  const beforeMap = toSnapshotMap(previous);
  const afterMap = toSnapshotMap(current);
  const allIds = new Set([...beforeMap.keys(), ...afterMap.keys()]);
  const changes = [];
  let unchangedCount = 0;
  let added = 0;
  let removed = 0;
  let changed = 0;

  for (const employeeId of allIds) {
    const before = beforeMap.get(employeeId) || null;
    const after = afterMap.get(employeeId) || null;

    if (!before && after) {
      added += 1;
      changes.push({
        employeeId, employeeCode: after.employeeCode, fullName: after.fullName,
        type: "ADDED", before: null, after, changedFields: [],
      });
      continue;
    }
    if (before && !after) {
      removed += 1;
      changes.push({
        employeeId, employeeCode: before.employeeCode, fullName: before.fullName,
        type: "REMOVED", before, after: null, changedFields: [],
      });
      continue;
    }

    const changedFields = [];
    for (const key of SNAPSHOT_COMPARISON_FIELDS) {
      const beforeValue = Number(before?.[key] || 0);
      const afterValue = Number(after?.[key] || 0);
      if (beforeValue !== afterValue) {
        changedFields.push({
          key, before: beforeValue, after: afterValue,
          delta: roundMoney(afterValue - beforeValue, DEFAULT_PAYROLL_CONFIG.decimalPlaces),
        });
      }
    }
    if (changedFields.length === 0) {
      unchangedCount += 1;
      continue;
    }
    changed += 1;
    changes.push({
      employeeId,
      employeeCode: after?.employeeCode || before?.employeeCode || "",
      fullName: after?.fullName || before?.fullName || "",
      type: "CHANGED", before, after, changedFields,
    });
  }

  const netDelta = roundMoney(
    Number(current?.totals?.totalNet || 0) - Number(previous?.totals?.totalNet || 0),
    DEFAULT_PAYROLL_CONFIG.decimalPlaces,
  );
  return {
    runId: String(run._id),
    hasBaseline: true,
    computeVersion: current.computeVersion,
    baselineVersion: previous.computeVersion,
    summary: { added, removed, changed, unchanged: unchangedCount, netDelta },
    changes: changes.sort((a, b) => (a.fullName || "").localeCompare(b.fullName || "")),
    unchangedCount,
  };
}


// ═══════════════════════════════════════════════════════
// SECTION F: RUN MANAGEMENT
// ═══════════════════════════════════════════════════════

async function recalculateRunTotals(runId, session = null, extraRunSet = {}) {
  const pc = await resolvePayrollConfig();
  const dp = clampDecimalPlaces(pc.decimalPlaces);

  const pipeline = [
    { $match: { runId: new mongoose.Types.ObjectId(String(runId)) } },
    {
      $group: {
        _id: null,
        totalGross: { $sum: "$grossSalary" },
        totalAdditions: { $sum: "$totalAdditions" },
        totalDeductions: { $sum: "$totalDeductions" },
        totalNet: { $sum: "$netSalary" },
        totalEmployeeInsurance: { $sum: "$employeeInsurance" },
        totalCompanyInsurance: { $sum: "$companyInsurance" },
        totalTax: { $sum: "$monthlyTax" },
        totalMartyrsFund: { $sum: "$martyrsFundDeduction" },
        employeeCount: { $sum: 1 },
        insuredCount: { $sum: { $cond: ["$isInsured", 1, 0] } },
        uninsuredCount: { $sum: { $cond: ["$isInsured", 0, 1] } },
        cashCount: { $sum: { $cond: [{ $eq: ["$paymentMethod", "CASH"] }, 1, 0] } },
        visaCount: { $sum: { $cond: [{ $ne: ["$paymentMethod", "CASH"] }, 1, 0] } },
        cashTotal: { $sum: { $cond: [{ $eq: ["$paymentMethod", "CASH"] }, "$netSalary", 0] } },
        visaTotal: { $sum: { $cond: [{ $ne: ["$paymentMethod", "CASH"] }, "$netSalary", 0] } },
      },
    },
    { $project: { _id: 0 } },
  ];

  let q = PayrollRecord.aggregate(pipeline);
  if (session) q = q.session(session);
  const [agg] = await q;

  let totals = {
    totalGross: 0, totalAdditions: 0, totalDeductions: 0, totalNet: 0,
    totalEmployeeInsurance: 0, totalCompanyInsurance: 0,
    totalTax: 0, totalMartyrsFund: 0,
    employeeCount: 0, insuredCount: 0, uninsuredCount: 0,
    cashCount: 0, visaCount: 0, cashTotal: 0, visaTotal: 0,
  };

  if (agg) {
    Object.keys(agg).forEach((k) => {
      totals[k] = typeof agg[k] === "number" ? roundMoney(agg[k], dp) : agg[k];
    });
  }

  const updatePayload = { totals, ...extraRunSet };
  const opts = session ? { session } : {};
  await PayrollRun.updateOne({ _id: runId }, { $set: updatePayload }, opts);
}

export async function resetPayrollRunProcessing(runId, userEmail) {
  const run = await PayrollRun.findById(runId);
  if (!run) throw new Error("Payroll run not found");
  if (run.status === "FINALIZED") {
    throw new Error("Cannot reset a finalized payroll run");
  }
  if (!["COMPUTING", "FINALIZING"].includes(run.status)) {
    throw new Error("Payroll run is not in a processing state");
  }

  const previousStatus = run.status;
  run.status = run.computedAt ? "COMPUTED" : "DRAFT";
  await run.save();

  try {
    await createAuditLog({
      entityType: "PayrollRun",
      entityId: String(runId),
      operation: "RESET_PROCESSING",
      previousValues: { status: previousStatus },
      newValues: { status: run.status },
      performedBy: userEmail,
    });
  } catch (err) {
    console.error("createAuditLog failed after resetPayrollRunProcessing", err);
  }

  return run.toObject();
}

/**
 * Re-sum run totals from all payroll lines (recovery / drift correction).
 */
export async function repairPayrollRunTotals(runId, userEmail) {
  const run = await PayrollRun.findById(runId);
  if (!run) throw new Error("Payroll run not found");
  await recalculateRunTotals(runId, null, {});
  const updated = await PayrollRun.findById(runId).lean();
  try {
    await createAuditLog({
      entityType: "PayrollRun",
      entityId: String(runId),
      operation: "REPAIR_TOTALS",
      newValues: { totalNet: updated?.totals?.totalNet },
      performedBy: userEmail,
    });
  } catch (err) {
    console.error("createAuditLog failed after repairPayrollRunTotals", err);
  }
  return updated;
}


// ═══════════════════════════════════════════════════════
// SECTION G: MANUAL EDITS
// ═══════════════════════════════════════════════════════

/** Avoid Boolean("false") === true when PATCH body sends strings. */
function coerceInsuredFromOverrides(overrides) {
  if (!Object.prototype.hasOwnProperty.call(overrides, "isInsured")) return undefined;
  const v = overrides.isInsured;
  if (v === true || v === "true" || v === 1 || v === "1") return true;
  if (v === false || v === "false" || v === 0 || v === "0") return false;
  return Boolean(v);
}

function sanitizeMergedPayrollNumbers(merged) {
  const nonNegativeKeys = [
    "baseSalary", "allowances", "workingDays", "daysPresent", "daysAbsent",
    "overtimeHours", "extraDaysWorked", "fixedBonus", "assessmentBonus",
    "attendanceDeduction", "fixedDeduction", "advanceAmount",
  ];
  for (const k of nonNegativeKeys) {
    const n = Number(merged[k]);
    if (Number.isFinite(n) && n < 0) merged[k] = 0;
  }
}

/**
 * Manually adjust one payroll line (draft or computed runs only) and refresh run totals.
 */
export async function updatePayrollRecordManually(recordId, overrides, userEmail) {
  const record = await PayrollRecord.findById(recordId);
  if (!record) throw new Error("Payroll record not found");
  const run = await PayrollRun.findById(record.runId);
  if (!run) throw new Error("Payroll run not found");
  if (run.status === "FINALIZED") throw new Error("Cannot edit records in a finalized payroll run");
  if (run.status === "COMPUTING" || run.status === "FINALIZING") {
    throw new Error("Cannot edit records while payroll run is processing");
  }

  const config = await resolvePayrollConfig();
  const configSnapshot = config;

  const merged = { ...record.toObject() };
  const insuredOverride = coerceInsuredFromOverrides(overrides);
  if (insuredOverride !== undefined) {
    merged.isInsured = insuredOverride;
  }

  for (const key of EDITABLE_RECORD_FIELDS) {
    if (key === "subscriptionWage" || key === "isInsured") continue;
    if (Object.prototype.hasOwnProperty.call(overrides, key)) {
      const v = overrides[key];
      merged[key] = v === "" || v === null || v === undefined ? 0 : Number(v);
      if (Number.isNaN(merged[key])) merged[key] = 0;
    }
  }

  sanitizeMergedPayrollNumbers(merged);

  let subscriptionWage;
  const subOverride = overrides.subscriptionWage;
  if (subOverride != null && subOverride !== "" && Number(subOverride) > 0) {
    subscriptionWage = Math.max(0, Number(subOverride));
  } else {
    const emp = await Employee.findById(record.employeeId)
      .select("financial.baseSalary socialInsurance.subscriptionWage")
      .lean();
    const empBase = Number(emp?.financial?.baseSalary) || 0;
    const mergedBase = Number(merged.baseSalary) || 0;
    subscriptionWage =
      Number(emp?.socialInsurance?.subscriptionWage) > 0
        ? Number(emp.socialInsurance.subscriptionWage)
        : mergedBase || empBase;
  }

  const hasAdvanceOverride = Object.prototype.hasOwnProperty.call(overrides, "advanceAmount");
  const advanceDemandForCompute = hasAdvanceOverride
    ? merged.advanceAmount
    : merged.advanceRequested != null &&
        merged.advanceRequested !== "" &&
        Number.isFinite(Number(merged.advanceRequested))
      ? Number(merged.advanceRequested)
      : merged.advanceAmount;

  const input = {
    baseSalary: merged.baseSalary,
    allowances: merged.allowances,
    overtimeHours: merged.overtimeHours,
    extraDaysWorked: merged.extraDaysWorked,
    fixedBonus: merged.fixedBonus,
    assessmentBonus: merged.assessmentBonus,
    daysAbsent: merged.daysAbsent,
    attendanceDeduction: merged.attendanceDeduction,
    fixedDeduction: merged.fixedDeduction,
    advanceAmount: advanceDemandForCompute,
    workingDays: merged.workingDays,
    daysPresent: merged.daysPresent,
    isInsured: merged.isInsured,
    subscriptionWage,
    calendarDaysInPeriod: merged.calendarDaysInPeriod || 0,
    employeeCalendarDays: merged.employeeCalendarDays || 0,
    isPartialPeriod: merged.isPartialPeriod || false,
  };

  const line = computePayrollLineFromInputs(input, config);

  let allocatedAdvanceBreakdown = [];
  if (run.period?.year != null && run.period?.month != null) {
    const { advanceBreakdown } = await getActiveAdvanceTotal(
      record.employeeId,
      run.period.year,
      run.period.month,
    );
    allocatedAdvanceBreakdown = allocateAdvanceBreakdown(
      advanceBreakdown,
      line.advanceAmount,
      config.decimalPlaces,
    );
  }

  const savePayload = {
    ...line,
    employeeId: record.employeeId,
    employeeCode: record.employeeCode,
    fullName: record.fullName,
    fullNameArabic: record.fullNameArabic,
    department: record.department,
    nationalId: record.nationalId,
    insuranceNumber: record.insuranceNumber,
    paymentMethod: record.paymentMethod,
    bankAccount: record.bankAccount,
    advanceBreakdown: allocatedAdvanceBreakdown,
  };

  const runId = record.runId;
  const supportsTx = await mongoSupportsTransactions();

  if (supportsTx) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const doc = await PayrollRecord.findById(recordId).session(session);
        if (!doc) throw new Error("Payroll record not found");
        doc.set(savePayload);
        await doc.save({ session });
        await recalculateRunTotals(runId, session, { configSnapshot });
      });
    } finally {
      session.endSession();
    }
  } else {
    console.warn(
      "[Payroll] Multi-document transactions not available; saving payroll line then totals sequentially.",
    );
    record.set(savePayload);
    await record.save();
    await recalculateRunTotals(runId, null, { configSnapshot });
  }

  const finalDoc = await PayrollRecord.findById(recordId);
  if (!finalDoc) throw new Error("Payroll record not found after save");

  try {
    await createAuditLog({
      entityType: "PayrollRecord",
      entityId: String(finalDoc._id),
      operation: "UPDATE",
      newValues: {
        employeeCode: finalDoc.employeeCode,
        netSalary: finalDoc.netSalary,
        runId: String(finalDoc.runId),
        consistencyMode: supportsTx ? "transaction" : "sequential",
      },
      performedBy: userEmail,
    });
  } catch (err) {
    console.error("createAuditLog failed after payroll record update", err);
  }

  return finalDoc.toObject();
}


// ═══════════════════════════════════════════════════════
// SECTION H: MAIN PIPELINE
// ═══════════════════════════════════════════════════════

/**
 * Main entry: compute all payroll records for a given PayrollRun.
 *
 * FIX #2: Reads OrganizationPolicy ONCE and passes it to computeMonthlyAnalysis
 *         via `options._orgPolicy` — eliminates the duplicate policy read.
 */
export async function runPayrollPipeline(runId, userEmail) {
  const run = await PayrollRun.findById(runId).lean();
  if (!run) throw new Error("Payroll run not found");
  if (run.status === "FINALIZED") throw new Error("Cannot recompute a finalized run");
  if (run.status === "COMPUTING" || run.status === "FINALIZING") {
    throw new Error("Payroll run is currently being processed");
  }

  const { year, month } = run.period;

  // FIX #2: Single policy read — shared between attendance analysis and payroll
  const orgPolicy = await OrganizationPolicy.findOne({ name: "default" }).lean();
  const config = buildPayrollConfigFromOrgPolicy(orgPolicy);
  const dp = clampDecimalPlaces(config.decimalPlaces);

  // Pass policy to attendance analysis to avoid second DB read
  const attResult = await computeMonthlyAnalysis(year, month, run.departmentId || undefined, {
    _orgPolicy: orgPolicy,
  });
  const summaryByEmp = new Map();
  for (const s of attResult.summary) summaryByEmp.set(String(s.employeeId), s);
  const employeeIds = [...summaryByEmp.keys()];

  const { periodStart, periodEnd } = {
    periodStart: new Date(attResult.period.periodStart),
    periodEnd: new Date(attResult.period.periodEnd),
  };
  const employeesWithAttendance = new Set(
    (
      await Attendance.distinct("employeeId", {
        employeeId: { $in: employeeIds },
        date: { $gte: periodStart, $lt: periodEnd },
      })
    ).map((id) => String(id)),
  );

  const employees = await Employee.find({
    _id: { $in: employeeIds },
    $or: [
      { status: { $nin: ["TERMINATED", "RESIGNED"] } },
      {
        status: { $in: ["TERMINATED", "RESIGNED"] },
        _id: { $in: [...employeesWithAttendance] },
      },
    ],
  })
    .select(
      "_id fullName fullNameArabic employeeCode department idNumber status " +
      "financial socialInsurance",
    )
    .lean();
  const employeeById = new Map(employees.map((e) => [String(e._id), e]));

  const records = [];
  const totals = {
    totalGross: 0, totalAdditions: 0, totalDeductions: 0, totalNet: 0,
    totalEmployeeInsurance: 0, totalCompanyInsurance: 0,
    totalTax: 0, totalMartyrsFund: 0,
    employeeCount: 0, insuredCount: 0, uninsuredCount: 0,
    cashCount: 0, visaCount: 0, cashTotal: 0, visaTotal: 0,
  };

  for (const employeeId of employeeIds) {
    const emp = employeeById.get(employeeId);
    if (!emp) continue;
    const attSummary = summaryByEmp.get(employeeId);
    const isSeparatedEmployee = ["TERMINATED", "RESIGNED"].includes(String(emp.status || "").toUpperCase());
    const inclusionMeta = {
      payrollInclusionReason: isSeparatedEmployee
        ? "Included because employee has attendance in this payroll period."
        : "",
    };

    // Business rule: payroll overtime uses assessment-only source.
    const overtimeHrs = 0;
    const extraDays = await getExtraDaysWorked(
      emp._id,
      periodStart,
      periodEnd,
      orgPolicy?.attendanceRules?.weeklyRestDays,
    );
    const { total: advTotal, advanceBreakdown } = await getActiveAdvanceTotal(emp._id, year, month);
    const assessmentNet = attSummary?.assessmentNet || 0;

    const rec = computeEmployeeRecord(
      emp, attSummary, config, overtimeHrs, extraDays,
      advTotal, assessmentNet, advanceBreakdown, inclusionMeta,
    );
    records.push(rec);

    totals.totalGross += rec.grossSalary;
    totals.totalAdditions += rec.totalAdditions;
    totals.totalDeductions += rec.totalDeductions;
    totals.totalNet += rec.netSalary;
    totals.totalEmployeeInsurance += rec.employeeInsurance;
    totals.totalCompanyInsurance += rec.companyInsurance;
    totals.totalTax += rec.monthlyTax;
    totals.totalMartyrsFund += rec.martyrsFundDeduction;
    totals.employeeCount += 1;
    if (rec.isInsured) totals.insuredCount += 1;
    else totals.uninsuredCount += 1;
    if (rec.paymentMethod === "CASH") {
      totals.cashCount += 1;
      totals.cashTotal += rec.netSalary;
    } else {
      totals.visaCount += 1;
      totals.visaTotal += rec.netSalary;
    }
  }

  for (const key of Object.keys(totals)) {
    if (typeof totals[key] === "number") totals[key] = roundMoney(totals[key], dp);
  }

  const snapshotRecords = records.map(buildSnapshotRecord);
  const supportsTx = await mongoSupportsTransactions();
  const updateRunPayload = {
    status: "COMPUTED",
    computedAt: new Date(),
    totals,
    configSnapshot: config,
  };

  if (supportsTx) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const liveRun = await PayrollRun.findById(runId).session(session);
        if (!liveRun) throw new Error("Payroll run not found");
        if (liveRun.status === "FINALIZED") throw new Error("Cannot recompute a finalized run");
        if (liveRun.status === "FINALIZING") throw new Error("Run is being finalized");

        liveRun.status = "COMPUTING";
        await liveRun.save({ session });

        await PayrollRecord.deleteMany({ runId }, { session });
        if (records.length > 0) {
          await PayrollRecord.insertMany(records.map((r) => ({ ...r, runId })), { session });
        }

        const nextVersion = Number(liveRun.computeVersion || 0) + 1;
        const [snapshot] = await PayrollComputeSnapshot.create(
          [{ runId, computeVersion: nextVersion, createdBy: userEmail, totals, records: snapshotRecords }],
          { session },
        );

        liveRun.set({
          ...updateRunPayload,
          computeVersion: nextVersion,
          previousSnapshotId: liveRun.currentSnapshotId || null,
          currentSnapshotId: snapshot._id,
        });
        await liveRun.save({ session });
      });
    } finally {
      session.endSession();
    }
  } else {
    const previousStatus = run.status;
    await PayrollRun.updateOne({ _id: runId }, { $set: { status: "COMPUTING" } });
    try {
      await PayrollRecord.deleteMany({ runId });
      if (records.length > 0) {
        await PayrollRecord.insertMany(records.map((r) => ({ ...r, runId })));
      }
      const latestRun = await PayrollRun.findById(runId);
      if (!latestRun) throw new Error("Payroll run not found");
      const nextVersion = Number(latestRun.computeVersion || 0) + 1;
      const snapshot = await PayrollComputeSnapshot.create({
        runId, computeVersion: nextVersion, createdBy: userEmail, totals, records: snapshotRecords,
      });
      await PayrollRun.updateOne(
        { _id: runId },
        {
          $set: {
            ...updateRunPayload,
            computeVersion: nextVersion,
            previousSnapshotId: latestRun.currentSnapshotId || null,
            currentSnapshotId: snapshot._id,
          },
        },
      );
    } catch (err) {
      await PayrollRun.updateOne({ _id: runId }, { $set: { status: previousStatus || "DRAFT" } });
      throw err;
    }
  }

  const updatedRun = await PayrollRun.findById(runId).lean();
  await createAuditLog({
    entityType: "PayrollRun",
    entityId: runId,
    operation: "COMPUTE",
    newValues: {
      period: updatedRun?.period,
      employeeCount: totals.employeeCount,
      totalNet: totals.totalNet,
      computeVersion: updatedRun?.computeVersion || 0,
      consistencyMode: supportsTx ? "transaction" : "sequential",
    },
    performedBy: userEmail,
  });

  return { run: updatedRun, recordCount: records.length };
}

/**
 * Finalize a computed run — locks it and marks advances as deducted.
 */
export async function finalizePayrollRun(runId, userEmail) {
  const run = await PayrollRun.findById(runId).lean();
  if (!run) throw new Error("Payroll run not found");
  if (run.status === "FINALIZED") throw new Error("Run is already finalized");
  if (run.status === "DRAFT") throw new Error("Run must be computed before finalization");
  if (run.status === "COMPUTING" || run.status === "FINALIZING") {
    throw new Error("Run is currently being processed");
  }

  const { year, month } = run.period;
  const orgPolicy = await OrganizationPolicy.findOne({ name: "default" }).lean();
  const companyStartDay = getCompanyMonthStartDay(orgPolicy);
  const { periodStart, periodEnd } = resolveMonthRange(year, month, companyStartDay);
  const config = buildPayrollConfigFromOrgPolicy(orgPolicy);
  const dp = clampDecimalPlaces(config.decimalPlaces);
  const supportsTx = await mongoSupportsTransactions();

  const validatePartialExcusedRows = (rows) => {
    const unresolved = rows.filter((r) => {
      const source = String(r.deductionSource || "").toUpperCase();
      const type = String(r.deductionValueType || "").toUpperCase();
      const value = Number(r.deductionValue);
      if (r.requiresDeductionDecision) return true;
      if (source !== "SALARY" && source !== "VACATION_BALANCE") return true;
      if (type !== "DAYS" && type !== "AMOUNT") return true;
      if (!Number.isFinite(value) || value <= 0) return true;
      if (source === "VACATION_BALANCE" && type !== "DAYS") return true;
      return false;
    });

    if (unresolved.length > 0) {
      const sample = unresolved
        .slice(0, 5)
        .map((r) => `${r.employeeCode || "Unknown"} @ ${new Date(r.date).toISOString().slice(0, 10)}`)
        .join(", ");
      throw new Error(
        `Cannot finalize payroll: ${unresolved.length} PARTIAL_EXCUSED attendance record(s) still require HR deduction source decision. Resolve pending rows first.`
          + (sample ? ` Sample: ${sample}` : ""),
      );
    }
  };

  if (supportsTx) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const liveRun = await PayrollRun.findById(runId).session(session);
        if (!liveRun) throw new Error("Payroll run not found");
        if (liveRun.status === "FINALIZED") throw new Error("Run is already finalized");
        if (liveRun.status === "DRAFT") throw new Error("Run must be computed before finalization");
        if (liveRun.status === "COMPUTING" || liveRun.status === "FINALIZING") {
          throw new Error("Run is currently being processed");
        }

        const existing = await PayrollRun.findOne({
          "period.year": liveRun.period.year,
          "period.month": liveRun.period.month,
          departmentId: liveRun.departmentId,
          status: "FINALIZED",
          _id: { $ne: liveRun._id },
        }).session(session);
        if (existing) throw new Error("A finalized run already exists for this period");

        liveRun.status = "FINALIZING";
        await liveRun.save({ session });

        const records = await PayrollRecord.find({ runId }).session(session).lean();
        if (records.length > 0) {
          const employeeIds = [...new Set(records.map((r) => r.employeeId))];
          const partialRows = await Attendance.find({
            employeeId: { $in: employeeIds },
            date: { $gte: periodStart, $lt: periodEnd },
            status: "PARTIAL_EXCUSED",
          })
            .select("employeeCode date requiresDeductionDecision deductionSource deductionValueType deductionValue")
            .sort({ date: 1 })
            .session(session)
            .lean();
          validatePartialExcusedRows(partialRows);
        }

        const actualDeductions = buildDeterministicAdvanceDeductions(records, dp);
        await markAdvancesDeducted(actualDeductions, runId, { session, decimalPlaces: dp, period: { year: liveRun.period.year, month: liveRun.period.month } });

        liveRun.status = "FINALIZED";
        liveRun.finalizedAt = new Date();
        liveRun.finalizedBy = userEmail;
        await liveRun.save({ session });
      });
    } finally {
      session.endSession();
    }
  } else {
    const existing = await PayrollRun.findOne({
      "period.year": run.period.year,
      "period.month": run.period.month,
      departmentId: run.departmentId,
      status: "FINALIZED",
      _id: { $ne: run._id },
    });
    if (existing) throw new Error("A finalized run already exists for this period");

    const previousStatus = run.status;
    await PayrollRun.updateOne({ _id: runId }, { $set: { status: "FINALIZING" } });
    try {
      const records = await PayrollRecord.find({ runId }).lean();
      if (records.length > 0) {
        const employeeIds = [...new Set(records.map((r) => r.employeeId))];
        const partialRows = await Attendance.find({
          employeeId: { $in: employeeIds },
          date: { $gte: periodStart, $lt: periodEnd },
          status: "PARTIAL_EXCUSED",
        })
          .select("employeeCode date requiresDeductionDecision deductionSource deductionValueType deductionValue")
          .sort({ date: 1 })
          .lean();
        validatePartialExcusedRows(partialRows);
      }
      const actualDeductions = buildDeterministicAdvanceDeductions(records, dp);
      await markAdvancesDeducted(actualDeductions, runId, { decimalPlaces: dp, period: { year: run.period.year, month: run.period.month } });

      await PayrollRun.updateOne(
        { _id: runId },
        { $set: { status: "FINALIZED", finalizedAt: new Date(), finalizedBy: userEmail } },
      );
    } catch (err) {
      await PayrollRun.updateOne({ _id: runId }, { $set: { status: previousStatus || "COMPUTED" } });
      throw err;
    }
  }

  const finalizedRun = await PayrollRun.findById(runId).lean();
  await createAuditLog({
    entityType: "PayrollRun",
    entityId: runId,
    operation: "FINALIZE",
    newValues: {
      period: finalizedRun?.period,
      totalNet: finalizedRun?.totals?.totalNet,
      finalizedBy: userEmail,
      consistencyMode: supportsTx ? "transaction" : "sequential",
    },
    performedBy: userEmail,
  });

  return finalizedRun;
}
