export function LeaveSectionHeader({ title, subtitle, actions }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 px-5 py-4">
      <div>
        <h2 className="leave-title text-base font-semibold leading-tight text-zinc-900 dark:text-zinc-50">{title}</h2>
        {subtitle ? <p className="leave-meta mt-1 text-sm text-zinc-500 dark:text-zinc-400">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}
