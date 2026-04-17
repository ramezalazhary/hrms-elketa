import { useCallback, useEffect, useState } from "react";
import { Layout } from "@/shared/components/Layout";
import { useToast } from "@/shared/components/ToastProvider";
import { useAppSelector } from "@/shared/hooks/reduxHooks";
import {
  ACCESS_LEVEL,
  getAdvancesAccessLevel,
  hasAccessLevel,
} from "@/shared/utils/accessControl";
import {
  getAdvancesApi,
  createAdvanceApi,
  approveAdvanceApi,
  cancelAdvanceApi,
} from "../api";
import {
  Loader2,
  Plus,
  Banknote,
  CheckCircle2,
  XCircle,
  Clock,
  CircleDollarSign,
  ChevronDown,
  ChevronUp,
  CalendarClock,
  CreditCard,
  Repeat,
  Search,
  Filter,
} from "lucide-react";

const MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

const STATUS_CONFIG = {
  PENDING:   { label: "قيد الانتظار", bg: "bg-amber-50 text-amber-700 ring-amber-200",   icon: Clock },
  APPROVED:  { label: "معتمدة",       bg: "bg-blue-50 text-blue-700 ring-blue-200",       icon: CheckCircle2 },
  ACTIVE:    { label: "قيد الخصم",    bg: "bg-indigo-50 text-indigo-700 ring-indigo-200", icon: Repeat },
  COMPLETED: { label: "مكتملة",       bg: "bg-emerald-50 text-emerald-700 ring-emerald-200", icon: CheckCircle2 },
  REJECTED:  { label: "مرفوضة",       bg: "bg-red-50 text-red-700 ring-red-200",          icon: XCircle },
  CANCELLED: { label: "ملغية",        bg: "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 ring-zinc-200",      icon: XCircle },
};

const PAYMENT_TYPE_LABELS = {
  ONE_TIME: "مرة واحدة",
  INSTALLMENTS: "تقسيط",
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.PENDING;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${cfg.bg}`}>
      <Icon size={12} />
      {cfg.label}
    </span>
  );
}

function AdvanceCard({ adv, isHrUser, onApprove, onReject, onCancel }) {
  const [expanded, setExpanded] = useState(false);
  const emp = adv.employeeId;
  const empName = typeof emp === "object" ? (emp.fullName || emp.email) : "—";
  const empCode = typeof emp === "object" ? emp.employeeCode : "";
  const empDept = typeof emp === "object" ? emp.department : "";

  const remaining = adv.remainingAmount ?? adv.amount;
  const paid = adv.amount - remaining;
  const progress = adv.amount > 0 ? Math.round((paid / adv.amount) * 100) : 0;

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm transition hover:shadow-md">
      {/* Header */}
      <div
        className="flex cursor-pointer items-center gap-4 px-5 py-4"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-100 to-violet-100 text-indigo-600">
          <Banknote size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">{empName}</span>
            {empCode && <span className="text-xs text-zinc-400">({empCode})</span>}
            <StatusBadge status={adv.status} />
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${adv.paymentType === "INSTALLMENTS" ? "bg-violet-50 text-violet-700 ring-violet-200" : "bg-zinc-50 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400 ring-zinc-200"}`}>
              {adv.paymentType === "INSTALLMENTS" ? <Repeat size={10} /> : <CreditCard size={10} />}
              {PAYMENT_TYPE_LABELS[adv.paymentType] || "مرة واحدة"}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap gap-4 text-xs text-zinc-500 dark:text-zinc-400">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">{adv.amount?.toLocaleString("en-EG")} ج.م</span>
            {empDept && <span>{empDept}</span>}
            {adv.reason && <span className="truncate max-w-[200px]">السبب: {adv.reason}</span>}
          </div>
        </div>
        <div className="text-zinc-400">
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-zinc-100 dark:border-zinc-800/50 px-5 py-4 space-y-4">
          {/* Progress bar for installments */}
          {(adv.paymentType === "INSTALLMENTS" || paid > 0) && (
            <div>
              <div className="flex justify-between text-xs text-zinc-500 dark:text-zinc-400 mb-1">
                <span>تم سداد {paid.toLocaleString("en-EG")} ج.م من {adv.amount.toLocaleString("en-EG")} ج.م</span>
                <span className="font-semibold text-indigo-600">{progress}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Details grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800/50 p-3">
              <p className="text-[11px] text-zinc-400 mb-0.5">المبلغ الكلي</p>
              <p className="font-semibold text-zinc-800 dark:text-zinc-200">{adv.amount?.toLocaleString("en-EG")} ج.م</p>
            </div>
            <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800/50 p-3">
              <p className="text-[11px] text-zinc-400 mb-0.5">المتبقي</p>
              <p className="font-semibold text-zinc-800 dark:text-zinc-200">{remaining.toLocaleString("en-EG")} ج.م</p>
            </div>
            {adv.paymentType === "INSTALLMENTS" && (
              <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800/50 p-3">
                <p className="text-[11px] text-zinc-400 mb-0.5">القسط الشهري</p>
                <p className="font-semibold text-zinc-800 dark:text-zinc-200">{(adv.monthlyDeduction || 0).toLocaleString("en-EG")} ج.م</p>
              </div>
            )}
            {adv.startYear && adv.startMonth && (
              <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800/50 p-3">
                <p className="text-[11px] text-zinc-400 mb-0.5">بداية الخصم</p>
                <p className="font-semibold text-zinc-800 dark:text-zinc-200">{MONTHS[adv.startMonth - 1]} {adv.startYear}</p>
              </div>
            )}
            <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800/50 p-3">
              <p className="text-[11px] text-zinc-400 mb-0.5">سُجلت بواسطة</p>
              <p className="font-semibold text-zinc-800 dark:text-zinc-200 truncate">{adv.recordedBy || "—"}</p>
            </div>
            {adv.approvedBy && (
              <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800/50 p-3">
                <p className="text-[11px] text-zinc-400 mb-0.5">اُعتمدت بواسطة</p>
                <p className="font-semibold text-zinc-800 dark:text-zinc-200 truncate">{adv.approvedBy}</p>
              </div>
            )}
          </div>

          {/* Deduction history */}
          {adv.deductionHistory?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-2">سجل الخصومات</p>
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800 rounded-lg border border-zinc-100 dark:border-zinc-800/50 bg-zinc-50/50 dark:bg-zinc-800/50">
                {adv.deductionHistory.map((h, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 text-xs">
                    <span className="text-zinc-500 dark:text-zinc-400">{new Date(h.date).toLocaleDateString("ar-EG")}</span>
                    <span className="font-medium text-red-600">-{h.amountDeducted?.toLocaleString("en-EG")} ج.م</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          {isHrUser && (
            <div className="flex flex-wrap gap-2 pt-1">
              {adv.status === "PENDING" && (
                <>
                  <button
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-emerald-700 transition"
                    onClick={() => onApprove(adv)}
                  >
                    <CheckCircle2 size={14} /> اعتماد
                  </button>
                  <button
                    className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-red-700 transition"
                    onClick={() => onReject(adv)}
                  >
                    <XCircle size={14} /> رفض
                  </button>
                </>
              )}
              {["PENDING", "APPROVED"].includes(adv.status) && (
                <button
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 shadow-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition"
                  onClick={() => onCancel(adv)}
                >
                  <XCircle size={14} /> إلغاء
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Approve Modal ───────────────────────────────── */

function ApproveModal({ advance, onClose, onConfirm }) {
  const [paymentType, setPaymentType] = useState("ONE_TIME");
  const [monthlyDeduction, setMonthlyDeduction] = useState("");
  const [startYear, setStartYear] = useState(new Date().getFullYear());
  const [startMonth, setStartMonth] = useState(new Date().getMonth() + 1);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (paymentType === "INSTALLMENTS" && (!monthlyDeduction || Number(monthlyDeduction) <= 0)) {
      return alert("يرجى تحديد قيمة القسط الشهري");
    }
    if (paymentType === "INSTALLMENTS" && Number(monthlyDeduction) > advance.amount) {
      return alert("القسط الشهري لا يمكن أن يتجاوز مبلغ السلفة");
    }
    setSubmitting(true);
    await onConfirm({
      paymentType,
      monthlyDeduction: paymentType === "INSTALLMENTS" ? Number(monthlyDeduction) : 0,
      startYear,
      startMonth,
    });
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 p-6 shadow-2xl space-y-5">
        <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <CheckCircle2 size={20} className="text-emerald-600" />
          اعتماد السلفة
        </h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          سلفة بمبلغ <span className="font-bold text-zinc-800 dark:text-zinc-200">{advance.amount?.toLocaleString("en-EG")} ج.م</span>
        </p>

        {/* Payment type */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">طريقة السداد</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className={`flex items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-medium transition ${paymentType === "ONE_TIME" ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300"}`}
              onClick={() => setPaymentType("ONE_TIME")}
            >
              <CreditCard size={16} /> مرة واحدة
            </button>
            <button
              type="button"
              className={`flex items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-medium transition ${paymentType === "INSTALLMENTS" ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300"}`}
              onClick={() => setPaymentType("INSTALLMENTS")}
            >
              <Repeat size={16} /> تقسيط
            </button>
          </div>
        </div>

        {/* Installment fields */}
        {paymentType === "INSTALLMENTS" && (
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/30 p-4 space-y-3">
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">القسط الشهري (ج.م)</label>
              <input
                type="number"
                min="1"
                max={advance.amount}
                className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none"
                placeholder="مثال: 1000"
                value={monthlyDeduction}
                onChange={(e) => setMonthlyDeduction(e.target.value)}
              />
            </div>
            {monthlyDeduction > 0 && (
              <p className="text-xs text-indigo-600">
                عدد الأشهر المتوقعة: <span className="font-bold">{Math.ceil(advance.amount / Number(monthlyDeduction))}</span> شهر
              </p>
            )}
          </div>
        )}

        {/* Start period */}
        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1 flex items-center gap-1">
            <CalendarClock size={14} /> بداية الخصم من مرتب شهر
          </label>
          <div className="flex gap-2">
            <select
              className="flex-1 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
              value={startMonth}
              onChange={(e) => setStartMonth(Number(e.target.value))}
            >
              {MONTHS.map((m, i) => (
                <option key={i} value={i + 1}>{m}</option>
              ))}
            </select>
            <input
              type="number"
              className="w-24 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
              value={startYear}
              onChange={(e) => setStartYear(Number(e.target.value))}
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-2 pt-2">
          <button
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow hover:bg-emerald-700 disabled:opacity-50 transition"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            تأكيد الاعتماد
          </button>
          <button
            className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition"
            onClick={onClose}
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Create Modal ────────────────────────────────── */

function CreateAdvanceModal({ onClose, onCreated }) {
  const [employeeId, setEmployeeId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [paymentType, setPaymentType] = useState("ONE_TIME");
  const [monthlyDeduction, setMonthlyDeduction] = useState("");
  const [startYear, setStartYear] = useState(new Date().getFullYear());
  const [startMonth, setStartMonth] = useState(new Date().getMonth() + 1);
  const [submitting, setSubmitting] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    // Fetch employees for the dropdown
    const fetchEmployees = async () => {
      try {
        const { fetchWithAuth } = await import("@/shared/api/fetchWithAuth");
        const { handleApiResponse } = await import("@/shared/api/handleApiResponse");
        const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
        const response = await fetchWithAuth(`${API_URL}/employees?limit=500`);
        const data = await handleApiResponse(response);
        setEmployees(Array.isArray(data) ? data : data?.employees || []);
      } catch (e) { /* ignore */ }
    };
    fetchEmployees();
  }, []);

  const filteredEmployees = employees.filter((emp) => {
    const term = searchTerm.toLowerCase();
    return (
      (emp.fullName || "").toLowerCase().includes(term) ||
      (emp.employeeCode || "").toLowerCase().includes(term)
    );
  });

  const selectedEmployee = employees.find((e) => (e.id || e._id) === employeeId);

  const handleSubmit = async () => {
    if (!employeeId || !amount || Number(amount) <= 0) return alert("يرجى ملء جميع الحقول المطلوبة");
    if (paymentType === "INSTALLMENTS" && (!monthlyDeduction || Number(monthlyDeduction) <= 0)) {
      return alert("يرجى تحديد قيمة القسط الشهري");
    }
    setSubmitting(true);
    try {
      await createAdvanceApi({
        employeeId,
        amount: Number(amount),
        reason,
        paymentType,
        monthlyDeduction: paymentType === "INSTALLMENTS" ? Number(monthlyDeduction) : 0,
        startYear,
        startMonth,
      });
      onCreated();
    } catch (e) {
      alert(e.message || "فشل إنشاء السلفة");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-zinc-900 p-6 shadow-2xl space-y-5">
        <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <CircleDollarSign size={20} className="text-indigo-600" />
          إنشاء سلفة جديدة
        </h3>

        {/* Employee search */}
        <div className="relative">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">الموظف</label>
          {selectedEmployee ? (
            <div className="flex items-center justify-between rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2">
              <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                {selectedEmployee.fullName} ({selectedEmployee.employeeCode})
              </span>
              <button className="text-xs text-indigo-600 hover:underline" onClick={() => { setEmployeeId(""); setSearchTerm(""); }}>
                تغيير
              </button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 py-2 pl-9 pr-3 text-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none"
                  placeholder="ابحث بالاسم أو الكود..."
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setShowDropdown(true); }}
                  onFocus={() => setShowDropdown(true)}
                />
              </div>
              {showDropdown && (
                <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-lg">
                  {filteredEmployees.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-zinc-400">لا توجد نتائج</p>
                  ) : (
                    filteredEmployees.slice(0, 20).map((emp) => (
                      <button
                        key={emp.id || emp._id}
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-indigo-50 text-right"
                        onClick={() => {
                          setEmployeeId(emp.id || emp._id);
                          setSearchTerm("");
                          setShowDropdown(false);
                        }}
                      >
                        <span className="font-medium text-zinc-800 dark:text-zinc-200">{emp.fullName}</span>
                        <span className="text-xs text-zinc-400">({emp.employeeCode})</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Amount & Reason */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">المبلغ (ج.م)</label>
            <input
              type="number"
              min="1"
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none"
              placeholder="5000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">السبب</label>
            <input
              type="text"
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none"
              placeholder="اختياري"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>

        {/* Payment type */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">طريقة السداد</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className={`flex items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-medium transition ${paymentType === "ONE_TIME" ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300"}`}
              onClick={() => setPaymentType("ONE_TIME")}
            >
              <CreditCard size={16} /> مرة واحدة
            </button>
            <button
              type="button"
              className={`flex items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-medium transition ${paymentType === "INSTALLMENTS" ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300"}`}
              onClick={() => setPaymentType("INSTALLMENTS")}
            >
              <Repeat size={16} /> تقسيط
            </button>
          </div>
        </div>

        {/* Installment fields */}
        {paymentType === "INSTALLMENTS" && (
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/30 p-4 space-y-3">
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">القسط الشهري (ج.م)</label>
              <input
                type="number"
                min="1"
                className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none"
                placeholder="مثال: 1000"
                value={monthlyDeduction}
                onChange={(e) => setMonthlyDeduction(e.target.value)}
              />
            </div>
            {monthlyDeduction > 0 && amount > 0 && (
              <p className="text-xs text-indigo-600">
                عدد الأشهر المتوقعة: <span className="font-bold">{Math.ceil(Number(amount) / Number(monthlyDeduction))}</span> شهر
              </p>
            )}
          </div>
        )}

        {/* Start period */}
        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1 flex items-center gap-1">
            <CalendarClock size={14} /> بداية الخصم من مرتب شهر
          </label>
          <div className="flex gap-2">
            <select
              className="flex-1 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
              value={startMonth}
              onChange={(e) => setStartMonth(Number(e.target.value))}
            >
              {MONTHS.map((m, i) => (
                <option key={i} value={i + 1}>{m}</option>
              ))}
            </select>
            <input
              type="number"
              className="w-24 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
              value={startYear}
              onChange={(e) => setStartYear(Number(e.target.value))}
            />
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-2 pt-2">
          <button
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow hover:bg-indigo-700 disabled:opacity-50 transition"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            إنشاء السلفة
          </button>
          <button
            className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition"
            onClick={onClose}
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ───────────────────────────────────── */

export function AdvancesPage() {
  const { showToast } = useToast();
  const currentUser = useAppSelector((state) => state.identity.currentUser);
  const advancesAccessLevel = getAdvancesAccessLevel(currentUser);
  const canManageAdvances = hasAccessLevel(advancesAccessLevel, ACCESS_LEVEL.EDIT);

  const [advances, setAdvances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [approveTarget, setApproveTarget] = useState(null);

  const fetchAdvances = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      const data = await getAdvancesApi(params);
      setAdvances(data || []);
    } catch (e) {
      showToast(e.message || "فشل تحميل السلف", "error");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, showToast]);

  useEffect(() => {
    fetchAdvances();
  }, [fetchAdvances]);

  const handleApproveConfirm = async (opts) => {
    if (!approveTarget) return;
    const id = approveTarget.id || approveTarget._id;
    try {
      await approveAdvanceApi(id, opts);
      showToast("تم اعتماد السلفة", "success");
      setApproveTarget(null);
      fetchAdvances();
    } catch (e) {
      showToast(e.message || "فشل الاعتماد", "error");
    }
  };

  const handleReject = async (adv) => {
    if (!window.confirm("هل أنت متأكد من رفض هذه السلفة؟")) return;
    const id = adv.id || adv._id;
    try {
      await approveAdvanceApi(id, { isRejected: true });
      showToast("تم رفض السلفة", "success");
      fetchAdvances();
    } catch (e) {
      showToast(e.message || "فشل الرفض", "error");
    }
  };

  const handleCancel = async (adv) => {
    if (!window.confirm("هل أنت متأكد من إلغاء هذه السلفة؟")) return;
    const id = adv.id || adv._id;
    try {
      await cancelAdvanceApi(id);
      showToast("تم إلغاء السلفة", "success");
      fetchAdvances();
    } catch (e) {
      showToast(e.message || "فشل الإلغاء", "error");
    }
  };

  const pendingCount = advances.filter((a) => a.status === "PENDING").length;
  const activeCount = advances.filter((a) => ["APPROVED", "ACTIVE"].includes(a.status)).length;
  const totalRemaining = advances
    .filter((a) => ["APPROVED", "ACTIVE"].includes(a.status))
    .reduce((s, a) => s + (a.remainingAmount || 0), 0);

  return (
    <Layout>
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-100 to-violet-100 text-indigo-700">
              <CircleDollarSign size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">إدارة السلف</h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">إنشاء واعتماد وتتبع سلف الموظفين</p>
            </div>
          </div>
          {canManageAdvances && (
            <button
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 transition"
              onClick={() => setShowCreateModal(true)}
            >
              <Plus size={14} /> سلفة جديدة
            </button>
          )}
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-amber-100 bg-gradient-to-br from-amber-50 to-orange-50 p-4">
            <p className="text-xs text-amber-600 mb-1">طلبات معلقة</p>
            <p className="text-2xl font-bold text-amber-700">{pendingCount}</p>
          </div>
          <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-violet-50 p-4">
            <p className="text-xs text-indigo-600 mb-1">سلف نشطة</p>
            <p className="text-2xl font-bold text-indigo-700">{activeCount}</p>
          </div>
          <div className="rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-teal-50 p-4">
            <p className="text-xs text-emerald-600 mb-1">إجمالي المتبقي</p>
            <p className="text-2xl font-bold text-emerald-700">{totalRemaining.toLocaleString("en-EG")} ج.م</p>
          </div>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-zinc-400" />
          <select
            className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-1.5 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">الكل</option>
            <option value="PENDING">قيد الانتظار</option>
            <option value="APPROVED">معتمدة</option>
            <option value="ACTIVE">قيد الخصم</option>
            <option value="COMPLETED">مكتملة</option>
            <option value="REJECTED">مرفوضة</option>
            <option value="CANCELLED">ملغية</option>
          </select>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-zinc-400" size={28} />
          </div>
        ) : advances.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-6 py-16 text-center">
            <Banknote className="mx-auto mb-3 text-zinc-300" size={36} />
            <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">لا توجد سلف</p>
            <p className="mt-1 text-xs text-zinc-400">أنشئ سلفة جديدة للبدء</p>
          </div>
        ) : (
          <div className="space-y-3">
            {advances.map((adv) => (
              <AdvanceCard
                key={adv.id || adv._id}
                adv={adv}
                isHrUser={canManageAdvances}
                onApprove={setApproveTarget}
                onReject={handleReject}
                onCancel={handleCancel}
              />
            ))}
          </div>
        )}

        {/* Modals */}
        {showCreateModal && (
          <CreateAdvanceModal
            onClose={() => setShowCreateModal(false)}
            onCreated={() => { setShowCreateModal(false); showToast("تم إنشاء السلفة بنجاح", "success"); fetchAdvances(); }}
          />
        )}
        {approveTarget && (
          <ApproveModal
            advance={approveTarget}
            onClose={() => setApproveTarget(null)}
            onConfirm={handleApproveConfirm}
          />
        )}
      </div>
    </Layout>
  );
}
