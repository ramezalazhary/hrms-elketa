export function LeaveSurface({ children, elevated = false, className = "" }) {
  return (
    <section className={`leave-surface ${elevated ? "leave-elevated" : ""} ${className}`}>
      {children}
    </section>
  );
}
