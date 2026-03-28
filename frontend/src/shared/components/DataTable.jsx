export function DataTable({
  data,
  columns,
  emptyText = 'No records found.',
  getRowKey,
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-slate-50">
          <tr>
          {columns.map((column) => (
            <th className="border-b border-slate-200 px-4 py-3 font-semibold text-slate-700" key={column.key}>
              {column.header}
            </th>
          ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td className="px-4 py-8 text-center text-slate-500" colSpan={columns.length}>
                {emptyText}
              </td>
            </tr>
          ) : (
            data.map((row, index) => (
              <tr className="border-b border-slate-100 transition hover:bg-slate-50 last:border-b-0" key={getRowKey?.(row, index) ?? index}>
                {columns.map((column) => (
                  <td className="px-4 py-3 text-slate-700" key={column.key}>
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
