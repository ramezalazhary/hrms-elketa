export function LeaveSectionHeader({ title, subtitle, actions }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3 border-b border-zinc-100 px-5 py-4">
      <div>
        <h2 className="leave-title text-base font-semibold">{title}</h2>
        {subtitle ? <p className="leave-meta mt-1 text-sm">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}
