/** Stored tier bounds: fractional minutes after shift start (API) ↔ `mm:ss` in UI. */

export function lateTierMmSsFromStoredMinutes(m) {
  const n = Number(m);
  if (!Number.isFinite(n) || n < 0) return "0:00";
  const totalSec = Math.round(n * 60);
  const mm = Math.floor(totalSec / 60);
  const ss = totalSec % 60;
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

/** Whole minutes, or `mm:ss` with seconds 0–59. Invalid → `null`. */
export function parseMmSsToStoredMinutes(str) {
  let t = String(str ?? "").trim();
  if (!t) return 0;
  t = t.replace(/\s/g, "");
  if (/^\d+$/.test(t)) return Math.max(0, parseInt(t, 10));
  let normalized = t;
  if (normalized.endsWith(":")) normalized += "00";
  const m = normalized.match(/^(\d+):(\d{1,2})$/);
  if (!m) return null;
  const mm = Math.max(0, parseInt(m[1], 10));
  const ss = parseInt(m[2], 10);
  if (!Number.isFinite(ss) || ss < 0 || ss > 59) return null;
  return mm + ss / 60;
}

export function formatLateTierStoredRange(fromMinutes, toMinutes) {
  return `[${lateTierMmSsFromStoredMinutes(fromMinutes)}–${lateTierMmSsFromStoredMinutes(toMinutes)})`;
}
