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
