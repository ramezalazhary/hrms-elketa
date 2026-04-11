/**
 * Mirrors backend `payrollComputationService.js` rounding and documents formulas
 * for UI + client-side consistency checks.
 */

/** HR policy: decimal places for EGP (mirrors backend `roundMoney` / `clampDecimalPlaces`). */
export function clampDecimalPlaces(dp, defaultDp = 2) {
  if (dp === undefined || dp === null || dp === "") return defaultDp;
  const n = Math.floor(Number(dp));
  if (!Number.isFinite(n)) return defaultDp;
  return Math.min(8, Math.max(0, n));
}

export function roundAtDecimalPlaces(v, decimalPlaces = 2) {
  const dp = clampDecimalPlaces(decimalPlaces);
  const f = 10 ** dp;
  return Math.round((Number(v) || 0) * f) / f;
}

/**
 * Format EGP for display: same monetary rounding as the server, then locale formatting.
 * (Avoids float noise — e.g. 5340.125 → two decimals → 5340.13, not 5340.12.)
 */
export function formatPayrollEgp(n, decimalPlaces = 2) {
  if (n == null || n === "") return "—";
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  const dp = clampDecimalPlaces(decimalPlaces, 2);
  const rounded = roundAtDecimalPlaces(num, dp);
  return rounded.toLocaleString("en-EG", { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

/** Two decimal places; kept for backward compatibility and tests. */
export function round2(v) {
  return roundAtDecimalPlaces(v, 2);
}

/** Same defaults as backend `DEFAULT_PAYROLL_CONFIG` (payrollComputationService.js). */
export const DEFAULT_MODULE_PAYROLL_CONFIG = {
  decimalPlaces: 2,
  workingDaysPerMonth: 22,
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
    { from: 40000, to: 55000, rate: 0.1 },
    { from: 55000, to: 70000, rate: 0.15 },
    { from: 70000, to: 200000, rate: 0.2 },
    { from: 200000, to: 400000, rate: 0.225 },
    { from: 400000, to: 1200000, rate: 0.25 },
    { from: 1200000, to: null, rate: 0.275 },
  ],
};

/**
 * Egyptian progressive tax — same algorithm as backend `computeProgressiveTax`.
 * @param {number} [decimalPlaces] - from payroll config (HR)
 */
export function computeProgressiveTax(annualTaxable, brackets, decimalPlaces) {
  if (annualTaxable <= 0) return 0;
  const sorted = [...brackets].sort((a, b) => a.from - b.from);
  let tax = 0;
  let remaining = annualTaxable;

  for (const bracket of sorted) {
    if (remaining <= 0) break;
    const bracketSize = bracket.to != null ? bracket.to - bracket.from : Infinity;
    const taxableInBracket = Math.min(remaining, bracketSize);
    tax += taxableInBracket * bracket.rate;
    remaining -= taxableInBracket;
  }
  return roundAtDecimalPlaces(tax, decimalPlaces ?? DEFAULT_MODULE_PAYROLL_CONFIG.decimalPlaces);
}

/**
 * Full single-employee payroll math matching `computeEmployeeRecord` + insured branch.
 * Pass numbers from outside (attendance analysis, advances, assessment) as manual fields.
 *
 * @param {object} raw
 * @param {number} [raw.baseSalary]
 * @param {number} [raw.allowances]
 * @param {number} [raw.fixedBonus]
 * @param {number} [raw.fixedDeduction]
 * @param {number} [raw.overtimeHours] — from attendance module
 * @param {number} [raw.extraDaysWorked] — Fri/Sat worked days count
 * @param {number} [raw.assessmentNet] — assessment net in EGP (approved month)
 * @param {number} [raw.absentDays] — from monthly analysis summary
 * @param {number} [raw.attendanceDeduction] — EGP: non-absence deduction days (late + early departure + incomplete + unpaid leave + excess excuse) × salaryPerDay
 * @param {number} [raw.advanceAmount] — requested advance (sum of active advances); capped to available pre-tax pool
 * @param {boolean} [raw.isInsured]
 * @param {number} [raw.subscriptionWage] — for insurance clamp; backend falls back to baseSalary
 * @param {object} [raw.configOverrides] — partial override of DEFAULT_MODULE_PAYROLL_CONFIG
 */
export function computePayrollLikeModule(raw = {}) {
  const cfg = {
    ...DEFAULT_MODULE_PAYROLL_CONFIG,
    ...(raw.configOverrides || {}),
    insuranceRates: {
      ...DEFAULT_MODULE_PAYROLL_CONFIG.insuranceRates,
      ...(raw.configOverrides?.insuranceRates || {}),
    },
    taxBrackets:
      raw.configOverrides?.taxBrackets?.length > 0
        ? raw.configOverrides.taxBrackets
        : DEFAULT_MODULE_PAYROLL_CONFIG.taxBrackets,
  };

  const dp = clampDecimalPlaces(cfg.decimalPlaces);
  const rnd = (x) => roundAtDecimalPlaces(x, dp);

  const baseSalary = rnd(Number(raw.baseSalary) || 0);
  const allowances = rnd(Number(raw.allowances) || 0);
  const grossSalary = rnd(baseSalary + allowances);

  const wdpmRaw = cfg.workingDaysPerMonth ?? 22;
  const hpdRaw = cfg.hoursPerDay ?? 8;
  const wdpm = wdpmRaw > 0 ? wdpmRaw : 22;
  const hpd = hpdRaw > 0 ? hpdRaw : 8;
  const rawDailyRate = grossSalary > 0 ? grossSalary / wdpm : 0;
  const rawHourlyRate = rawDailyRate > 0 ? rawDailyRate / hpd : 0;
  const salaryPerDay = rnd(rawDailyRate);
  const salaryPerHour = rnd(rawHourlyRate);

  const empCalDays = Number(raw.employeeCalendarDays) || 0;
  const periodCalDays = Number(raw.calendarDaysInPeriod) || 0;
  const isPartialPeriod = Boolean(raw.isPartialPeriod);
  const proRateFactor = isPartialPeriod && periodCalDays > 0
    ? Math.min(empCalDays / periodCalDays, 1)
    : 1;
  const effectiveGross = rnd(grossSalary * proRateFactor);

  const overtimeHrs = rnd(Number(raw.overtimeHours) || 0);
  const extraDays = Number(raw.extraDaysWorked) || 0;
  const otMult = cfg.overtimeMultiplier ?? 1.5;
  const overtimePay = rnd(overtimeHrs * rawHourlyRate * otMult);
  const extraDaysPay = rnd(extraDays * rawDailyRate);
  const fixedBonus = rnd(Number(raw.fixedBonus) || 0);
  const assessmentBonus = rnd(Number(raw.assessmentNet) || 0);
  const totalAdditions = rnd(overtimePay + extraDaysPay + fixedBonus + assessmentBonus);

  const workingDays = Number(raw.workingDays) || 0;
  const daysAbsent = Number(raw.absentDays) || 0;
  const rawAbsentDeduction = rnd(daysAbsent * rawDailyRate);
  const absentDeduction = (daysAbsent >= workingDays && workingDays > 0)
    ? effectiveGross
    : rawAbsentDeduction;
  const attendanceDeduction = rnd(Number(raw.attendanceDeduction) || 0);
  const fixedDeduction = rnd(Number(raw.fixedDeduction) || 0);
  const requestedAdvance = rnd(Number(raw.advanceAmount) || 0);
  const grossPool = rnd(effectiveGross + totalAdditions);
  const nonAdvanceDeductions = rnd(absentDeduction + attendanceDeduction + fixedDeduction);
  const maxAdvanceDeduction = rnd(Math.max(0, grossPool - nonAdvanceDeductions));
  const advanceAmount = rnd(Math.min(requestedAdvance, maxAdvanceDeduction));
  const totalDeductions = rnd(nonAdvanceDeductions + advanceAmount);

  const dueBeforeInsurance = rnd(effectiveGross + totalAdditions - totalDeductions);

  const isInsured = Boolean(raw.isInsured);
  const ir = cfg.insuranceRates || {};
  /** Same as backend: `Number(subscriptionWage) || baseSalary` (empty → 0 → fallback). */
  const rawWage = Number(raw.subscriptionWage) || baseSalary;
  const insuredWage = isInsured
    ? Math.min(Math.max(rawWage, ir.minInsurableWage || 2700), ir.maxInsurableWage || 16700)
    : 0;
  const employeeInsurance = isInsured ? rnd(insuredWage * (ir.employeeShare || 0.11)) : 0;
  const companyInsurance = isInsured ? rnd(insuredWage * (ir.companyShare || 0.1875)) : 0;

  const exemptionMonthly = rnd((cfg.personalExemptionAnnual || 20000) / 12);
  const taxableMonthly = isInsured
    ? rnd(Math.max(0, dueBeforeInsurance - employeeInsurance - exemptionMonthly))
    : 0;
  const taxableAnnual = isInsured ? rnd(taxableMonthly * 12) : 0;
  const annualTax = isInsured ? computeProgressiveTax(taxableAnnual, cfg.taxBrackets, dp) : 0;
  const monthlyTax = isInsured ? rnd(annualTax / 12) : 0;
  const martyrsRate = cfg.martyrsFundRate ?? 0.0005;
  const martyrsFundDeduction = isInsured ? rnd(insuredWage * martyrsRate) : 0;

  const netSalary = isInsured
    ? rnd(Math.max(0, dueBeforeInsurance - employeeInsurance - monthlyTax - martyrsFundDeduction))
    : rnd(Math.max(0, dueBeforeInsurance));

  return {
    configUsed: cfg,
    baseSalary,
    allowances,
    grossSalary,
    effectiveGross,
    isPartialPeriod,
    salaryPerDay,
    salaryPerHour,
    overtimeHours: overtimeHrs,
    extraDaysWorked: extraDays,
    overtimePay,
    extraDaysPay,
    fixedBonus,
    assessmentBonus,
    totalAdditions,
    daysAbsent,
    absentDeduction,
    attendanceDeduction,
    fixedDeduction,
    advanceRequested: requestedAdvance,
    advanceAmount,
    totalDeductions,
    dueBeforeInsurance,
    isInsured,
    insuredWage,
    employeeInsurance,
    companyInsurance,
    taxableMonthly,
    taxableAnnual,
    annualTax,
    monthlyTax,
    martyrsFundDeduction,
    netSalary,
  };
}

/** Float-safe comparison for money at HR rounding (used by verification + manual checker). */
export function matchToleranceForPayroll(decimalPlaces = 2) {
  const dp = clampDecimalPlaces(decimalPlaces);
  if (dp === 0) return 0.5;
  if (dp === 1) return 0.05;
  // dp >= 2: keep legacy ±0.02 at 2dp; scale down for finer rounding so checks stay meaningful
  const legacyAt2dp = 0.02;
  const scaledLegacy = legacyAt2dp * 10 ** -(dp - 2);
  const halfUnit = 0.5 * 10 ** -dp;
  return Math.max(scaledLegacy, halfUnit);
}

function approxEq(a, b, decimalPlaces = 2) {
  const dp = clampDecimalPlaces(decimalPlaces);
  const eps = matchToleranceForPayroll(dp);
  const ra = roundAtDecimalPlaces(a, dp);
  const rb = roundAtDecimalPlaces(b, dp);
  return Math.abs(ra - rb) <= eps;
}

/** Human-readable sections for the payroll guide (keep in sync with backend). */
export const PAYROLL_GUIDE_SECTIONS = [
  {
    title: "Gross and rates",
    bullets: [
      "Gross salary = base salary + allowances (from employee profile).",
      "Salary per day = gross ÷ working days per month (from organization policy).",
      "Salary per hour = salary per day ÷ hours per day (default 8).",
      "Partial period (mid-month hire): effective gross = gross × (employee calendar days ÷ period calendar days). Rest days (e.g. Friday) are included as paid days.",
    ],
  },
  {
    title: "Additions",
    bullets: [
      "Overtime pay = overtime hours × salary per hour × overtime multiplier (default 1.5).",
      "Extra rest-day days = days with attendance on configured weekly rest days (org policy) × salary per day.",
      "Fixed bonus and assessment bonus (from profile / assessments) are added.",
      "Total additions = overtime + extra days + fixed bonus + assessment bonus.",
    ],
  },
  {
    title: "Deductions (before tax)",
    bullets: [
      "Absent days × salary per day. If absent ALL working days, capped at effective gross (no rest-day pay earned).",
      "Attendance deductions (late / partial rules) computed from penalty days × daily rate.",
      "Fixed deductions from employee profile.",
      "Active salary advances (ONE_TIME: full remaining; INSTALLMENTS: monthly deduction amount; capped at remaining).",
      "Total deductions = absence + attendance deductions + fixed + advances.",
    ],
  },
  {
    title: "Due before insurance & tax",
    bullets: [
      "Due before insurance = effective gross + total additions − total deductions.",
      "Uninsured employees: net salary = due before insurance (no insurance or income tax in this engine).",
    ],
  },
  {
    title: "Insured employees",
    bullets: [
      "Insured wage = subscription wage clamped between min/max (defaults 2,700–16,700 EGP).",
      "Employee insurance = insured wage × 11%; company share is separate (not net pay).",
      "Taxable monthly = max(0, due before insurance − employee insurance − personal exemption ÷ 12).",
      "Annual tax uses progressive brackets on taxable monthly × 12; monthly tax = annual tax ÷ 12.",
      "Martyrs’ fund = insured wage × 0.05% (default rate).",
      "Net = due before insurance − employee insurance − monthly tax − martyrs’ fund.",
    ],
  },
];

/**
 * Run consistency checks on loaded payroll records vs run totals.
 * @param {number} [decimalPlaces=2] — HR payroll rounding (organization policy); must match compute.
 * @returns {{ allPassed: boolean, checks: Array<{ id: string, label: string, ok: boolean, detail: string }> }}
 */
export function verifyPayrollData(records = [], totals = {}, decimalPlaces = 2) {
  const checks = [];
  if (!records.length) {
    return { allPassed: true, checks: [] };
  }

  const dp = clampDecimalPlaces(decimalPlaces);
  const rnd = (x) => roundAtDecimalPlaces(x, dp);
  const fmtN = (x) => rnd(x).toLocaleString("en-EG", { minimumFractionDigits: dp, maximumFractionDigits: dp });

  const sum = (field) =>
    rnd(records.reduce((s, r) => s + (Number(r[field]) || 0), 0));

  const sg = sum("grossSalary");
  const sa = sum("totalAdditions");
  const sd = sum("totalDeductions");
  const sn = sum("netSalary");
  const sie = sum("employeeInsurance");
  const sic = sum("companyInsurance");
  const smt = sum("monthlyTax");
  const smf = sum("martyrsFundDeduction");

  const tg = rnd(totals.totalGross);
  const ta = rnd(totals.totalAdditions);
  const td = rnd(totals.totalDeductions);
  const tn = rnd(totals.totalNet);
  const tie = rnd(totals.totalEmployeeInsurance);
  const tic = rnd(totals.totalCompanyInsurance);
  const ttx = rnd(totals.totalTax);
  const tmf = rnd(totals.totalMartyrsFund);

  checks.push({
    id: "sum-gross",
    label: "Sum of row gross matches run total gross",
    ok: approxEq(sg, tg, dp),
    detail: `Σ rows ${fmtN(sg)} · Run ${fmtN(tg)}`,
  });
  checks.push({
    id: "sum-additions",
    label: "Sum of row additions matches run total additions",
    ok: approxEq(sa, ta, dp),
    detail: `Σ rows ${fmtN(sa)} · Run ${fmtN(ta)}`,
  });
  checks.push({
    id: "sum-deductions",
    label: "Sum of row deductions matches run total deductions",
    ok: approxEq(sd, td, dp),
    detail: `Σ rows ${fmtN(sd)} · Run ${fmtN(td)}`,
  });
  checks.push({
    id: "sum-net",
    label: "Sum of row net salaries matches run total net",
    ok: approxEq(sn, tn, dp),
    detail: `Σ rows ${fmtN(sn)} · Run ${fmtN(tn)}`,
  });
  checks.push({
    id: "sum-employee-insurance",
    label: "Sum of employee insurance matches run total",
    ok: approxEq(sie, tie, dp),
    detail: `Σ rows ${fmtN(sie)} · Run ${fmtN(tie)}`,
  });
  checks.push({
    id: "sum-company-insurance",
    label: "Sum of company insurance matches run total",
    ok: approxEq(sic, tic, dp),
    detail: `Σ rows ${fmtN(sic)} · Run ${fmtN(tic)}`,
  });
  checks.push({
    id: "sum-tax",
    label: "Sum of monthly tax matches run total tax",
    ok: approxEq(smt, ttx, dp),
    detail: `Σ rows ${fmtN(smt)} · Run ${fmtN(ttx)}`,
  });
  checks.push({
    id: "sum-martyrs",
    label: "Sum of martyrs’ fund matches run total",
    ok: approxEq(smf, tmf, dp),
    detail: `Σ rows ${fmtN(smf)} · Run ${fmtN(tmf)}`,
  });

  const sadv = sum("advanceAmount");
  const empsWithAdv = records.filter(r => (Number(r.advanceAmount) || 0) > 0).length;
  checks.push({
    id: "sum-advances",
    label: "Total salary advances included in deductions",
    ok: sadv >= 0,
    detail: `Σ advances: ${fmtN(sadv)} EGP across ${empsWithAdv} employee(s)`,
  });

  let dueMismatch = 0;
  let netMismatch = 0;
  const dueSamples = [];
  const netSamples = [];

  for (const r of records) {
    const base = Number(r.effectiveGross) || Number(r.grossSalary) || 0;
    const add = Number(r.totalAdditions) || 0;
    const ded = Number(r.totalDeductions) || 0;
    const expectedDue = rnd(base + add - ded);
    const storedDue = Number(r.dueBeforeInsurance);
    if (!approxEq(expectedDue, storedDue, dp)) {
      dueMismatch++;
      if (dueSamples.length < 3) {
        dueSamples.push(r.employeeCode || "?");
      }
    }

    const due = rnd(Number(r.dueBeforeInsurance) || expectedDue);
    if (r.isInsured) {
      const ei = Number(r.employeeInsurance) || 0;
      const mt = Number(r.monthlyTax) || 0;
      const mf = Number(r.martyrsFundDeduction) || 0;
      const expectedNet = rnd(due - ei - mt - mf);
      if (!approxEq(expectedNet, Number(r.netSalary), dp)) {
        netMismatch++;
        if (netSamples.length < 3) netSamples.push(r.employeeCode || "?");
      }
    } else {
      if (!approxEq(due, Number(r.netSalary), dp)) {
        netMismatch++;
        if (netSamples.length < 3) netSamples.push(r.employeeCode || "?");
      }
    }
  }

  checks.push({
    id: "row-due",
    label: "Each row: effective gross + additions − deductions = due before insurance",
    ok: dueMismatch === 0,
    detail:
      dueMismatch === 0
        ? `All ${records.length} rows`
        : `${dueMismatch} row(s) off (e.g. codes ${dueSamples.join(", ")})`,
  });
  checks.push({
    id: "row-net",
    label: "Each row: net matches formula (insured vs uninsured)",
    ok: netMismatch === 0,
    detail:
      netMismatch === 0
        ? `All ${records.length} rows`
        : `${netMismatch} row(s) off (e.g. codes ${netSamples.join(", ")})`,
  });

  const allPassed = checks.every((c) => c.ok);
  return { allPassed, checks };
}
