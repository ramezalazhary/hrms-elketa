/**
 * Single place for punch vs shift timing: status, late minutes for tiers, monthly grace quota.
 * Used by attendance routes (finalize) and monthly analysis so results stay aligned.
 */
import { parseTimeToMinutes } from "./excuseAttendance.js";
import { parseAttendanceClock } from "./attendanceClockParse.js";
import { weeklyRestDaySet } from "./weeklyRestDays.js";
import { isHolidayForEmployee } from "./isHolidayForEmployee.js";

/**
 * Seconds added to `floor(fromMinutes * 60)` so tier matching never treats the exact
 * boundary instant as inside the band (avoids double hits between tiers).
 */
export const TIER_BOUNDARY_EPSILON_SEC = 1;

/** @param {Date} d */
export function utcCalendarDayKey(d) {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x.toISOString().slice(0, 10);
}

export function clockToSecOfDay(t) {
  return t ? t.h * 3600 + t.m * 60 + t.s : null;
}

function toSec(t) {
  return clockToSecOfDay(t);
}

/**
 * Whole seconds elapsed after shift start until check-in (same-day wall clock).
 * @param {string | null | undefined} checkInStr
 * @param {string} shiftStartStr
 */
export function lateSecondsAfterShiftStart(checkInStr, shiftStartStr) {
  const tIn = parseAttendanceClock(checkInStr);
  const tSh = parseAttendanceClock(shiftStartStr || "09:00");
  if (!tIn || !tSh) return 0;
  return Math.max(0, toSec(tIn) - toSec(tSh));
}

/**
 * Convert policy tiers (fractional minutes from shift start) to inclusive second intervals:
 * `[floor(from*60)+1, floor(to*60)]` on the lateness timeline.
 * @param {{ fromMinutes: number, toMinutes: number, deductionDays: number }[]} tiers
 * @returns {{ lo: number, hi: number, deductionDays: number }[]}
 */
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

/**
 * Match `lateSec` to a tier. Above the last tier's `hi`, the last tier's deduction still applies.
 * @param {number} lateSec
 * @param {{ fromMinutes: number, toMinutes: number, deductionDays: number }[]} tiers
 */
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

/**
 * Validate tiers for save: each interval well-formed; sorted; no overlap; contiguous (next.lo === prev.hi + 1).
 * @param {{ fromMinutes: number, toMinutes: number, deductionDays: number }[]} tiers
 * @returns {{ ok: boolean, message?: string }}
 */
export function validateLateDeductionTiersForSave(tiers) {
  if (!Array.isArray(tiers) || tiers.length === 0) return { ok: true };
  const bad = tiers.find(
    (t) =>
      !t ||
      !Number.isFinite(Number(t.fromMinutes)) ||
      !Number.isFinite(Number(t.toMinutes)),
  );
  if (bad) return { ok: false, message: "Each late tier needs numeric fromMinutes and toMinutes." };
  const intervals = tierIntervalsSecondsFromPolicy(tiers);
  if (intervals.length !== tiers.length) {
    return {
      ok: false,
      message:
        "Late tier bounds invalid for second-resolution rules (need toMinutes large enough that floor(to×60) ≥ floor(from×60)+1).",
    };
  }
  for (let i = 0; i < intervals.length - 1; i++) {
    const a = intervals[i];
    const b = intervals[i + 1];
    if (b.lo <= a.hi) {
      return { ok: false, message: "Late deduction tiers overlap when converted to whole seconds." };
    }
    if (b.lo !== a.hi + 1) {
      return {
        ok: false,
        message:
          "Late tiers must be contiguous in seconds: each tier's start must be exactly 1 second after the previous tier's end.",
      };
    }
  }
  return { ok: true };
}

/**
 * @param {string | null | undefined} checkInStr
 * @param {string} shiftStartStr
 * @param {number} graceMinutes
 * @returns {boolean} true if strictly after shift start and not after shift+grace (second precision).
 */
export function isGraceBandArrival(checkInStr, shiftStartStr, graceMinutes) {
  const t1 = parseAttendanceClock(checkInStr);
  const shiftStart = parseAttendanceClock(shiftStartStr || "09:00");
  if (!t1 || !shiftStart || !Number.isFinite(graceMinutes) || graceMinutes <= 0) return false;
  const checkInSec = toSec(t1);
  const startSec = toSec(shiftStart);
  const limitSec = startSec + graceMinutes * 60;
  return checkInSec > startSec && checkInSec <= limitSec;
}

/** Late covered by excuse does not consume monthly grace quota. */
export function isLateExcusedAttendanceRow(row) {
  if (!row) return false;
  return (
    row.originalStatus === "LATE" &&
    (
      row.status === "EXCUSED" ||
      row.status === "PARTIAL_EXCUSED" ||
      row.excuseCovered === true
    )
  );
}

/**
 * @param {object} policy - standardStartTime, standardEndTime, gracePeriod or gracePeriodMinutes
 * @param {{ lateGraceAddMinutes?: number }} [options] - minutes added after shift start before LATE; default from policy
 */
export function calculateTimingStatus(checkIn, checkOut, policy, options = {}) {
  const t1 = parseAttendanceClock(checkIn);
  const t2 = parseAttendanceClock(checkOut);
  const shiftStart = parseAttendanceClock(policy.standardStartTime || "09:00");
  const shiftEnd = parseAttendanceClock(policy.standardEndTime || "17:00");
  const baseGrace =
    policy.gracePeriod ?? policy.gracePeriodMinutes ?? 15;
  const lateGraceAddMinutes =
    options.lateGraceAddMinutes !== undefined
      ? options.lateGraceAddMinutes
      : baseGrace;

  const format24h = (t) => {
    if (!t) return null;
    return `${t.h.toString().padStart(2, "0")}:${t.m.toString().padStart(2, "0")}:${t.s.toString().padStart(2, "0")}`;
  };

  if (t1 && !t2) {
    return {
      t1,
      t2: null,
      totalHours: 0,
      status: "INCOMPLETE",
      checkInStr: format24h(t1),
      checkOutStr: null,
    };
  }

  const totalHours =
    t1 && t2
      ? parseFloat(
        (
          t2.h + t2.m / 60 + t2.s / 3600 -
          (t1.h + t1.m / 60 + t1.s / 3600)
        ).toFixed(2),
      )
      : 0;

  let status = "PRESENT";

  if (t1 && shiftStart) {
    const checkInSec = toSec(t1);
    const limitSec = toSec(shiftStart) + lateGraceAddMinutes * 60;
    if (checkInSec > limitSec) {
      status = "LATE";
    }
  }

  if (status === "PRESENT" && t2 && shiftEnd) {
    const checkOutSec = toSec(t2);
    const endSec = toSec(shiftEnd);
    if (checkOutSec < endSec) {
      status = "EARLY_DEPARTURE";
    }
  }

  return {
    t1,
    t2,
    totalHours,
    status,
    checkInStr: format24h(t1),
    checkOutStr: format24h(t2),
  };
}

/**
 * Minutes after shift start used for late tier matching (fractional if seconds present).
 * When `lateGraceAddMinutes` is 0, lateness is measured from shift start (grace band becomes part of lateness).
 * @param {string} checkInStr
 * @param {{ standardStartTime?: string, gracePeriodMinutes?: number }} policy
 * @param {{ lateGraceAddMinutes: number }} opts
 */
export function lateMinutesForTiers(checkInStr, policy, opts) {
  const startMin = parseTimeToMinutes(policy.standardStartTime || "09:00");
  const checkInMin = parseTimeToMinutes(checkInStr);
  const lateGraceAddMinutes = opts.lateGraceAddMinutes;
  if (startMin == null || checkInMin == null || !Number.isFinite(lateGraceAddMinutes)) return 0;
  const threshold = startMin + lateGraceAddMinutes;
  return checkInMin > threshold ? checkInMin - startMin : 0;
}

/**
 * Late tier `deductionDays` when monthly grace quota is exhausted (`lateGraceAddMinutes === 0`)
 * while policy `gracePeriodMinutes` (`baseGraceMinutes`) is positive.
 *
 * Uses {@link lateSecondsAfterShiftStart} + {@link deductionForLateTiersSeconds}. After exhaustion,
 * lateness inside the former grace window (or before the first tier's inclusive second `lo`)
 * uses the **first tier's** `deductionDays`.
 *
 * @param {string | null | undefined} checkInStr
 * @param {string} shiftStartStr
 * @param {{ fromMinutes: number, toMinutes: number, deductionDays: number }[]} tiers
 * @param {number} baseGraceMinutes - policy grace (whole minutes)
 * @param {number} lateGraceAddMinutes - effective add for lateness threshold (0 when exhausted)
 */
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

export function effectiveLateGraceAddMinutes({
  monthlyGraceUsesEnabled,
  monthlyGraceUsesAllowed,
  graceUsesBeforeTargetDate,
  baseGraceMinutes,
}) {
  if (!monthlyGraceUsesEnabled || !Number.isFinite(monthlyGraceUsesAllowed) || monthlyGraceUsesAllowed <= 0) {
    return baseGraceMinutes;
  }
  if (!Number.isFinite(graceUsesBeforeTargetDate) || graceUsesBeforeTargetDate < 0) {
    return baseGraceMinutes;
  }
  if (graceUsesBeforeTargetDate >= monthlyGraceUsesAllowed) {
    return 0;
  }
  return baseGraceMinutes;
}

/**
 * Dynamic count: prior calendar days in the fiscal month (strictly before `targetUtcMidnight`)
 * that consumed one monthly grace slot. Recomputed from stored rows + punches (no separate counter field).
 *
 * @param {object} p
 * @param {Array<object>} p.sortedMonthRowsAsc - Attendance lean docs, sorted by `date` ascending
 * @param {Date} p.targetUtcMidnight
 * @param {string} p.shiftStartStr
 * @param {number} p.baseGraceMinutes
 * @param {boolean} p.monthlyGraceUsesEnabled
 * @param {number} p.monthlyGraceUsesAllowed
 * @param {unknown} p.weeklyRestDays
 * @param {Array} p.holidays
 * @param {string|import("mongoose").Types.ObjectId} p.employeeId
 * @param {unknown} p.departmentId
 */
export function countMonthlyGraceUsesBeforeTarget({
  sortedMonthRowsAsc,
  targetUtcMidnight,
  shiftStartStr,
  baseGraceMinutes,
  monthlyGraceUsesEnabled,
  monthlyGraceUsesAllowed,
  weeklyRestDays,
  holidays,
  employeeId,
  departmentId,
}) {
  if (!monthlyGraceUsesEnabled || !monthlyGraceUsesAllowed || monthlyGraceUsesAllowed <= 0) return 0;
  if (!Array.isArray(sortedMonthRowsAsc) || sortedMonthRowsAsc.length === 0) return 0;

  const targetKey = utcCalendarDayKey(targetUtcMidnight);
  const rest = weeklyRestDaySet(weeklyRestDays);
  let n = 0;

  for (const row of sortedMonthRowsAsc) {
    const rowKey = utcCalendarDayKey(row.date);
    if (rowKey >= targetKey) break;

    const dow = new Date(row.date).getUTCDay();
    if (rest.has(dow)) continue;

    if (row.status === "HOLIDAY") continue;
    if (isHolidayForEmployee(holidays, rowKey, employeeId, departmentId).isHoliday) continue;

    if (row.status === "ON_LEAVE" || row.onApprovedLeave) continue;
    if (row.status === "ABSENT" && !row.checkIn) continue;

    if (isLateExcusedAttendanceRow(row)) continue;

    if (!row.checkIn) continue;
    if (!isGraceBandArrival(row.checkIn, shiftStartStr, baseGraceMinutes)) continue;

    n += 1;
  }
  return n;
}
