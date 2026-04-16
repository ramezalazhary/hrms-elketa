/**
 * Payroll computation engine.
 *
 * Consumes: Employee profile, Attendance module, Assessment module, payrollConfig.
 * Produces: PayrollRecord documents with full line-item breakdown.
 *
 * Supports insured (social insurance + progressive tax) and uninsured employee paths.
 */
import { PayrollRun } from "../models/PayrollRun.js";
import { PayrollRecord } from "../models/PayrollRecord.js";
import { Employee } from "../models/Employee.js";
import { EmployeeAdvance } from "../models/EmployeeAdvance.js";
import { OrganizationPolicy } from "../models/OrganizationPolicy.js";
import { Attendance } from "../models/Attendance.js";
import { Assessment } from "../models/Assessment.js";
import { computeMonthlyAnalysis } from "./attendanceAnalysisService.js";
import { parseTimeToMinutes } from "../utils/excuseAttendance.js";
import { createAuditLog } from "./auditService.js";
import mongoose from "mongoose";
import { mongoSupportsTransactions } from "../utils/mongoTransactions.js";
import { weeklyRestDaySet } from "../utils/weeklyRestDays.js";
import {
  resolveWorkingDaysPerMonth,
  DEFAULT_WORKING_DAYS_PER_MONTH,
} from "../utils/orgPolicyWorkingDays.js";
import {
  fiscalMonthPeriodStartUtc,
  getCompanyMonthStartDay,
} from "./leavePolicyService.js";

const DEFAULT_PAYROLL_CONFIG = {
  /** HR-configurable via Organization Policy → Payroll (0–8). */
  decimalPlaces: 2,
  workingDaysPerMonth: DEFAULT_WORKING_DAYS_PER_MONTH,
  hoursPerDay: 8,
  overtimeMultiplier: 1.5,
  personalExemptionAnnual: 20000,
  martyrsFundRate: 0.0005,
  insuranceRates: {
    employeeShare: 0.11,
    companyShare: 0.1875,
    maxInsurableWage: 16700,
    minInsurableWage: 2700,
  },
  taxBrackets: [
    { from: 0, to: 40000, rate: 0 },
    { from: 40000, to: 55000, rate: 0.10 },
    { from: 55000, to: 70000, rate: 0.15 },
    { from: 70000, to: 200000, rate: 0.20 },
    { from: 200000, to: 400000, rate: 0.225 },
    { from: 400000, to: 1200000, rate: 0.25 },
    { from: 1200000, to: null, rate: 0.275 },
  ],
};

export function clampDecimalPlaces(dp) {
  const def = DEFAULT_PAYROLL_CONFIG.decimalPlaces ?? 2;
  if (dp === undefined || dp === null || dp === "") return def;
  const n = Math.floor(Number(dp));
  if (!Number.isFinite(n)) return def;
  return Math.min(8, Math.max(0, n));
}

/** Round monetary values; `decimalPlaces` comes from HR payroll policy (default 2). */
export function roundMoney(v, decimalPlaces) {
  const dp = clampDecimalPlaces(decimalPlaces);
  const f = 10 ** dp;
  return Math.round((Number(v) || 0) * f) / f;
}

/**
 * Apply Egyptian progressive tax brackets to annual taxable income.
 * @param {number} decimalPlaces - from payroll config (HR)
 */
export function computeProgressiveTax(annualTaxable, brackets, decimalPlaces) {
  if (annualTaxable <= 0) return 0;
  const sorted = [...brackets].sort((a, b) => a.from - b.from);
  let tax = 0;
  let remaining = annualTaxable;

  for (const bracket of sorted) {
    if (remaining <= 0) break;
    const bracketSize =
      bracket.to != null ? bracket.to - bracket.from : Infinity;
    const taxableInBracket = Math.min(remaining, bracketSize);
    tax += taxableInBracket * bracket.rate;
    remaining -= taxableInBracket;
  }
  return roundMoney(tax, decimalPlaces ?? DEFAULT_PAYROLL_CONFIG.decimalPlaces);
}

/**
 * Compute overtime hours from attendance records.
 * Hours worked past standardEndTime are counted as overtime.
 */
export async function getOvertimeHours(
  employeeId,
  periodStart,
  periodEnd,
  standardEndTime,
  decimalPlaces
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
 * Count attendance records on configured weekly rest days (UTC weekday, from org policy).
 */
export async function getExtraDaysWorked(employeeId, periodStart, periodEnd, weeklyRestDays) {
  const rest = weeklyRestDaySet(weeklyRestDays);
  const records = await Attendance.find({
    employeeId,
    date: { $gte: periodStart, $lt: periodEnd },
    status: { $in: ["PRESENT", "LATE", "EXCUSED"] },
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
    remainingAmount: { $gt: 0 }
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
 * Mark advances as deducted after payroll finalization.
 */
export async function markAdvancesDeducted(actualDeductions, runId) {
  if (!actualDeductions?.length) return;

  for (const adv of actualDeductions) {
    const record = await EmployeeAdvance.findById(adv.id);
    if (!record) continue;

    const deductedAmount = adv.amount;

    record.remainingAmount = Math.max(0, record.remainingAmount - deductedAmount);
    // Move to ACTIVE if it was APPROVED since we started deducting, or COMPLETED if done.
    if (record.remainingAmount === 0) {
      record.status = "COMPLETED";
    } else {
      record.status = "ACTIVE";
    }

    // Legacy fallback so old code doesn't break entirely
    record.deductedInRunId = runId;

    record.deductionHistory.push({
      runId,
      amountDeducted: deductedAmount,
      date: new Date()
    });

    await record.save();
  }
}

/**
 * Split `cappedTotal` across advance rows (FCFS) so `deductedThisMonth` sums to the payslip deduction.
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
  // Rest days (e.g. Friday) are paid — so pro-rate by calendar days, not working days.
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
  // Cap: if absent ALL working days, deduction = effectiveGross (no rest-day pay earned)
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

  // Use effectiveGross (pro-rated) instead of grossSalary as the base
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
function computeEmployeeRecord(emp, attendanceSummary, config, overtimeHrs, extraDays, advanceTotal, assessmentNet, advanceBreakdown = []) {
  const baseSalary = Number(emp.financial?.baseSalary) || 0;
  const allowances = Number(emp.financial?.allowances) || 0;
  const subscriptionWage =
    Number(emp.socialInsurance?.subscriptionWage) > 0
      ? Number(emp.socialInsurance.subscriptionWage)
      : baseSalary;

  // Payroll owns the money calculation: convert attendance deduction DAYS → EGP here,
  // not in attendanceAnalysisService. Attendance analysis is count-only.
  // Use full precision (rawDailyRate) for all multiplications; computePayrollLineFromInputs
  // will apply rnd() to the final EGP values.
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
    // Assessment detail (raw inputs + computed EGP per component)
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

function resolveRunPeriodRange(year, month, companyMonthStartDay) {
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

export async function resolvePayrollConfig() {
  const orgPolicy = await OrganizationPolicy.findOne({ name: "default" }).lean();
  return buildPayrollConfigFromOrgPolicy(orgPolicy);
}

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
    "baseSalary",
    "allowances",
    "workingDays",
    "daysPresent",
    "daysAbsent",
    "overtimeHours",
    "extraDaysWorked",
    "fixedBonus",
    "assessmentBonus",
    "attendanceDeduction",
    "fixedDeduction",
    "advanceAmount",
  ];
  for (const k of nonNegativeKeys) {
    const n = Number(merged[k]);
    if (Number.isFinite(n) && n < 0) merged[k] = 0;
  }
}

async function recalculateRunTotals(runId, session = null, extraRunSet = {}) {
  const pc = await resolvePayrollConfig();
  const dp = clampDecimalPlaces(pc.decimalPlaces);

  let q = PayrollRecord.find({ runId });
  if (session) q = q.session(session);
  const records = await q.lean();
  const totals = {
    totalGross: 0,
    totalAdditions: 0,
    totalDeductions: 0,
    totalNet: 0,
    totalEmployeeInsurance: 0,
    totalCompanyInsurance: 0,
    totalTax: 0,
    totalMartyrsFund: 0,
    employeeCount: 0,
    insuredCount: 0,
    uninsuredCount: 0,
    cashCount: 0,
    visaCount: 0,
    cashTotal: 0,
    visaTotal: 0,
  };

  for (const rec of records) {
    totals.totalGross += rec.grossSalary || 0;
    totals.totalAdditions += rec.totalAdditions || 0;
    totals.totalDeductions += rec.totalDeductions || 0;
    totals.totalNet += rec.netSalary || 0;
    totals.totalEmployeeInsurance += rec.employeeInsurance || 0;
    totals.totalCompanyInsurance += rec.companyInsurance || 0;
    totals.totalTax += rec.monthlyTax || 0;
    totals.totalMartyrsFund += rec.martyrsFundDeduction || 0;
    totals.employeeCount++;
    if (rec.isInsured) totals.insuredCount++;
    else totals.uninsuredCount++;
    const isCash = rec.paymentMethod === "CASH";
    if (isCash) {
      totals.cashCount++;
      totals.cashTotal += rec.netSalary || 0;
    } else {
      totals.visaCount++;
      totals.visaTotal += rec.netSalary || 0;
    }
  }

  Object.keys(totals).forEach((k) => {
    if (typeof totals[k] === "number") totals[k] = roundMoney(totals[k], dp);
  });

  const updatePayload = { totals, ...extraRunSet };
  const opts = session ? { session } : {};
  await PayrollRun.updateOne({ _id: runId }, { $set: updatePayload }, opts);
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

const EDITABLE_RECORD_FIELDS = [
  "baseSalary",
  "allowances",
  "workingDays",
  "daysPresent",
  "daysAbsent",
  "overtimeHours",
  "extraDaysWorked",
  "fixedBonus",
  "assessmentBonus",
  "attendanceDeduction",
  "fixedDeduction",
  "advanceAmount",
  "isInsured",
  "subscriptionWage",
];

/**
 * Manually adjust one payroll line (draft or computed runs only) and refresh run totals.
 * Uses a multi-document transaction when MongoDB supports it; otherwise sequential writes.
 */
export async function updatePayrollRecordManually(recordId, overrides, userEmail) {
  const record = await PayrollRecord.findById(recordId);
  if (!record) throw new Error("Payroll record not found");
  const run = await PayrollRun.findById(record.runId);
  if (!run) throw new Error("Payroll run not found");
  if (run.status === "FINALIZED") throw new Error("Cannot edit records in a finalized payroll run");

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

/**
 * Main entry: compute all payroll records for a given PayrollRun.
 */
export async function computePayrollRun(runId, userEmail) {
  const run = await PayrollRun.findById(runId);
  if (!run) throw new Error("Payroll run not found");
  if (run.status === "FINALIZED") throw new Error("Cannot recompute a finalized run");

  const { year, month } = run.period;
  const orgPolicy = await OrganizationPolicy.findOne({ name: "default" }).lean();
  const config = buildPayrollConfigFromOrgPolicy(orgPolicy);

  const attResult = await computeMonthlyAnalysis(year, month, run.departmentId || undefined);
  const summaryByEmp = new Map();
  for (const s of attResult.summary) {
    summaryByEmp.set(String(s.employeeId), s);
  }

  const empFilter = { isActive: true };
  if (run.departmentId) empFilter.departmentId = run.departmentId;
  const employees = await Employee.find(empFilter)
    .select(
      "_id fullName fullNameArabic employeeCode department idNumber " +
      "financial socialInsurance"
    )
    .lean();

  const { periodStart, periodEnd } = {
    periodStart: new Date(attResult.period.periodStart),
    periodEnd: new Date(attResult.period.periodEnd),
  };

  const records = [];
  const totals = {
    totalGross: 0, totalAdditions: 0, totalDeductions: 0, totalNet: 0,
    totalEmployeeInsurance: 0, totalCompanyInsurance: 0,
    totalTax: 0, totalMartyrsFund: 0,
    employeeCount: 0, insuredCount: 0, uninsuredCount: 0,
    cashCount: 0, visaCount: 0, cashTotal: 0, visaTotal: 0,
  };

  const dp = clampDecimalPlaces(config.decimalPlaces);

  for (const emp of employees) {
    const eid = String(emp._id);
    const attSummary = summaryByEmp.get(eid);

    // Assessment overtime is already included (as EGP) inside assessmentNet,
    // so we must NOT feed it again through the overtimeHours → overtimePay path
    // (that path expects raw hours and re-multiplies by salaryPerHour × multiplier).
    const overtimeHrs = 0;
    const extraDays = await getExtraDaysWorked(
      emp._id,
      periodStart,
      periodEnd,
      orgPolicy?.attendanceRules?.weeklyRestDays,
    );

    const { total: advTotal, advanceBreakdown } = await getActiveAdvanceTotal(emp._id, year, month);

    const assessmentNet = attSummary?.assessmentNet || 0;

    const rec = computeEmployeeRecord(emp, attSummary, config, overtimeHrs, extraDays, advTotal, assessmentNet, advanceBreakdown);
    records.push(rec);

    totals.totalGross += rec.grossSalary;
    totals.totalAdditions += rec.totalAdditions;
    totals.totalDeductions += rec.totalDeductions;
    totals.totalNet += rec.netSalary;
    totals.totalEmployeeInsurance += rec.employeeInsurance;
    totals.totalCompanyInsurance += rec.companyInsurance;
    totals.totalTax += rec.monthlyTax;
    totals.totalMartyrsFund += rec.martyrsFundDeduction;
    totals.employeeCount++;
    if (rec.isInsured) totals.insuredCount++;
    else totals.uninsuredCount++;
    const isCash = rec.paymentMethod === "CASH";
    if (isCash) { totals.cashCount++; totals.cashTotal += rec.netSalary; }
    else { totals.visaCount++; totals.visaTotal += rec.netSalary; }
  }

  Object.keys(totals).forEach((k) => {
    if (typeof totals[k] === "number") totals[k] = roundMoney(totals[k], dp);
  });

  await PayrollRecord.deleteMany({ runId });
  if (records.length > 0) {
    await PayrollRecord.insertMany(records.map((r) => ({ ...r, runId })));
  }

  run.status = "COMPUTED";
  run.computedAt = new Date();
  run.totals = totals;
  run.configSnapshot = config;
  await run.save();

  await createAuditLog({
    entityType: "PayrollRun",
    entityId: run._id,
    operation: "COMPUTE",
    newValues: { period: run.period, employeeCount: totals.employeeCount, totalNet: totals.totalNet },
    performedBy: userEmail,
  });

  return { run: run.toObject(), recordCount: records.length };
}

/**
 * Finalize a computed run — locks it and marks advances as deducted.
 */
export async function finalizePayrollRun(runId, userEmail) {
  const run = await PayrollRun.findById(runId);
  if (!run) throw new Error("Payroll run not found");
  if (run.status === "FINALIZED") throw new Error("Run is already finalized");
  if (run.status === "DRAFT") throw new Error("Run must be computed before finalization");

  const existing = await PayrollRun.findOne({
    "period.year": run.period.year,
    "period.month": run.period.month,
    departmentId: run.departmentId,
    status: "FINALIZED",
    _id: { $ne: run._id },
  });
  if (existing) throw new Error("A finalized run already exists for this period");

  const records = await PayrollRecord.find({ runId }).lean();
  const { year, month } = run.period;

  if (records.length > 0) {
    const orgPolicy = await OrganizationPolicy.findOne({ name: "default" }).lean();
    const companyStartDay = getCompanyMonthStartDay(orgPolicy);
    const { periodStart, periodEnd } = resolveRunPeriodRange(
      year,
      month,
      companyStartDay,
    );
    const employeeIds = [...new Set(records.map((r) => String(r.employeeId)))];
    const partialRows = await Attendance.find({
      employeeId: { $in: employeeIds },
      date: { $gte: periodStart, $lt: periodEnd },
      status: "PARTIAL_EXCUSED",
    })
      .select("employeeCode date requiresDeductionDecision deductionSource deductionValueType deductionValue")
      .sort({ date: 1 })
      .lean();

    const unresolved = partialRows.filter((r) => {
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
  }

  for (const rec of records) {
    if (rec.advanceAmount > 0) {
      // Re-evaluate what should be deducted in case HR manually edited the advanceAmount in constraints
      const { advancesToDeduct } = await getActiveAdvanceTotal(rec.employeeId, year, month);
      
      let remainingToAttribute = rec.advanceAmount;
      const actualDeductions = [];
      for (const adv of advancesToDeduct) {
        if (remainingToAttribute <= 0) break;
        const deduct = Math.min(adv.amount, remainingToAttribute);
        actualDeductions.push({ id: adv.id, amount: deduct });
        remainingToAttribute -= deduct;
      }

      await markAdvancesDeducted(actualDeductions, runId);
    }
  }

  run.status = "FINALIZED";
  run.finalizedAt = new Date();
  run.finalizedBy = userEmail;
  await run.save();

  await createAuditLog({
    entityType: "PayrollRun",
    entityId: run._id,
    operation: "FINALIZE",
    newValues: { period: run.period, totalNet: run.totals?.totalNet, finalizedBy: userEmail },
    performedBy: userEmail,
  });

  return run.toObject();
}
