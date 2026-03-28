export function Modal({ open, title, onClose, children, maxWidth = "max-w-lg" }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className={`w-full ${maxWidth} rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl`}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">{title}</h2>
          <button className="rounded-xl border border-slate-200/60 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-100" onClick={onClose} type="button">
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
