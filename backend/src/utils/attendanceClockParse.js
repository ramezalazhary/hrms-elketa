/**
 * Parse punch / shift clock values (string, Date, or Excel fractional day).
 * Shared by attendance routes and timing core so status math stays identical.
 * @param {unknown} timeStr
 * @returns {{ h: number, m: number, s: number } | null}
 */
export function parseAttendanceClock(timeStr) {
  if (timeStr === undefined || timeStr === null || timeStr === "") return null;
  if (timeStr instanceof Date) {
    return {
      h: timeStr.getHours(),
      m: timeStr.getMinutes(),
      s: timeStr.getSeconds(),
    };
  }

  if (typeof timeStr === "number") {
    const totalSeconds = Math.round(timeStr * 86400);
    return {
      h: Math.floor(totalSeconds / 3600),
      m: Math.floor((totalSeconds % 3600) / 60),
      s: totalSeconds % 60,
    };
  }

  const str = timeStr.toString().trim().toUpperCase();
  const match = str.match(/(\d+):(\d+)(?::(\d+))?\s*(AM|PM)?/i);
  if (!match) return null;

  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const s = match[3] ? parseInt(match[3], 10) : 0;
  const ampm = match[4];

  if (ampm === "PM" && h < 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;

  return { h, m, s };
}
