export function Layout({ title, description, actions, children, className = "max-w-6xl", hideHeader = false }) {
  return (
    <section className={`space-y-8 ${className}`}>
      {!hideHeader && (
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-6">
          <div>
            <h1 className="text-lg font-medium tracking-tight text-zinc-900 dark:text-zinc-100">{title}</h1>
            {description ? (
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400 font-normal">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </header>
      )}
      <div className="text-zinc-800 dark:text-zinc-200">{children}</div>
    </section>
  );
}
