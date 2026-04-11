/**
 * Monthly attendance analysis: aggregation, deduction computation, daily detail.
 * Used by both the analysis endpoint and the payroll-ready report.
 */
import { Attendance } from "../models/Attendance.js";
import { LeaveRequest } from "../models/LeaveRequest.js";
import { Employee } from "../models/Employee.js";
import { OrganizationPolicy } from "../models/OrganizationPolicy.js";
import { Assessment } from "../models/Assessment.js";
import { CompanyHoliday } from "../models/CompanyHoliday.js";
import {
  getCompanyMonthStartDay,
  fiscalMonthPeriodStartUtc,
} from "./leavePolicyService.js";
import { parseTimeToMinutes } from "../utils/excuseAttendance.js";
import { weeklyRestDaySet } from "../utils/weeklyRestDays.js";
import { resolveWorkingDaysPerMonth } from "../utils/orgPolicyWorkingDays.js";

const DEFAULT_ATTENDANCE_RULES = {
  standardStartTime: "09:00",
  standardEndTime: "17:00",
  gracePeriodMinutes: 15,
  workingDaysPerMonth: 22,
  lateDeductionTiers: [],
  absenceDeductionDays: 1,
  earlyDepartureDeductionDays: 0,
  incompleteRecordDeductionDays: 0,
  unpaidLeaveDeductionDays: 1,
  weeklyRestDays: [5, 6],
};

/**
 * Returns true if a declared CompanyHoliday covers `dateStr` (YYYY-MM-DD) for the
 * given employee (by empId) who belongs to `deptId`.
 * Scopes: COMPANY → affects everyone; DEPARTMENT → matches deptId; EMPLOYEE → matches empId.
 *
 * @param {Array} holidays  - lean CompanyHoliday docs for the period
 * @param {string} dateStr  - ISO date string "YYYY-MM-DD"
 * @param {*} empId         - employee ObjectId or string
 * @param {*} deptId        - department ObjectId or string (nullable)
 * @returns {{ isHoliday: boolean, title?: string }}
 */
function isHolidayForEmployee(holidays, dateStr, empId, deptId) {
  const ts = new Date(dateStr + "T00:00:00.000Z").getTime();
  for (const h of holidays) {
    const start = new Date(h.startDate).setUTCHours(0, 0, 0, 0);
    const end = new Date(h.endDate).setUTCHours(23, 59, 59, 999);
    if (ts < start || ts > end) continue;
    if (h.scope === "COMPANY") return { isHoliday: true, title: h.title };
    if (h.scope === "DEPARTMENT" && deptId && String(h.targetDepartmentId) === String(deptId)) {
      return { isHoliday: true, title: h.title };
    }
    if (h.scope === "EMPLOYEE" && String(h.targetEmployeeId) === String(empId)) {
      return { isHoliday: true, title: h.title };
    }
  }
  return { isHoliday: false };
}

/**
 * Resolve fiscal month date range [start, end) using company month start day.
 */
function resolveMonthRange(year, month, companyMonthStartDay) {
  const refDate = new Date(Date.UTC(year, month - 1, 15));
  const periodStart = fiscalMonthPeriodStartUtc(refDate, companyMonthStartDay);

  // Build next fiscal anchor date explicitly from next calendar month.
  // Using fixed day=15 can resolve back to the same fiscal start (bug),
  // which yields empty periods like 2026-03-24 -> 2026-03-24.
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

function lateMinutes(checkInStr, policy) {
  const startMin = parseTimeToMinutes(policy.standardStartTime || "09:00");
  const grace = policy.gracePeriodMinutes ?? 15;
  const checkInMin = parseTimeToMinutes(checkInStr);
  if (startMin == null || checkInMin == null) return 0;
  const threshold = startMin + grace;
  return checkInMin > threshold ? checkInMin - startMin : 0;
}

function deductionForLate(minutesLate, tiers) {
  if (!Array.isArray(tiers) || tiers.length === 0 || minutesLate <= 0) return 0;
  const sorted = [...tiers].sort((a, b) => a.fromMinutes - b.fromMinutes);
  for (const tier of sorted) {
    if (minutesLate >= tier.fromMinutes && minutesLate < tier.toMinutes) {
      return tier.deductionDays;
    }
  }
  const last = sorted[sorted.length - 1];
  if (minutesLate >= last.toMinutes) return last.deductionDays;
  return 0;
}

/**
 * Generate the set of expected working dates in the period.
 * Excludes configured weekly rest days (OrganizationPolicy.attendanceRules.weeklyRestDays, UTC weekdays).
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

/**
 * Core analysis: builds per-employee summary + daily detail for a given month.
 * @param {number} year
 * @param {number} month 1-12
 * @param {string} [departmentId] optional filter
 * @param {{ includeDetails?: boolean }} [options]
 * @returns {Promise<{summary, details, policySnapshot, period}>}
 */
export async function computeMonthlyAnalysis(year, month, departmentId, options = {}) {
  const includeDetails = options.includeDetails !== false;
  const orgPolicy = await OrganizationPolicy.findOne({ name: "default" }).lean();
  const rules = orgPolicy?.attendanceRules
    ? { ...DEFAULT_ATTENDANCE_RULES, ...orgPolicy.attendanceRules }
    : { ...DEFAULT_ATTENDANCE_RULES };
  rules.workingDaysPerMonth = resolveWorkingDaysPerMonth(orgPolicy);

  const companyStartDay = getCompanyMonthStartDay(orgPolicy);
  const { periodStart, periodEnd } = resolveMonthRange(year, month, companyStartDay);

  const empFilter = { isActive: true };
  if (departmentId) empFilter.departmentId = departmentId;
  const employees = await Employee.find(empFilter)
    .select("_id fullName email employeeCode department departmentId financial dateOfHire")
    .lean();

  const empIds = employees.map((e) => e._id);

  const assessmentPayrollRules = orgPolicy?.assessmentPayrollRules || {};
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

  // Declared company holidays that overlap this period (company-wide, dept, or individual).
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
        };
      }
    }
    return { covered: false };
  }

  const UNPAID_LEAVE_TYPES = new Set(["UNPAID"]);

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

    // Exclude pre-hire days from this employee's monthly computation window.
    const effectiveStart =
      hireDate && hireDate > periodStart ? hireDate : periodStart;
    const empWorkDates = workDates.filter((d) => d >= effectiveStart);

    // Calendar days for pro-rating (rest days like Friday are paid, so use calendar days)
    const calendarDaysInPeriod = Math.round((periodEnd - periodStart) / 86400000);
    const employeeCalendarDays = Math.round((periodEnd - effectiveStart) / 86400000);
    const isPartialPeriod = effectiveStart > periodStart;

    const attByDate = new Map();
    for (const rec of empAttendance) {
      const ds = new Date(rec.date).toISOString().slice(0, 10);
      attByDate.set(ds, rec);
    }

    let presentDays = 0;
    let lateDays = 0;
    let absentDays = 0;
    let onLeaveDays = 0;
    let paidLeaveDays = 0;
    let unpaidLeaveDays = 0;
    let excusedDays = 0;
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

    const dailyRows = [];

    for (const wd of empWorkDates) {
      const ds = wd.toISOString().slice(0, 10);
      const rec = attByDate.get(ds);
      const notes = [];

      // Declared holiday check has the highest priority: no deduction, no absence.
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

        switch (rec.status) {
          case "PRESENT":
            presentDays++;
            break;
          case "LATE": {
            lateDays++;
            const mins = lateMinutes(rec.checkIn, rules);
            const ded = deductionForLate(mins, rules.lateDeductionTiers);
            lateDeductionTotal += ded;
            dayDeduction = ded;
            notes.push(`Late by ${mins} min — ${ded} day(s) deducted`);
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
          status: rec.status,
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
            dailyRows.push({
              date: ds, status: "EXCUSED", checkIn: null, checkOut: null,
              rawHours: 0, excusedMinutes: 0, effectiveHours: 0,
              mergedPunches: 0, deduction: 0, leaveType: null,
              notes: ["Approved excuse (no attendance record)"],
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
    // Holiday days are excluded: totalHoursWorked doesn't track hours on declared holidays.
    const daysWithHours = presentDays + lateDays + excusedDays + earlyDepartureDays + incompleteDays;
    const avgDailyHours = daysWithHours > 0 ? totalHoursWorked / daysWithHours : 0;

    const baseSalary = Number(emp.financial?.baseSalary) || 0;
    const allowances = Number(emp.financial?.allowances) || 0;
    const grossSalary = baseSalary + allowances;
    const wdpm = rules.workingDaysPerMonth;
    // Use grossSalary (base + allowances) to match the payroll computation engine.
    // Keep full precision for all multiplications; round only the final EGP amount (Round Late).
    const r2 = (v) => Math.round(v * 100) / 100;
    const rawDailyRate = grossSalary > 0 ? grossSalary / wdpm : 0;
    const dailyRate = r2(rawDailyRate); // display-only rounded value

    const lateDeductionAmount = r2(lateDeductionTotal * rawDailyRate);
    const absenceDeductionAmount = r2(absenceDeductionTotal * rawDailyRate);
    const unpaidLeaveDeductionAmount = r2(unpaidLeaveDeductionTotal * rawDailyRate);
    const earlyDepartureDeductionAmount = r2(earlyDepartureDeductionTotal * rawDailyRate);
    const incompleteDeductionAmount = r2(incompleteDeductionTotal * rawDailyRate);
    const excessExcuseDeductionAmount = r2(excessExcuseDeductionTotal * rawDailyRate);
    const totalDeductionAmount = r2(
      lateDeductionAmount + absenceDeductionAmount + unpaidLeaveDeductionAmount +
      earlyDepartureDeductionAmount + incompleteDeductionAmount + excessExcuseDeductionAmount,
    );

    let assessmentBonusAmount = 0;
    let assessmentOvertimeAmount = 0;
    let assessmentDeductionAmount = 0;
    let assessmentRawBonusDays = 0;
    let assessmentRawOvertimeUnits = 0;
    let assessmentRawDeductionEgp = 0;
    /** Sum of `overtime` on HR-approved assessment lines (informational; payroll may still use rules separately). */
    let assessmentApprovedOvertimeUnits = 0;
    const empAssessments = assessmentByEmp.get(eid) || [];
    for (const a of empAssessments) {
      assessmentApprovedOvertimeUnits += Math.max(0, Number(a.overtime) || 0);
      if (assessmentPayrollRules.bonusDaysEnabled && a.daysBonus > 0) {
        const mult = assessmentPayrollRules.bonusDayMultiplier ?? 1;
        assessmentBonusAmount += r2(a.daysBonus * mult * rawDailyRate);
        assessmentRawBonusDays += Number(a.daysBonus) || 0;
      }
      if (assessmentPayrollRules.overtimeEnabled && a.overtime > 0) {
        const mult = assessmentPayrollRules.overtimeDayMultiplier ?? 1.5;
        assessmentOvertimeAmount += r2(a.overtime * mult * rawDailyRate);
        assessmentRawOvertimeUnits += Number(a.overtime) || 0;
      }
      if (assessmentPayrollRules.deductionEnabled && a.deduction > 0) {
        // deduction is a direct EGP amount — multiply by multiplier only, NOT by dailyRate
        const mult = assessmentPayrollRules.deductionDayMultiplier ?? 1;
        assessmentDeductionAmount += r2(a.deduction * mult);
        assessmentRawDeductionEgp += Number(a.deduction) || 0;
      }
    }
    const assessmentNetAmount = r2(assessmentBonusAmount + assessmentOvertimeAmount - assessmentDeductionAmount);

    const netSalary = r2(Math.max(0, grossSalary - totalDeductionAmount + assessmentNetAmount));

    summary.push({
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
      earlyDepartureDays,
      incompleteDays,
      holidayDays,
      totalHoursWorked: r2(totalHoursWorked),
      totalExcusedMinutes,
      avgDailyHours: r2(avgDailyHours),
      deductions: {
        // ── Authoritative counts (consumed by payroll engine to compute EGP) ──
        lateDays: r2(lateDeductionTotal),
        absenceDays: r2(absenceDeductionTotal),
        unpaidLeaveDays: r2(unpaidLeaveDeductionTotal),
        earlyDepartureDays: r2(earlyDepartureDeductionTotal),
        incompleteDays: r2(incompleteDeductionTotal),
        excessExcuseDays: r2(excessExcuseDeductionTotal),
        totalDeductionDays: r2(totalDeductionDays),
        // ── Display-only EGP estimates (UI / attendance report) — NOT read by payroll ──
        lateAmount: lateDeductionAmount,
        absenceAmount: absenceDeductionAmount,
        unpaidLeaveAmount: unpaidLeaveDeductionAmount,
        earlyDepartureAmount: earlyDepartureDeductionAmount,
        incompleteAmount: incompleteDeductionAmount,
        excessExcuseAmount: excessExcuseDeductionAmount,
        totalAmount: totalDeductionAmount,
      },
      netEffectiveDays: r2(workingDays - totalDeductionDays),
      baseSalary,
      allowances,
      grossSalary,
      dailyRate,
      assessmentBonus: assessmentBonusAmount,
      assessmentOvertime: assessmentOvertimeAmount,
      assessmentDeduction: assessmentDeductionAmount,
      assessmentNet: assessmentNetAmount,
      assessmentRawBonusDays: r2(assessmentRawBonusDays),
      assessmentRawOvertimeUnits: r2(assessmentRawOvertimeUnits),
      assessmentRawDeductionEgp: r2(assessmentRawDeductionEgp),
      assessmentCount: empAssessments.length,
      netSalary,
      assessmentApprovedOvertimeUnits: r2(assessmentApprovedOvertimeUnits),
    });

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
