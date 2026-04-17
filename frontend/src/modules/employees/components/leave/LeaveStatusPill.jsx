const MAP = {
  PENDING: "bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-400",
  ESCALATED: "bg-violet-100 dark:bg-violet-500/20 text-violet-800 dark:text-violet-400",
  APPROVED: "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-400",
  REJECTED: "bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-400",
  CANCELLED: "bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-400",
  PAID: "bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-400",
  UNPAID: "bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-400",
};

export function LeaveStatusPill({ status, label }) {
  const key = String(status || "").toUpperCase();
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${MAP[key] || "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"}`}>
      {label || key || "UNKNOWN"}
    </span>
  );
}
