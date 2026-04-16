const MAP = {
  PENDING: "bg-amber-100 text-amber-800",
  ESCALATED: "bg-violet-100 text-violet-800",
  APPROVED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-rose-100 text-rose-800",
  CANCELLED: "bg-zinc-200 text-zinc-700",
  PAID: "bg-blue-100 text-blue-800",
  UNPAID: "bg-rose-100 text-rose-800",
};

export function LeaveStatusPill({ status, label }) {
  const key = String(status || "").toUpperCase();
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${MAP[key] || "bg-zinc-100 text-zinc-700"}`}>
      {label || key || "UNKNOWN"}
    </span>
  );
}
