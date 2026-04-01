import { useState } from "react";
import { ArrowRightLeft, X, Check, Building2, Briefcase, DollarSign, Calendar, FileText, Badge } from "lucide-react";

export function TransferModal({ employee, departments, onClose, onSubmit }) {
  const currentSalary = employee?.financial?.baseSalary || 0;

  const [toDepartment, setToDepartment] = useState("");
  const [newEmployeeCode, setNewEmployeeCode] = useState("");
  const [newPosition, setNewPosition] = useState("");
  const [newSalary, setNewSalary] = useState(currentSalary.toString());
  const [resetYearlyIncreaseDate, setResetYearlyIncreaseDate] = useState(false);
  const [notes, setNotes] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!toDepartment) return;
    
    onSubmit({
      toDepartment,
      newEmployeeCode: newEmployeeCode || undefined,
      newPosition: newPosition || undefined,
      newSalary: newSalary ? parseFloat(newSalary) : undefined,
      resetYearlyIncreaseDate,
      notes,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 md:p-8 shadow-2xl relative overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
        <div className="absolute right-0 top-0 -mr-16 -mt-16 h-48 w-48 rounded-full bg-indigo-500/10 blur-3xl" />
        
        <div className="relative flex items-start justify-between mb-8">
          <div className="flex gap-4">
            <div className="flex items-center justify-center shrink-0 w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 shadow-sm border border-indigo-100/50">
              <ArrowRightLeft className="h-6 w-6" strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 leading-none">Transfer Employee</h2>
              <p className="mt-1.5 text-sm text-slate-500">Record a structural or departmental change for <strong>{employee.fullName}</strong>.</p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="flex items-center justify-center h-8 w-8 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition -mr-2"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="relative flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-2">
            
            {/* Target Department */}
            <div className="md:col-span-2">
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                <Building2 className="h-3.5 w-3.5 text-indigo-500" /> Target Department <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={toDepartment}
                onChange={(e) => setToDepartment(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="" disabled>Select a department...</option>
                {departments.map(d => (
                  <option key={d.name} value={d.name}>{d.name}</option>
                ))}
              </select>
            </div>

            {/* New Job Title */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                <Briefcase className="h-3.5 w-3.5 text-indigo-400" /> New Job Title
              </label>
              {(() => {
                const selectedDeptObj = departments.find(d => d.name === toDepartment);
                const positions = selectedDeptObj ? [
                  ...(selectedDeptObj.positions || []).map(p => p.title),
                  ...(selectedDeptObj.teams || []).flatMap(t => (t.positions || []).map(p => p.title))
                ] : [];
                const uniquePositions = [...new Set(positions)].filter(Boolean);

                if (toDepartment && uniquePositions.length > 0) {
                  return (
                    <select
                      value={newPosition}
                      onChange={(e) => setNewPosition(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    >
                      <option value="">Select a position...</option>
                      {uniquePositions.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  );
                }

                return (
                  <input
                    type="text"
                    placeholder={employee.position || "e.g. Senior Manager"}
                    value={newPosition}
                    onChange={(e) => setNewPosition(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50 disabled:bg-slate-50"
                    disabled={!toDepartment}
                  />
                );
              })()}
            </div>

            {/* New Code */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                <Badge className="h-3.5 w-3.5 text-indigo-400" /> New Employee Code
              </label>
              <input
                type="text"
                placeholder={`Current: ${employee.employeeCode || "N/A"}`}
                value={newEmployeeCode}
                onChange={(e) => setNewEmployeeCode(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-mono shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            {/* Base Salary Change */}
            <div className="md:col-span-2 rounded-xl border border-slate-100 bg-slate-50/50 p-4">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 uppercase tracking-wider mb-3">
                <DollarSign className="h-4 w-4 text-emerald-500 p-0.5 rounded-full bg-emerald-100" /> Financial Details
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[11px] font-semibold text-slate-500">New Base Salary</label>
                    <span className="text-[10px] font-bold text-slate-400">Current: {new Intl.NumberFormat("en-EG").format(currentSalary)} EGP</span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder={currentSalary}
                      value={newSalary}
                      onChange={(e) => setNewSalary(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 pl-8 text-sm font-semibold shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                      £
                    </span>
                  </div>
                  {(() => {
                    const parsed = parseFloat(newSalary);
                    if (!isNaN(parsed) && currentSalary > 0 && parsed !== currentSalary) {
                      const diff = parsed - currentSalary;
                      const percent = ((diff / currentSalary) * 100).toFixed(1).replace(/\.0$/, '');
                      const isIncrease = diff > 0;
                      return (
                        <div className={`mt-2 flex items-center gap-1.5 text-[10px] font-bold ${isIncrease ? 'text-emerald-600' : 'text-rose-600'}`}>
                          <span className={`px-1.5 py-0.5 rounded ${isIncrease ? 'bg-emerald-100/50' : 'bg-rose-100/50'}`}>
                            {isIncrease ? "+" : ""}{percent}%
                          </span>
                          <span>
                            {isIncrease ? "+" : "-"} {new Intl.NumberFormat("en-EG").format(Math.abs(diff))} EGP
                          </span>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
                
                <div className="flex-1 rounded-lg border border-indigo-100 bg-indigo-50/50 p-3 pt-3 flex items-start gap-3 mt-1 sm:mt-5 transition-colors hover:bg-indigo-50 hover:border-indigo-200">
                  <input 
                    type="checkbox" 
                    id="resetBtn"
                    checked={resetYearlyIncreaseDate}
                    onChange={(e) => setResetYearlyIncreaseDate(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer"
                  />
                  <div className="flex-1">
                    <label htmlFor="resetBtn" className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-900 cursor-pointer uppercase tracking-wide">
                      Reset Yearly Increase <Calendar className="h-3 w-3" />
                    </label>
                    <p className="text-[10px] text-indigo-700/70 mt-0.5 font-medium leading-tight">
                      Adjusting this resets their scheduled increase to exactly 1 year from today.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="md:col-span-2">
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                <FileText className="h-3.5 w-3.5 text-indigo-400" /> Transfer Notes & Reason
              </label>
              <textarea
                rows={3}
                placeholder="Briefly state the reason for this transfer or structural change..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!toDepartment}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/25 transition hover:shadow-xl hover:shadow-indigo-500/40 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
            >
              <Check className="h-4 w-4" /> Process Transfer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
