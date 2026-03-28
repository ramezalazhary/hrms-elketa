export function Pagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;

  return (
    <div className="mt-4 flex items-center justify-end gap-2 text-sm text-zinc-600">
      <button
        className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        type="button"
      >
        Prev
      </button>
      <span className="px-2 tabular-nums">
        Page {page} / {totalPages}
      </span>
      <button
        className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        type="button"
      >
        Next
      </button>
    </div>
  );
}
