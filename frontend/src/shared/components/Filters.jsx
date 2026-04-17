export function Filters({
  search,
  onSearchChange,
  placeholder = "Search...",
}) {
  return (
    <div className="mb-3 flex gap-2">
      <input
        className="w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400"
        placeholder={placeholder}
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
      />
      <button
        className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 transition hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
        onClick={() => onSearchChange("")}
        type="button"
      >
        Clear
      </button>
    </div>
  );
}
