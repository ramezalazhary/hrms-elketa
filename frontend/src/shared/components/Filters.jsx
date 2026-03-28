export function Filters({
  search,
  onSearchChange,
  placeholder = 'Search...',
}) {
  return (
    <div className="mb-3 flex gap-2">
      <input
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 focus:border-blue-500 focus:outline-none"
        placeholder={placeholder}
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
      />
      <button
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-700 transition hover:bg-slate-50"
        onClick={() => onSearchChange('')}
        type="button"
      >
        Clear
      </button>
    </div>
  )
}
