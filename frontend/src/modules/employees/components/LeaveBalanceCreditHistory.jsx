/**
 * Table of manual annual leave balance credits (HR-added increases), newest first.
 * @param {{ credits?: Array<{ days: number, reason?: string, recordedBy?: string, recordedAt?: string }>, className?: string, compact?: boolean, maxRows?: number }} props
 */
export function LeaveBalanceCreditHistory({
  credits,
  className = "",
  compact = false,
  maxRows,
}) {
  if (!credits?.length) return null;

  const shown =
    typeof maxRows === "number" && maxRows > 0
      ? credits.slice(0, maxRows)
      : credits;
  const hiddenCount = credits.length - shown.length;

  const fmtWhen = (d) => {
    if (!d) return "—";
    return new Date(d).toLocaleString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const totalAllDays = credits.reduce((s, c) => s + (Number(c.days) || 0), 0);

  return (
    <div className={className}>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Balance credit history</h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Manual increases to vacation entitlement ·{" "}
          <span className="font-medium text-zinc-700 dark:text-zinc-300">{totalAllDays} day(s)</span> total
          {hiddenCount > 0
            ? ` · ${shown.length} most recent shown`
            : ""}
        </p>
      </div>
      <div
        className={`overflow-x-auto rounded-[20px] border border-zinc-200/90 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 ring-1 ring-zinc-950/[0.06] dark:ring-zinc-800 ${
          compact ? "" : "shadow-sm"
        }`}
      >
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-100 dark:border-zinc-800/50 bg-zinc-50/80 dark:bg-zinc-800/50">
              <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                When
              </th>
              <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                +Days
              </th>
              <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Reason
              </th>
              <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Recorded by
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {shown.map((c, i) => (
              <tr key={`${c.recordedAt}-${i}`} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/50">
                <td className="whitespace-nowrap px-3 py-2 text-xs text-zinc-600 dark:text-zinc-400">
                  {fmtWhen(c.recordedAt)}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  +{Number(c.days) || 0}
                </td>
                <td className="max-w-[min(28rem,55vw)] px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300">
                  {c.reason || "—"}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400">
                  {c.recordedBy || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
