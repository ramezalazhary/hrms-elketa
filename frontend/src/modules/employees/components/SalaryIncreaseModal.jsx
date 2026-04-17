import { useState, useMemo, useEffect } from "react";
import { TrendingUp, X, Check, Calculator, AlertCircle } from "lucide-react";

export function SalaryIncreaseModal({ employee, orgPolicy, onClose, onSubmit }) {
  const currentSalary = employee?.financial?.baseSalary || 0;

  const defaultPercentage = useMemo(() => {
    if (!orgPolicy?.salaryIncreaseRules) return 10;
    const r = orgPolicy.salaryIncreaseRules;
    const e = r.find(x => x.type === "EMPLOYEE" && (x.target === employee.id || x.target === employee.employeeCode));
    if (e) return e.percentage;
    const d = r.find(x => x.type === "DEPARTMENT" && x.target === employee.department);
    if (d) return d.percentage;
    return (r.find(x => x.type === "DEFAULT")?.percentage) || 10;
  }, [employee, orgPolicy]);

  const [method, setMethod] = useState("PERCENT");
  const [percentValue, setPercentValue] = useState(defaultPercentage.toString());
  const [fixedValue, setFixedValue] = useState(Math.round(currentSalary * (defaultPercentage / 100)).toString());
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState(`Annual Salary Increase - ${new Date().getFullYear()}`);

  const activePercent = method === "PERCENT" ? parseFloat(percentValue || 0) : (currentSalary > 0 ? ((parseFloat(fixedValue || 0) / currentSalary) * 100) : 0);
  const activeAmount = method === "FIXED" ? parseFloat(fixedValue || 0) : (currentSalary * (parseFloat(percentValue || 0) / 100));
  const newSalary = currentSalary + activeAmount;

  // Sync inputs dynamically for the user
  useEffect(() => {
    if (method === "PERCENT" && !isNaN(parseFloat(percentValue))) {
      setFixedValue(Math.round(currentSalary * (parseFloat(percentValue) / 100)).toString());
    }
  }, [percentValue, method, currentSalary]);

  useEffect(() => {
    if (method === "FIXED" && !isNaN(parseFloat(fixedValue)) && currentSalary > 0) {
      setPercentValue(((parseFloat(fixedValue) / currentSalary) * 100).toFixed(2).replace(/\.00$/, ""));
    }
  }, [fixedValue, method, currentSalary]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      method: method,
      value: method === "PERCENT" ? parseFloat(percentValue) : parseFloat(fixedValue),
      effectiveDate: date,
      reason: reason
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg overflow-hidden rounded-[20px] border border-zinc-200/90 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 p-6 shadow-2xl ring-1 ring-zinc-950/[0.06] dark:ring-zinc-800 animate-in zoom-in-95 duration-200">
        <div className="absolute right-0 top-0 -mr-16 -mt-16 h-48 w-48 rounded-full bg-zinc-300/30 blur-3xl" />
        
        <div className="relative flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 ring-1 ring-zinc-200/80 dark:ring-zinc-700">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 leading-none">Process Salary Increase</h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">For <strong>{employee.fullName}</strong></p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="flex items-center justify-center h-8 w-8 rounded-full text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-600 dark:hover:text-zinc-400 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="relative flex flex-col gap-5">
          {/* Method Selection */}
          <div className="flex gap-2 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
            <button
              type="button"
              onClick={() => setMethod("PERCENT")}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-lg transition-all ${
                method === "PERCENT" 
                  ? "border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm" 
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-200/50"
              }`}
            >
              Percentage (%)
            </button>
            <button
              type="button"
              onClick={() => setMethod("FIXED")}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-lg transition-all ${
                method === "FIXED" 
                  ? "border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm" 
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-200/50"
              }`}
            >
              Fixed Amount (EGP)
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Input Value */}
            <div>
              <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                {method === "PERCENT" ? "Increase Percentage" : "Increase Amount"}
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  min="0.1"
                  required
                  value={method === "PERCENT" ? percentValue : fixedValue}
                  onChange={(e) => method === "PERCENT" ? setPercentValue(e.target.value) : setFixedValue(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 px-4 py-2.5 pl-9 text-base font-semibold shadow-sm transition focus:border-zinc-400 focus:bg-white dark:focus:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-200/80 dark:focus:ring-zinc-700"
                />
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 font-bold">
                  {method === "PERCENT" ? "%" : "±"}
                </span>
                {method === "FIXED" && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-zinc-400">EGP</span>}
              </div>
            </div>

            {/* Effective Date */}
            <div>
              <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">Effective Date</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 px-3 py-2.5 text-sm font-medium shadow-sm transition focus:border-zinc-400 focus:bg-white dark:focus:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-200/80 dark:focus:ring-zinc-700"
              />
            </div>
          </div>

          {/* Real-time Calculation Display */}
          <div className="rounded-[20px] border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/80 dark:bg-zinc-800/50 p-4 ring-1 ring-zinc-950/[0.04]">
            <h4 className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
              <Calculator className="h-3.5 w-3.5" /> Calculation Preview
            </h4>
            
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Current Base Salary</span>
              <span className="font-mono text-sm font-semibold text-zinc-500 dark:text-zinc-400">
                {new Intl.NumberFormat("en-EG").format(currentSalary)} <span className="text-[10px] text-zinc-400">EGP</span>
              </span>
            </div>

            <div className="mb-3 flex items-center justify-between border-b border-zinc-200/80 dark:border-zinc-800/80 pb-3">
              <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                Calculated increase
                <span className="ml-2 inline-flex items-center rounded-md bg-zinc-200/70 px-1.5 py-0.5 text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                  +{isNaN(activePercent) ? "0" : activePercent.toFixed(1).replace(/\.0$/, '')}%
                </span>
              </span>
              <span className="font-mono text-sm font-bold text-zinc-800 dark:text-zinc-200">
                +{new Intl.NumberFormat("en-EG").format(isNaN(activeAmount) ? 0 : Math.round(activeAmount))} <span className="text-[10px] text-zinc-500 dark:text-zinc-400">EGP</span>
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200">New base salary</span>
              <span className="font-mono text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                {new Intl.NumberFormat("en-EG").format(isNaN(newSalary) ? currentSalary : Math.round(newSalary))} 
                <span className="ml-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400">EGP</span>
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">Reason / Notes</label>
            <textarea
              required
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full resize-none rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 px-3 py-2 text-sm shadow-sm transition focus:border-zinc-400 focus:bg-white dark:focus:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-200/80 dark:focus:ring-zinc-700"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 active:scale-[0.98] motion-reduce:active:scale-100"
            >
              <Check className="h-4 w-4" /> Apply Increase
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
