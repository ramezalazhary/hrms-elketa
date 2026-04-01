export function Layout({ title, description, actions, children, className = "max-w-6xl", hideHeader = false }) {
  return (
    <section className={`space-y-8 ${className}`}>
      {!hideHeader && (
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-200 pb-6">
          <div>
            <h1 className="text-lg font-medium tracking-tight text-zinc-900">{title}</h1>
            {description ? (
              <p className="mt-1 text-sm text-zinc-500 font-normal">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </header>
      )}
      <div className="text-zinc-800">{children}</div>
    </section>
  );
}
