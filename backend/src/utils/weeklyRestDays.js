/**
 * Weekly rest days use JavaScript Date UTC weekday: 0 = Sunday … 6 = Saturday.
 * Default [5, 6] matches Egypt-style Friday–Saturday weekend.
 */

export const DEFAULT_WEEKLY_REST_DAYS_UTC = [5, 6];

/**
 * @param {unknown} value - from OrganizationPolicy.attendanceRules.weeklyRestDays
 * @returns {number[]} sorted unique integers in 0–6; empty array means no weekly rest (all days can be working days)
 */
export function normalizeWeeklyRestDays(value) {
  if (value === undefined || value === null) return [...DEFAULT_WEEKLY_REST_DAYS_UTC];
  if (!Array.isArray(value)) return [...DEFAULT_WEEKLY_REST_DAYS_UTC];
  const set = new Set();
  for (const x of value) {
    const n = Math.floor(Number(x));
    if (n >= 0 && n <= 6) set.add(n);
  }
  return [...set].sort((a, b) => a - b);
}

/**
 * @param {unknown} value
 * @returns {Set<number>}
 */
export function weeklyRestDaySet(value) {
  return new Set(normalizeWeeklyRestDays(value));
}
