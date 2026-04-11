import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "@/shared/components/Layout";
import { useToast } from "@/shared/components/ToastProvider";
import {
  getPayrollRunApi,
  getPayrollRecordsApi,
  computePayrollRunApi,
  finalizePayrollRunApi,
  repairPayrollRunTotalsApi,
  getPaymentListApi,
  getInsuranceReportApi,
  getTaxReportApi,
  downloadPayrollExcelApi,
} from "../api";
import {
  Loader2,
  Play,
  Lock,
  Download,
  ArrowLeft,
  Wallet,
  Users,
  ShieldCheck,
  Receipt,
  Banknote,
  Wrench,
} from "lucide-react";
import { PayrollHelpPanel } from "../components/PayrollHelpPanel";
import { EmployeePayrollCalculationModal } from "../components/EmployeePayrollCalculationModal";
import { formatPayrollEgp } from "../payrollVerification";
import { usePayrollDecimalPlaces } from "../usePayrollDecimalPlaces";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const fmtInt = (n) => (n != null ? Number(n).toLocaleString() : "—");

export function PayrollRunDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const payrollDp = usePayrollDecimalPlaces();
  const fmt = (n) => formatPayrollEgp(n, payrollDp);

  const [run, setRun] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [activeTab, setActiveTab] = useState("records");
  const [paymentList, setPaymentList] = useState(null);
  const [insuranceReport, setInsuranceReport] = useState(null);
  const [taxReport, setTaxReport] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);

  const fetchData = useCallback(async (opts = {}) => {
    const silent = opts.silent === true;
    if (!silent) setLoading(true);
    try {
      const [runData, recData] = await Promise.all([
        getPayrollRunApi(id),
        getPayrollRecordsApi(id),
      ]);
      setRun(runData);
      setRecords(recData || []);
    } catch (e) {
      showToast(e.message || "Failed to load", "error");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [id, showToast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const invalidateReportCaches = useCallback(() => {
    setPaymentList(null);
    setInsuranceReport(null);
    setTaxReport(null);
  }, []);

  const refetchActiveReportIfNeeded = useCallback(async () => {
    try {
      if (activeTab === "payment") {
        setPaymentList(await getPaymentListApi(id));
      } else if (activeTab === "insurance") {
        setInsuranceReport(await getInsuranceReportApi(id));
      } else if (activeTab === "tax") {
        setTaxReport(await getTaxReportApi(id));
      }
    } catch (e) {
      showToast(e.message || "Failed to refresh report", "error");
    }
  }, [activeTab, id, showToast]);

  const handleCompute = async () => {
    if (
      !window.confirm(
        "This replaces every employee line with a fresh calculation from attendance, profiles, and advances. Any manual edits to individual lines will be lost. Continue?"
      )
    ) {
      return;
    }
    setComputing(true);
    try {
      await computePayrollRunApi(id);
      showToast("Payroll computed successfully", "success");
      invalidateReportCaches();
      await fetchData({ silent: true });
      await refetchActiveReportIfNeeded();
    } catch (e) {
      showToast(e.message || "Computation failed", "error");
    } finally {
      setComputing(false);
    }
  };

  const handleRepairTotals = async () => {
    if (
      !window.confirm(
        "Recalculate this run’s header totals from all employee lines? Use this if numbers look out of sync.",
      )
    ) {
      return;
    }
    setRepairing(true);
    try {
      const runData = await repairPayrollRunTotalsApi(id);
      setRun(runData);
      invalidateReportCaches();
      await refetchActiveReportIfNeeded();
      showToast("Run totals repaired", "success");
    } catch (e) {
      showToast(e.message || "Repair failed", "error");
    } finally {
      setRepairing(false);
    }
  };

  const handleFinalize = async () => {
    if (!window.confirm("Finalize this payroll run? This action cannot be undone. Advances will be marked as deducted.")) return;
    setFinalizing(true);
    try {
      await finalizePayrollRunApi(id);
      showToast("Payroll finalized", "success");
      invalidateReportCaches();
      await fetchData({ silent: true });
      await refetchActiveReportIfNeeded();
    } catch (e) {
      showToast(e.message || "Finalization failed", "error");
    } finally {
      setFinalizing(false);
    }
  };

  const handleExport = async (type) => {
    try {
      const blob = await downloadPayrollExcelApi(id, type);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `payroll-${type}-${run?.period?.year}-${String(run?.period?.month).padStart(2, "0")}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      showToast("Export failed", "error");
    }
  };

  const loadPaymentList = async () => {
    if (paymentList) return;
    try { setPaymentList(await getPaymentListApi(id)); } catch { showToast("Failed to load payment list", "error"); }
  };
  const loadInsurance = async () => {
    if (insuranceReport) return;
    try { setInsuranceReport(await getInsuranceReportApi(id)); } catch { showToast("Failed to load insurance report", "error"); }
  };
  const loadTax = async () => {
    if (taxReport) return;
    try { setTaxReport(await getTaxReportApi(id)); } catch { showToast("Failed to load tax report", "error"); }
  };

  useEffect(() => {
    if (activeTab === "payment") loadPaymentList();
    if (activeTab === "insurance") loadInsurance();
    if (activeTab === "tax") loadTax();
  }, [activeTab]);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-zinc-400" size={28} />
        </div>
      </Layout>
    );
  }

  if (!run) {
    return (
      <Layout>
        <div className="py-20 text-center text-zinc-500">Run not found</div>
      </Layout>
    );
  }

  const t = run.totals || {};
  const period = `${MONTHS[(run.period?.month || 1) - 1]} ${run.period?.year}`;
  const canCompute = run.status !== "FINALIZED";
  const canFinalize = run.status === "COMPUTED";
  const hasRecords = records.length > 0;

  return (
    <Layout>
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        {/* Top bar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/payroll")} className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 transition">
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-xl font-bold text-zinc-900">{period}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${
                  run.status === "FINALIZED" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" :
                  run.status === "COMPUTED" ? "bg-amber-50 text-amber-700 ring-amber-200" :
                  "bg-zinc-100 text-zinc-700 ring-zinc-200"
                }`}>{run.status}</span>
                <span className="text-xs text-zinc-400">Created by {run.createdBy}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canCompute && (
              <button
                onClick={handleCompute}
                disabled={computing}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-amber-700 disabled:opacity-50"
              >
                {computing ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                {computing ? "Computing..." : "Compute"}
              </button>
            )}
            {canFinalize && (
              <button
                onClick={handleFinalize}
                disabled={finalizing}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
              >
                {finalizing ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
                {finalizing ? "Finalizing..." : "Finalize"}
              </button>
            )}
            {hasRecords && (
              <button
                type="button"
                onClick={handleRepairTotals}
                disabled={repairing || computing || finalizing}
                title="Re-sum header cards from all lines if they look wrong"
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-600 shadow-sm hover:bg-zinc-50 disabled:opacity-50"
              >
                {repairing ? <Loader2 size={14} className="animate-spin" /> : <Wrench size={14} />}
                {repairing ? "Repairing…" : "Repair totals"}
              </button>
            )}
            {hasRecords && (
              <div className="relative group">
                <button className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50">
                  <Download size={14} /> Export
                </button>
                <div className="absolute right-0 top-full z-10 mt-1 hidden w-44 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg group-hover:block">
                  {["full", "payment", "insurance", "tax"].map((t) => (
                    <button key={t} onClick={() => handleExport(t)} className="block w-full px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50 capitalize">
                      {t === "full" ? "Full Payroll" : t === "payment" ? "Payment List" : t === "insurance" ? "Insurance Report" : "Tax Report"}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Summary cards */}
        {hasRecords && (
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { label: "Employees", value: fmtInt(t.employeeCount), icon: Users, cls: "text-indigo-500" },
              { label: "Total Gross", value: fmt(t.totalGross), icon: Wallet, cls: "text-blue-500" },
              { label: "Total Deductions", value: fmt(t.totalDeductions), icon: Receipt, cls: "text-red-500" },
              { label: "Insurance (Emp)", value: fmt(t.totalEmployeeInsurance), icon: ShieldCheck, cls: "text-teal-500" },
              { label: "Total Tax", value: fmt(t.totalTax), icon: Receipt, cls: "text-amber-500" },
              { label: "Total Net", value: fmt(t.totalNet), icon: Banknote, cls: "text-emerald-500" },
            ].map(({ label, value, icon: Icon, cls }) => (
              <div key={label} className="rounded-xl border border-zinc-200 bg-white p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Icon size={14} className={cls} />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">{label}</span>
                </div>
                <p className="text-lg font-bold text-zinc-900">{value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Cash vs Visa split */}
        {hasRecords && (
          <div className="grid gap-3 grid-cols-2">
            <div className="rounded-xl border border-zinc-200 bg-white p-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-green-50 flex items-center justify-center">
                <Banknote size={18} className="text-green-600" />
              </div>
              <div>
                <p className="text-xs text-zinc-400 font-medium">Cash ({fmtInt(t.cashCount)})</p>
                <p className="text-base font-bold text-zinc-900">EGP {fmt(t.cashTotal)}</p>
              </div>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center">
                <Wallet size={18} className="text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-zinc-400 font-medium">Bank Transfer ({fmtInt(t.visaCount)})</p>
                <p className="text-base font-bold text-zinc-900">EGP {fmt(t.visaTotal)}</p>
              </div>
            </div>
          </div>
        )}

        <PayrollHelpPanel
          records={hasRecords ? records : null}
          totals={hasRecords ? t : null}
          defaultOpen={false}
        />

        {/* Tabs */}
        {hasRecords && (
          <div className="border-b border-zinc-200">
            <div className="flex gap-1 overflow-x-auto">
              {[
                { key: "records", label: "Employee Records" },
                { key: "payment", label: "Payment List" },
                { key: "insurance", label: "Insurance Report" },
                { key: "tax", label: "Tax Report" },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`whitespace-nowrap px-4 py-2.5 text-sm font-medium transition border-b-2 -mb-px ${
                    activeTab === key ? "border-indigo-600 text-indigo-700" : "border-transparent text-zinc-500 hover:text-zinc-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Records tab */}
        {activeTab === "records" && hasRecords && (
          <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
            <table className="min-w-full divide-y divide-zinc-200 text-xs">
              <thead className="bg-zinc-50/90 text-left text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-3 py-3">Code</th>
                  <th className="px-3 py-3">Name</th>
                  <th className="px-3 py-3">Dept</th>
                  <th className="px-3 py-3 text-center">Insured</th>
                  <th className="px-3 py-3 text-right">Gross</th>
                  <th className="px-3 py-3 text-right">Additions</th>
                  <th className="px-3 py-3 text-right">Deductions</th>
                  <th className="px-3 py-3 text-right">Ins. (Emp)</th>
                  <th className="px-3 py-3 text-right">Tax</th>
                  <th className="px-3 py-3 text-right font-bold">Net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {records.map((r) => {
                  const rid = r.id || r._id;
                  return (
                    <tr
                      key={rid}
                      className="cursor-pointer hover:bg-zinc-50/80 transition"
                      onClick={() => setSelectedRecord(r)}
                      title="View full calculation"
                    >
                      <td className="px-3 py-2.5">
                        <span className="rounded-md border border-teal-200 bg-teal-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-teal-800">{r.employeeCode}</span>
                      </td>
                      <td className="px-3 py-2.5 font-medium text-zinc-900">{r.fullName}</td>
                      <td className="px-3 py-2.5 text-zinc-500">{r.department || "—"}</td>
                      <td className="px-3 py-2.5 text-center">
                        {r.isInsured ? <span className="text-emerald-600 font-semibold">Yes</span> : <span className="text-zinc-400">No</span>}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono">{fmt(r.grossSalary)}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-emerald-600">+{fmt(r.totalAdditions)}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-red-600">-{fmt(r.totalDeductions)}</td>
                      <td className="px-3 py-2.5 text-right font-mono">{r.isInsured ? fmt(r.employeeInsurance) : "—"}</td>
                      <td className="px-3 py-2.5 text-right font-mono">{r.monthlyTax > 0 ? fmt(r.monthlyTax) : "—"}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-zinc-900">{fmt(r.netSalary)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Payment list tab */}
        {activeTab === "payment" && paymentList && (
          <div className="space-y-4">
            {[
              { title: "Cash Employees", data: paymentList.cash, total: paymentList.cashTotal },
              { title: "Bank Transfer Employees", data: paymentList.visa, total: paymentList.visaTotal },
            ].map(({ title, data, total }) => (
              <div key={title} className="rounded-xl border border-zinc-200 bg-white">
                <div className="border-b border-zinc-100 px-5 py-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-zinc-800">{title} ({data.length})</h3>
                  <span className="text-sm font-bold text-zinc-900">EGP {fmt(total)}</span>
                </div>
                <table className="min-w-full divide-y divide-zinc-100 text-xs">
                  <thead className="bg-zinc-50/60 text-left text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    <tr>
                      <th className="px-4 py-2">Name</th>
                      <th className="px-4 py-2">Code</th>
                      <th className="px-4 py-2">Department</th>
                      {title.includes("Bank") && <th className="px-4 py-2">Bank Account</th>}
                      <th className="px-4 py-2 text-right">Net Salary</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50">
                    {data.map((r, i) => (
                      <tr key={i} className="hover:bg-zinc-50/50">
                        <td className="px-4 py-2 text-zinc-800">{r.fullName}</td>
                        <td className="px-4 py-2 font-mono text-zinc-500">{r.employeeCode}</td>
                        <td className="px-4 py-2 text-zinc-500">{r.department}</td>
                        {title.includes("Bank") && <td className="px-4 py-2 font-mono text-zinc-600">{r.bankAccount || "—"}</td>}
                        <td className="px-4 py-2 text-right font-bold text-zinc-900">{fmt(r.netSalary)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}

        {/* Insurance report tab */}
        {activeTab === "insurance" && insuranceReport && (
          <div className="rounded-xl border border-zinc-200 bg-white">
            <div className="border-b border-zinc-100 px-5 py-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-800">Insurance Report ({insuranceReport.rows.length} insured)</h3>
              <span className="text-sm font-bold text-zinc-900">Total: EGP {fmt(insuranceReport.totalCombined)}</span>
            </div>
            <table className="min-w-full divide-y divide-zinc-100 text-xs">
              <thead className="bg-zinc-50/60 text-left text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Insurance #</th>
                  <th className="px-4 py-2 text-right">Insured Wage</th>
                  <th className="px-4 py-2 text-right">Employee (11%)</th>
                  <th className="px-4 py-2 text-right">Company (18.75%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {insuranceReport.rows.map((r, i) => (
                  <tr key={i} className="hover:bg-zinc-50/50">
                    <td className="px-4 py-2 text-zinc-800">{r.fullName}</td>
                    <td className="px-4 py-2 font-mono text-zinc-500">{r.insuranceNumber || "—"}</td>
                    <td className="px-4 py-2 text-right font-mono">{fmt(r.insuredWage)}</td>
                    <td className="px-4 py-2 text-right font-mono">{fmt(r.employeeShare)}</td>
                    <td className="px-4 py-2 text-right font-mono">{fmt(r.companyShare)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-zinc-50/80 font-semibold text-xs">
                <tr>
                  <td colSpan={3} className="px-4 py-2 text-right">Totals</td>
                  <td className="px-4 py-2 text-right">{fmt(insuranceReport.totalEmployee)}</td>
                  <td className="px-4 py-2 text-right">{fmt(insuranceReport.totalCompany)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Tax report tab */}
        {activeTab === "tax" && taxReport && (
          <div className="rounded-xl border border-zinc-200 bg-white">
            <div className="border-b border-zinc-100 px-5 py-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-800">Tax Report</h3>
              <span className="text-sm font-bold text-zinc-900">Monthly Tax: EGP {fmt(taxReport.totalMonthlyTax)}</span>
            </div>
            <table className="min-w-full divide-y divide-zinc-100 text-xs">
              <thead className="bg-zinc-50/60 text-left text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2 text-right">Gross</th>
                  <th className="px-4 py-2 text-right">Taxable (Annual)</th>
                  <th className="px-4 py-2 text-right">Annual Tax</th>
                  <th className="px-4 py-2 text-right">Monthly Tax</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {taxReport.rows.map((r, i) => (
                  <tr key={i} className="hover:bg-zinc-50/50">
                    <td className="px-4 py-2 text-zinc-800">{r.fullName}</td>
                    <td className="px-4 py-2 text-right font-mono">{fmt(r.grossSalary)}</td>
                    <td className="px-4 py-2 text-right font-mono">{fmt(r.taxableAnnual)}</td>
                    <td className="px-4 py-2 text-right font-mono">{fmt(r.annualTax)}</td>
                    <td className="px-4 py-2 text-right font-bold">{fmt(r.monthlyTax)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Empty state */}
        {!hasRecords && run.status === "DRAFT" && (
          <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/30 px-6 py-16 text-center">
            <Play className="mx-auto mb-3 text-zinc-300" size={36} />
            <p className="text-sm font-medium text-zinc-600">Run not yet computed</p>
            <p className="mt-1 text-xs text-zinc-400">Click "Compute" to calculate payroll for all employees</p>
          </div>
        )}

        {selectedRecord && (
          <EmployeePayrollCalculationModal
            record={selectedRecord}
            periodLabel={period}
            runId={id}
            runStatus={run.status}
            onClose={() => setSelectedRecord(null)}
            onUpdated={async () => {
              try {
                const [runData, recData] = await Promise.all([
                  getPayrollRunApi(id),
                  getPayrollRecordsApi(id),
                ]);
                setRun(runData);
                setRecords(recData || []);
                setSelectedRecord((prev) => {
                  if (!prev) return null;
                  const rid = String(prev.id || prev._id);
                  const fresh = (recData || []).find((r) => String(r.id || r._id) === rid);
                  return fresh || prev;
                });
                setPaymentList(null);
                setInsuranceReport(null);
                setTaxReport(null);
                await refetchActiveReportIfNeeded();
              } catch (e) {
                showToast(e.message || "Failed to refresh", "error");
              }
            }}
          />
        )}
      </div>
    </Layout>
  );
}
