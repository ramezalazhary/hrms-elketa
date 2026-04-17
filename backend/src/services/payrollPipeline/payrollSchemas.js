/**
 * Validation contracts for the payroll pipeline.
 *
 * These catch structural data issues (negative deduction days, mismatched sums)
 * at the boundary between attendance analysis and payroll computation.
 * They do NOT validate business logic correctness (formula accuracy).
 */

export class PayrollValidationError extends Error {
  constructor(section, field, message) {
    super(`[Payroll:${section}] ${field}: ${message}`);
    this.section = section;
    this.field = field;
  }
}

/**
 * Validate the attendance summary produced for one employee before payroll consumes it.
 * Throws PayrollValidationError on problems; returns silently if OK.
 *
 * @param {object} summary — one row from computeMonthlyAnalysis().summary
 * @param {{ strict?: boolean }} [opts] — if strict, throw; else console.warn
 */
export function validateAttendanceSummary(summary, opts = {}) {
  const strict = opts.strict !== false;
  const errors = [];

  const d = summary?.deductions || {};

  // All deduction day counts must be non-negative
  const dayFields = [
    "lateDays", "absenceDays", "unpaidLeaveDays",
    "earlyDepartureDays", "incompleteDays", "excessExcuseDays",
  ];
  for (const f of dayFields) {
    const v = Number(d[f]);
    if (Number.isFinite(v) && v < 0) {
      errors.push({ field: `deductions.${f}`, msg: `negative value: ${v}` });
    }
  }

  // totalDeductionDays should equal sum of components (within tolerance)
  const sumComponents =
    (Number(d.lateDays) || 0) +
    (Number(d.absenceDays) || 0) +
    (Number(d.unpaidLeaveDays) || 0) +
    (Number(d.earlyDepartureDays) || 0) +
    (Number(d.incompleteDays) || 0) +
    (Number(d.excessExcuseDays) || 0);
  const total = Number(d.totalDeductionDays) || 0;
  if (Math.abs(sumComponents - total) > 0.01) {
    errors.push({
      field: "deductions.totalDeductionDays",
      msg: `sum mismatch: components=${sumComponents.toFixed(4)}, total=${total.toFixed(4)}`,
    });
  }

  // Working days must be non-negative
  if (Number.isFinite(summary?.workingDays) && summary.workingDays < 0) {
    errors.push({ field: "workingDays", msg: `negative: ${summary.workingDays}` });
  }

  if (errors.length > 0) {
    const empLabel = summary?.employeeCode || summary?.employeeId || "unknown";
    const msg = errors.map((e) => `${e.field}: ${e.msg}`).join("; ");
    if (strict) {
      throw new PayrollValidationError("AttendanceSummary", empLabel, msg);
    } else {
      console.warn(`[PayrollValidation] Employee ${empLabel}: ${msg}`);
    }
  }
}

/**
 * Validate a computed payroll line before persistence.
 * Catches structural issues like grossSalary != base + allowances, negative net, etc.
 *
 * @param {object} line — output of computePayrollLineFromInputs or computeEmployeeRecord
 * @param {{ strict?: boolean }} [opts]
 */
export function validatePayrollLine(line, opts = {}) {
  const strict = opts.strict !== false;
  const errors = [];

  // grossSalary should equal baseSalary + allowances
  const expectedGross = (Number(line.baseSalary) || 0) + (Number(line.allowances) || 0);
  const actualGross = Number(line.grossSalary) || 0;
  if (Math.abs(expectedGross - actualGross) > 0.01) {
    errors.push({
      field: "grossSalary",
      msg: `expected ${expectedGross}, got ${actualGross}`,
    });
  }

  // netSalary should not be negative
  if (Number.isFinite(line.netSalary) && line.netSalary < 0) {
    errors.push({ field: "netSalary", msg: `negative: ${line.netSalary}` });
  }

  // totalDeductions should not exceed grossPool
  const grossPool = (Number(line.effectiveGross) || 0) + (Number(line.totalAdditions) || 0);
  const totalDed = Number(line.totalDeductions) || 0;
  if (totalDed > grossPool + 0.01) {
    errors.push({
      field: "totalDeductions",
      msg: `${totalDed} exceeds gross pool ${grossPool}`,
    });
  }

  if (errors.length > 0) {
    const empLabel = line.employeeCode || line.employeeId || "unknown";
    const msg = errors.map((e) => `${e.field}: ${e.msg}`).join("; ");
    if (strict) {
      throw new PayrollValidationError("PayrollLine", empLabel, msg);
    } else {
      console.warn(`[PayrollValidation] Employee ${empLabel}: ${msg}`);
    }
  }
}
