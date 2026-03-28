export function Modal({ open, title, onClose, children, maxWidth = "max-w-lg" }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/30 p-4 backdrop-blur-[2px]">
      <div className={`w-full ${maxWidth} rounded-lg border border-zinc-200 bg-white p-6 shadow-card`}>
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-base font-medium text-zinc-900">{title}</h2>
          <button
            className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-600 transition hover:bg-zinc-50 hover:text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-300"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
