/**
 * Mirrors backend/src/utils/attendanceTimingCore.js tier + monthly-grace exhaustion
 * so Organization Rules can preview deduction days from the user's tier table.
 */

const TIER_BOUNDARY_EPSILON_SEC = 1;

export function parseClockToSec(clockStr) {
  const parts = String(clockStr ?? "09:00:00").trim().split(":");
  const h = Number(parts[0]) || 0;
  const m = Number(parts[1]) || 0;
  const s = parts.length > 2 ? Number(parts[2]) || 0 : 0;
  return h * 3600 + m * 60 + s;
}

export function formatSecToHms(totalSec) {
  const t = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(t / 3600) % 24;
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export function addSecondsToClock(shiftStr, deltaSec) {
  return formatSecToHms(parseClockToSec(shiftStr) + deltaSec);
}

export function lateSecondsAfterShiftStart(checkInStr, shiftStartStr) {
  const a = parseClockToSec(checkInStr);
  const b = parseClockToSec(shiftStartStr || "09:00:00");
  return Math.max(0, a - b);
}

export function tierIntervalsSecondsFromPolicy(tiers) {
  if (!Array.isArray(tiers)) return [];
  return [...tiers]
    .map((t) => {
      const fromM = Number(t.fromMinutes);
      const toM = Number(t.toMinutes);
      if (!Number.isFinite(fromM) || !Number.isFinite(toM)) return null;
      const lo = Math.floor(fromM * 60) + TIER_BOUNDARY_EPSILON_SEC;
      const hi = Math.floor(toM * 60);
      const deductionDays = Math.max(0, Number(t.deductionDays) || 0);
      return { lo, hi, deductionDays };
    })
    .filter((x) => x && x.hi >= x.lo)
    .sort((a, b) => a.lo - b.lo);
}

export function deductionForLateTiersSeconds(lateSec, tiers) {
  const intervals = tierIntervalsSecondsFromPolicy(tiers);
  if (intervals.length === 0 || !Number.isFinite(lateSec) || lateSec <= 0) return 0;
  for (const iv of intervals) {
    if (lateSec >= iv.lo && lateSec <= iv.hi) return iv.deductionDays;
  }
  const last = intervals[intervals.length - 1];
  if (lateSec > last.hi) return last.deductionDays;
  return 0;
}

/** Same contract as backend `deductionForLateWithMonthlyGraceExhaustion`. */
export function deductionForLateWithMonthlyGraceExhaustion(
  checkInStr,
  shiftStartStr,
  tiers,
  baseGraceMinutes,
  lateGraceAddMinutes,
) {
  const lateSec = lateSecondsAfterShiftStart(checkInStr, shiftStartStr);
  if (!Array.isArray(tiers) || tiers.length === 0 || lateSec <= 0) return 0;
  const intervals = tierIntervalsSecondsFromPolicy(tiers);
  if (intervals.length === 0) return 0;
  const first = intervals[0];
  const exhaustedWindow =
    lateGraceAddMinutes === 0 &&
    Number.isFinite(baseGraceMinutes) &&
    baseGraceMinutes > 0;
  const baseGraceSec = Math.max(0, Math.floor(baseGraceMinutes * 60));
  if (exhaustedWindow && (lateSec <= baseGraceSec || lateSec < first.lo)) {
    return first.deductionDays;
  }
  return deductionForLateTiersSeconds(lateSec, tiers);
}

export function isLateByPolicy(checkInStr, shiftStartStr, lateGraceAddMinutes) {
  const limit = parseClockToSec(shiftStartStr) + lateGraceAddMinutes * 60;
  return parseClockToSec(checkInStr) > limit;
}
