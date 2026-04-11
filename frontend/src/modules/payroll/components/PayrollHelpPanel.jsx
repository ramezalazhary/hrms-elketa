import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  FlaskConical,
} from "lucide-react";
import { getDocumentRequirementsApi } from "@/modules/organization/api";
import {
  PAYROLL_GUIDE_SECTIONS,
  clampDecimalPlaces,
  computePayrollLikeModule,
  matchToleranceForPayroll,
  roundAtDecimalPlaces,
  verifyPayrollData,
} from "../payrollVerification";

/** Matches checker logic: analysis pair overrides manual non-absence amount. */
function resolveAttendanceDeductionForChecker(form, decimalPlaces) {
  const dp = clampDecimalPlaces(decimalPlaces);
  const rnd = (v) => roundAtDecimalPlaces(v, dp);
  const at = form.analysisTotalAmount;
  const aa = form.analysisAbsenceAmount;
  const useAnalysisSplit =
    String(at).trim() !== "" && String(aa).trim() !== "";
  const attendanceDeduction = useAnalysisSplit
    ? rnd((Number(at) || 0) - (Number(aa) || 0))
    : rnd(Number(form.attendanceDeduction) || 0);
  return { attendanceDeduction, useAnalysisSplit };
}

const emptyModuleForm = () => ({
  baseSalary: "",
  allowances: "",
  fixedBonus: "",
  fixedDeduction: "",
  overtimeHours: "",
  extraDaysWorked: "",
  assessmentNet: "",
  absentDays: "",
  attendanceDeduction: "",
  analysisTotalAmount: "",
  analysisAbsenceAmount: "",
  advanceAmount: "",
  isInsured: false,
  subscriptionWage: "",
  wdpm: "",
  hpd: "",
  overtimeMultiplier: "",
  personalExemptionAnnual: "",
  decimalPlacesOverride: "",
  actualNetSalary: "",
});

/**
 * Collapsible guide to payroll math + optional automated checks when records are loaded.
 */
export function PayrollHelpPanel({ records = null, totals = null, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const [form, setForm] = useState(emptyModuleForm);
  const [policyDecimalPlaces, setPolicyDecimalPlaces] = useState(2);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getDocumentRequirementsApi();
        if (cancelled || !data?.payrollConfig) return;
        const dp = data.payrollConfig.decimalPlaces;
        setPolicyDecimalPlaces(clampDecimalPlaces(dp, 2));
      } catch {
        /* keep default */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const effectiveDecimalPlaces = useMemo(() => {
    if (String(form.decimalPlacesOverride).trim() !== "") {
      return clampDecimalPlaces(Number(form.decimalPlacesOverride), policyDecimalPlaces);
    }
    return policyDecimalPlaces;
  }, [form.decimalPlacesOverride, policyDecimalPlaces]);

  const verification = useMemo(() => {
    if (!records?.length || !totals) return null;
    return verifyPayrollData(records, totals, effectiveDecimalPlaces);
  }, [records, totals, effectiveDecimalPlaces]);

  const checkerAttendance = useMemo(
    () => resolveAttendanceDeductionForChecker(form, effectiveDecimalPlaces),
    [form, effectiveDecimalPlaces],
  );

  const moduleResult = useMemo(() => {
    const { attendanceDeduction } = checkerAttendance;

    const configOverrides = { decimalPlaces: effectiveDecimalPlaces };
    if (String(form.wdpm).trim() !== "") configOverrides.workingDaysPerMonth = Number(form.wdpm);
    if (String(form.hpd).trim() !== "") configOverrides.hoursPerDay = Number(form.hpd);
    if (String(form.overtimeMultiplier).trim() !== "")
      configOverrides.overtimeMultiplier = Number(form.overtimeMultiplier);
    if (String(form.personalExemptionAnnual).trim() !== "")
      configOverrides.personalExemptionAnnual = Number(form.personalExemptionAnnual);

    return computePayrollLikeModule({
      baseSalary: form.baseSalary,
      allowances: form.allowances,
      fixedBonus: form.fixedBonus,
      fixedDeduction: form.fixedDeduction,
      overtimeHours: form.overtimeHours,
      extraDaysWorked: form.extraDaysWorked,
      assessmentNet: form.assessmentNet,
      absentDays: form.absentDays,
      attendanceDeduction,
      advanceAmount: form.advanceAmount,
      isInsured: form.isInsured,
      subscriptionWage: form.subscriptionWage,
      configOverrides,
    });
  }, [form, checkerAttendance, effectiveDecimalPlaces]);

  const manualCheck = useMemo(() => {
    const dp = effectiveDecimalPlaces;
    const rnd = (v) => roundAtDecimalPlaces(v, dp);
    const tol = matchToleranceForPayroll(dp);
    const hasActual = String(form.actualNetSalary).trim() !== "";
    const actualNet = hasActual ? rnd(Number(form.actualNetSalary) || 0) : null;
    const expectedNet = moduleResult.netSalary;
    const passed = hasActual ? Math.abs(expectedNet - actualNet) <= tol : null;
    return { hasActual, actualNet, expectedNet, passed, tol, dp };
  }, [form.actualNetSalary, moduleResult.netSalary, effectiveDecimalPlaces]);

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/80 to-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-indigo-50/50 sm:px-5"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
            <BookOpen size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-zinc-900">How payroll is calculated</p>
            <p className="text-xs text-zinc-500 truncate">
              {verification
                ? verification.allPassed
                  ? "Guide + verification tests — all checks passed"
                  : "Guide + verification — some checks need review"
                : "Formulas match the server; run Compute on a draft to enable row tests"}
            </p>
          </div>
        </div>
        <ChevronDown
          size={18}
          className={`shrink-0 text-indigo-400 transition ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="border-t border-indigo-100 px-4 pb-4 pt-1 sm:px-5">
          <div className="space-y-4 text-sm text-zinc-700">
            {PAYROLL_GUIDE_SECTIONS.map((section) => (
              <div key={section.title}>
                <p className="text-xs font-bold uppercase tracking-wide text-indigo-600/90">
                  {section.title}
                </p>
                <ul className="mt-1.5 list-disc space-y-1 pl-5 text-xs leading-relaxed text-zinc-600">
                  {section.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {verification && (
            <div className="mt-5 rounded-lg border border-zinc-200 bg-white p-4">
              <div className="mb-3 flex items-center gap-2">
                <FlaskConical size={16} className="text-amber-600" />
                <span className="text-xs font-bold uppercase tracking-wide text-zinc-700">
                  Verification tests (this browser)
                </span>
              </div>
              <p className="mb-3 text-xs text-zinc-500">
                Recomputes sums and per-row relationships from the loaded table. Uses organization payroll rounding (
                {effectiveDecimalPlaces} decimal{effectiveDecimalPlaces === 1 ? "" : "s"}); tolerance ±
                {matchToleranceForPayroll(effectiveDecimalPlaces)} EGP.
              </p>
              <ul className="space-y-2">
                {verification.checks.map((c) => (
                  <li
                    key={c.id}
                    className={`flex gap-2 rounded-md px-2 py-1.5 text-xs ${
                      c.ok ? "bg-emerald-50/80 text-emerald-900" : "bg-red-50/90 text-red-900"
                    }`}
                  >
                    {c.ok ? (
                      <CircleCheck size={14} className="mt-0.5 shrink-0 text-emerald-600" />
                    ) : (
                      <CircleAlert size={14} className="mt-0.5 shrink-0 text-red-600" />
                    )}
                    <span>
                      <span className="font-medium">{c.label}</span>
                      <span className="mt-0.5 block text-[11px] opacity-90">{c.detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-5 rounded-lg border border-zinc-200 bg-white p-4">
            <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <FlaskConical size={16} className="text-indigo-600" />
                  <span className="text-xs font-bold uppercase tracking-wide text-zinc-700">
                    Module-matched checker
                  </span>
                </div>
                <p className="max-w-prose text-xs text-zinc-500">
                  Same steps as the server: gross from profile, rates from payroll config (defaults 26 days, 8 h, OT 1.5),
                  EGP rounding from organization policy ({effectiveDecimalPlaces} decimal
                  {effectiveDecimalPlaces === 1 ? "" : "s"}), additions from overtime / weekly rest days / bonuses / assessment
                  net, deductions from absence × salary/day, non-absence attendance money, fixed deduction, advances — then
                  insurance and tax if insured. Enter values from attendance analysis or other systems manually to validate.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setForm(emptyModuleForm())}
                className="shrink-0 rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
              >
                Reset
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <fieldset className="space-y-2">
                <legend className="text-[11px] font-bold uppercase text-zinc-500">Employee profile (financial)</legend>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <NumberField label="Base salary" value={form.baseSalary} onChange={(v) => setField("baseSalary", v)} />
                  <NumberField label="Allowances" value={form.allowances} onChange={(v) => setField("allowances", v)} />
                  <NumberField label="Fixed bonus" value={form.fixedBonus} onChange={(v) => setField("fixedBonus", v)} />
                  <NumberField label="Fixed deduction" value={form.fixedDeduction} onChange={(v) => setField("fixedDeduction", v)} />
                </div>
              </fieldset>

              <fieldset className="space-y-2">
                <legend className="text-[11px] font-bold uppercase text-zinc-500">
                  External / manual (attendance & advances)
                </legend>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  <NumberField
                    label="Overtime hours (period)"
                    value={form.overtimeHours}
                    onChange={(v) => setField("overtimeHours", v)}
                  />
                  <NumberField
                    label="Extra rest-day days worked"
                    value={form.extraDaysWorked}
                    onChange={(v) => setField("extraDaysWorked", v)}
                  />
                  <NumberField
                    label="Assessment net (EGP)"
                    value={form.assessmentNet}
                    onChange={(v) => setField("assessmentNet", v)}
                  />
                  <NumberField label="Absent days (count)" value={form.absentDays} onChange={(v) => setField("absentDays", v)} />
                  <NumberField
                    label="Active advances total (EGP)"
                    value={form.advanceAmount}
                    onChange={(v) => setField("advanceAmount", v)}
                  />
                </div>
                <p className="text-[11px] text-zinc-500">
                  Non-absence attendance deductions: enter one amount below, or fill analysis totals so we apply{" "}
                  <span className="font-mono">totalAmount − absenceAmount</span> like the server.
                </p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  <NumberField
                    label="Attendance deduction non-absence (EGP)"
                    value={form.attendanceDeduction}
                    onChange={(v) => setField("attendanceDeduction", v)}
                  />
                  <NumberField
                    label="Analysis: total deductions (EGP)"
                    value={form.analysisTotalAmount}
                    onChange={(v) => setField("analysisTotalAmount", v)}
                  />
                  <NumberField
                    label="Analysis: absence amount (EGP)"
                    value={form.analysisAbsenceAmount}
                    onChange={(v) => setField("analysisAbsenceAmount", v)}
                  />
                </div>
                {checkerAttendance.useAnalysisSplit && (
                  <p className="rounded-md bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900">
                    Using <span className="font-mono">total − absence</span> from analysis; the manual non-absence field above is ignored.
                  </p>
                )}
              </fieldset>

              <fieldset className="space-y-2">
                <legend className="text-[11px] font-bold uppercase text-zinc-500">Insurance & tax</legend>
                <label className="inline-flex items-center gap-2 text-xs font-medium text-zinc-700">
                  <input
                    type="checkbox"
                    checked={form.isInsured}
                    onChange={(e) => setField("isInsured", e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Insured (social insurance + tax + martyrs fund)
                </label>
                {form.isInsured && (
                  <NumberField
                    label="Subscription wage (empty = base salary)"
                    value={form.subscriptionWage}
                    onChange={(v) => setField("subscriptionWage", v)}
                  />
                )}
              </fieldset>

              <fieldset className="space-y-2">
                <legend className="text-[11px] font-bold uppercase text-zinc-500">
                  Payroll config overrides (optional, else server defaults)
                </legend>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <NumberField
                    label="Amount decimal places (optional)"
                    value={form.decimalPlacesOverride}
                    onChange={(v) => setField("decimalPlacesOverride", v)}
                    placeholder={String(policyDecimalPlaces)}
                  />
                  <NumberField label="Working days / month" value={form.wdpm} onChange={(v) => setField("wdpm", v)} placeholder="26" />
                  <NumberField label="Hours / day" value={form.hpd} onChange={(v) => setField("hpd", v)} placeholder="8" />
                  <NumberField
                    label="Overtime multiplier"
                    value={form.overtimeMultiplier}
                    onChange={(v) => setField("overtimeMultiplier", v)}
                    placeholder="1.5"
                  />
                  <NumberField
                    label="Personal exemption (annual)"
                    value={form.personalExemptionAnnual}
                    onChange={(v) => setField("personalExemptionAnnual", v)}
                    placeholder="20000"
                  />
                </div>
              </fieldset>

              <NumberField
                label="Actual net (from payroll row / Excel) — optional check"
                value={form.actualNetSalary}
                onChange={(v) => setField("actualNetSalary", v)}
              />

              <div className="overflow-x-auto rounded-lg border border-zinc-100 bg-zinc-50/80">
                <table className="min-w-full text-xs">
                  <tbody className="divide-y divide-zinc-100">
                    <ResultRow label="Gross salary" value={moduleResult.grossSalary} fractionDigits={effectiveDecimalPlaces} />
                    <ResultRow label="Salary / day" value={moduleResult.salaryPerDay} fractionDigits={effectiveDecimalPlaces} />
                    <ResultRow label="Salary / hour" value={moduleResult.salaryPerHour} fractionDigits={effectiveDecimalPlaces} />
                    <ResultRow label="Overtime pay" value={moduleResult.overtimePay} fractionDigits={effectiveDecimalPlaces} />
                    <ResultRow label="Extra rest-day pay" value={moduleResult.extraDaysPay} fractionDigits={effectiveDecimalPlaces} />
                    <ResultRow label="Total additions" value={moduleResult.totalAdditions} emphasize fractionDigits={effectiveDecimalPlaces} />
                    <ResultRow label="Absent deduction" value={moduleResult.absentDeduction} fractionDigits={effectiveDecimalPlaces} />
                    <ResultRow label="Attendance (non-absence) deduction" value={moduleResult.attendanceDeduction} fractionDigits={effectiveDecimalPlaces} />
                    <ResultRow label="Total deductions (pre-tax)" value={moduleResult.totalDeductions} emphasize fractionDigits={effectiveDecimalPlaces} />
                    <ResultRow label="Due before insurance" value={moduleResult.dueBeforeInsurance} bold fractionDigits={effectiveDecimalPlaces} />
                    {form.isInsured && (
                      <>
                        <ResultRow label="Insured wage (clamped)" value={moduleResult.insuredWage} fractionDigits={effectiveDecimalPlaces} />
                        <ResultRow label="Employee insurance" value={moduleResult.employeeInsurance} fractionDigits={effectiveDecimalPlaces} />
                        <ResultRow
                          label="Taxable monthly / annual"
                          value={`${moduleResult.taxableMonthly} / ${moduleResult.taxableAnnual}`}
                          raw
                          fractionDigits={effectiveDecimalPlaces}
                        />
                        <ResultRow
                          label="Annual tax / Monthly tax"
                          value={`${moduleResult.annualTax} / ${moduleResult.monthlyTax}`}
                          raw
                          fractionDigits={effectiveDecimalPlaces}
                        />
                        <ResultRow label="Martyrs fund" value={moduleResult.martyrsFundDeduction} fractionDigits={effectiveDecimalPlaces} />
                      </>
                    )}
                    <ResultRow label="Expected net salary" value={moduleResult.netSalary} bold highlight fractionDigits={effectiveDecimalPlaces} />
                  </tbody>
                </table>
              </div>

              {manualCheck.hasActual && (
                <div
                  className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs ${
                    manualCheck.passed ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-900"
                  }`}
                >
                  {manualCheck.passed ? (
                    <CircleCheck size={14} className="text-emerald-600" />
                  ) : (
                    <CircleAlert size={14} className="text-red-600" />
                  )}
                  <span>
                    {manualCheck.passed ? "Match" : "Mismatch"}: expected{" "}
                    <strong>
                      {roundAtDecimalPlaces(manualCheck.expectedNet, manualCheck.dp).toFixed(manualCheck.dp)}
                    </strong>{" "}
                    vs actual{" "}
                    <strong>
                      {manualCheck.actualNet == null
                        ? "—"
                        : roundAtDecimalPlaces(manualCheck.actualNet, manualCheck.dp).toFixed(manualCheck.dp)}
                    </strong>{" "}
                    (±{manualCheck.tol})
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ResultRow({ label, value, emphasize, bold, highlight, raw, fractionDigits = 2 }) {
  const dp = clampDecimalPlaces(fractionDigits);
  let display;
  if (raw && typeof value === "string" && value.includes(" / ")) {
    display = value
      .split(" / ")
      .map((part) => {
        const n = Number(part);
        return Number.isFinite(n) ? roundAtDecimalPlaces(n, dp).toFixed(dp) : part;
      })
      .join(" / ");
  } else if (raw) {
    display = String(value ?? "—");
  } else if (typeof value === "number") {
    display = roundAtDecimalPlaces(value, dp).toFixed(dp);
  } else {
    display = String(value ?? "—");
  }
  return (
    <tr className={highlight ? "bg-indigo-50/60" : ""}>
      <td className="px-3 py-1.5 text-zinc-600">{label}</td>
      <td
        className={`px-3 py-1.5 text-right font-mono ${bold || highlight ? "font-bold text-zinc-900" : emphasize ? "font-semibold text-zinc-800" : "text-zinc-800"}`}
      >
        {display}
      </td>
    </tr>
  );
}

function NumberField({ label, value, onChange, placeholder }) {
  return (
    <label className="text-xs">
      <span className="mb-1 block font-medium text-zinc-600">{label}</span>
      <input
        type="number"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-sm text-zinc-800 outline-none transition placeholder:text-zinc-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
      />
    </label>
  );
}
