import { History } from "lucide-react";

export function ApprovalTimeline({ approvals = [] }) {
  if (!approvals.length) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
      {approvals.map((step, idx) => (
        <div key={`${step.role}-${idx}`} className="flex items-center gap-2">
          {idx > 0 ? <span className="text-zinc-300">→</span> : null}
          <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-1 text-zinc-700">
            {step.role === "MANAGEMENT" ? "Mgmt" : step.role} · {step.status}
          </span>
          {step.processedBy ? <span className="text-zinc-500">{step.processedBy}</span> : null}
        </div>
      ))}
    </div>
  );
}

export function AuditTimeline({ logs, loading, open, onToggle }) {
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={onToggle}
        className="inline-flex items-center gap-1 text-xs font-medium text-zinc-700 hover:underline"
      >
        <History className="h-3 w-3" />
        {loading ? "Loading..." : open ? "Hide audit trail" : "View audit trail"}
      </button>
      {open ? (
        <div className="mt-2 space-y-1">
          {!logs?.length ? <p className="text-xs text-zinc-400">No history entries.</p> : null}
          {(logs || []).map((log, index) => (
            <div key={index} className="rounded-md border border-zinc-100 bg-zinc-50 px-2 py-1 text-xs text-zinc-600">
              <span className="font-semibold text-zinc-800">{log.operation}</span>
              {" by "}
              <span className="font-medium">{log.performedBy}</span>
              {log.newValues?.comment ? ` — "${log.newValues.comment}"` : ""}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
