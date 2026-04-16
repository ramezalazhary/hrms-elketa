import { useEffect, useId, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Trash2,
  Save,
  FileStack,
  MapPinned,
  Percent,
  Plus,
  Loader2,
  ShieldCheck,
  Building2,
  User,
  Plane,
  Network,
  Clock,
  ChevronDown,
  Info,
  CircleHelp,
  CheckCircle2,
  Gift,
} from "lucide-react";
import { Layout } from "@/shared/components/Layout";
import { useToast } from "@/shared/components/ToastProvider";
import {
  createPartnerApi,
  deletePartnerApi,
  getDocumentRequirementsApi,
  getPartnersApi,
  updateDocumentRequirementsApi,
  updatePartnerApi,
} from "../api";
import { getDepartmentsApi } from "@/modules/departments/api";
import { getEmployeesApi } from "@/modules/employees/api";
import { useAppSelector } from "@/shared/hooks/reduxHooks";
import { canManagePartners } from "@/shared/utils/accessControl";
import { normaliseRoleKey } from "@/shared/components/EntityBadges";
import { EGYPT_GOVERNORATES, getCitiesForGovernorate } from "@/shared/data/egyptGovernorates";
import {
  normalizeWorkLocationsForEditor,
  workLocationsToApiPayload,
  emptyPolicyBranchRow,
} from "@/shared/utils/policyWorkLocationBranches";
import {
  lateTierMmSsFromStoredMinutes,
  parseMmSsToStoredMinutes,
} from "@/shared/utils/lateTierTimeFormat";
import {
  addSecondsToClock,
  deductionForLateWithMonthlyGraceExhaustion,
  isLateByPolicy,
  tierIntervalsSecondsFromPolicy,
} from "@/shared/utils/lateTierDeductionPreview";

const TABS = [
  { key: "general", label: "General", icon: Network, color: "teal" },
  { key: "documents", label: "Documents", icon: FileStack, color: "zinc" },
  { key: "workplaces", label: "Workplaces", icon: MapPinned, color: "blue" },
  { key: "leave", label: "Leave & Excuse", icon: Plane, color: "teal" },
  { key: "attendance", label: "Attendance", icon: Clock, color: "orange" },
  { key: "salary", label: "Salary Rules", icon: Percent, color: "violet" },
  { key: "payroll", label: "Payroll Config", icon: Gift, color: "indigo" },
];

function SkeletonBlock() {
  return (
    <div className="animate-pulse space-y-4 p-6">
      <div className="h-5 w-40 rounded-md bg-zinc-200" />
      <div className="h-24 rounded-xl bg-zinc-100" />
      <div className="h-24 rounded-xl bg-zinc-100" />
    </div>
  );
}

function SectionShell({ icon: Icon, title, description, iconColor = "text-zinc-600", actions, children }) {
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-zinc-100 ring-1 ring-zinc-200/80">
            <Icon className={`h-5 w-5 ${iconColor}`} aria-hidden />
          </div>
          <div className="min-w-0 pt-0.5">
            <h2 className="text-[17px] font-semibold tracking-tight text-zinc-900">{title}</h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-zinc-500">{description}</p>
          </div>
        </div>
        {actions ? <div className="shrink-0 sm:pt-0.5">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}

function ExpandableRulesHint({ accent = "sky", title, subtitle, subtitleDir = "ltr", children }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const isEmerald = accent === "emerald";
  const accentBar = isEmerald ? "border-l-emerald-500" : "border-l-sky-500";
  const iconTint = isEmerald ? "text-emerald-600" : "text-sky-600";

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="group flex w-full items-center gap-3 rounded-2xl bg-zinc-100/70 px-4 py-3.5 text-left transition hover:bg-zinc-100 active:scale-[0.998] motion-reduce:active:scale-100"
      >
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-zinc-200/80 ${iconTint}`} aria-hidden>
          <CircleHelp className="h-[18px] w-[18px]" strokeWidth={1.75} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold leading-snug tracking-tight text-zinc-900">{title}</span>
          {subtitle ? (
            <span className="mt-0.5 block text-xs leading-snug text-zinc-500" dir={subtitleDir}>
              {subtitle}
            </span>
          ) : null}
        </span>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-zinc-400 transition duration-200 ${open ? "-rotate-180" : ""}`}
          aria-hidden
          strokeWidth={2}
        />
      </button>
      {open ? (
        <div
          id={panelId}
          role="region"
          aria-label={title}
          className={`mt-2 space-y-4 rounded-2xl border border-zinc-200/80 bg-zinc-50/40 p-4 sm:p-5 text-[13px] leading-relaxed text-zinc-700 shadow-sm shadow-zinc-950/5 border-l-[3px] ${accentBar}`}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

function formatDeductionDaysLabel(d) {
  if (!Number.isFinite(d)) return "—";
  const x = Number(d);
  if (x === 0) return "0";
  const t = x.toFixed(4).replace(/\.?0+$/, "");
  return t;
}

/** Live preview: late deduction days from the editor’s tiers, before vs after monthly grace quota exhaustion. */
function MonthlyGraceDeductionPreview({ rules }) {
  const shift = rules.standardStartTime || "09:00:00";
  const baseGrace = Number(rules.gracePeriodMinutes);
  const graceOk = Number.isFinite(baseGrace) && baseGrace > 0;
  const tiers = Array.isArray(rules.lateDeductionTiers) ? rules.lateDeductionTiers : [];

  const preview = useMemo(() => {
    if (!tiers.length) return { empty: true };
    const intervals = tierIntervalsSecondsFromPolicy(tiers);
    const firstDed = intervals[0]?.deductionDays;
    const lateAddFull = graceOk ? baseGrace : 0;
    const rows = [];

    if (graceOk) {
      const maxSec = baseGrace * 60;
      const graceInteriorSec = Math.min(Math.max(30, Math.floor(maxSec * 0.7)), maxSec);
      const cinGrace = addSecondsToClock(shift, graceInteriorSec);
      const lateBefore = isLateByPolicy(cinGrace, shift, lateAddFull);
      const dedBeforeGrace = lateBefore
        ? deductionForLateWithMonthlyGraceExhaustion(cinGrace, shift, tiers, baseGrace, lateAddFull)
        : 0;
      const dedAfterGrace = deductionForLateWithMonthlyGraceExhaustion(cinGrace, shift, tiers, baseGrace, 0);
      rows.push({
        id: "inGrace",
        checkIn: cinGrace,
        offsetLabel: `${lateTierMmSsFromStoredMinutes(graceInteriorSec / 60)} after shift`,
        beforeStatus: lateBefore ? "LATE" : "PRESENT",
        beforeDed: dedBeforeGrace,
        afterStatus: "LATE",
        afterDed: dedAfterGrace,
      });
    }

    const pastOffsetSec = graceOk ? baseGrace * 60 + 60 : 11 * 60;
    const cinLate = addSecondsToClock(shift, pastOffsetSec);
    const dedBeforeLate = deductionForLateWithMonthlyGraceExhaustion(cinLate, shift, tiers, baseGrace, lateAddFull);
    const dedAfterLate = deductionForLateWithMonthlyGraceExhaustion(cinLate, shift, tiers, baseGrace, 0);
    rows.push({
      id: "pastGrace",
      checkIn: cinLate,
      offsetLabel: graceOk ? `${baseGrace} min grace + 1 min` : "11 min after shift (no grace)",
      beforeStatus: "LATE",
      beforeDed: dedBeforeLate,
      afterStatus: "LATE",
      afterDed: dedAfterLate,
    });

    return {
      empty: false,
      rows,
      firstDed,
      intervals,
      shift,
      baseGrace,
      graceOk,
    };
  }, [shift, baseGrace, graceOk, tiers]);

  if (preview.empty) {
    return (
      <div className="rounded-2xl bg-white px-4 py-4 ring-1 ring-zinc-200/80">
        <p className="text-[13px] font-semibold tracking-tight text-zinc-900">Deduction preview</p>
        <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">
          Add at least one late tier in the table below. Sample rows will then show day(s) deducted before vs after the monthly grace
          quota runs out — same logic as payroll and attendance finalize.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-zinc-500" dir="rtl">
          أضف شريحة تأخير واحدة على الأقل في الجدول أدناه ليظهر معاين الخصم هنا.
        </p>
      </div>
    );
  }

  const { rows, firstDed, intervals } = preview;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">From your rules</p>
          <p className="mt-0.5 text-[13px] font-semibold tracking-tight text-zinc-900">Deduction preview</p>
        </div>
        <span className="rounded-lg bg-zinc-100 px-2.5 py-1 font-mono text-xs text-zinc-700 ring-1 ring-zinc-200/80">
          {shift}
        </span>
      </div>

      <ul className="space-y-2 rounded-2xl bg-white px-4 py-3 ring-1 ring-zinc-200/80">
        <li className="flex gap-3 text-xs leading-relaxed text-zinc-600">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500/80" aria-hidden />
          <span>
            <span className="font-medium text-zinc-800">Grace quota available</span>
            {" — "}
            Late threshold is shift + <strong className="text-zinc-900">{graceOk ? `${baseGrace} min` : "0"}</strong>. Inside that
            window you are <strong className="text-emerald-700">PRESENT</strong> (0 tier deduction). After that,{" "}
            <strong className="text-red-700/90">LATE</strong> uses your tier table on seconds after shift start.
          </span>
        </li>
        <li className="flex gap-3 text-xs leading-relaxed text-zinc-600">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500/80" aria-hidden />
          <span>
            <span className="font-medium text-zinc-800">Grace quota exhausted</span>
            {" — "}
            Lateness is measured from shift start. Inside the old grace window (or before the first tier&apos;s first second), the
            deduction is your <strong className="text-zinc-900">first tier</strong>
            {Number.isFinite(firstDed) ? (
              <>
                : <strong className="tabular-nums text-zinc-900">{formatDeductionDaysLabel(firstDed)}</strong> day(s)
              </>
            ) : null}
            . Otherwise the matching tier applies (or the last tier if above the top band).
          </span>
        </li>
      </ul>

      <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-zinc-200/80">
        <table className="min-w-full text-left text-xs">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50/80">
              <th className="px-3 py-2.5 font-medium text-zinc-500">Sample</th>
              <th className="px-3 py-2.5 font-medium text-zinc-500">Check-in</th>
              <th className="px-3 py-2.5 font-medium text-zinc-500">Has quota</th>
              <th className="px-3 py-2.5 font-medium text-zinc-500">Quota out</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map((r) => (
              <tr key={r.id} className="text-zinc-700">
                <td className="px-3 py-3 align-top">
                  <span className="font-medium text-zinc-900">{r.offsetLabel}</span>
                </td>
                <td className="px-3 py-3 align-top font-mono text-[11px] text-zinc-800">{r.checkIn}</td>
                <td className="px-3 py-3 align-top">
                  <span className="font-medium text-zinc-900">{r.beforeStatus}</span>
                  <span className="text-zinc-400"> · </span>
                  <span className="tabular-nums font-semibold text-zinc-900">{formatDeductionDaysLabel(r.beforeDed)}</span>
                  <span className="text-zinc-400"> d</span>
                </td>
                <td className="px-3 py-3 align-top">
                  <span className="font-medium text-zinc-900">{r.afterStatus}</span>
                  <span className="text-zinc-400"> · </span>
                  <span className="tabular-nums font-semibold text-zinc-900">{formatDeductionDaysLabel(r.afterDed)}</span>
                  <span className="text-zinc-400"> d</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {intervals.length > 0 ? (
        <p className="px-0.5 text-[11px] leading-relaxed text-zinc-400">
          First tier (server seconds): {intervals[0].lo}–{intervals[0].hi}s after shift →{" "}
          <span className="font-medium text-zinc-600">{formatDeductionDaysLabel(intervals[0].deductionDays)}</span> day(s).
        </p>
      ) : null}

      <p className="rounded-xl bg-zinc-100/60 px-3 py-2.5 text-xs leading-relaxed text-zinc-600" dir="rtl">
        «Has quota» = عتبة شيفت + السماح. «Quota out» = بعد نفاد الرصيد؛ التأخير من أول الشيفت مع قاعدة الشريحة الأولى عند
        الحاجة.
      </p>
    </div>
  );
}

function FieldGroup({ label, hint, children, className = "" }) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-xs font-medium text-zinc-500">{label}</label>
      {hint && <p className="mb-2 text-[11px] leading-snug text-zinc-400">{hint}</p>}
      {children}
    </div>
  );
}

const INPUT_CLS =
  "w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-200/80";
const SELECT_CLS = `${INPUT_CLS} disabled:bg-zinc-100/80 disabled:text-zinc-400`;
const NUM_CLS = `${INPUT_CLS} tabular-nums`;

const SECONDARY_BTN =
  "inline-flex items-center gap-2 rounded-full border border-zinc-200/90 bg-white px-4 py-2 text-sm font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50 active:scale-[0.99] motion-reduce:active:scale-100";

function LateTierMmSsInput({ valueMinutes, onCommit, className }) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState("");
  const formatted = lateTierMmSsFromStoredMinutes(valueMinutes);
  return (
    <input
      type="text"
      inputMode="text"
      autoComplete="off"
      spellCheck={false}
      placeholder="mm:ss"
      title="minutes:seconds after shift start (e.g. 1:30 = 1 min 30 sec)"
      className={className}
      value={focused ? draft : formatted}
      onFocus={() => {
        setFocused(true);
        setDraft(formatted);
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setFocused(false);
        const p = parseMmSsToStoredMinutes(draft);
        if (p !== null && Number.isFinite(p)) onCommit(p);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
    />
  );
}

function ruleBadge(type) {
  const styles = {
    DEFAULT: "bg-zinc-100 text-zinc-800 ring-zinc-200/80",
    DEPARTMENT: "bg-zinc-100 text-zinc-800 ring-zinc-200/80",
    EMPLOYEE: "bg-zinc-100 text-zinc-800 ring-zinc-200/80",
  };
  const labels = { DEFAULT: "Global default", DEPARTMENT: "Department", EMPLOYEE: "Employee" };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${styles[type] || "bg-zinc-100 text-zinc-700 ring-zinc-200"}`}>
      {labels[type] || type}
    </span>
  );
}

export function OrganizationRulesPage() {
  const [activeTab, setActiveTab] = useState("general");
  const [requiredDocs, setRequiredDocs] = useState([]);
  const [workLocations, setWorkLocations] = useState([]);
  const [salaryIncreaseRules, setSalaryIncreaseRules] = useState([]);
  const [companyTimezone, setCompanyTimezone] = useState("Africa/Cairo");
  const [companyMonthStartDay, setCompanyMonthStartDay] = useState(1);
  const [chiefExecutiveEmployeeId, setChiefExecutiveEmployeeId] = useState("");
  const [chiefExecutiveTitle, setChiefExecutiveTitle] = useState("Chief Executive Officer");
  const [leavePolicies, setLeavePolicies] = useState([]);
  const [attendanceRules, setAttendanceRules] = useState({
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
    /** 0=Sun … 6=Sat (UTC, same as stored attendance dates). Default Egypt: Fri+Sat. */
    weeklyRestDays: [5, 6],
  });
  const [payrollConfig, setPayrollConfig] = useState({
    decimalPlaces: 2,
    workingDaysPerMonth: 22,
    hoursPerDay: 8,
    overtimeMultiplier: 1.5,
    personalExemptionAnnual: 20000,
    martyrsFundRate: 0.0005,
    insuranceRates: { employeeShare: 0.11, companyShare: 0.1875, maxInsurableWage: 16700, minInsurableWage: 2700 },
    taxBrackets: [
      { from: 0, to: 40000, rate: 0 },
      { from: 40000, to: 55000, rate: 0.10 },
      { from: 55000, to: 70000, rate: 0.15 },
      { from: 70000, to: 200000, rate: 0.20 },
      { from: 200000, to: 400000, rate: 0.225 },
      { from: 400000, to: 1200000, rate: 0.25 },
      { from: 1200000, to: null, rate: 0.275 },
    ],
  });
  const [assessmentPayrollRules, setAssessmentPayrollRules] = useState({
    bonusDaysEnabled: true,
    bonusDayMultiplier: 1.0,
    overtimeEnabled: false,
    overtimeDayMultiplier: 1.5,
    deductionEnabled: false,
    deductionDayMultiplier: 1.0,
  });
  const [departmentRows, setDepartmentRows] = useState([]);
  const [employeeOptions, setEmployeeOptions] = useState([]);
  const [partners, setPartners] = useState([]);
  const [partnerDraft, setPartnerDraft] = useState({
    name: "",
    title: "Partner",
    employeeId: "",
    ownershipPercent: "",
    notes: "",
  });
  const [savingPartner, setSavingPartner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedPolicies, setExpandedPolicies] = useState({});
  const [expandedLocations, setExpandedLocations] = useState({});
  const { showToast } = useToast();
  const currentUser = useAppSelector((state) => state.identity.currentUser);
  const canEditPartners = canManagePartners(currentUser, chiefExecutiveEmployeeId);
  const canManageBulkLeaveCredits = new Set(["HR_STAFF", "HR_MANAGER", "ADMIN"]).has(
    normaliseRoleKey(currentUser?.role),
  );

  useEffect(() => {
    async function load() {
      try {
        const data = await getDocumentRequirementsApi();
        setRequiredDocs(data.documentRequirements || []);
        setWorkLocations(normalizeWorkLocationsForEditor(data.workLocations || []));
        setSalaryIncreaseRules(data.salaryIncreaseRules || []);
        setCompanyTimezone(data.companyTimezone || "Africa/Cairo");
        setCompanyMonthStartDay(Math.min(31, Math.max(1, Number(data.companyMonthStartDay) || 1)));
        const ceo = data.chiefExecutiveEmployeeId;
        if (ceo && typeof ceo === "object") {
          const ceoId = ceo.id ?? ceo._id ?? null;
          setChiefExecutiveEmployeeId(ceoId ? String(ceoId) : "");
        } else if (ceo) {
          const ceoStr = String(ceo).trim();
          setChiefExecutiveEmployeeId(ceoStr && ceoStr !== "[object Object]" ? ceoStr : "");
        } else {
          setChiefExecutiveEmployeeId("");
        }
        setChiefExecutiveTitle(data.chiefExecutiveTitle?.trim() || "Chief Executive Officer");
        setPartners(Array.isArray(data.partners) ? data.partners : []);
        setLeavePolicies(Array.isArray(data.leavePolicies) ? data.leavePolicies : []);
        if (data.attendanceRules && typeof data.attendanceRules === "object") {
          setAttendanceRules((prev) => ({ ...prev, ...data.attendanceRules }));
        }
        if (data.assessmentPayrollRules && typeof data.assessmentPayrollRules === "object") {
          setAssessmentPayrollRules((prev) => ({ ...prev, ...data.assessmentPayrollRules }));
        }
        if (data.payrollConfig && typeof data.payrollConfig === "object") {
          setPayrollConfig((prev) => ({
            ...prev,
            ...data.payrollConfig,
            insuranceRates: { ...prev.insuranceRates, ...(data.payrollConfig.insuranceRates || {}) },
            taxBrackets: Array.isArray(data.payrollConfig.taxBrackets) && data.payrollConfig.taxBrackets.length > 0
              ? data.payrollConfig.taxBrackets
              : prev.taxBrackets,
          }));
        }
        const unifiedWdRaw =
          data.attendanceRules?.workingDaysPerMonth != null
            ? Number(data.attendanceRules.workingDaysPerMonth)
            : Number(data.payrollConfig?.workingDaysPerMonth);
        if (Number.isFinite(unifiedWdRaw) && unifiedWdRaw >= 1 && unifiedWdRaw <= 31) {
          const unifiedWd = Math.floor(unifiedWdRaw);
          setAttendanceRules((prev) => ({ ...prev, workingDaysPerMonth: unifiedWd }));
          setPayrollConfig((prev) => ({ ...prev, workingDaysPerMonth: unifiedWd }));
        }
        try {
          const deps = await getDepartmentsApi();
          setDepartmentRows(Array.isArray(deps) ? deps : []);
        } catch { setDepartmentRows([]); }
        try {
          const emRes = await getEmployeesApi({ page: "1", limit: "500" });
          const list = emRes?.employees ?? emRes;
          setEmployeeOptions(Array.isArray(list) ? list : []);
        } catch { setEmployeeOptions([]); }
      } catch (error) {
        showToast(error.message, "error");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [showToast]);

  // --- Document handlers ---
  const addDoc = () => setRequiredDocs([...requiredDocs, { name: "", isMandatory: true, description: "" }]);
  const updateDoc = (index, field, value) => {
    const next = [...requiredDocs];
    next[index][field] = value;
    setRequiredDocs(next);
  };
  const removeDoc = (index) => setRequiredDocs(requiredDocs.filter((_, i) => i !== index));

  // --- Location handlers ---
  const addLocation = () => {
    const newIdx = workLocations.length;
    setWorkLocations([...workLocations, { governorate: "", city: "", branches: [emptyPolicyBranchRow()] }]);
    setExpandedLocations((p) => ({ ...p, [newIdx]: true }));
  };
  const updateLocation = (index, field, value) => {
    const next = [...workLocations];
    if (field === "governorate") { next[index].governorate = value; next[index].city = ""; }
    else next[index][field] = value;
    setWorkLocations(next);
  };
  const addBranch = (ci) => {
    const next = [...workLocations];
    next[ci].branches.push(emptyPolicyBranchRow(next[ci].city || ""));
    setWorkLocations(next);
  };
  const updateBranchField = (ci, bi, field, value) => {
    const next = [...workLocations];
    next[ci].branches[bi] = { ...next[ci].branches[bi], [field]: value };
    setWorkLocations(next);
  };
  const removeCity = (ci) => setWorkLocations(workLocations.filter((_, i) => i !== ci));
  const removeBranch = (ci, bi) => {
    const next = [...workLocations];
    next[ci].branches = next[ci].branches.filter((_, i) => i !== bi);
    setWorkLocations(next);
  };

  // --- Salary rule handlers ---
  const addSalaryRule = () => setSalaryIncreaseRules([...salaryIncreaseRules, { type: "DEPARTMENT", target: "", percentage: 10 }]);
  const updateSalaryRule = (index, field, value) => {
    const next = [...salaryIncreaseRules];
    next[index][field] = value;
    setSalaryIncreaseRules(next);
  };
  const removeSalaryRule = (index) => setSalaryIncreaseRules(salaryIncreaseRules.filter((_, i) => i !== index));

  // --- Leave policy handlers ---
  const addLeavePolicy = () => {
    const nextV = (leavePolicies.reduce((m, x) => Math.max(m, Number(x.version) || 0), 0) || 0) + 1;
    setLeavePolicies([...leavePolicies, {
      version: nextV,
      vacationRules: { annualDays: 21, maxConsecutiveDays: 365, minDaysAfterHire: 0, entitlementVariesByYear: false, firstYearDays: 15, afterFirstYearDays: 21 },
      excuseRules: { maxHoursPerExcuse: 8, maxExcusesPerPeriod: 0, excuseLimitPeriod: "MONTH", roundingMinutes: 15, minDaysAfterHire: 0 },
    }]);
    setExpandedPolicies((p) => ({ ...p, [nextV]: true }));
  };
  const updateLeavePolicy = (index, patch) => {
    const next = [...leavePolicies];
    next[index] = { ...next[index], ...patch };
    setLeavePolicies(next);
  };
  const updateLeavePolicyNested = (index, key, field, value) => {
    const next = [...leavePolicies];
    next[index] = { ...next[index], [key]: { ...(next[index][key] || {}), [field]: value } };
    setLeavePolicies(next);
  };
  const removeLeavePolicy = (index) => setLeavePolicies(leavePolicies.filter((_, i) => i !== index));

  // --- Attendance handlers ---
  const updateAttendanceField = (field, value) => {
    setAttendanceRules((prev) => ({ ...prev, [field]: value }));
    if (field === "workingDaysPerMonth") {
      const n = Math.floor(Number(value));
      const v = Number.isFinite(n) ? Math.min(31, Math.max(1, n)) : 22;
      setPayrollConfig((prev) => ({ ...prev, workingDaysPerMonth: v }));
    }
  };

  const toggleWeeklyRestDay = (dow) => {
    setAttendanceRules((prev) => {
      const raw = Array.isArray(prev.weeklyRestDays) ? prev.weeklyRestDays : [5, 6];
      const set = new Set(raw.filter((x) => Number.isInteger(x) && x >= 0 && x <= 6));
      if (set.has(dow)) set.delete(dow);
      else set.add(dow);
      return { ...prev, weeklyRestDays: [...set].sort((a, b) => a - b) };
    });
  };
  const addDeductionTier = () => {
    const tiers = attendanceRules.lateDeductionTiers || [];
    const lastToMin = tiers.length > 0 ? tiers[tiers.length - 1].toMinutes : 0;
    setAttendanceRules((prev) => ({
      ...prev,
      lateDeductionTiers: [
        ...prev.lateDeductionTiers,
        { fromMinutes: lastToMin, toMinutes: lastToMin + 30, deductionDays: 0.25 },
      ],
    }));
  };
  const updateDeductionTier = (index, field, value) => {
    setAttendanceRules((prev) => {
      const tiers = [...prev.lateDeductionTiers];
      tiers[index] = { ...tiers[index], [field]: value };
      return { ...prev, lateDeductionTiers: tiers };
    });
  };
  const removeDeductionTier = (index) => {
    setAttendanceRules((prev) => ({ ...prev, lateDeductionTiers: prev.lateDeductionTiers.filter((_, i) => i !== index) }));
  };

  // --- Save ---
  const handleSave = useCallback(async () => {
    if (!chiefExecutiveEmployeeId.trim()) {
      showToast("Chief Executive is required. Select an active employee before saving.", "error");
      return;
    }
    setSaving(true);
    try {
      await updateDocumentRequirementsApi({
        documentRequirements: requiredDocs.filter((d) => d.name),
        workLocations: workLocationsToApiPayload(workLocations),
        salaryIncreaseRules: salaryIncreaseRules.filter((r) => r.type === "DEFAULT" ? true : r.target),
        companyTimezone: companyTimezone.trim() || "Africa/Cairo",
        companyMonthStartDay: Math.min(31, Math.max(1, Math.floor(Number(companyMonthStartDay)) || 1)),
        chiefExecutiveTitle: chiefExecutiveTitle.trim() || "Chief Executive Officer",
        chiefExecutiveEmployeeId: chiefExecutiveEmployeeId.trim(),
        partners,
        leavePolicies: leavePolicies.map((p) => ({ version: Number(p.version) || 1, vacationRules: p.vacationRules || {}, excuseRules: p.excuseRules || {} })),
        attendanceRules: {
          ...attendanceRules,
          lateDeductionTiers: (attendanceRules.lateDeductionTiers || [])
            .filter((t) => t.fromMinutes != null && t.toMinutes != null)
            .map((t) => ({
              fromMinutes: Math.max(0, Number(t.fromMinutes) || 0),
              toMinutes: Number(t.toMinutes),
              deductionDays: Number(t.deductionDays) || 0,
            }))
            .filter(
              (t) =>
                Number.isFinite(t.fromMinutes) &&
                Number.isFinite(t.toMinutes) &&
                t.toMinutes > t.fromMinutes,
            ),
        },
        assessmentPayrollRules: {
          bonusDaysEnabled: Boolean(assessmentPayrollRules.bonusDaysEnabled),
          bonusDayMultiplier: Number(assessmentPayrollRules.bonusDayMultiplier) || 1,
          overtimeEnabled: Boolean(assessmentPayrollRules.overtimeEnabled),
          overtimeDayMultiplier: Number(assessmentPayrollRules.overtimeDayMultiplier) || 1.5,
          deductionEnabled: Boolean(assessmentPayrollRules.deductionEnabled),
          deductionDayMultiplier: Number(assessmentPayrollRules.deductionDayMultiplier) || 1,
        },
        payrollConfig: {
          decimalPlaces: Math.min(8, Math.max(0, Math.floor(Number(payrollConfig.decimalPlaces)) || 2)),
          workingDaysPerMonth:
            Math.min(31, Math.max(1, Math.floor(Number(attendanceRules.workingDaysPerMonth)) || 22)),
          hoursPerDay: Number(payrollConfig.hoursPerDay) || 8,
          overtimeMultiplier: Number(payrollConfig.overtimeMultiplier) || 1.5,
          personalExemptionAnnual: Number(payrollConfig.personalExemptionAnnual) || 20000,
          martyrsFundRate: Number(payrollConfig.martyrsFundRate) || 0.0005,
          insuranceRates: {
            employeeShare: Number(payrollConfig.insuranceRates?.employeeShare) || 0.11,
            companyShare: Number(payrollConfig.insuranceRates?.companyShare) || 0.1875,
            maxInsurableWage: Number(payrollConfig.insuranceRates?.maxInsurableWage) || 16700,
            minInsurableWage: Number(payrollConfig.insuranceRates?.minInsurableWage) || 2700,
          },
          taxBrackets: payrollConfig.taxBrackets,
        },
      });
      showToast("Organization settings updated successfully", "success");
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setSaving(false);
    }
  }, [requiredDocs, workLocations, salaryIncreaseRules, companyTimezone, companyMonthStartDay, chiefExecutiveTitle, chiefExecutiveEmployeeId, leavePolicies, attendanceRules, assessmentPayrollRules, payrollConfig, partners, showToast]);

  const refreshPartners = useCallback(async () => {
    const data = await getPartnersApi();
    setPartners(Array.isArray(data?.partners) ? data.partners : []);
  }, []);

  const handleCreatePartner = useCallback(async () => {
    if (!canEditPartners) return;
    if (!partnerDraft.name.trim()) {
      showToast("Partner name is required", "error");
      return;
    }
    setSavingPartner(true);
    try {
      await createPartnerApi({
        ...partnerDraft,
        employeeId: partnerDraft.employeeId || null,
        ownershipPercent:
          partnerDraft.ownershipPercent === "" ? null : Number(partnerDraft.ownershipPercent),
      });
      await refreshPartners();
      setPartnerDraft({ name: "", title: "Partner", employeeId: "", ownershipPercent: "", notes: "" });
      showToast("Partner added", "success");
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setSavingPartner(false);
    }
  }, [canEditPartners, partnerDraft, refreshPartners, showToast]);

  const handleDeletePartner = useCallback(async (partnerId) => {
    if (!canEditPartners || !partnerId) return;
    setSavingPartner(true);
    try {
      await deletePartnerApi(partnerId);
      await refreshPartners();
      showToast("Partner removed", "success");
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setSavingPartner(false);
    }
  }, [canEditPartners, refreshPartners, showToast]);

  const handleUpdatePartner = useCallback(async (partner) => {
    if (!canEditPartners || !partner?._id) return;
    setSavingPartner(true);
    try {
      await updatePartnerApi(partner._id, partner);
      await refreshPartners();
      showToast("Partner updated", "success");
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setSavingPartner(false);
    }
  }, [canEditPartners, refreshPartners, showToast]);

  const stats = useMemo(() => {
    const filledDocs = requiredDocs.filter((d) => d.name?.trim()).length;
    const filledLocs = workLocations.filter((l) => l.governorate && l.city).length;
    const branchCount = workLocations.reduce((n, l) => n + (l.branches || []).filter((b) => (b.name || "").trim() || (b.code || "").trim()).length, 0);
    const validRules = salaryIncreaseRules.filter((r) => (r.type === "DEFAULT" ? true : r.target)).length;
    const policyCount = leavePolicies.length;
    const tierCount = (attendanceRules.lateDeductionTiers || []).length;
    return { filledDocs, filledLocs, branchCount, validRules, policyCount, tierCount };
  }, [requiredDocs, workLocations, salaryIncreaseRules, leavePolicies, attendanceRules]);

  // Tab badges show item counts
  const tabBadges = useMemo(() => ({
    general: null,
    documents: stats.filledDocs || null,
    workplaces: stats.filledLocs || null,
    leave: stats.policyCount || null,
    attendance: stats.tierCount || null,
    salary: stats.validRules || null,
  }), [stats]);

  return (
    <Layout
      title="Organization rules"
      description="Company-wide configuration for documents, workplaces, leave, attendance, and salary."
    >
      <div className="pb-24">
        {/* Tab navigation — segmented control */}
        <div className="mb-8 -mx-1 overflow-x-auto pb-0.5">
          <div
            className="inline-flex min-w-max gap-0.5 rounded-2xl bg-zinc-100/90 p-1 ring-1 ring-zinc-200/80"
            role="tablist"
            aria-label="Organization settings sections"
          >
            {TABS.map(({ key, label, icon: TabIcon }) => {
              const isActive = activeTab === key;
              const badge = tabBadges[key];
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(key)}
                  className={`flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium whitespace-nowrap transition ${
                    isActive
                      ? "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200/60"
                      : "text-zinc-600 hover:text-zinc-900"
                  }`}
                >
                  <TabIcon className={`h-4 w-4 shrink-0 ${isActive ? "text-zinc-800" : "text-zinc-400"}`} />
                  {label}
                  {badge != null && (
                    <span
                      className={`ml-0.5 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold tabular-nums ${
                        isActive ? "bg-zinc-900 text-white" : "bg-zinc-200/80 text-zinc-600"
                      }`}
                    >
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {loading ? (
          <div className="overflow-hidden rounded-[20px] bg-white shadow-sm ring-1 ring-zinc-950/[0.06]">
            <SkeletonBlock />
          </div>
        ) : (
          <div className="overflow-hidden rounded-[20px] bg-white shadow-sm ring-1 ring-zinc-950/[0.06]">
            <div className="p-6 sm:p-8 lg:p-10">
              {/* ===== GENERAL ===== */}
              {activeTab === "general" && (
                <SectionShell
                  icon={Network}
                  iconColor="text-zinc-700"
                  title="Company month & organizational hierarchy"
                  description="Set the first day of your monthly cycle, timezone, and identify the chief executive. Department managers are listed from the Departments module."
                >
                  <section className="space-y-3">
                    <header className="px-0.5">
                      <h3 className="text-[15px] font-semibold tracking-tight text-zinc-900">Fiscal month & leadership</h3>
                      <p className="mt-1 text-sm leading-relaxed text-zinc-500">Used across payroll, attendance periods, and reporting.</p>
                    </header>
                    <div className="overflow-hidden rounded-[20px] bg-white p-5 shadow-sm ring-1 ring-zinc-950/[0.06] sm:p-6">
                      <div className="grid gap-6 sm:grid-cols-2">
                        <FieldGroup
                          label="Month starts on calendar day (1–31)"
                          hint="1 = standard calendar month. E.g. 26 = period runs 26th to 25th of the next month."
                        >
                          <input
                            type="number" min={1} max={31}
                            className={`${NUM_CLS} max-w-[8rem]`}
                            value={companyMonthStartDay}
                            onChange={(e) => setCompanyMonthStartDay(Math.min(31, Math.max(1, Number(e.target.value) || 1)))}
                          />
                        </FieldGroup>
                        <FieldGroup label="Company timezone (IANA)">
                          <input
                            type="text"
                            className={`${INPUT_CLS} max-w-xs`}
                            value={companyTimezone}
                            onChange={(e) => setCompanyTimezone(e.target.value)}
                            placeholder="Africa/Cairo"
                          />
                        </FieldGroup>
                        <FieldGroup label="Chief executive title">
                          <input
                            type="text"
                            className={INPUT_CLS}
                            value={chiefExecutiveTitle}
                            onChange={(e) => setChiefExecutiveTitle(e.target.value)}
                            placeholder="e.g. Chief Executive Officer, Managing Director"
                          />
                        </FieldGroup>
                        <FieldGroup label="Chief executive (employee record)">
                          <select
                            className={SELECT_CLS}
                            value={chiefExecutiveEmployeeId}
                            onChange={(e) => setChiefExecutiveEmployeeId(e.target.value)}
                          >
                            <option value="">Not set</option>
                            {employeeOptions.map((emp) => (
                              <option key={emp.id || emp._id} value={emp.id || emp._id}>
                                {emp.fullName || emp.email} {emp.employeeCode ? `(${emp.employeeCode})` : ""}
                              </option>
                            ))}
                          </select>
                        </FieldGroup>
                      </div>
                      {!chiefExecutiveEmployeeId.trim() ? (
                        <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 ring-1 ring-amber-200">
                          A Chief Executive is mandatory. Save is blocked until a valid active employee is selected.
                        </p>
                      ) : null}
                    </div>
                  </section>

                  <section className="space-y-3">
                    <header className="px-0.5">
                      <h3 className="text-[15px] font-semibold tracking-tight text-zinc-900">Partners governance</h3>
                      <p className="mt-1 text-sm leading-relaxed text-zinc-500">
                        Partner records can be created or edited only by the active Chief Executive or Admin.
                      </p>
                    </header>
                    <div className="overflow-hidden rounded-[20px] bg-white p-5 shadow-sm ring-1 ring-zinc-950/[0.06] sm:p-6">
                      {partners.length === 0 ? (
                        <p className="text-sm text-zinc-500">No partners configured.</p>
                      ) : (
                        <div className="space-y-3">
                          {partners.map((p) => {
                            const pid = p._id || p.id;
                            return (
                              <div key={pid} className="grid gap-3 rounded-xl border border-zinc-200 p-3 sm:grid-cols-5">
                                <input className={INPUT_CLS} value={p.name || ""} disabled={!canEditPartners || savingPartner} onChange={(e) => setPartners((prev) => prev.map((row) => (String(row._id || row.id) === String(pid) ? { ...row, name: e.target.value } : row)))} />
                                <input className={INPUT_CLS} value={p.title || ""} disabled={!canEditPartners || savingPartner} onChange={(e) => setPartners((prev) => prev.map((row) => (String(row._id || row.id) === String(pid) ? { ...row, title: e.target.value } : row)))} />
                                <input className={NUM_CLS} type="number" min={0} max={100} value={p.ownershipPercent ?? ""} disabled={!canEditPartners || savingPartner} onChange={(e) => setPartners((prev) => prev.map((row) => (String(row._id || row.id) === String(pid) ? { ...row, ownershipPercent: e.target.value } : row)))} />
                                <button type="button" className="rounded-xl border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-60" disabled={!canEditPartners || savingPartner} onClick={() => handleUpdatePartner(p)}>Update</button>
                                <button type="button" className="rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60" disabled={!canEditPartners || savingPartner} onClick={() => handleDeletePartner(pid)}>Remove</button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {canEditPartners ? (
                        <div className="mt-4 grid gap-3 rounded-xl border border-dashed border-zinc-300 p-3 sm:grid-cols-5">
                          <input className={INPUT_CLS} placeholder="Partner name" value={partnerDraft.name} onChange={(e) => setPartnerDraft((prev) => ({ ...prev, name: e.target.value }))} />
                          <input className={INPUT_CLS} placeholder="Title" value={partnerDraft.title} onChange={(e) => setPartnerDraft((prev) => ({ ...prev, title: e.target.value }))} />
                          <input className={NUM_CLS} type="number" min={0} max={100} placeholder="Ownership %" value={partnerDraft.ownershipPercent} onChange={(e) => setPartnerDraft((prev) => ({ ...prev, ownershipPercent: e.target.value }))} />
                          <select className={SELECT_CLS} value={partnerDraft.employeeId} onChange={(e) => setPartnerDraft((prev) => ({ ...prev, employeeId: e.target.value }))}>
                            <option value="">No linked employee</option>
                            {employeeOptions.map((emp) => (
                              <option key={emp.id || emp._id} value={emp.id || emp._id}>
                                {emp.fullName || emp.email}
                              </option>
                            ))}
                          </select>
                          <button type="button" className="rounded-xl bg-zinc-900 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-60" disabled={savingPartner} onClick={handleCreatePartner}>Add partner</button>
                        </div>
                      ) : (
                        <p className="mt-4 rounded-xl bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-600 ring-1 ring-zinc-200">
                          Read-only: partner management is restricted to Chief Executive and Admin.
                        </p>
                      )}
                    </div>
                  </section>

                  <section className="space-y-3">
                    <header className="px-0.5">
                      <h3 className="text-[15px] font-semibold tracking-tight text-zinc-900">Department managers</h3>
                      <p className="mt-1 text-sm leading-relaxed text-zinc-500">
                        Read-only here. Update names and emails in{" "}
                        <Link to="/departments" className="font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-2 hover:decoration-zinc-600">
                          Departments
                        </Link>
                        .
                      </p>
                    </header>
                    {departmentRows.length === 0 ? (
                      <div className="rounded-[20px] bg-zinc-50/50 py-10 text-center text-sm text-zinc-500 ring-1 ring-zinc-200/80">
                        No departments loaded.
                      </div>
                    ) : (
                      <div className="overflow-hidden rounded-[20px] bg-white shadow-sm ring-1 ring-zinc-950/[0.06]">
                        <table className="min-w-full divide-y divide-zinc-100 text-sm">
                          <thead>
                            <tr className="bg-zinc-50/80 text-left text-xs font-medium text-zinc-500">
                              <th className="px-4 py-3">Department</th>
                              <th className="px-4 py-3">Code</th>
                              <th className="px-4 py-3">Head</th>
                              <th className="w-20 px-4 py-3" />
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-100">
                            {departmentRows.map((d) => {
                              const did = d.id || d._id;
                              return (
                                <tr key={did} className="transition hover:bg-zinc-50/60">
                                  <td className="px-4 py-3 font-medium text-zinc-900">{d.name}</td>
                                  <td className="px-4 py-3 text-zinc-500">{d.code || "—"}</td>
                                  <td className="px-4 py-3 text-zinc-600">{d.head?.trim() || "—"}</td>
                                  <td className="px-4 py-3 text-right">
                                    <Link to={`/departments/${did}/edit`} className="text-xs font-semibold text-zinc-700 hover:text-zinc-900">
                                      Edit
                                    </Link>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>
                </SectionShell>
              )}

              {/* ===== DOCUMENTS ===== */}
              {activeTab === "documents" && (
                <SectionShell
                  icon={FileStack}
                  iconColor="text-zinc-700"
                  title="Required documents"
                  description="Documents shown to employees in onboarding checklists. Mark items as mandatory to flag missing uploads."
                  actions={
                    <button type="button" onClick={addDoc} className={SECONDARY_BTN}>
                      <Plus className="h-4 w-4" /> Add document
                    </button>
                  }
                >
                  {requiredDocs.length === 0 ? (
                    <EmptyState icon={FileStack} title="No document types yet" description="Add national ID, contract, or any file your HR team must collect." actionLabel="Add the first document" onAction={addDoc} />
                  ) : (
                    <ul className="space-y-3">
                      {requiredDocs.map((doc, index) => (
                        <li
                          key={index}
                          className={`relative overflow-hidden rounded-[20px] bg-white shadow-sm ring-1 transition ${
                            doc.isMandatory ? "ring-zinc-900/15" : "ring-zinc-950/[0.06]"
                          }`}
                        >
                          <div className="flex flex-col gap-5 p-5 sm:flex-row sm:flex-wrap sm:items-end">
                            <div className="min-w-0 flex-1 sm:min-w-[200px]">
                              <label className="mb-1.5 flex items-center gap-2 text-xs font-medium text-zinc-500">
                                <span className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-lg bg-zinc-100 text-[11px] font-semibold text-zinc-600 ring-1 ring-zinc-200/80">
                                  {index + 1}
                                </span>
                                Name
                              </label>
                              <input type="text" className={INPUT_CLS} placeholder="e.g. National ID, employment contract" value={doc.name} onChange={(e) => updateDoc(index, "name", e.target.value)} />
                            </div>
                            <div className="min-w-0 flex-[2] sm:min-w-[280px]">
                              <label className="mb-1.5 block text-xs font-medium text-zinc-500">Instructions</label>
                              <input type="text" className={INPUT_CLS} placeholder="Optional — e.g. must be a clear color scan" value={doc.description} onChange={(e) => updateDoc(index, "description", e.target.value)} />
                            </div>
                            <div className="flex items-center gap-3 border-t border-zinc-100 pt-4 sm:border-0 sm:pt-0">
                              <label className="flex cursor-pointer items-center gap-2.5 text-sm text-zinc-800">
                                <input type="checkbox" className="h-[18px] w-[18px] rounded-md border-zinc-300 text-zinc-900 focus:ring-zinc-400/30" checked={doc.isMandatory} onChange={(e) => updateDoc(index, "isMandatory", e.target.checked)} />
                                <span className="flex items-center gap-1.5 font-medium">
                                  {doc.isMandatory && <ShieldCheck className="h-4 w-4 text-zinc-700" aria-hidden />}
                                  Mandatory
                                </span>
                              </label>
                            </div>
                            <button type="button" onClick={() => removeDoc(index)} className="absolute right-3 top-3 rounded-full p-2 text-zinc-400 transition hover:bg-red-50 hover:text-red-600 sm:static sm:ml-auto sm:self-center" aria-label={`Remove document row ${index + 1}`}>
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </SectionShell>
              )}

              {/* ===== WORKPLACES ===== */}
              {activeTab === "workplaces" && (
                <SectionShell
                  icon={MapPinned}
                  iconColor="text-zinc-700"
                  title="Workplaces & branches"
                  description="Governorates and cities power workplace pickers. Each branch matches the Branch record shape (name, code, insurance number, location, city, country, status)."
                  actions={
                    <button type="button" onClick={addLocation} className={SECONDARY_BTN}>
                      <Plus className="h-4 w-4" /> Add location
                    </button>
                  }
                >
                  {workLocations.length === 0 ? (
                    <EmptyState icon={MapPinned} title="No workplaces configured" description="Add Cairo HQ, regional hubs, or remote options so new hires can pick where they work." actionLabel="Add first location" onAction={addLocation} />
                  ) : (
                    <div className="space-y-4">
                      {workLocations.map((loc, cityIndex) => {
                        const isOpen = expandedLocations[cityIndex] !== false;
                        const filledBranches = (loc.branches || []).filter((b) => (b.name || "").trim() || (b.code || "").trim()).length;
                        return (
                          <div key={cityIndex} className="overflow-hidden rounded-[20px] bg-white shadow-sm ring-1 ring-zinc-950/[0.06] transition hover:ring-zinc-950/[0.1]">
                            <button
                              type="button"
                              onClick={() => setExpandedLocations((p) => ({ ...p, [cityIndex]: !isOpen }))}
                              className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-zinc-50/80"
                            >
                              <div className="flex min-w-0 items-center gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 ring-1 ring-zinc-200/80">
                                  <MapPinned className="h-4 w-4 text-zinc-600" />
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate text-[15px] font-semibold tracking-tight text-zinc-900">
                                    {loc.governorate && loc.city ? `${loc.city}, ${loc.governorate}` : "New location"}
                                  </p>
                                  <p className="text-xs text-zinc-500">{filledBranches} branch{filledBranches !== 1 ? "es" : ""}</p>
                                </div>
                              </div>
                              <div className="flex shrink-0 items-center gap-1">
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); removeCity(cityIndex); }}
                                  className="rounded-full p-2 text-zinc-400 transition hover:bg-red-50 hover:text-red-600"
                                  aria-label="Remove location"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                                <ChevronDown className={`h-5 w-5 text-zinc-400 transition ${isOpen ? "-rotate-180" : ""}`} aria-hidden />
                              </div>
                            </button>

                            {isOpen && (
                              <div className="space-y-6 border-t border-zinc-100 bg-zinc-50/30 p-5 sm:p-6">
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                  <FieldGroup label="Governorate">
                                    <select className={SELECT_CLS} value={loc.governorate} onChange={(e) => updateLocation(cityIndex, "governorate", e.target.value)}>
                                      <option value="">Choose…</option>
                                      {EGYPT_GOVERNORATES.map((g) => <option key={g.name} value={g.name}>{g.name} ({g.nameAr})</option>)}
                                    </select>
                                  </FieldGroup>
                                  <FieldGroup label="City">
                                    <select className={SELECT_CLS} value={loc.city} onChange={(e) => updateLocation(cityIndex, "city", e.target.value)} disabled={!loc.governorate}>
                                      <option value="">Choose…</option>
                                      {loc.governorate && getCitiesForGovernorate(loc.governorate).map((c) => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                  </FieldGroup>
                                </div>

                                <div className="border-t border-zinc-100/80 pt-5">
                                  <div className="mb-4 flex items-center justify-between">
                                    <span className="text-[13px] font-semibold text-zinc-900">Branches</span>
                                    <button type="button" onClick={() => addBranch(cityIndex)} className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
                                      + Add branch
                                    </button>
                                  </div>
                                  {loc.branches.length === 0 ? (
                                    <p className="rounded-2xl bg-white py-8 text-center text-sm text-zinc-500 ring-1 ring-zinc-200/80">No branches — add one to define sites.</p>
                                  ) : (
                                    <div className="space-y-4">
                                      {loc.branches.map((branch, bi) => (
                                        <div key={bi} className="space-y-4 rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm sm:p-5">
                                          <div className="flex items-center justify-between gap-2">
                                            <span className="text-xs font-semibold text-zinc-600">Branch {bi + 1}</span>
                                            <button type="button" onClick={() => removeBranch(cityIndex, bi)} className="shrink-0 rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600" aria-label="Remove branch">
                                              <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                          </div>
                                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                            <FieldGroup label="Name"><input type="text" className={INPUT_CLS} placeholder="e.g. Gleem Office" value={branch.name ?? ""} onChange={(e) => updateBranchField(cityIndex, bi, "name", e.target.value)} /></FieldGroup>
                                            <FieldGroup label="Code"><input type="text" className={`${INPUT_CLS} uppercase`} placeholder="e.g. GLM-01" value={branch.code ?? ""} onChange={(e) => updateBranchField(cityIndex, bi, "code", e.target.value)} /></FieldGroup>
                                            <FieldGroup label="Insurance number"><input type="text" className={INPUT_CLS} placeholder="Optional" value={branch.insuranceNumber ?? ""} onChange={(e) => updateBranchField(cityIndex, bi, "insuranceNumber", e.target.value)} /></FieldGroup>
                                            <FieldGroup label="City"><input type="text" className={INPUT_CLS} placeholder={loc.city || "Defaults to area city"} value={branch.city ?? ""} onChange={(e) => updateBranchField(cityIndex, bi, "city", e.target.value)} /></FieldGroup>
                                            <FieldGroup label="Country"><input type="text" className={INPUT_CLS} value={branch.country ?? "Egypt"} onChange={(e) => updateBranchField(cityIndex, bi, "country", e.target.value)} /></FieldGroup>
                                            <FieldGroup label="Status">
                                              <select className={SELECT_CLS} value={branch.status ?? "ACTIVE"} onChange={(e) => updateBranchField(cityIndex, bi, "status", e.target.value)}>
                                                <option value="ACTIVE">Active</option>
                                                <option value="INACTIVE">Inactive</option>
                                                <option value="CLOSED">Closed</option>
                                              </select>
                                            </FieldGroup>
                                          </div>
                                          <FieldGroup label="Location address">
                                            <textarea rows={2} className={INPUT_CLS} placeholder={"e.g. 12 Main St\nFloor 3"} value={branch.locationText ?? ""} onChange={(e) => updateBranchField(cityIndex, bi, "locationText", e.target.value)} />
                                          </FieldGroup>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </SectionShell>
              )}

              {/* ===== LEAVE & EXCUSE POLICIES ===== */}
              {activeTab === "leave" && (
                <SectionShell
                  icon={Plane}
                  iconColor="text-zinc-700"
                  title="Leave & excuse policies"
                  description="Rules by version number — the highest version applies to new requests. Company timezone is used for time-off logic."
                  actions={
                    <div className="flex flex-wrap items-center gap-2">
                      {canManageBulkLeaveCredits && (
                        <Link to="/leave-operations" className={SECONDARY_BTN}>
                          <Gift className="h-4 w-4" /> Bulk credits & history
                        </Link>
                      )}
                      <button type="button" onClick={addLeavePolicy} className={SECONDARY_BTN}>
                        <Plus className="h-4 w-4" /> Add policy version
                      </button>
                    </div>
                  }
                >
                  <div className="flex gap-3 rounded-2xl bg-zinc-100/70 px-4 py-3.5 text-xs leading-relaxed text-zinc-600 ring-1 ring-zinc-200/80">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
                    <p>
                      Each version defines vacation and excuse rules independently. The <strong className="font-semibold text-zinc-800">highest version number</strong> is active for new requests. Older versions stay for audit.
                    </p>
                  </div>

                  {leavePolicies.length === 0 ? (
                    <EmptyState icon={Plane} title="No policy versions" description="Server defaults apply (annual 21 days, unlimited excuses). Add a version to customize." actionLabel="Create first policy" onAction={addLeavePolicy} />
                  ) : (
                    <div className="space-y-3">
                      {leavePolicies.map((p, idx) => {
                        const isOpen = expandedPolicies[p.version] !== false;
                        const isHighest = p.version === Math.max(...leavePolicies.map((x) => Number(x.version) || 0));
                        return (
                          <div
                            key={idx}
                            className={`overflow-hidden rounded-[20px] shadow-sm ring-1 transition ${
                              isHighest ? "bg-white ring-zinc-900/20" : "bg-white ring-zinc-950/[0.06]"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => setExpandedPolicies((prev) => ({ ...prev, [p.version]: !isOpen }))}
                              className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-zinc-50/80"
                            >
                              <div className="flex items-center gap-3">
                                <span className="text-[15px] font-semibold tracking-tight text-zinc-900">Version {p.version}</span>
                                {isHighest && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-zinc-900 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                                    <CheckCircle2 className="h-3 w-3" /> Active
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                <button type="button" onClick={(e) => { e.stopPropagation(); removeLeavePolicy(idx); }} className="rounded-full p-2 text-zinc-400 transition hover:bg-red-50 hover:text-red-600" aria-label="Remove policy">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                                <ChevronDown className={`h-5 w-5 text-zinc-400 transition ${isOpen ? "-rotate-180" : ""}`} aria-hidden />
                              </div>
                            </button>

                            {isOpen && (
                              <div className="space-y-6 border-t border-zinc-100 bg-zinc-50/30 p-5 sm:p-6">
                                <FieldGroup label="Version # (highest wins)" className="max-w-[10rem]">
                                  <input type="number" className={NUM_CLS} value={p.version} onChange={(e) => updateLeavePolicy(idx, { version: Number(e.target.value) })} />
                                </FieldGroup>

                                <div className="grid gap-5 sm:grid-cols-2">
                                  {/* Vacation */}
                                  <div className="space-y-4 rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm">
                                    <div className="flex items-center gap-2 border-b border-zinc-100 pb-3">
                                      <Plane className="h-4 w-4 text-zinc-500" />
                                      <p className="text-[13px] font-semibold tracking-tight text-zinc-900">Vacation rules</p>
                                    </div>
                                    <label className="flex items-center gap-2 text-xs text-zinc-700 cursor-pointer">
                                      <input type="checkbox" className="h-4 w-4 rounded border-zinc-300" checked={Boolean(p.vacationRules?.entitlementVariesByYear)} onChange={(e) => updateLeavePolicyNested(idx, "vacationRules", "entitlementVariesByYear", e.target.checked)} />
                                      Entitlement differs after first year
                                    </label>
                                    {p.vacationRules?.entitlementVariesByYear ? (
                                      <div className="grid gap-3 sm:grid-cols-2">
                                        <FieldGroup label="First year (days)">
                                          <input type="number" min={0} className={NUM_CLS} value={p.vacationRules?.firstYearDays ?? 15} onChange={(e) => updateLeavePolicyNested(idx, "vacationRules", "firstYearDays", Number(e.target.value))} />
                                        </FieldGroup>
                                        <FieldGroup label="After first year (days)">
                                          <input type="number" min={0} className={NUM_CLS} value={p.vacationRules?.afterFirstYearDays ?? 21} onChange={(e) => updateLeavePolicyNested(idx, "vacationRules", "afterFirstYearDays", Number(e.target.value))} />
                                        </FieldGroup>
                                      </div>
                                    ) : (
                                      <FieldGroup label="Annual days (everyone)">
                                        <input type="number" className={`${NUM_CLS} max-w-[8rem]`} value={p.vacationRules?.annualDays ?? 21} onChange={(e) => updateLeavePolicyNested(idx, "vacationRules", "annualDays", Number(e.target.value))} />
                                      </FieldGroup>
                                    )}
                                    <FieldGroup label="Max consecutive days">
                                      <input type="number" className={`${NUM_CLS} max-w-[8rem]`} value={p.vacationRules?.maxConsecutiveDays ?? 365} onChange={(e) => updateLeavePolicyNested(idx, "vacationRules", "maxConsecutiveDays", Number(e.target.value))} />
                                    </FieldGroup>
                                    <FieldGroup label="Min. days after hire" hint="0 = eligible from hire day. Uses each employee's date of hire.">
                                      <input type="number" min={0} className={`${NUM_CLS} max-w-[8rem]`} value={p.vacationRules?.minDaysAfterHire ?? 0} onChange={(e) => updateLeavePolicyNested(idx, "vacationRules", "minDaysAfterHire", Number(e.target.value))} />
                                    </FieldGroup>
                                  </div>

                                  {/* Excuse */}
                                  <div className="space-y-4 rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm">
                                    <div className="flex items-center gap-2 border-b border-zinc-100 pb-3">
                                      <Clock className="h-4 w-4 text-zinc-500" />
                                      <p className="text-[13px] font-semibold tracking-tight text-zinc-900">Excuse rules</p>
                                    </div>
                                    <FieldGroup label="Max hours per excuse">
                                      <input type="number" min={0.25} step={0.25} className={`${NUM_CLS} max-w-[8rem]`} value={p.excuseRules?.maxHoursPerExcuse ?? 8} onChange={(e) => updateLeavePolicyNested(idx, "excuseRules", "maxHoursPerExcuse", Number(e.target.value))} />
                                    </FieldGroup>
                                    <FieldGroup label="Max excuses per period" hint="0 = unlimited. Counts pending + approved in the same period (UTC).">
                                      <input type="number" min={0} className={`${NUM_CLS} max-w-[8rem]`} value={p.excuseRules?.maxExcusesPerPeriod ?? 0} onChange={(e) => updateLeavePolicyNested(idx, "excuseRules", "maxExcusesPerPeriod", Number(e.target.value))} />
                                    </FieldGroup>
                                    <FieldGroup label="Period for limit">
                                      <select className={`${SELECT_CLS} max-w-[12rem]`} value={p.excuseRules?.excuseLimitPeriod ?? "MONTH"} onChange={(e) => updateLeavePolicyNested(idx, "excuseRules", "excuseLimitPeriod", e.target.value)}>
                                        <option value="WEEK">Week (Mon–Sun, UTC)</option>
                                        <option value="MONTH">Month</option>
                                        <option value="YEAR">Year</option>
                                      </select>
                                    </FieldGroup>
                                    <FieldGroup label="Rounding (minutes)">
                                      <input type="number" className={`${NUM_CLS} max-w-[8rem]`} value={p.excuseRules?.roundingMinutes ?? 15} onChange={(e) => updateLeavePolicyNested(idx, "excuseRules", "roundingMinutes", Number(e.target.value))} />
                                    </FieldGroup>
                                    <FieldGroup label="Min. days after hire" hint="Can differ from vacation. 0 = from hire day.">
                                      <input type="number" min={0} className={`${NUM_CLS} max-w-[8rem]`} value={p.excuseRules?.minDaysAfterHire ?? 0} onChange={(e) => updateLeavePolicyNested(idx, "excuseRules", "minDaysAfterHire", Number(e.target.value))} />
                                    </FieldGroup>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </SectionShell>
              )}

              {/* ===== ATTENDANCE ===== */}
              {activeTab === "attendance" && (
                <SectionShell
                  icon={Clock}
                  iconColor="text-zinc-700"
                  title="Attendance & deduction rules"
                  description="Global work hours (start/end support seconds), grace period, and penalty tiers for lateness, absence, and early departure. Deductions are expressed as days deducted from monthly pay."
                >
                  <div className="space-y-10">
                    {/* —— Schedule & grace —— */}
                    <section className="space-y-3">
                      <header className="px-0.5">
                        <h3 className="text-[15px] font-semibold tracking-tight text-zinc-900">Schedule & grace</h3>
                        <p className="mt-1 max-w-prose text-sm leading-snug text-zinc-500">
                          Company default check-in and check-out. Supports seconds. Grace minutes extend how late someone can arrive before status becomes late, unless the monthly grace budget has run out.
                        </p>
                      </header>

                      <div className="overflow-hidden rounded-[20px] bg-white shadow-sm ring-1 ring-zinc-950/[0.06]">
                        <div className="grid divide-y divide-zinc-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                          <div className="p-4 sm:p-5">
                            <label className="block text-xs font-medium text-zinc-500">Start</label>
                            <input
                              type="time"
                              step={1}
                              className="mt-2 w-full min-w-0 rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-2.5 text-[15px] font-medium text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-200/80"
                              value={attendanceRules.standardStartTime}
                              onChange={(e) => updateAttendanceField("standardStartTime", e.target.value)}
                            />
                          </div>
                          <div className="p-4 sm:p-5">
                            <label className="block text-xs font-medium text-zinc-500">End</label>
                            <input
                              type="time"
                              step={1}
                              className="mt-2 w-full min-w-0 rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-2.5 text-[15px] font-medium text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-200/80"
                              value={attendanceRules.standardEndTime}
                              onChange={(e) => updateAttendanceField("standardEndTime", e.target.value)}
                            />
                          </div>
                          <div className="p-4 sm:p-5">
                            <label className="block text-xs font-medium text-zinc-500">Grace period</label>
                            <div className="mt-2 flex items-center gap-2">
                              <input
                                type="number"
                                min={0}
                                className="w-full min-w-0 rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-2.5 text-[15px] font-medium tabular-nums text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-200/80"
                                value={attendanceRules.gracePeriodMinutes}
                                onChange={(e) => updateAttendanceField("gracePeriodMinutes", Number(e.target.value))}
                              />
                              <span className="shrink-0 text-sm text-zinc-400">min</span>
                            </div>
                          </div>
                        </div>

                        <div className="border-t border-zinc-100 bg-zinc-50/40 px-4 py-4 sm:px-5">
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <label className="flex cursor-pointer items-start gap-3 sm:items-center">
                              <input
                                type="checkbox"
                                className="mt-0.5 h-[18px] w-[18px] shrink-0 rounded-md border-zinc-300 text-zinc-900 focus:ring-zinc-400/30 sm:mt-0"
                                checked={Boolean(attendanceRules.monthlyGraceUsesEnabled)}
                                onChange={(e) => updateAttendanceField("monthlyGraceUsesEnabled", e.target.checked)}
                              />
                              <span>
                                <span className="block text-[15px] font-medium text-zinc-900">Monthly grace budget</span>
                                <span className="mt-0.5 block text-xs leading-snug text-zinc-500">
                                  Limit how many times per fiscal month an arrival can sit in the grace window without counting as late. Excused late days do not use a slot.
                                </span>
                              </span>
                            </label>
                            <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-zinc-500">Max / month</span>
                                <input
                                  type="number"
                                  min={0}
                                  max={31}
                                  disabled={!attendanceRules.monthlyGraceUsesEnabled}
                                  className="w-14 rounded-xl border border-zinc-200 bg-white px-2.5 py-2 text-center text-sm font-semibold tabular-nums text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200/80 disabled:cursor-not-allowed disabled:opacity-45"
                                  value={attendanceRules.monthlyGraceUsesAllowed ?? 0}
                                  onChange={(e) =>
                                    updateAttendanceField(
                                      "monthlyGraceUsesAllowed",
                                      Math.min(31, Math.max(0, Number(e.target.value) || 0)),
                                    )
                                  }
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => setAttendanceRules((p) => ({ ...p, monthlyGraceUsesEnabled: false }))}
                                className="text-sm font-medium text-zinc-500 transition hover:text-zinc-800"
                              >
                                Turn off
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="border-t border-zinc-100 px-4 py-4 sm:px-5">
                          <label className="block text-xs font-medium text-zinc-500">Working days per month</label>
                          <p className="mt-1 max-w-prose text-xs leading-relaxed text-zinc-400">
                            One number for salary math: attendance deductions, payroll daily rate, and assessments. Synced with payroll policy.
                          </p>
                          <input
                            type="number"
                            min={1}
                            max={31}
                            className="mt-3 w-24 rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-2.5 text-[15px] font-semibold tabular-nums text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-200/80"
                            value={attendanceRules.workingDaysPerMonth}
                            onChange={(e) => updateAttendanceField("workingDaysPerMonth", Number(e.target.value))}
                          />
                        </div>
                      </div>

                      <ExpandableRulesHint
                        accent="sky"
                        title="How monthly grace behaves"
                        subtitle="مثال رقمي + معاينة خصم من شرائحك — اضغط للتفاصيل"
                        subtitleDir="rtl"
                      >
                        <div className="space-y-4">
                          <p className="text-xs leading-relaxed text-zinc-600">
                            Workdays in the fiscal month (excluding weekly rest and holidays) count toward the budget when check-in is after shift start but still within the grace window. After the limit, late is measured from shift start and the former grace window can incur the first tier.
                          </p>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="rounded-2xl bg-white p-4 ring-1 ring-zinc-200/80">
                              <p className="text-xs font-semibold text-zinc-900">Budget off</p>
                              <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-zinc-600">
                                <li>Example: Mon / Wed / Fri, check-in <strong className="text-zinc-800">09:07</strong>, shift <strong>09:00</strong>, grace <strong>10 min</strong>.</li>
                                <li>All three → <strong className="text-emerald-600">PRESENT</strong>; no tier deduction.</li>
                              </ul>
                            </div>
                            <div className="rounded-2xl bg-white p-4 ring-1 ring-zinc-200/80">
                              <p className="text-xs font-semibold text-zinc-900">Budget on (max 2 / month)</p>
                              <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-zinc-600">
                                <li>
                                  <strong className="text-zinc-800">Mon</strong> & <strong className="text-zinc-800">Wed</strong> →{" "}
                                  <strong className="text-emerald-600">PRESENT</strong> (uses 1 &amp; 2).
                                </li>
                                <li>
                                  <strong className="text-zinc-800">Fri</strong> → quota used →{" "}
                                  <strong className="text-red-600/90">LATE</strong> from shift start (~7 min); tiers apply.
                                </li>
                              </ul>
                            </div>
                          </div>
                          <MonthlyGraceDeductionPreview rules={attendanceRules} />
                          <p className="text-xs leading-relaxed text-zinc-600" dir="rtl">
                            ملخص: مع إيقاف الرصيد كل الأيام في المثال <strong>حاضر</strong>. مع حدّ <strong>مرتين</strong> اليوم الثالث يصبح <strong>متأخراً</strong> ويُخصم حسب الجدول.
                          </p>
                        </div>
                      </ExpandableRulesHint>
                    </section>

                    {/* —— Calendar —— */}
                    <section className="space-y-3">
                      <header className="px-0.5">
                        <h3 className="text-[15px] font-semibold tracking-tight text-zinc-900">Weekly rest</h3>
                        <p className="mt-1 max-w-prose text-sm leading-snug text-zinc-500">
                          Stored as UTC weekday (0 Sunday … 6 Saturday), same as attendance dates. Egypt: often Friday + Saturday. Clear all to count every calendar day in reports.
                        </p>
                      </header>
                      <div className="flex flex-wrap gap-2 rounded-[20px] bg-white p-4 shadow-sm ring-1 ring-zinc-950/[0.06] sm:p-5">
                        {[
                          { dow: 0, label: "Sun" },
                          { dow: 1, label: "Mon" },
                          { dow: 2, label: "Tue" },
                          { dow: 3, label: "Wed" },
                          { dow: 4, label: "Thu" },
                          { dow: 5, label: "Fri" },
                          { dow: 6, label: "Sat" },
                        ].map(({ dow, label }) => {
                          const selected = (attendanceRules.weeklyRestDays || []).includes(dow);
                          return (
                            <button
                              key={dow}
                              type="button"
                              onClick={() => toggleWeeklyRestDay(dow)}
                              className={`min-h-[44px] min-w-[44px] rounded-full px-4 text-sm font-medium transition ${
                                selected
                                  ? "bg-zinc-900 text-white shadow-sm"
                                  : "bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200/80 hover:bg-zinc-200/80"
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                      <p className="px-0.5 text-xs text-zinc-400" dir="rtl">
                        الأيام بالعربي في التلميح أعلاه؛ الأزرار مختصرة لتقليل الزحمة.
                      </p>
                    </section>

                    {/* —— Late tiers —— */}
                    <section className="space-y-4">
                      <header className="px-0.5">
                        <h3 className="text-[15px] font-semibold tracking-tight text-zinc-900">Late arrival tiers</h3>
                        <p className="mt-1 max-w-prose text-sm leading-snug text-zinc-500">
                          Minutes after shift start; deduction is expressed in days of monthly pay. Tiers must be contiguous when saved.
                        </p>
                      </header>

                      <ExpandableRulesHint
                        accent="emerald"
                        title="Reference: tiers vs clock (example shift 09:00)"
                        subtitle="لماذا يتكرر 10:00 بين صفّين — اضغط للشرح والجدول"
                        subtitleDir="rtl"
                      >
                        <div className="space-y-4">
                          <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-zinc-200/80">
                            <table className="min-w-full text-left font-mono text-[11px] sm:text-xs">
                              <thead>
                                <tr className="border-b border-zinc-100 bg-zinc-50/90">
                                  <th className="px-3 py-2.5 font-sans text-xs font-medium text-zinc-500">From</th>
                                  <th className="px-3 py-2.5 font-sans text-xs font-medium text-zinc-500">To</th>
                                  <th className="px-3 py-2.5 font-sans text-xs font-medium text-zinc-500">Deduction</th>
                                  <th className="px-3 py-2.5 font-sans text-xs font-medium text-zinc-500">Clock</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-zinc-100 text-zinc-700">
                                <tr>
                                  <td className="px-3 py-2.5">01:00</td>
                                  <td className="px-3 py-2.5">10:00</td>
                                  <td className="px-3 py-2.5 font-sans">0.25 d</td>
                                  <td className="px-3 py-2.5 text-emerald-800/90">
                                    <strong>09:01:01</strong> → <strong>09:10:00</strong>
                                  </td>
                                </tr>
                                <tr className="bg-zinc-50/50">
                                  <td className="px-3 py-2.5">10:00</td>
                                  <td className="px-3 py-2.5">30:00</td>
                                  <td className="px-3 py-2.5 font-sans">0.5 d</td>
                                  <td className="px-3 py-2.5 text-emerald-800/90">
                                    <strong>09:10:01</strong> → <strong>09:30:00</strong>
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                          <div className="rounded-2xl bg-zinc-100/60 px-4 py-3 text-xs leading-relaxed text-zinc-600">
                            <strong className="text-zinc-800">Same 10:00 on two rows?</strong> Yes — tier 1 ends at second 600; tier 2 starts at second 601 (<code className="rounded bg-white/90 px-1 ring-1 ring-zinc-200/80">floor(from×60)+1</code>), so you do not need to type 10:01.
                          </div>
                          <p className="text-xs leading-relaxed text-zinc-600" dir="rtl">
                            الشريحة الثانية قد تبدأ بنفس «10:00» كقيمة من؛ السيرفر يحسب أول ثانية للشريحة الثانية تلقائياً.
                          </p>
                        </div>
                      </ExpandableRulesHint>

                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={addDeductionTier}
                          className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800"
                        >
                          <Plus className="h-4 w-4" />
                          Add tier
                        </button>
                      </div>

                      {attendanceRules.lateDeductionTiers.length === 0 ? (
                        <div className="rounded-[20px] border border-dashed border-zinc-200 bg-zinc-50/30 px-4 py-10 text-center">
                          <p className="text-sm font-medium text-zinc-600">No late tiers</p>
                          <p className="mx-auto mt-1 max-w-sm text-xs text-zinc-400">Late arrivals will not reduce pay until you add at least one tier.</p>
                        </div>
                      ) : (
                        <div className="overflow-hidden rounded-[20px] bg-white shadow-sm ring-1 ring-zinc-950/[0.06]">
                          <table className="min-w-full divide-y divide-zinc-100 text-sm">
                            <thead>
                              <tr className="bg-zinc-50/80 text-left text-xs font-medium text-zinc-500">
                                <th className="whitespace-nowrap px-4 py-3">From (mm:ss)</th>
                                <th className="whitespace-nowrap px-4 py-3">To (mm:ss)</th>
                                <th className="whitespace-nowrap px-4 py-3">Days deducted</th>
                                <th className="w-12 px-2 py-3" />
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100">
                              {attendanceRules.lateDeductionTiers.map((tier, idx) => (
                                <tr key={idx} className="transition hover:bg-zinc-50/60">
                                  <td className="px-4 py-3 align-middle">
                                    <LateTierMmSsInput
                                      valueMinutes={tier.fromMinutes}
                                      onCommit={(v) => updateDeductionTier(idx, "fromMinutes", v)}
                                      className={`${NUM_CLS} w-full max-w-[8.5rem] font-mono text-sm`}
                                    />
                                  </td>
                                  <td className="px-4 py-3 align-middle">
                                    <LateTierMmSsInput
                                      valueMinutes={tier.toMinutes}
                                      onCommit={(v) => updateDeductionTier(idx, "toMinutes", v)}
                                      className={`${NUM_CLS} w-full max-w-[8.5rem] font-mono text-sm`}
                                    />
                                  </td>
                                  <td className="px-4 py-3 align-middle">
                                    <input
                                      type="number"
                                      min={0}
                                      step={0.25}
                                      className={`${NUM_CLS} w-full max-w-[6.5rem] font-semibold`}
                                      value={tier.deductionDays}
                                      onChange={(e) => updateDeductionTier(idx, "deductionDays", Number(e.target.value))}
                                    />
                                  </td>
                                  <td className="px-2 py-3 align-middle text-right">
                                    <button
                                      type="button"
                                      onClick={() => removeDeductionTier(idx)}
                                      className="rounded-full p-2 text-zinc-400 transition hover:bg-red-50 hover:text-red-600"
                                      aria-label="Remove tier"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </section>
                  </div>

                  <section className="space-y-4">
                    <header className="px-0.5">
                      <h3 className="text-[15px] font-semibold tracking-tight text-zinc-900">Other attendance deductions</h3>
                      <p className="mt-1 max-w-prose text-sm leading-relaxed text-zinc-500">
                        Fixed day amounts per event type (separate from late tiers above).
                      </p>
                    </header>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <DeductionCard
                      label="Absence"
                      description="Per full-day absence without approved leave"
                      value={attendanceRules.absenceDeductionDays}
                      onChange={(v) => updateAttendanceField("absenceDeductionDays", v)}
                      color="red"
                    />
                    <DeductionCard
                      label="Early departure"
                      description="Per event when checkout is before shift end"
                      value={attendanceRules.earlyDepartureDeductionDays}
                      onChange={(v) => updateAttendanceField("earlyDepartureDeductionDays", v)}
                      color="amber"
                    />
                    <DeductionCard
                      label="Incomplete record"
                      description="Check-in only, no checkout recorded"
                      value={attendanceRules.incompleteRecordDeductionDays}
                      onChange={(v) => updateAttendanceField("incompleteRecordDeductionDays", v)}
                      color="zinc"
                    />
                    <DeductionCard
                      label="Unpaid leave"
                      description="Per day of approved unpaid leave taken"
                      value={attendanceRules.unpaidLeaveDeductionDays}
                      onChange={(v) => updateAttendanceField("unpaidLeaveDeductionDays", v)}
                      color="orange"
                    />
                    </div>
                  </section>
                </SectionShell>
              )}

              {/* ===== SALARY RULES ===== */}
              {activeTab === "salary" && (<>
                <SectionShell
                  icon={Percent}
                  iconColor="text-zinc-700"
                  title="Annual salary increases"
                  description="Default and overrides for processing increases. Department and employee rules take precedence over the global default."
                  actions={
                    <button type="button" onClick={addSalaryRule} className={SECONDARY_BTN}>
                      <Plus className="h-4 w-4" /> Add rule
                    </button>
                  }
                >
                  {salaryIncreaseRules.length === 0 ? (
                    <EmptyState icon={Percent} title="No salary rules" description="Start with one 'Global default' percentage, then add department overrides." actionLabel="Add a rule" onAction={addSalaryRule} />
                  ) : (
                    <div className="overflow-hidden rounded-[20px] bg-white shadow-sm ring-1 ring-zinc-950/[0.06]">
                      <table className="min-w-full divide-y divide-zinc-100 text-sm">
                        <thead>
                          <tr className="bg-zinc-50/80 text-left text-xs font-medium text-zinc-500">
                            <th className="whitespace-nowrap px-4 py-3">Type</th>
                            <th className="whitespace-nowrap px-4 py-3">Applies to</th>
                            <th className="whitespace-nowrap px-4 py-3 text-right">Rate</th>
                            <th className="w-10 px-2 py-3" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                          {salaryIncreaseRules.map((rule, idx) => (
                            <tr key={idx} className="align-top transition hover:bg-zinc-50/60">
                              <td className="px-4 py-3">
                                <div className="flex flex-wrap items-center gap-2">
                                  {ruleBadge(rule.type)}
                                  <select className={`${SELECT_CLS} min-w-[10rem] text-xs font-medium`} value={rule.type} onChange={(e) => updateSalaryRule(idx, "type", e.target.value)} aria-label="Rule type">
                                    <option value="DEFAULT">Global default</option>
                                    <option value="DEPARTMENT">Department</option>
                                    <option value="EMPLOYEE">Employee</option>
                                  </select>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                {rule.type === "DEFAULT" ? (
                                  <span className="inline-flex items-center gap-1.5 text-zinc-600"><Building2 className="h-3.5 w-3.5 shrink-0 text-zinc-400" aria-hidden /> All departments (fallback)</span>
                                ) : rule.type === "DEPARTMENT" ? (
                                  <div className="flex items-start gap-2">
                                    <Building2 className="mt-1 h-3.5 w-3.5 shrink-0 text-zinc-400" aria-hidden />
                                    <input type="text" className={`${INPUT_CLS} min-w-[8rem]`} placeholder="e.g. Sales, Engineering" value={rule.target} onChange={(e) => updateSalaryRule(idx, "target", e.target.value)} />
                                  </div>
                                ) : (
                                  <div className="flex items-start gap-2">
                                    <User className="mt-1 h-3.5 w-3.5 shrink-0 text-zinc-400" aria-hidden />
                                    <input type="text" className={`${INPUT_CLS} min-w-[8rem]`} placeholder="Employee code or ID" value={rule.target} onChange={(e) => updateSalaryRule(idx, "target", e.target.value)} />
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="inline-flex items-center justify-end gap-1">
                                  <input type="number" className={`${NUM_CLS} w-20 text-right font-semibold`} value={rule.percentage} onChange={(e) => updateSalaryRule(idx, "percentage", Number(e.target.value))} min={0} aria-label="Percentage" />
                                  <span className="text-xs font-medium text-zinc-400">%</span>
                                </div>
                              </td>
                              <td className="px-2 py-3 text-right">
                                <button type="button" onClick={() => removeSalaryRule(idx)} className="rounded-full p-2 text-zinc-400 transition hover:bg-red-50 hover:text-red-600" aria-label="Remove rule"><Trash2 className="h-4 w-4" /></button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <p className="border-t border-zinc-100 bg-zinc-50/50 px-4 py-3 text-xs leading-relaxed text-zinc-500">
                        Rows without a target (non-default) are excluded when you save.
                      </p>
                    </div>
                  )}
                </SectionShell>

                <div className="mt-10">
                  <SectionShell
                    icon={Gift}
                    iconColor="text-zinc-700"
                    title="Assessment payroll rules"
                    description="Configure how assessment bonuses and overtime translate to monetary amounts in the monthly payroll report. Bonus days and overtime are multiplied by the employee's daily gross rate."
                  >
                    <div className="space-y-4">
                      <div className="overflow-hidden divide-y divide-zinc-100 rounded-[20px] bg-white shadow-sm ring-1 ring-zinc-950/[0.06]">
                        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <label className="flex cursor-pointer items-center gap-3">
                              <input
                                type="checkbox"
                                className="h-[18px] w-[18px] rounded-md border-zinc-300 text-zinc-900 focus:ring-zinc-400/30"
                                checked={assessmentPayrollRules.bonusDaysEnabled}
                                onChange={(e) => setAssessmentPayrollRules((p) => ({ ...p, bonusDaysEnabled: e.target.checked }))}
                              />
                              <span className="text-[15px] font-semibold tracking-tight text-zinc-900">Bonus days</span>
                            </label>
                            <p className="mt-1 pl-9 text-xs leading-relaxed text-zinc-500">Days in assessment × multiplier × daily gross rate</p>
                          </div>
                          {assessmentPayrollRules.bonusDaysEnabled && (
                            <div className="flex flex-wrap items-center gap-2 pl-9 sm:pl-0">
                              <span className="text-xs font-medium text-zinc-500">Multiplier</span>
                              <input
                                type="number"
                                min={0}
                                step={0.1}
                                className={`${NUM_CLS} w-20 text-right font-semibold`}
                                value={assessmentPayrollRules.bonusDayMultiplier}
                                onChange={(e) => setAssessmentPayrollRules((p) => ({ ...p, bonusDayMultiplier: Number(e.target.value) }))}
                              />
                              <span className="text-xs text-zinc-400">× daily rate</span>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <label className="flex cursor-pointer items-center gap-3">
                              <input
                                type="checkbox"
                                className="h-[18px] w-[18px] rounded-md border-zinc-300 text-zinc-900 focus:ring-zinc-400/30"
                                checked={assessmentPayrollRules.overtimeEnabled}
                                onChange={(e) => setAssessmentPayrollRules((p) => ({ ...p, overtimeEnabled: e.target.checked }))}
                              />
                              <span className="text-[15px] font-semibold tracking-tight text-zinc-900">Overtime hours</span>
                            </label>
                            <p className="mt-1 pl-9 text-xs leading-relaxed text-zinc-500">Hours in assessment × multiplier × daily gross rate</p>
                          </div>
                          {assessmentPayrollRules.overtimeEnabled && (
                            <div className="flex flex-wrap items-center gap-2 pl-9 sm:pl-0">
                              <span className="text-xs font-medium text-zinc-500">Multiplier</span>
                              <input
                                type="number"
                                min={0}
                                step={0.1}
                                className={`${NUM_CLS} w-20 text-right font-semibold`}
                                value={assessmentPayrollRules.overtimeDayMultiplier}
                                onChange={(e) => setAssessmentPayrollRules((p) => ({ ...p, overtimeDayMultiplier: Number(e.target.value) }))}
                              />
                              <span className="text-xs text-zinc-400">× daily rate</span>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <label className="flex cursor-pointer items-center gap-3">
                              <input
                                type="checkbox"
                                className="h-[18px] w-[18px] rounded-md border-zinc-300 text-zinc-900 focus:ring-zinc-400/30"
                                checked={assessmentPayrollRules.deductionEnabled}
                                onChange={(e) => setAssessmentPayrollRules((p) => ({ ...p, deductionEnabled: e.target.checked }))}
                              />
                              <span className="text-[15px] font-semibold tracking-tight text-zinc-900">Deduction (EGP)</span>
                            </label>
                            <p className="mt-1 pl-9 text-xs leading-relaxed text-zinc-500">Fixed EGP in assessment × multiplier (no daily rate)</p>
                          </div>
                          {assessmentPayrollRules.deductionEnabled && (
                            <div className="flex flex-wrap items-center gap-2 pl-9 sm:pl-0">
                              <span className="text-xs font-medium text-zinc-500">Multiplier</span>
                              <input
                                type="number"
                                min={0}
                                step={0.1}
                                className={`${NUM_CLS} w-20 text-right font-semibold`}
                                value={assessmentPayrollRules.deductionDayMultiplier}
                                onChange={(e) => setAssessmentPayrollRules((p) => ({ ...p, deductionDayMultiplier: Number(e.target.value) }))}
                              />
                              <span className="text-xs text-zinc-400">× EGP amount</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="rounded-2xl bg-zinc-100/60 px-4 py-3 text-xs leading-relaxed text-zinc-600">
                        <strong className="text-zinc-800">Formulas:</strong>{" "}
                        Bonus = days × multiplier × daily gross rate. Overtime = hours × multiplier × daily gross rate. Deduction = EGP × multiplier. Net = bonus + overtime − deduction. Only HR-approved assessments count.
                      </div>
                    </div>
                  </SectionShell>
                </div>
              </>)}

              {/* ===== PAYROLL CONFIG ===== */}
              {activeTab === "payroll" && (
                <SectionShell
                  icon={Gift}
                  iconColor="text-zinc-700"
                  title="Payroll computation settings"
                  description="Egyptian labor law defaults (2026). Tax brackets, social insurance rates, overtime multiplier, and personal exemption. These values drive the payroll engine."
                >
                  <div className="space-y-8">
                    <div className="overflow-hidden rounded-[20px] bg-white p-5 shadow-sm ring-1 ring-zinc-950/[0.06] sm:p-6">
                    <FieldGroup
                      label="Amount decimal places (payroll rounding)"
                      hint="HR sets how all EGP amounts are rounded in payroll (0 = whole pounds, 2 = fils to two decimals). Applies to compute, lines, and totals."
                    >
                      <input
                        type="number"
                        min={0}
                        max={8}
                        className={`${NUM_CLS} max-w-[10rem]`}
                        value={payrollConfig.decimalPlaces ?? 2}
                        onChange={(e) =>
                          setPayrollConfig((p) => ({ ...p, decimalPlaces: Number(e.target.value) }))
                        }
                      />
                    </FieldGroup>
                    <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                      <FieldGroup
                        label="Working days / month"
                        hint="Same value as Attendance → Shift schedule (Days/mo). Edit it there; both payroll and monthly attendance analysis use this divisor."
                      >
                        <input
                          type="number"
                          min={1}
                          max={31}
                          readOnly
                          className={`${NUM_CLS} cursor-not-allowed bg-zinc-50 text-zinc-700`}
                          value={attendanceRules.workingDaysPerMonth}
                          aria-readonly
                        />
                      </FieldGroup>
                      <FieldGroup label="Hours / day">
                        <input type="number" min={1} max={24} className={NUM_CLS} value={payrollConfig.hoursPerDay} onChange={(e) => setPayrollConfig((p) => ({ ...p, hoursPerDay: Number(e.target.value) }))} />
                      </FieldGroup>
                      <FieldGroup label="OT multiplier">
                        <input type="number" min={0} step={0.1} className={NUM_CLS} value={payrollConfig.overtimeMultiplier} onChange={(e) => setPayrollConfig((p) => ({ ...p, overtimeMultiplier: Number(e.target.value) }))} />
                      </FieldGroup>
                      <FieldGroup label="Personal exemption (annual EGP)">
                        <input type="number" min={0} className={NUM_CLS} value={payrollConfig.personalExemptionAnnual} onChange={(e) => setPayrollConfig((p) => ({ ...p, personalExemptionAnnual: Number(e.target.value) }))} />
                      </FieldGroup>
                    </div>
                    </div>

                    <div className="overflow-hidden rounded-[20px] bg-white p-5 shadow-sm ring-1 ring-zinc-950/[0.06] sm:p-6">
                      <p className="mb-4 text-[13px] font-semibold tracking-tight text-zinc-900">Social insurance</p>
                      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                        <FieldGroup label="Employee share">
                          <div className="flex items-center gap-1">
                            <input type="number" min={0} step={0.001} className={`${NUM_CLS} w-20`} value={payrollConfig.insuranceRates?.employeeShare} onChange={(e) => setPayrollConfig((p) => ({ ...p, insuranceRates: { ...p.insuranceRates, employeeShare: Number(e.target.value) } }))} />
                            <span className="text-xs text-zinc-400">(0.11 = 11%)</span>
                          </div>
                        </FieldGroup>
                        <FieldGroup label="Company share">
                          <div className="flex items-center gap-1">
                            <input type="number" min={0} step={0.001} className={`${NUM_CLS} w-20`} value={payrollConfig.insuranceRates?.companyShare} onChange={(e) => setPayrollConfig((p) => ({ ...p, insuranceRates: { ...p.insuranceRates, companyShare: Number(e.target.value) } }))} />
                            <span className="text-xs text-zinc-400">(0.1875 = 18.75%)</span>
                          </div>
                        </FieldGroup>
                        <FieldGroup label="Max insurable wage (EGP)">
                          <input type="number" min={0} className={NUM_CLS} value={payrollConfig.insuranceRates?.maxInsurableWage} onChange={(e) => setPayrollConfig((p) => ({ ...p, insuranceRates: { ...p.insuranceRates, maxInsurableWage: Number(e.target.value) } }))} />
                        </FieldGroup>
                        <FieldGroup label="Min insurable wage (EGP)">
                          <input type="number" min={0} className={NUM_CLS} value={payrollConfig.insuranceRates?.minInsurableWage} onChange={(e) => setPayrollConfig((p) => ({ ...p, insuranceRates: { ...p.insuranceRates, minInsurableWage: Number(e.target.value) } }))} />
                        </FieldGroup>
                      </div>
                      <FieldGroup label="Martyrs fund rate">
                        <div className="flex items-center gap-1">
                          <input type="number" min={0} step={0.0001} className={`${NUM_CLS} w-24`} value={payrollConfig.martyrsFundRate} onChange={(e) => setPayrollConfig((p) => ({ ...p, martyrsFundRate: Number(e.target.value) }))} />
                          <span className="text-xs text-zinc-400">(0.0005 = 0.05%)</span>
                        </div>
                      </FieldGroup>
                    </div>

                    <div className="overflow-hidden rounded-[20px] bg-white p-5 shadow-sm ring-1 ring-zinc-950/[0.06] sm:p-6">
                      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-[13px] font-semibold tracking-tight text-zinc-900">Tax brackets (annual EGP)</p>
                        <button
                          type="button"
                          onClick={() => {
                            const brackets = [...payrollConfig.taxBrackets];
                            const lastTo = brackets.length > 0 ? (brackets[brackets.length - 1].to || brackets[brackets.length - 1].from + 100000) : 0;
                            brackets.push({ from: lastTo, to: null, rate: 0 });
                            setPayrollConfig((p) => ({ ...p, taxBrackets: brackets }));
                          }}
                          className={`${SECONDARY_BTN} py-2 text-xs`}
                        >
                          <Plus className="h-3.5 w-3.5" /> Add bracket
                        </button>
                      </div>
                      <div className="overflow-hidden rounded-xl ring-1 ring-zinc-100">
                        <table className="min-w-full divide-y divide-zinc-100 text-xs">
                          <thead>
                            <tr className="bg-zinc-50/80 text-left text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                              <th className="px-3 py-2">From (EGP)</th>
                              <th className="px-3 py-2">To (EGP)</th>
                              <th className="px-3 py-2">Rate</th>
                              <th className="w-10 px-2 py-2" />
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-50 bg-white">
                            {(payrollConfig.taxBrackets || []).map((b, idx) => (
                              <tr key={idx}>
                                <td className="px-3 py-2">
                                  <input type="number" min={0} className={`${NUM_CLS} w-28`} value={b.from} onChange={(e) => {
                                    const next = [...payrollConfig.taxBrackets];
                                    next[idx] = { ...next[idx], from: Number(e.target.value) };
                                    setPayrollConfig((p) => ({ ...p, taxBrackets: next }));
                                  }} />
                                </td>
                                <td className="px-3 py-2">
                                  <input type="number" min={0} className={`${NUM_CLS} w-28`} value={b.to ?? ""} placeholder="Unlimited" onChange={(e) => {
                                    const next = [...payrollConfig.taxBrackets];
                                    const val = e.target.value === "" ? null : Number(e.target.value);
                                    next[idx] = { ...next[idx], to: val };
                                    setPayrollConfig((p) => ({ ...p, taxBrackets: next }));
                                  }} />
                                </td>
                                <td className="px-3 py-2">
                                  <div className="flex items-center gap-1">
                                    <input type="number" min={0} max={1} step={0.005} className={`${NUM_CLS} w-20`} value={b.rate} onChange={(e) => {
                                      const next = [...payrollConfig.taxBrackets];
                                      next[idx] = { ...next[idx], rate: Number(e.target.value) };
                                      setPayrollConfig((p) => ({ ...p, taxBrackets: next }));
                                    }} />
                                    <span className="text-zinc-400">{(b.rate * 100).toFixed(1)}%</span>
                                  </div>
                                </td>
                                <td className="px-2 py-2">
                                  <button type="button" onClick={() => {
                                    setPayrollConfig((p) => ({ ...p, taxBrackets: p.taxBrackets.filter((_, i) => i !== idx) }));
                                  }} className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600">
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <p className="text-[11px] text-zinc-400">Brackets are applied after subtracting the personal exemption. Empty "To" means unlimited (top bracket).</p>
                    </div>
                  </div>
                </SectionShell>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Sticky save bar */}
      {!loading && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-200 bg-white/95 backdrop-blur-md shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-3 text-xs text-zinc-500">
                <span>{stats.filledDocs} doc{stats.filledDocs !== 1 ? "s" : ""}</span>
                <span className="text-zinc-300">·</span>
                <span>{stats.filledLocs} location{stats.filledLocs !== 1 ? "s" : ""}</span>
                <span className="text-zinc-300">·</span>
                <span>{stats.policyCount} polic{stats.policyCount !== 1 ? "ies" : "y"}</span>
                <span className="text-zinc-300">·</span>
                <span>{stats.validRules} salary rule{stats.validRules !== 1 ? "s" : ""}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-zinc-800 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "Saving…" : "Save all changes"}
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
}

function EmptyState({ icon: Icon, title, description, actionLabel, onAction }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[20px] border border-dashed border-zinc-200 bg-zinc-50/40 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-zinc-200/80">
        <Icon className="h-7 w-7 text-zinc-300" aria-hidden />
      </div>
      <p className="mt-4 text-[15px] font-semibold tracking-tight text-zinc-900">{title}</p>
      <p className="mt-1.5 max-w-sm px-4 text-sm leading-relaxed text-zinc-500">{description}</p>
      <button type="button" onClick={onAction} className="mt-6 rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 active:scale-[0.98] motion-reduce:active:scale-100">
        {actionLabel}
      </button>
    </div>
  );
}

function DeductionCard({ label, description, value, onChange, color = "zinc" }) {
  const dotColors = { red: "bg-red-500", amber: "bg-amber-500", zinc: "bg-zinc-400", orange: "bg-orange-500" };
  const dot = dotColors[color] || dotColors.zinc;
  return (
    <div className="space-y-3 rounded-[20px] bg-white p-5 shadow-sm ring-1 ring-zinc-950/[0.06]">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} aria-hidden />
        <span className="text-[13px] font-semibold tracking-tight text-zinc-900">{label}</span>
      </div>
      <p className="text-xs leading-relaxed text-zinc-500">{description}</p>
      <div className="flex items-center gap-2">
        <input type="number" min={0} step={0.25} className={`${NUM_CLS} w-full max-w-[6.5rem] font-semibold`} value={value} onChange={(e) => onChange(Number(e.target.value))} />
        <span className="text-xs text-zinc-400">days</span>
      </div>
    </div>
  );
}
