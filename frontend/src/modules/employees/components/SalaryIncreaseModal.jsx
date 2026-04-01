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

  const activePercent = method === "PERCENT" ? parseFloat(percentValue || 0) : ((parseFloat(fixedValue || 0) / currentSalary) * 100);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl relative overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
        <div className="absolute right-0 top-0 -mr-16 -mt-16 h-48 w-48 rounded-full bg-teal-500/10 blur-3xl" />
        
        <div className="relative flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-teal-50 text-teal-600">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 leading-none">Process Salary Increase</h2>
              <p className="mt-1 text-sm text-slate-500">For <strong>{employee.fullName}</strong></p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="flex items-center justify-center h-8 w-8 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="relative flex flex-col gap-5">
          {/* Method Selection */}
          <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => setMethod("PERCENT")}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-lg transition-all ${
                method === "PERCENT" 
                  ? "bg-white text-teal-700 shadow-sm border border-slate-200" 
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
              }`}
            >
              Percentage (%)
            </button>
            <button
              type="button"
              onClick={() => setMethod("FIXED")}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-lg transition-all ${
                method === "FIXED" 
                  ? "bg-white text-teal-700 shadow-sm border border-slate-200" 
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
              }`}
            >
              Fixed Amount (EGP)
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Input Value */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
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
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 pl-9 text-base font-semibold shadow-sm transition focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                />
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                  {method === "PERCENT" ? "%" : "±"}
                </span>
                {method === "FIXED" && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">EGP</span>}
              </div>
            </div>

            {/* Effective Date */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Effective Date</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium shadow-sm transition focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              />
            </div>
          </div>

          {/* Real-time Calculation Display */}
          <div className="rounded-xl border border-teal-100 bg-teal-50/50 p-4">
            <h4 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-teal-600/70 mb-3">
              <Calculator className="h-3.5 w-3.5" /> Calculation Preview
            </h4>
            
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-600">Current Base Salary</span>
              <span className="font-mono text-sm font-semibold text-slate-500">
                {new Intl.NumberFormat("en-EG").format(currentSalary)} <span className="text-[10px] text-slate-400">EGP</span>
              </span>
            </div>

            <div className="flex items-center justify-between mb-3 border-b border-teal-100/60 pb-3">
              <span className="text-sm font-medium text-slate-600">
                Calculated Increase 
                <span className="ml-2 inline-flex items-center rounded bg-teal-100/80 px-1.5 py-0.5 text-xs font-bold text-teal-800">
                  +{isNaN(activePercent) ? "0" : activePercent.toFixed(1).replace(/\.0$/, '')}%
                </span>
              </span>
              <span className="font-mono text-sm font-bold text-emerald-600">
                +{new Intl.NumberFormat("en-EG").format(isNaN(activeAmount) ? 0 : Math.round(activeAmount))} <span className="text-[10px] text-emerald-600/60">EGP</span>
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-800">New Base Salary</span>
              <span className="font-mono text-lg font-black text-teal-700 tracking-tight">
                {new Intl.NumberFormat("en-EG").format(isNaN(newSalary) ? currentSalary : Math.round(newSalary))} 
                <span className="ml-1 text-xs font-bold text-teal-600/60">EGP</span>
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Reason / Notes</label>
            <textarea
              required
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-teal-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-teal-500/25 transition hover:shadow-xl hover:shadow-teal-500/40 active:scale-[0.98]"
            >
              <Check className="h-4 w-4" /> Apply Increase
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
