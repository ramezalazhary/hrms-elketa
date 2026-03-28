export function DataTable({
  data,
  columns,
  emptyText = "No records found.",
  getRowKey,
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-card">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-zinc-50/80">
          <tr>
            {columns.map((column) => (
              <th
                className="border-b border-zinc-200 px-4 py-3 text-xs font-medium text-zinc-600 uppercase tracking-wide"
                key={column.key}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td className="px-4 py-8 text-center text-zinc-500" colSpan={columns.length}>
                {emptyText}
              </td>
            </tr>
          ) : (
            data.map((row, index) => (
              <tr
                className="border-b border-zinc-100 transition hover:bg-zinc-50/80 last:border-b-0"
                key={getRowKey?.(row, index) ?? index}
              >
                {columns.map((column) => (
                  <td className="px-4 py-3 text-zinc-800" key={column.key}>
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
