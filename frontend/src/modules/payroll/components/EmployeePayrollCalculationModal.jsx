import { useEffect, useState } from "react";
import { Modal } from "@/shared/components/Modal";
import { useToast } from "@/shared/components/ToastProvider";
import { AlertTriangle, Banknote, Calculator, ChevronRight, Loader2, Pencil, TrendingDown, TrendingUp } from "lucide-react";
import { updatePayrollRecordApi } from "../api";
import { formatPayrollEgp } from "../payrollVerification";
import { usePayrollDecimalPlaces } from "../usePayrollDecimalPlaces";

const fmtInt = (n) => (n != null && !isNaN(n) ? Number(n).toLocaleString("en-EG") : "—");

function Row({ label, value, valueClass = "text-zinc-900" }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 text-xs border-b border-zinc-100 last:border-0">
      <span className="text-zinc-500 shrink-0">{label}</span>
      <span className={`font-mono text-right tabular-nums ${valueClass}`}>{value}</span>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-3">
      <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
        <Calculator size={12} className="text-indigo-500" />
        {title}
      </h3>
      <div className="space-y-0">{children}</div>
    </div>
  );
}

function numIn(v) {
  if (v === "" || v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function recordToForm(r) {
  const s = (n) => (n == null || n === "" ? "" : String(n));
  return {
    baseSalary: s(r.baseSalary),
    allowances: s(r.allowances),
    workingDays: s(r.workingDays),
    daysPresent: s(r.daysPresent),
    daysAbsent: s(r.daysAbsent),
    overtimeHours: s(r.overtimeHours),
    fixedBonus: s(r.fixedBonus),
    assessmentBonus: s(r.assessmentBonus),
    attendanceDeduction: s(r.attendanceDeduction),
    fixedDeduction: s(r.fixedDeduction),
    advanceAmount: s(r.advanceRequested ?? r.advanceAmount),
    isInsured: Boolean(r.isInsured),
    subscriptionWage: "",
  };
}

function DeductionDayRow({ label, days, dailyRate, amount, fmt, fmtInt, capped }) {
  if (!days && !amount) return null;
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 text-xs border-b border-zinc-100 last:border-0">
      <span className="text-zinc-500 shrink-0 flex items-center gap-1">
        <TrendingDown size={10} className="text-red-400 shrink-0" />
        {label}
        {capped && <span className="text-[9px] text-red-500 font-semibold">(capped)</span>}
      </span>
      <span className="text-right text-red-600 font-mono tabular-nums">
        {days > 0 && dailyRate > 0
          ? `${fmtInt(days)} day${days !== 1 ? "s" : ""} × EGP ${fmt(dailyRate)}/day = − EGP ${fmt(amount)}`
          : `− EGP ${fmt(amount)}`}
      </span>
    </div>
  );
}

function DeductionsSection({ record, fmt, fmtInt }) {
  const spd = record.salaryPerDay || 0;
  const attDed = record.attendanceDeduction || 0;
  const wd = record.workingDays || 0;
  const absDays = record.daysAbsent || 0;
  const absentCapped = absDays >= wd && wd > 0;

  const lateDd = record.lateDeductionDays || 0;
  const earlyDd = record.earlyDepartureDeductionDays || 0;
  const incompDd = record.incompleteDeductionDays || 0;
  const unpaidDd = record.unpaidLeaveDeductionDays || 0;
  const excessDd = record.excessExcuseDeductionDays || 0;
  const totalNonAbsDays = lateDd + earlyDd + incompDd + unpaidDd + excessDd;

  const share = (days) =>
    totalNonAbsDays > 0 ? (days / totalNonAbsDays) * attDed : days * spd;

  const rows = [
    {
      label: "Absent",
      days: absDays,
      amount: record.absentDeduction || 0,
      capped: absentCapped,
    },
    { label: "Late arrivals", days: lateDd, amount: share(lateDd) },
    { label: "Early departure", days: earlyDd, amount: share(earlyDd) },
    { label: "Incomplete records (no checkout)", days: incompDd, amount: share(incompDd) },
    { label: "Unpaid leave", days: unpaidDd, amount: share(unpaidDd) },
    { label: "Excess excuse", days: excessDd, amount: share(excessDd) },
  ].filter((r) => r.days > 0 || r.amount > 0);

  const hasFixed = (record.fixedDeduction || 0) > 0;
  const hasAdvance = (record.advanceAmount || 0) > 0;
  const advReq = Number(record.advanceRequested);
  const advAct = Number(record.advanceAmount) || 0;
  const advanceCapped =
    hasAdvance &&
    Number.isFinite(advReq) &&
    advReq > advAct + 1e-6;

  return (
    <div className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-3">
      <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
        <Calculator size={12} className="text-indigo-500" />
        Deductions (before tax)
      </h3>

      {/* Daily rate reference */}
      <div className="mb-2 rounded-md bg-amber-50/60 border border-amber-100 px-2.5 py-1.5 text-[10px] text-amber-800">
        Daily gross rate: <span className="font-bold font-mono">EGP {fmt(spd)}</span>
        {" "}(gross ÷ working days/month)
      </div>

      <div className="space-y-0">
        {rows.map((r) => (
          <DeductionDayRow
            key={r.label}
            label={r.label}
            days={r.days}
            dailyRate={spd}
            amount={r.amount}
            fmt={fmt}
            fmtInt={fmtInt}
            capped={r.capped}
          />
        ))}

        {absentCapped && (
          <div className="rounded-md bg-red-50/60 border border-red-100 px-2.5 py-1.5 text-[10px] text-red-800 mt-1">
            Absent all {wd} working days — deduction capped at {record.isPartialPeriod ? "pro-rated" : "full"} gross
            ({`EGP ${fmt(record.effectiveGross || record.grossSalary)}`}).
            Rest days are not paid when no working days are attended.
          </div>
        )}

        {rows.length === 0 && (
          <p className="py-1.5 text-xs text-zinc-400 italic">No attendance deductions</p>
        )}

        {hasFixed && (
          <div className="flex items-baseline justify-between gap-4 py-1.5 text-xs border-b border-zinc-100">
            <span className="text-zinc-500">Fixed deduction</span>
            <span className="text-right text-red-600 font-mono tabular-nums">− EGP {fmt(record.fixedDeduction)}</span>
          </div>
        )}
        {hasAdvance && (
          <div className="flex items-baseline justify-between gap-4 py-1.5 text-xs border-b border-zinc-100">
            <span className="text-zinc-500 flex items-center gap-1">
              Salary advances
              {advanceCapped && (
                <span className="text-[9px] text-amber-700 font-semibold">(capped)</span>
              )}
            </span>
            <span className="text-right text-red-600 font-mono tabular-nums">− EGP {fmt(record.advanceAmount)}</span>
          </div>
        )}

        {advanceCapped && (
          <div className="rounded-md bg-amber-50/60 border border-amber-100 px-2.5 py-1.5 text-[10px] text-amber-900 mt-1">
            Advance demand EGP {fmt(record.advanceRequested)} exceeds what can be taken this month before tax
            (EGP {fmt(record.advanceAmount)} applied). The rest stays on the advance for later payrolls.
          </div>
        )}

        <div className="flex items-baseline justify-between gap-4 pt-2 text-xs">
          <span className="font-semibold text-zinc-700">Total deductions</span>
          <span className="font-bold font-mono text-red-700 tabular-nums">EGP {fmt(record.totalDeductions)}</span>
        </div>
      </div>
    </div>
  );
}

function StatusRow({ label, count, dot, fmtInt }) {
  if (!count) return null;
  return (
    <div className="flex items-center justify-between gap-4 py-1 text-xs">
      <span className="flex items-center gap-1.5 text-zinc-600">
        <span className={`inline-block h-2 w-2 rounded-full ${dot}`} />
        {label}
      </span>
      <span className="font-mono tabular-nums text-zinc-900">{fmtInt(count)}</span>
    </div>
  );
}

function AttendanceBreakdownSection({ record, fmtInt }) {
  const wd = record.workingDays || 0;
  const present = record.daysPresent || 0;
  const absent = record.daysAbsent || 0;
  const late = record.lateDays || 0;
  const excused = record.excusedDays || 0;
  const onLeave = record.onLeaveDays || 0;
  const paidLeave = record.paidLeaveDays || 0;
  const unpaidLeave = record.unpaidLeaveDays || 0;
  const earlyDep = record.earlyDepartureDays || 0;
  const incomplete = record.incompleteDays || 0;
  const holiday = record.holidayDays || 0;

  const accounted = present + absent + excused + onLeave + holiday + late + earlyDep + incomplete;
  const unrecorded = Math.max(0, wd - accounted);

  const attendedAnyDay = present + late + earlyDep + incomplete > 0;
  const showWarning = absent > 0 && !attendedAnyDay;
  const showUnrecordedWarning = unrecorded > 0;

  return (
    <div className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-3">
      <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
        <Calculator size={12} className="text-indigo-500" />
        Attendance breakdown
      </h3>

      <div className="flex items-center justify-between gap-4 py-1 text-xs border-b border-zinc-200 mb-1">
        <span className="font-semibold text-zinc-700">Working days (in period)</span>
        <span className="font-bold font-mono tabular-nums text-zinc-900">{fmtInt(wd)}</span>
      </div>

      <div className="space-y-0">
        <StatusRow label="Present" count={present} dot="bg-emerald-500" fmtInt={fmtInt} />
        {late > 0 && (
          <StatusRow label="Late (arrived late)" count={late} dot="bg-amber-400" fmtInt={fmtInt} />
        )}
        {earlyDep > 0 && (
          <StatusRow label="Early departure" count={earlyDep} dot="bg-amber-400" fmtInt={fmtInt} />
        )}
        {incomplete > 0 && (
          <StatusRow label="Incomplete (no checkout)" count={incomplete} dot="bg-orange-400" fmtInt={fmtInt} />
        )}
        <StatusRow label="Excused" count={excused} dot="bg-blue-400" fmtInt={fmtInt} />
        <StatusRow label="On leave (paid)" count={paidLeave} dot="bg-sky-400" fmtInt={fmtInt} />
        <StatusRow label="On leave (unpaid)" count={unpaidLeave} dot="bg-purple-400" fmtInt={fmtInt} />
        {onLeave > 0 && onLeave !== paidLeave + unpaidLeave && (
          <StatusRow label="On leave (total)" count={onLeave} dot="bg-sky-300" fmtInt={fmtInt} />
        )}
        <StatusRow label="Holidays" count={holiday} dot="bg-teal-400" fmtInt={fmtInt} />
        <StatusRow label="Absent" count={absent} dot="bg-red-500" fmtInt={fmtInt} />
      </div>

      {showUnrecordedWarning && (
        <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-900">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-600" />
          <div>
            <span className="font-semibold">{unrecorded} day{unrecorded !== 1 ? "s" : ""} with no recorded attendance.</span>
            {" "}These working days have no check-in/check-out, no approved leave, no excuse, and no holiday.
            They are counted as <span className="font-semibold text-red-700">absent</span>.
          </div>
        </div>
      )}

      {showWarning && (
        <div className="mt-2 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-2.5 py-2 text-[11px] text-red-900">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-red-600" />
          <span>
            <span className="font-semibold">No attendance recorded</span> — {absent} day{absent !== 1 ? "s" : ""} marked absent
            with no check-in/check-out on any working day.
            Verify that attendance records and approved leaves/excuses exist for this employee.
          </span>
        </div>
      )}

      {!showWarning && attendedAnyDay && wd > 0 && absent / wd >= 0.5 && (
        <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-900">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-600" />
          <span>
            <span className="font-semibold">High absence rate</span> — {absent} of {wd} working days ({Math.round((absent / wd) * 100)}%)
            had no attendance records and are counted as absent.
          </span>
        </div>
      )}
    </div>
  );
}

function AssessmentRow({ icon, label, detail, amount, fmt, isDeduction = false }) {
  const Icon = icon;
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-xs border-b border-zinc-100 last:border-0">
      <span className="flex items-start gap-1.5 text-zinc-600 shrink-0 min-w-0">
        <Icon size={11} className={`mt-0.5 shrink-0 ${isDeduction ? "text-red-400" : "text-emerald-500"}`} />
        <span>
          <span className="font-medium">{label}</span>
          {detail && <span className="block text-[10px] text-zinc-400 leading-tight">{detail}</span>}
        </span>
      </span>
      <span className={`font-mono tabular-nums shrink-0 ${isDeduction ? "text-red-600" : "text-emerald-700"}`}>
        {isDeduction ? "−" : "+"} EGP {fmt(Math.abs(amount))}
      </span>
    </div>
  );
}

function AssessmentBreakdownSection({ record, fmt }) {
  const bonusDays = record.assessmentBonusDays || 0;
  const bonusAmt = record.assessmentBonusAmount || 0;
  const otUnits = record.assessmentOvertimeUnits || 0;
  const otAmt = record.assessmentOvertimeAmount || 0;
  const dedEgp = record.assessmentDeductionEgp || 0;
  const dedAmt = record.assessmentDeductionAmount || 0;
  const net = record.assessmentBonus || 0;
  const count = record.assessmentCount || 0;
  const spd = record.salaryPerDay || 0;

  const hasAnything = bonusAmt !== 0 || otAmt !== 0 || dedAmt !== 0;

  if (!hasAnything) {
    return (
      <div className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-3">
        <h3 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
          <Calculator size={12} className="text-zinc-300" />
          Assessment breakdown
        </h3>
        <p className="mt-1.5 text-xs text-zinc-400 italic">No approved assessments in this period.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-indigo-100 bg-indigo-50/30 p-3">
      <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-indigo-600">
        <Calculator size={12} className="text-indigo-500" />
        Assessment breakdown
        {count > 0 && (
          <span className="ml-auto rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 normal-case tracking-normal">
            {count} assessment{count !== 1 ? "s" : ""}
          </span>
        )}
      </h3>

      {spd > 0 && (
        <div className="mb-2 rounded-md bg-indigo-50 border border-indigo-100 px-2.5 py-1.5 text-[10px] text-indigo-800">
          Daily gross rate used: <span className="font-bold font-mono">EGP {fmt(spd)}</span>
        </div>
      )}

      <div className="space-y-0">
        {bonusAmt !== 0 && (
          <AssessmentRow
            icon={TrendingUp}
            label="Bonus days"
            detail={`${bonusDays} day${bonusDays !== 1 ? "s" : ""} × daily rate → EGP ${fmt(bonusAmt)}`}
            amount={bonusAmt}
            fmt={fmt}
          />
        )}
        {otAmt !== 0 && (
          <AssessmentRow
            icon={TrendingUp}
            label="Overtime"
            detail={`${otUnits} hr${otUnits !== 1 ? "s" : ""} × daily rate → EGP ${fmt(otAmt)}`}
            amount={otAmt}
            fmt={fmt}
          />
        )}
        {dedAmt !== 0 && (
          <AssessmentRow
            icon={TrendingDown}
            label="Deduction"
            detail={`EGP ${fmt(dedEgp)} (base) → after multiplier: EGP ${fmt(dedAmt)}`}
            amount={dedAmt}
            fmt={fmt}
            isDeduction
          />
        )}

        <div className="flex items-center justify-between gap-4 pt-2 text-xs">
          <span className="flex items-center gap-1 font-semibold text-zinc-700">
            <ChevronRight size={12} className="text-indigo-400" />
            Net assessment
          </span>
          <span className={`font-bold font-mono tabular-nums ${net >= 0 ? "text-emerald-700" : "text-red-700"}`}>
            {net >= 0 ? "+" : "−"} EGP {fmt(Math.abs(net))}
          </span>
        </div>
      </div>
    </div>
  );
}

function AdvancesBreakdownSection({ record, fmt }) {
  const items = record.advanceBreakdown || [];
  const total = record.advanceAmount || 0;
  const advReq = Number(record.advanceRequested);
  const capped =
    total > 0 &&
    Number.isFinite(advReq) &&
    advReq > total + 1e-6;

  if (total === 0 && items.length === 0) return null;

  return (
    <div className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-3">
      <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
        <Banknote size={12} className="text-orange-500" />
        Salary advances
        {items.length > 0 && (
          <span className="ml-auto rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-700 normal-case tracking-normal">
            {items.length} advance{items.length !== 1 ? "s" : ""}
          </span>
        )}
      </h3>

      {capped && (
        <div className="mb-2 rounded-md bg-amber-50/80 border border-amber-100 px-2 py-1.5 text-[10px] text-amber-900">
          This month’s deduction is limited to <span className="font-mono font-semibold">EGP {fmt(total)}</span>
          {" "}(demand was EGP {fmt(advReq)}). Unrecovered balance rolls forward.
        </div>
      )}

      {items.length > 0 ? (
        <div className="space-y-0">
          {items.map((adv, i) => (
            <div key={adv.advanceId || i} className="flex items-start justify-between gap-4 py-1.5 text-xs border-b border-zinc-100 last:border-0">
              <span className="text-zinc-600 min-w-0">
                <span className="font-medium">{adv.reason || "Advance"}</span>
                <span className="block text-[10px] text-zinc-400 leading-tight">
                  {adv.paymentType === "INSTALLMENTS" ? "Installment" : "One-time"}
                  {" · "}Total: EGP {fmt(adv.totalAmount)} · Remaining before: EGP {fmt(adv.remainingBefore)}
                </span>
              </span>
              <span className="font-mono tabular-nums text-red-600 shrink-0">
                − EGP {fmt(adv.deductedThisMonth)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-1.5 text-xs text-zinc-500">
          Total advance deduction: <span className="font-mono font-semibold text-red-600">EGP {fmt(total)}</span>
        </div>
      )}

      <div className="flex items-center justify-between gap-4 pt-2 text-xs">
        <span className="font-semibold text-zinc-700">Total advances deducted</span>
        <span className="font-bold font-mono text-red-700 tabular-nums">EGP {fmt(total)}</span>
      </div>
    </div>
  );
}

/**
 * Full payroll calculation breakdown for one PayrollRecord; optional manual edit when run is not finalized.
 */
export function EmployeePayrollCalculationModal({ record, periodLabel, runId, runStatus, onClose, onUpdated }) {
  const payrollDp = usePayrollDecimalPlaces();
  const fmt = (n) => formatPayrollEgp(n, payrollDp);
  const { showToast } = useToast();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => recordToForm(record || {}));

  const canEdit = runStatus && runStatus !== "FINALIZED";

  useEffect(() => {
    if (record) setForm(recordToForm(record));
    setEditing(false);
  }, [record]);

  if (!record) return null;

  const rid = record.id || record._id;

  const handleField = (key) => (e) => {
    if (e.target.type === "checkbox") {
      setForm((f) => ({ ...f, [key]: e.target.checked }));
      return;
    }
    setForm((f) => ({ ...f, [key]: e.target.value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const body = {
        baseSalary: numIn(form.baseSalary),
        allowances: numIn(form.allowances),
        workingDays: numIn(form.workingDays),
        daysPresent: numIn(form.daysPresent),
        daysAbsent: numIn(form.daysAbsent),
        overtimeHours: numIn(form.overtimeHours),
        fixedBonus: numIn(form.fixedBonus),
        assessmentBonus: numIn(form.assessmentBonus),
        attendanceDeduction: numIn(form.attendanceDeduction),
        fixedDeduction: numIn(form.fixedDeduction),
        advanceAmount: numIn(form.advanceAmount),
        isInsured: Boolean(form.isInsured),
      };
      const sw = String(form.subscriptionWage).trim();
      if (sw !== "" && Number(sw) > 0) {
        body.subscriptionWage = Number(sw);
      }
      const updated = await updatePayrollRecordApi(runId, rid, body);
      showToast("Payroll line updated", "success");
      setEditing(false);
      onUpdated?.(updated);
    } catch (e) {
      showToast(e.message || "Save failed", "error");
    } finally {
      setSaving(false);
    }
  };

  const title = (
    <span className="block">
      <span className="block text-base font-semibold text-zinc-900">{record.fullName}</span>
      {periodLabel && <span className="mt-0.5 block text-xs font-normal text-zinc-500">{periodLabel}</span>}
    </span>
  );

  const insured = editing ? Boolean(form.isInsured) : Boolean(record.isInsured);

  const inputCls =
    "mt-0.5 w-full rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";

  return (
    <Modal open title={title} onClose={onClose} maxWidth="max-w-2xl" closeDisabled={saving}>
      <div className="space-y-4">
        {record.payrollInclusionReason ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <div className="flex items-start gap-2">
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-600" />
              <div>
                <p className="font-semibold">
                  {record.employeeStatus || "Separated employee"} included in payroll
                </p>
                <p className="mt-0.5">{record.payrollInclusionReason}</p>
              </div>
            </div>
          </div>
        ) : null}
        {canEdit && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-b border-zinc-100 pb-3">
            {!editing ? (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
              >
                <Pencil size={14} />
                Edit
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setForm(recordToForm(record));
                  }}
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                  {saving ? "Saving…" : "Save"}
                </button>
              </>
            )}
          </div>
        )}

        {editing ? (
          <div className="space-y-4 rounded-lg border border-indigo-100 bg-indigo-50/30 p-4">
            <p className="text-xs text-zinc-600">
              Adjust inputs below. Net pay, tax, and insurance are recalculated using the same rules as Compute.
            </p>
            <p className="text-xs text-amber-700">
              Extra rest-day days are derived from approved attendance rows and cannot be edited from payroll.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["baseSalary", "Base salary (EGP)"],
                ["allowances", "Allowances (EGP)"],
                ["workingDays", "Working days"],
                ["daysPresent", "Days present"],
                ["daysAbsent", "Days absent"],
                ["overtimeHours", "Overtime hours"],
                ["fixedBonus", "Fixed bonus (EGP)"],
                ["assessmentBonus", "Assessment bonus (EGP)"],
                ["attendanceDeduction", "Attendance deduction (EGP)"],
                ["fixedDeduction", "Fixed deduction (EGP)"],
                ["advanceAmount", "Advances (EGP)"],
              ].map(([key, label]) => (
                <label key={key} className="block text-xs">
                  <span className="font-medium text-zinc-600">{label}</span>
                  <input
                    type="number"
                    step="any"
                    className={inputCls}
                    value={form[key]}
                    onChange={handleField(key)}
                  />
                </label>
              ))}
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-800">
              <input
                type="checkbox"
                checked={form.isInsured}
                onChange={handleField("isInsured")}
                className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
              />
              Insured (social insurance + income tax)
            </label>
            {insured && (
              <label className="block text-xs">
                <span className="font-medium text-zinc-600">
                  Insurance subscription wage (EGP) — optional; leave empty to use employee profile
                </span>
                <input
                  type="number"
                  step="any"
                  className={inputCls}
                  value={form.subscriptionWage}
                  onChange={handleField("subscriptionWage")}
                  placeholder="From profile if empty"
                />
              </label>
            )}
          </div>
        ) : (
          <>
            <Section title="Employee">
              <Row label="Code" value={record.employeeCode || "—"} />
              <Row label="Department" value={record.department || "—"} />
              <Row label="Payment method" value={record.paymentMethod || "—"} />
              {record.bankAccount && <Row label="Bank account" value={record.bankAccount} />}
              <Row label="Insured" value={insured ? "Yes" : "No"} />
              {record.insuranceNumber && <Row label="Insurance #" value={record.insuranceNumber} />}
            </Section>

            <Section title="Gross & rates">
              <Row label="Base salary" value={`EGP ${fmt(record.baseSalary)}`} />
              <Row label="Allowances" value={`EGP ${fmt(record.allowances)}`} />
              <Row label="Gross salary (monthly)" value={`EGP ${fmt(record.grossSalary)}`} valueClass="font-semibold text-zinc-900" />
              {record.isPartialPeriod && (
                <>
                  <Row
                    label={`Pro-rated gross (${record.employeeCalendarDays || 0} of ${record.calendarDaysInPeriod || 0} days)`}
                    value={`EGP ${fmt(record.effectiveGross)}`}
                    valueClass="font-semibold text-amber-700"
                  />
                  <div className="rounded-md bg-amber-50/60 border border-amber-100 px-2.5 py-1.5 text-[10px] text-amber-800 mt-1">
                    Partial period: employee joined mid-month. Gross pro-rated by calendar days (incl. rest days).
                  </div>
                </>
              )}
              <Row label="Salary per day" value={`EGP ${fmt(record.salaryPerDay)}`} />
              <Row label="Salary per hour" value={`EGP ${fmt(record.salaryPerHour)}`} />
            </Section>

            <AttendanceBreakdownSection record={record} fmtInt={fmtInt} />

            <Section title="Additions">
              <Row label="Overtime hours" value={fmtInt(record.overtimeHours)} />
              <Row label="Overtime pay" value={`EGP ${fmt(record.overtimePay)}`} valueClass="text-emerald-700" />
              <Row label="Extra rest-day days worked" value={fmtInt(record.extraDaysWorked)} />
              <div className="rounded-md border border-emerald-100 bg-emerald-50/60 px-2.5 py-1.5 text-[10px] text-emerald-800">
                Source: approved attendance rows on configured weekly rest days.
                {Number(record.extraDaysWorked) > 0
                  ? ` Counted for payroll: ${fmtInt(record.extraDaysWorked)} day(s).`
                  : " No approved rest-day attendance counted in this payroll run."}
              </div>
              <Row label="Extra days pay" value={`EGP ${fmt(record.extraDaysPay)}`} valueClass="text-emerald-700" />
              <Row label="Fixed bonus" value={`EGP ${fmt(record.fixedBonus)}`} valueClass="text-emerald-700" />
              <Row label="Assessment net" value={`EGP ${fmt(record.assessmentBonus)}`} valueClass="text-emerald-700" />
              <Row label="Total additions" value={`EGP ${fmt(record.totalAdditions)}`} valueClass="font-semibold text-emerald-800" />
            </Section>

            <AssessmentBreakdownSection record={record} fmt={fmt} />

            <DeductionsSection record={record} fmt={fmt} fmtInt={fmtInt} />

            <AdvancesBreakdownSection record={record} fmt={fmt} />

            <Section title="Due before insurance & tax">
              <Row
                label={record.isPartialPeriod ? "Pro-rated gross + additions − deductions" : "Gross + additions − deductions"}
                value={`EGP ${fmt(record.dueBeforeInsurance)}`}
                valueClass="font-semibold text-indigo-900"
              />
            </Section>

            {insured ? (
              <>
                <Section title="Social insurance">
                  <Row label="Insured wage (capped)" value={`EGP ${fmt(record.insuredWage)}`} />
                  <Row label="Employee share (11%)" value={`− EGP ${fmt(record.employeeInsurance)}`} valueClass="text-red-600" />
                  <Row label="Company share (reference)" value={`EGP ${fmt(record.companyInsurance)}`} valueClass="text-zinc-600" />
                </Section>

                <Section title="Income tax">
                  <Row label="Taxable monthly (after exemption)" value={`EGP ${fmt(record.taxableMonthly)}`} />
                  <Row label="Taxable annual" value={`EGP ${fmt(record.taxableAnnual)}`} />
                  <Row label="Annual tax (progressive)" value={`EGP ${fmt(record.annualTax)}`} />
                  <Row label="Monthly tax" value={`− EGP ${fmt(record.monthlyTax)}`} valueClass="text-red-600" />
                  <Row label="Martyrs fund" value={`− EGP ${fmt(record.martyrsFundDeduction)}`} valueClass="text-red-600" />
                </Section>
              </>
            ) : (
              <div className="rounded-lg border border-amber-100 bg-amber-50/80 px-3 py-2 text-xs text-amber-900">
                This employee is not insured in the payroll engine: no employee insurance, income tax, or martyrs fund are applied.
                Net equals due before insurance.
              </div>
            )}

            <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50/90 px-4 py-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Net pay</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-900">EGP {fmt(record.netSalary)}</p>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
