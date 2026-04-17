/**
 * Payroll math utilities — single source of truth for monetary rounding,
 * default config, and progressive tax computation.
 *
 * Every layer in the payroll pipeline imports rounding from here so that
 * attendance analysis and payroll computation never diverge.
 */

/** HR-configurable defaults; overridden per-field from OrganizationPolicy. */
export const DEFAULT_PAYROLL_CONFIG = {
  /** HR-configurable via Organization Policy → Payroll (0–8). */
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
    { from: 40000, to: 55000, rate: 0.10 },
    { from: 55000, to: 70000, rate: 0.15 },
    { from: 70000, to: 200000, rate: 0.20 },
    { from: 200000, to: 400000, rate: 0.225 },
    { from: 400000, to: 1200000, rate: 0.25 },
    { from: 1200000, to: null, rate: 0.275 },
  ],
};

/**
 * Clamp HR-provided decimal places to a safe 0–8 range.
 * Returns the policy default (2) when the input is missing or invalid.
 */
export function clampDecimalPlaces(dp) {
  const def = DEFAULT_PAYROLL_CONFIG.decimalPlaces ?? 2;
  if (dp === undefined || dp === null || dp === "") return def;
  const n = Math.floor(Number(dp));
  if (!Number.isFinite(n)) return def;
  return Math.min(8, Math.max(0, n));
}

/**
 * Round monetary values.
 * `decimalPlaces` comes from HR payroll policy (default 2).
 *
 * **This is the ONLY rounding function in the project.**
 * Both attendance analysis and payroll computation must use it.
 */
export function roundMoney(v, decimalPlaces) {
  const dp = clampDecimalPlaces(decimalPlaces);
  const f = 10 ** dp;
  return Math.round((Number(v) || 0) * f) / f;
}

/**
 * Apply Egyptian progressive tax brackets to annual taxable income.
 * @param {number} annualTaxable
 * @param {Array<{from: number, to: number|null, rate: number}>} brackets
 * @param {number} [decimalPlaces] - from payroll config (HR)
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
