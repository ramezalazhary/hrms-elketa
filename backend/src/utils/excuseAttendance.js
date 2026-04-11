/**
 * Parse "HH:mm" or "HH:mm:ss" to minutes from midnight.
 * @param {string | null | undefined} s
 * @returns {number | null}
 */
export function parseTimeToMinutes(s) {
  if (!s || typeof s !== "string") return null;
  const m = s.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/**
 * Approved excuse removes "late" if check-in is covered by excuse window or
 * excuse extends past shift start and check-in is before excuse end (pre-work permission).
 */
export function excuseCoversLateCheckIn(
  checkInMin,
  excuseStartMin,
  excuseEndMin,
  shiftStartMin,
  graceMin,
) {
  const lateThreshold = shiftStartMin + graceMin;
  if (checkInMin <= lateThreshold) return false;
  if (checkInMin >= excuseStartMin && checkInMin <= excuseEndMin) return true;
  if (excuseEndMin > shiftStartMin && checkInMin <= excuseEndMin) return true;
  return false;
}

/**
 * Compute total credited minutes from mid-day excuses.
 * Only counts excuse windows that are fully within the work day
 * (i.e. excuse start > shift start + grace).
 * @param {Array<{startTime:string, endTime:string}>} excuses - approved excuses for the day
 * @param {number} shiftStartMin - shift start in minutes from midnight
 * @param {number} shiftEndMin - shift end in minutes from midnight
 * @param {number} graceMin - grace period in minutes
 * @returns {{ creditMinutes: number, coversEndOfDay: boolean }}
 */
export function computeMidDayExcuseCredit(excuses, shiftStartMin, shiftEndMin, graceMin) {
  let creditMinutes = 0;
  let coversEndOfDay = false;

  for (const ex of excuses) {
    const es = parseTimeToMinutes(ex.startTime);
    const ee = parseTimeToMinutes(ex.endTime);
    if (es == null || ee == null || ee <= es) continue;

    const lateThreshold = shiftStartMin + graceMin;
    if (es <= lateThreshold) continue;

    creditMinutes += (ee - es);

    if (ee >= shiftEndMin) {
      coversEndOfDay = true;
    }
  }

  return { creditMinutes, coversEndOfDay };
}
