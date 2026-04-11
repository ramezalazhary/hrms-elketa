import { useEffect, useMemo, useState, useCallback } from "react";
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
  ChevronUp,
  Info,
  CheckCircle2,
  Gift,
} from "lucide-react";
import { Layout } from "@/shared/components/Layout";
import { useToast } from "@/shared/components/ToastProvider";
import { getDocumentRequirementsApi, updateDocumentRequirementsApi } from "../api";
import { getDepartmentsApi } from "@/modules/departments/api";
import { getEmployeesApi } from "@/modules/employees/api";
import { EGYPT_GOVERNORATES, getCitiesForGovernorate } from "@/shared/data/egyptGovernorates";
import {
  normalizeWorkLocationsForEditor,
  workLocationsToApiPayload,
  emptyPolicyBranchRow,
} from "@/shared/utils/policyWorkLocationBranches";

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
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-zinc-200/80">
            <Icon className={`h-5 w-5 ${iconColor}`} aria-hidden />
          </div>
          <div>
            <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
            <p className="mt-0.5 max-w-2xl text-sm text-zinc-500">{description}</p>
          </div>
        </div>
        {actions}
      </div>
      {children}
    </div>
  );
}

function FieldGroup({ label, hint, children, className = "" }) {
  return (
    <div className={className}>
      <label className="mb-1 block text-xs font-medium text-zinc-600">{label}</label>
      {hint && <p className="mb-1.5 text-[11px] leading-snug text-zinc-400">{hint}</p>}
      {children}
    </div>
  );
}

const INPUT_CLS = "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";
const SELECT_CLS = `${INPUT_CLS} disabled:bg-zinc-50 disabled:text-zinc-400`;
const NUM_CLS = `${INPUT_CLS} tabular-nums`;

function ruleBadge(type) {
  const styles = {
    DEFAULT: "bg-emerald-50 text-emerald-800 ring-emerald-200/60",
    DEPARTMENT: "bg-sky-50 text-sky-800 ring-sky-200/60",
    EMPLOYEE: "bg-violet-50 text-violet-800 ring-violet-200/60",
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedPolicies, setExpandedPolicies] = useState({});
  const [expandedLocations, setExpandedLocations] = useState({});
  const { showToast } = useToast();

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
    const lastTo = tiers.length > 0 ? tiers[tiers.length - 1].toMinutes : 0;
    setAttendanceRules((prev) => ({
      ...prev,
      lateDeductionTiers: [...prev.lateDeductionTiers, { fromMinutes: lastTo, toMinutes: lastTo + 30, deductionDays: 0.25 }],
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
    setSaving(true);
    try {
      await updateDocumentRequirementsApi({
        documentRequirements: requiredDocs.filter((d) => d.name),
        workLocations: workLocationsToApiPayload(workLocations),
        salaryIncreaseRules: salaryIncreaseRules.filter((r) => r.type === "DEFAULT" ? true : r.target),
        companyTimezone: companyTimezone.trim() || "Africa/Cairo",
        companyMonthStartDay: Math.min(31, Math.max(1, Math.floor(Number(companyMonthStartDay)) || 1)),
        chiefExecutiveTitle: chiefExecutiveTitle.trim() || "Chief Executive Officer",
        chiefExecutiveEmployeeId: chiefExecutiveEmployeeId.trim() || null,
        leavePolicies: leavePolicies.map((p) => ({ version: Number(p.version) || 1, vacationRules: p.vacationRules || {}, excuseRules: p.excuseRules || {} })),
        attendanceRules: {
          ...attendanceRules,
          lateDeductionTiers: (attendanceRules.lateDeductionTiers || [])
            .filter((t) => t.fromMinutes != null && t.toMinutes != null)
            .map((t) => ({ fromMinutes: Number(t.fromMinutes) || 0, toMinutes: Number(t.toMinutes) || 1, deductionDays: Number(t.deductionDays) || 0 })),
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
  }, [requiredDocs, workLocations, salaryIncreaseRules, companyTimezone, companyMonthStartDay, chiefExecutiveTitle, chiefExecutiveEmployeeId, leavePolicies, attendanceRules, assessmentPayrollRules, payrollConfig, showToast]);

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
        {/* Tab navigation */}
        <div className="mb-6 -mx-1 overflow-x-auto">
          <div className="flex gap-1 min-w-max px-1">
            {TABS.map(({ key, label, icon: TabIcon }) => {
              const isActive = activeTab === key;
              const badge = tabBadges[key];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveTab(key)}
                  className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-all whitespace-nowrap ${
                    isActive
                      ? "bg-zinc-900 text-white shadow-md"
                      : "bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50 hover:text-zinc-900"
                  }`}
                >
                  <TabIcon className={`h-4 w-4 ${isActive ? "text-white" : "text-zinc-400"}`} />
                  {label}
                  {badge != null && (
                    <span className={`ml-0.5 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${
                      isActive ? "bg-white/20 text-white" : "bg-zinc-100 text-zinc-500"
                    }`}>
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-zinc-200/90 bg-white shadow-sm">
            <SkeletonBlock />
          </div>
        ) : (
          <div className="rounded-2xl border border-zinc-200/90 bg-white shadow-sm overflow-hidden">
            <div className="p-5 sm:p-7">
              {/* ===== GENERAL ===== */}
              {activeTab === "general" && (
                <SectionShell
                  icon={Network}
                  iconColor="text-teal-600"
                  title="Company month & organizational hierarchy"
                  description="Set the first day of your monthly cycle, timezone, and identify the chief executive. Department managers are listed from the Departments module."
                >
                  <div className="grid gap-5 sm:grid-cols-2">
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

                  <div className="mt-8 pt-6 border-t border-zinc-100">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="text-sm font-semibold text-zinc-800">Department managers</h3>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          Update names and emails in{" "}
                          <Link to="/departments" className="font-medium text-indigo-600 hover:text-indigo-800 underline underline-offset-2">Departments</Link>.
                        </p>
                      </div>
                    </div>
                    {departmentRows.length === 0 ? (
                      <p className="py-4 text-sm text-zinc-500 text-center bg-zinc-50 rounded-xl">No departments loaded.</p>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border border-zinc-200/90">
                        <table className="min-w-full divide-y divide-zinc-200 text-sm">
                          <thead className="bg-zinc-50 text-left text-xs font-medium text-zinc-500">
                            <tr>
                              <th className="px-4 py-2.5">Department</th>
                              <th className="px-4 py-2.5">Code</th>
                              <th className="px-4 py-2.5">Head</th>
                              <th className="px-4 py-2.5 w-20" />
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-100 bg-white">
                            {departmentRows.map((d) => {
                              const did = d.id || d._id;
                              return (
                                <tr key={did} className="hover:bg-zinc-50/60">
                                  <td className="px-4 py-2.5 font-medium text-zinc-900">{d.name}</td>
                                  <td className="px-4 py-2.5 text-zinc-500">{d.code || "—"}</td>
                                  <td className="px-4 py-2.5 text-zinc-700">{d.head?.trim() || "—"}</td>
                                  <td className="px-4 py-2.5 text-right">
                                    <Link to={`/departments/${did}/edit`} className="text-xs font-medium text-indigo-600 hover:text-indigo-800">Edit</Link>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </SectionShell>
              )}

              {/* ===== DOCUMENTS ===== */}
              {activeTab === "documents" && (
                <SectionShell
                  icon={FileStack}
                  title="Required documents"
                  description="Documents shown to employees in onboarding checklists. Mark items as mandatory to flag missing uploads."
                  actions={
                    <button type="button" onClick={addDoc} className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50">
                      <Plus className="h-4 w-4" /> Add document
                    </button>
                  }
                >
                  {requiredDocs.length === 0 ? (
                    <EmptyState icon={FileStack} title="No document types yet" description="Add national ID, contract, or any file your HR team must collect." actionLabel="Add the first document" onAction={addDoc} />
                  ) : (
                    <ul className="space-y-3">
                      {requiredDocs.map((doc, index) => (
                        <li key={index} className={`relative rounded-xl border transition-shadow hover:shadow-md ${doc.isMandatory ? "border-indigo-200/60 bg-gradient-to-r from-indigo-50/30 to-white" : "border-zinc-200/90 bg-white"}`}>
                          <div className="flex flex-col gap-4 p-4 sm:flex-row sm:flex-wrap sm:items-end">
                            <div className="min-w-0 flex-1 sm:min-w-[200px]">
                              <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-zinc-500">
                                <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded bg-zinc-200/80 px-1 text-[10px] font-semibold text-zinc-700">{index + 1}</span>
                                Name
                              </label>
                              <input type="text" className={INPUT_CLS} placeholder="e.g. National ID, employment contract" value={doc.name} onChange={(e) => updateDoc(index, "name", e.target.value)} />
                            </div>
                            <div className="min-w-0 flex-[2] sm:min-w-[280px]">
                              <label className="mb-1 block text-xs font-medium text-zinc-500">Instructions</label>
                              <input type="text" className={INPUT_CLS} placeholder="Optional — e.g. must be a clear color scan" value={doc.description} onChange={(e) => updateDoc(index, "description", e.target.value)} />
                            </div>
                            <div className="flex items-center gap-3 border-t border-zinc-100 pt-3 sm:border-0 sm:pt-0">
                              <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-700">
                                <input type="checkbox" className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500/30" checked={doc.isMandatory} onChange={(e) => updateDoc(index, "isMandatory", e.target.checked)} />
                                <span className="flex items-center gap-1 font-medium">
                                  {doc.isMandatory && <ShieldCheck className="h-4 w-4 text-indigo-600" aria-hidden />}
                                  Mandatory
                                </span>
                              </label>
                            </div>
                            <button type="button" onClick={() => removeDoc(index)} className="absolute right-3 top-3 rounded-lg p-2 text-zinc-400 opacity-70 transition hover:bg-red-50 hover:text-red-600 sm:static sm:ml-auto sm:self-center sm:opacity-100" aria-label={`Remove document row ${index + 1}`}>
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
                  iconColor="text-blue-600"
                  title="Workplaces & branches"
                  description="Governorates and cities power workplace pickers. Each branch matches the Branch record shape (name, code, insurance number, location, city, country, status)."
                  actions={
                    <button type="button" onClick={addLocation} className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50">
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
                          <div key={cityIndex} className="rounded-xl border border-zinc-200/90 bg-white overflow-hidden transition hover:shadow-sm">
                            <button
                              type="button"
                              onClick={() => setExpandedLocations((p) => ({ ...p, [cityIndex]: !isOpen }))}
                              className="w-full flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-zinc-50/60 transition text-left"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <MapPinned className="h-4 w-4 text-blue-500 shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-zinc-900 truncate">
                                    {loc.governorate && loc.city ? `${loc.city}, ${loc.governorate}` : "New location"}
                                  </p>
                                  <p className="text-[11px] text-zinc-400">{filledBranches} branch{filledBranches !== 1 ? "es" : ""}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); removeCity(cityIndex); }}
                                  className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-red-50 hover:text-red-600"
                                  aria-label="Remove location"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                                {isOpen ? <ChevronUp className="h-4 w-4 text-zinc-400" /> : <ChevronDown className="h-4 w-4 text-zinc-400" />}
                              </div>
                            </button>

                            {isOpen && (
                              <div className="border-t border-zinc-100 p-5 space-y-5">
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

                                <div className="border-t border-zinc-100 pt-4">
                                  <div className="flex items-center justify-between mb-3">
                                    <span className="text-xs font-semibold text-zinc-700">Branches</span>
                                    <button type="button" onClick={() => addBranch(cityIndex)} className="text-xs font-medium text-indigo-600 hover:text-indigo-800">+ Add branch</button>
                                  </div>
                                  {loc.branches.length === 0 ? (
                                    <p className="py-3 text-center text-xs text-zinc-400 bg-zinc-50 rounded-lg">No branches — add one to define sites.</p>
                                  ) : (
                                    <div className="space-y-3">
                                      {loc.branches.map((branch, bi) => (
                                        <div key={bi} className="rounded-lg border border-zinc-200 bg-zinc-50/40 p-4 space-y-3">
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
                  iconColor="text-teal-600"
                  title="Leave & excuse policies"
                  description="Rules by version number — the highest version applies to new requests. Company timezone is used for time-off logic."
                  actions={
                    <button type="button" onClick={addLeavePolicy} className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50">
                      <Plus className="h-4 w-4" /> Add policy version
                    </button>
                  }
                >
                  <div className="rounded-lg border border-blue-100 bg-blue-50/50 px-4 py-3 flex gap-3 items-start text-xs text-blue-800">
                    <Info className="h-4 w-4 shrink-0 mt-0.5 text-blue-500" />
                    <p>Each version defines vacation and excuse rules independently. The <strong className="font-semibold">highest version number</strong> is always active for new requests. Keep older versions for audit trail.</p>
                  </div>

                  {leavePolicies.length === 0 ? (
                    <EmptyState icon={Plane} title="No policy versions" description="Server defaults apply (annual 21 days, unlimited excuses). Add a version to customize." actionLabel="Create first policy" onAction={addLeavePolicy} />
                  ) : (
                    <div className="space-y-3">
                      {leavePolicies.map((p, idx) => {
                        const isOpen = expandedPolicies[p.version] !== false;
                        const isHighest = p.version === Math.max(...leavePolicies.map((x) => Number(x.version) || 0));
                        return (
                          <div key={idx} className={`rounded-xl border overflow-hidden transition ${isHighest ? "border-emerald-200 bg-emerald-50/20" : "border-zinc-200 bg-white"}`}>
                            <button
                              type="button"
                              onClick={() => setExpandedPolicies((prev) => ({ ...prev, [p.version]: !isOpen }))}
                              className="w-full flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-zinc-50/60 transition text-left"
                            >
                              <div className="flex items-center gap-3">
                                <span className="text-sm font-bold text-zinc-900">Version {p.version}</span>
                                {isHighest && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-inset ring-emerald-200/60">
                                    <CheckCircle2 className="h-3 w-3" /> Active
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <button type="button" onClick={(e) => { e.stopPropagation(); removeLeavePolicy(idx); }} className="rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 transition" aria-label="Remove policy">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                                {isOpen ? <ChevronUp className="h-4 w-4 text-zinc-400" /> : <ChevronDown className="h-4 w-4 text-zinc-400" />}
                              </div>
                            </button>

                            {isOpen && (
                              <div className="border-t border-zinc-100 p-5 space-y-5">
                                <FieldGroup label="Version # (highest wins)" className="max-w-[10rem]">
                                  <input type="number" className={NUM_CLS} value={p.version} onChange={(e) => updateLeavePolicy(idx, { version: Number(e.target.value) })} />
                                </FieldGroup>

                                <div className="grid gap-5 sm:grid-cols-2">
                                  {/* Vacation */}
                                  <div className="rounded-xl border border-zinc-200 bg-white p-4 space-y-4">
                                    <div className="flex items-center gap-2 pb-2 border-b border-zinc-100">
                                      <Plane className="h-4 w-4 text-teal-500" />
                                      <p className="text-sm font-semibold text-zinc-800">Vacation rules</p>
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
                                  <div className="rounded-xl border border-zinc-200 bg-white p-4 space-y-4">
                                    <div className="flex items-center gap-2 pb-2 border-b border-zinc-100">
                                      <Clock className="h-4 w-4 text-orange-500" />
                                      <p className="text-sm font-semibold text-zinc-800">Excuse rules</p>
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
                  iconColor="text-orange-600"
                  title="Attendance & deduction rules"
                  description="Global work hours, grace period, and penalty tiers for lateness, absence, and early departure. Deductions are expressed as days deducted from monthly pay."
                >
                  {/* Shift hours visual */}
                  <div className="rounded-xl border border-orange-100 bg-gradient-to-r from-orange-50/60 to-amber-50/40 p-4">
                    <div className="flex items-center gap-3 text-xs font-semibold text-orange-800 mb-3">
                      <Clock className="h-4 w-4" />
                      Shift schedule
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 border border-orange-200/60 shadow-sm">
                        <span className="text-[10px] uppercase tracking-wide text-zinc-400 font-bold">Start</span>
                        <input type="time" className="text-sm font-bold text-zinc-900 bg-transparent outline-none w-24" value={attendanceRules.standardStartTime} onChange={(e) => updateAttendanceField("standardStartTime", e.target.value)} />
                      </div>
                      <span className="text-zinc-300 font-bold">→</span>
                      <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 border border-orange-200/60 shadow-sm">
                        <span className="text-[10px] uppercase tracking-wide text-zinc-400 font-bold">End</span>
                        <input type="time" className="text-sm font-bold text-zinc-900 bg-transparent outline-none w-24" value={attendanceRules.standardEndTime} onChange={(e) => updateAttendanceField("standardEndTime", e.target.value)} />
                      </div>
                      <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 border border-orange-200/60 shadow-sm">
                        <span className="text-[10px] uppercase tracking-wide text-zinc-400 font-bold">Grace</span>
                        <input type="number" min={0} className="text-sm font-bold text-zinc-900 bg-transparent outline-none w-14 tabular-nums" value={attendanceRules.gracePeriodMinutes} onChange={(e) => updateAttendanceField("gracePeriodMinutes", Number(e.target.value))} />
                        <span className="text-xs text-zinc-400">min</span>
                      </div>
                      <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 border border-orange-200/60 shadow-sm">
                        <span className="text-[10px] uppercase tracking-wide text-zinc-400 font-bold">Days/mo</span>
                        <input type="number" min={1} max={31} className="text-sm font-bold text-zinc-900 bg-transparent outline-none w-12 tabular-nums" value={attendanceRules.workingDaysPerMonth} onChange={(e) => updateAttendanceField("workingDaysPerMonth", Number(e.target.value))} />
                      </div>
                    </div>
                    <p className="text-[11px] text-orange-900/80 mt-3 leading-relaxed">
                      <strong>Days/mo</strong> is the single company value for dividing monthly salary (attendance deductions,
                      payroll daily rate, and assessment multipliers). It is stored on both attendance and payroll policy blocks
                      in sync.
                    </p>
                    <p className="text-[11px] text-orange-900/80 mt-3 leading-relaxed">
                      Weekly rest days below use UTC weekday (0 = Sunday … 6 = Saturday), matching how attendance dates are stored. Typical Egypt setup: Friday + Saturday (5 and 6). Clear all to treat every calendar day as a possible working day in reports.
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {[
                        { dow: 0, label: "Sun / الأحد" },
                        { dow: 1, label: "Mon / الاثنين" },
                        { dow: 2, label: "Tue / الثلاثاء" },
                        { dow: 3, label: "Wed / الأربعاء" },
                        { dow: 4, label: "Thu / الخميس" },
                        { dow: 5, label: "Fri / الجمعة" },
                        { dow: 6, label: "Sat / السبت" },
                      ].map(({ dow, label }) => {
                        const selected = (attendanceRules.weeklyRestDays || []).includes(dow);
                        return (
                          <button
                            key={dow}
                            type="button"
                            onClick={() => toggleWeeklyRestDay(dow)}
                            className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
                              selected
                                ? "border-orange-400 bg-orange-100 text-orange-900"
                                : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Deduction tiers */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-zinc-800">Late arrival deduction tiers</p>
                        <p className="text-xs text-zinc-500">Minutes late range → days deducted from salary.</p>
                      </div>
                      <button type="button" onClick={addDeductionTier} className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50">
                        <Plus className="h-3.5 w-3.5" /> Add tier
                      </button>
                    </div>
                    {attendanceRules.lateDeductionTiers.length === 0 ? (
                      <p className="text-xs text-zinc-400 py-4 text-center border border-dashed border-zinc-200 rounded-lg bg-zinc-50/30">
                        No tiers — late arrivals will not be penalized until tiers are added.
                      </p>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border border-zinc-200/90">
                        <table className="min-w-full divide-y divide-zinc-200 text-sm">
                          <thead className="bg-zinc-50/90 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                            <tr>
                              <th className="whitespace-nowrap px-4 py-2.5">From (min)</th>
                              <th className="whitespace-nowrap px-4 py-2.5">To (min)</th>
                              <th className="whitespace-nowrap px-4 py-2.5">Days deducted</th>
                              <th className="w-10 px-2 py-2.5" />
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-100 bg-white">
                            {attendanceRules.lateDeductionTiers.map((tier, idx) => (
                              <tr key={idx} className="hover:bg-zinc-50/80">
                                <td className="px-4 py-2"><input type="number" min={0} className={`${NUM_CLS} w-24`} value={tier.fromMinutes} onChange={(e) => updateDeductionTier(idx, "fromMinutes", Number(e.target.value))} /></td>
                                <td className="px-4 py-2"><input type="number" min={1} className={`${NUM_CLS} w-24`} value={tier.toMinutes} onChange={(e) => updateDeductionTier(idx, "toMinutes", Number(e.target.value))} /></td>
                                <td className="px-4 py-2"><input type="number" min={0} step={0.25} className={`${NUM_CLS} w-24 font-semibold`} value={tier.deductionDays} onChange={(e) => updateDeductionTier(idx, "deductionDays", Number(e.target.value))} /></td>
                                <td className="px-2 py-2 text-right">
                                  <button type="button" onClick={() => removeDeductionTier(idx)} className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Per-event deductions */}
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
                </SectionShell>
              )}

              {/* ===== SALARY RULES ===== */}
              {activeTab === "salary" && (<>
                <SectionShell
                  icon={Percent}
                  iconColor="text-violet-600"
                  title="Annual salary increases"
                  description="Default and overrides for processing increases. Department and employee rules take precedence over the global default."
                  actions={
                    <button type="button" onClick={addSalaryRule} className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50">
                      <Plus className="h-4 w-4" /> Add rule
                    </button>
                  }
                >
                  {salaryIncreaseRules.length === 0 ? (
                    <EmptyState icon={Percent} title="No salary rules" description="Start with one 'Global default' percentage, then add department overrides." actionLabel="Add a rule" onAction={addSalaryRule} />
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-zinc-200/90">
                      <table className="min-w-full divide-y divide-zinc-200 text-sm">
                        <thead className="bg-zinc-50/90 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                          <tr>
                            <th className="whitespace-nowrap px-4 py-3">Type</th>
                            <th className="whitespace-nowrap px-4 py-3">Applies to</th>
                            <th className="whitespace-nowrap px-4 py-3 text-right">Rate</th>
                            <th className="w-10 px-2 py-3" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 bg-white">
                          {salaryIncreaseRules.map((rule, idx) => (
                            <tr key={idx} className="align-top transition hover:bg-zinc-50/80">
                              <td className="px-4 py-3">
                                <div className="flex flex-wrap items-center gap-2">
                                  {ruleBadge(rule.type)}
                                  <select className="min-w-[10rem] rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs font-medium text-zinc-900" value={rule.type} onChange={(e) => updateSalaryRule(idx, "type", e.target.value)} aria-label="Rule type">
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
                                <button type="button" onClick={() => removeSalaryRule(idx)} className="rounded-lg p-2 text-zinc-400 transition hover:bg-red-50 hover:text-red-600" aria-label="Remove rule"><Trash2 className="h-4 w-4" /></button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <p className="border-t border-zinc-100 bg-zinc-50/50 px-4 py-2 text-xs text-zinc-500">
                        Rows without a target (non-default) are excluded when you save.
                      </p>
                    </div>
                  )}
                </SectionShell>

                <div className="mt-6">
                  <SectionShell
                    icon={Gift}
                    iconColor="text-amber-600"
                    title="Assessment payroll rules"
                    description="Configure how assessment bonuses and overtime translate to monetary amounts in the monthly payroll report. Bonus days and overtime are multiplied by the employee's daily gross rate."
                  >
                    <div className="space-y-4">
                      <div className="rounded-xl border border-zinc-200/90 divide-y divide-zinc-100 bg-white">
                        <div className="flex items-center justify-between px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-zinc-300"
                                checked={assessmentPayrollRules.bonusDaysEnabled}
                                onChange={(e) => setAssessmentPayrollRules((p) => ({ ...p, bonusDaysEnabled: e.target.checked }))}
                              />
                              <span className="text-sm font-semibold text-zinc-800">Bonus days</span>
                            </label>
                            <span className="text-xs text-zinc-400">Days entered in assessment × multiplier × daily gross rate</span>
                          </div>
                          {assessmentPayrollRules.bonusDaysEnabled && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-zinc-500">Multiplier</span>
                              <input
                                type="number"
                                min={0}
                                step={0.1}
                                className="w-16 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-right text-sm font-semibold text-zinc-900 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-200"
                                value={assessmentPayrollRules.bonusDayMultiplier}
                                onChange={(e) => setAssessmentPayrollRules((p) => ({ ...p, bonusDayMultiplier: Number(e.target.value) }))}
                              />
                              <span className="text-xs text-zinc-400">× daily rate</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-zinc-300"
                                checked={assessmentPayrollRules.overtimeEnabled}
                                onChange={(e) => setAssessmentPayrollRules((p) => ({ ...p, overtimeEnabled: e.target.checked }))}
                              />
                              <span className="text-sm font-semibold text-zinc-800">Overtime hours</span>
                            </label>
                            <span className="text-xs text-zinc-400">Hours entered in assessment × multiplier × daily gross rate</span>
                          </div>
                          {assessmentPayrollRules.overtimeEnabled && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-zinc-500">Multiplier</span>
                              <input
                                type="number"
                                min={0}
                                step={0.1}
                                className="w-16 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-right text-sm font-semibold text-zinc-900 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
                                value={assessmentPayrollRules.overtimeDayMultiplier}
                                onChange={(e) => setAssessmentPayrollRules((p) => ({ ...p, overtimeDayMultiplier: Number(e.target.value) }))}
                              />
                              <span className="text-xs text-zinc-400">× daily rate</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-zinc-300"
                                checked={assessmentPayrollRules.deductionEnabled}
                                onChange={(e) => setAssessmentPayrollRules((p) => ({ ...p, deductionEnabled: e.target.checked }))}
                              />
                              <span className="text-sm font-semibold text-zinc-800">Deduction (EGP)</span>
                            </label>
                            <span className="text-xs text-zinc-400">Fixed EGP amount entered in assessment × multiplier (no daily rate)</span>
                          </div>
                          {assessmentPayrollRules.deductionEnabled && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-zinc-500">Multiplier</span>
                              <input
                                type="number"
                                min={0}
                                step={0.1}
                                className="w-16 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-right text-sm font-semibold text-zinc-900 outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-200"
                                value={assessmentPayrollRules.deductionDayMultiplier}
                                onChange={(e) => setAssessmentPayrollRules((p) => ({ ...p, deductionDayMultiplier: Number(e.target.value) }))}
                              />
                              <span className="text-xs text-zinc-400">× EGP amount</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="rounded-lg bg-zinc-50/80 px-4 py-2.5 text-xs text-zinc-500">
                        <strong>Formulas:</strong>{" "}
                        Bonus = days × multiplier × daily gross rate.{" "}
                        Overtime = hours × multiplier × daily gross rate.{" "}
                        Deduction = EGP amount × multiplier (direct, no rate conversion).{" "}
                        Net assessment = bonus + overtime − deduction. Only HR-approved assessments are included.
                      </div>
                    </div>
                  </SectionShell>
                </div>
              </>)}

              {/* ===== PAYROLL CONFIG ===== */}
              {activeTab === "payroll" && (
                <SectionShell
                  icon={Gift}
                  iconColor="text-indigo-600"
                  title="Payroll computation settings"
                  description="Egyptian labor law defaults (2026). Tax brackets, social insurance rates, overtime multiplier, and personal exemption. These values drive the payroll engine."
                >
                  <div className="space-y-6">
                    <FieldGroup
                      label="Amount decimal places (payroll rounding)"
                      hint="HR sets how all EGP amounts are rounded in payroll (0 = whole pounds, 2 = fils to two decimals). Applies to compute, lines, and totals."
                    >
                      <input
                        type="number"
                        min={0}
                        max={8}
                        className={NUM_CLS}
                        value={payrollConfig.decimalPlaces ?? 2}
                        onChange={(e) =>
                          setPayrollConfig((p) => ({ ...p, decimalPlaces: Number(e.target.value) }))
                        }
                      />
                    </FieldGroup>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

                    <div className="rounded-xl border border-zinc-200/90 p-4 space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Social Insurance Rates</h4>
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

                    <div className="rounded-xl border border-zinc-200/90 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Tax Brackets (Annual EGP)</h4>
                        <button
                          type="button"
                          onClick={() => {
                            const brackets = [...payrollConfig.taxBrackets];
                            const lastTo = brackets.length > 0 ? (brackets[brackets.length - 1].to || brackets[brackets.length - 1].from + 100000) : 0;
                            brackets.push({ from: lastTo, to: null, rate: 0 });
                            setPayrollConfig((p) => ({ ...p, taxBrackets: brackets }));
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                        >
                          <Plus className="h-3 w-3" /> Add bracket
                        </button>
                      </div>
                      <div className="overflow-x-auto rounded-lg border border-zinc-100">
                        <table className="min-w-full divide-y divide-zinc-100 text-xs">
                          <thead className="bg-zinc-50/80 text-left text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                            <tr>
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
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50/30 py-14 text-center">
      <Icon className="h-10 w-10 text-zinc-300" aria-hidden />
      <p className="mt-3 text-sm font-medium text-zinc-600">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-zinc-500">{description}</p>
      <button type="button" onClick={onAction} className="mt-4 text-sm font-medium text-indigo-600 hover:text-indigo-800 underline underline-offset-2">
        {actionLabel}
      </button>
    </div>
  );
}

function DeductionCard({ label, description, value, onChange, color = "zinc" }) {
  const colors = {
    red: "border-red-100 bg-red-50/30",
    amber: "border-amber-100 bg-amber-50/30",
    zinc: "border-zinc-200 bg-zinc-50/30",
  };
  const dotColors = { red: "bg-red-400", amber: "bg-amber-400", zinc: "bg-zinc-400" };
  return (
    <div className={`rounded-xl border p-4 space-y-2 ${colors[color]}`}>
      <div className="flex items-center gap-2">
        <div className={`h-2 w-2 rounded-full ${dotColors[color]}`} />
        <span className="text-xs font-semibold text-zinc-800">{label}</span>
      </div>
      <p className="text-[11px] text-zinc-500 leading-snug">{description}</p>
      <div className="flex items-center gap-1.5">
        <input type="number" min={0} step={0.25} className={`${NUM_CLS} w-20 font-semibold`} value={value} onChange={(e) => onChange(Number(e.target.value))} />
        <span className="text-xs text-zinc-400">days</span>
      </div>
    </div>
  );
}
