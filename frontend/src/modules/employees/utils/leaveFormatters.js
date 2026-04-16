export function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function fmtDateTime(d) {
  if (!d) return "—";
  return new Date(d).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmtDays(n) {
  const x = Number(n);
  if (Number.isNaN(x)) return "—";
  return Math.abs(x % 1) < 1e-9 ? String(x) : x.toFixed(1);
}

export function fmtMins(m) {
  const x = Number(m);
  if (Number.isNaN(x)) return "—";
  if (x >= 60 && x % 60 === 0) return `${x / 60} h`;
  return `${x} min`;
}
