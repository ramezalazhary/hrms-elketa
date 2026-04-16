import { useState } from "react";
import { UserX, CalendarX2, AlertTriangle, X, Check, FileText } from "lucide-react";

export function TerminateEmployeeModal({ employee, onClose, onSubmit }) {
  const [status, setStatus] = useState("TERMINATED");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      status,
      terminationDate: date,
      terminationReason: reason
    });
  };

  const getInitials = (name) => {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/);
    return (parts[0]?.[0] + (parts[1]?.[0] || "")).toUpperCase();
  };

  const AVATAR_COLORS = [
    "from-zinc-500 to-zinc-700",
    "from-stone-500 to-stone-700",
    "from-neutral-500 to-neutral-700",
    "from-zinc-600 to-stone-600",
  ];

  const getAvatarColor = (name) => {
    let h = 0;
    for (let i = 0; i < (name || "").length; i++) h = (Math.imul(31, h) + name.charCodeAt(i)) | 0;
    return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-300">
      <div className="relative w-full max-w-lg overflow-hidden rounded-[20px] border border-zinc-200/90 bg-white shadow-2xl ring-1 ring-zinc-950/[0.06] animate-in zoom-in-95 duration-300">
        <div className="pointer-events-none absolute right-0 top-0 -mr-16 -mt-16 h-48 w-48 rounded-full bg-rose-500/[0.07] blur-3xl" />
        <div className="pointer-events-none absolute left-0 bottom-0 -ml-16 -mb-16 h-32 w-32 rounded-full bg-zinc-400/[0.06] blur-2xl" />
        
        <div className="relative p-6 sm:p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${getAvatarColor(employee.fullName)} text-lg font-black text-white shadow-lg ring-4 ring-white`}>
                  {getInitials(employee.fullName)}
                </div>
                <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-rose-500 text-white ring-2 ring-white">
                  <UserX className="h-3.5 w-3.5" />
                </div>
              </div>
              <div>
                <h2 className="text-xl font-black text-zinc-900 tracking-tight leading-tight">Terminate Employment</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm font-semibold text-zinc-500 truncate">{employee.fullName}</span>
                  <span className="h-1 w-1 rounded-full bg-zinc-300" />
                  <span className="font-mono text-[11px] font-bold text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded uppercase tracking-wider">{employee.employeeCode || "EMP-000"}</span>
                </div>
              </div>
            </div>
            <button 
              type="button" 
              onClick={onClose}
              className="flex items-center justify-center h-10 w-10 rounded-2xl text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-all duration-200 active:scale-90"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="relative flex flex-col gap-6">
            {/* Warning Box */}
            <div className="flex items-start gap-4 p-4 rounded-2xl bg-rose-50 border border-rose-100 shadow-sm ring-1 ring-rose-200/50">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-rose-500 shadow-sm border border-rose-100">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-bold text-rose-900 mb-1 leading-none">Important Action</h4>
                <p className="text-xs font-medium text-rose-700/80 leading-relaxed">
                  Marking this employee as separated will move them to the "Separated" list and restrict their system access immediately after the specified exit date.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Exit Type Selection */}
              <div className="space-y-2">
                <label className="block text-[11px] font-black text-zinc-500 uppercase tracking-widest ml-1">
                  Exit Classification
                </label>
                <div className="flex p-1 bg-zinc-100 rounded-2xl border border-zinc-200/60 shadow-inner">
                  <button
                    type="button"
                    onClick={() => setStatus("TERMINATED")}
                    className={`flex-1 flex items-center justify-center py-2.5 text-xs font-bold rounded-xl transition-all duration-200 ${
                      status === "TERMINATED" 
                        ? "bg-white text-rose-600 shadow-md ring-1 ring-rose-200/50" 
                        : "text-zinc-500 hover:text-zinc-700 hover:bg-zinc-200/50 uppercase tracking-wider"
                    }`}
                  >
                    Termination
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatus("RESIGNED")}
                    className={`flex-1 flex items-center justify-center py-2.5 text-xs font-bold rounded-xl transition-all duration-200 ${
                      status === "RESIGNED" 
                        ? "bg-white text-zinc-900 shadow-md ring-1 ring-zinc-200/70" 
                        : "text-zinc-500 hover:text-zinc-700 hover:bg-zinc-200/50 uppercase tracking-wider"
                    }`}
                  >
                    Resignation
                  </button>
                </div>
              </div>

              {/* Exit Date */}
              <div className="space-y-2">
                <label className="block text-[11px] font-black text-zinc-500 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                  <CalendarX2 className="h-3 w-3" /> Effective Date
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-bold text-zinc-800 shadow-sm transition-all focus:border-rose-400 focus:outline-none focus:ring-4 focus:ring-rose-500/10 placeholder:text-zinc-300"
                />
              </div>
            </div>

            {/* Reason Textarea */}
            <div className="space-y-2">
              <label className="block text-[11px] font-black text-zinc-500 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                <FileText className="h-3 w-3" /> Reason for Departure
              </label>
              <textarea
                required
                rows={3}
                placeholder="Briefly describe the reason for termination or resignation..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-800 shadow-sm transition-all focus:border-rose-400 focus:outline-none focus:ring-4 focus:ring-rose-500/10 resize-none placeholder:text-zinc-400"
              />
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100 mt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-2xl px-6 py-3 text-sm font-bold text-zinc-500 hover:bg-zinc-100 transition-all duration-200 active:scale-95"
              >
                Go Back
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-full bg-rose-600 px-8 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 active:scale-[0.98] motion-reduce:active:scale-100"
              >
                <Check className="h-4 w-4" /> Confirm & Process
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
