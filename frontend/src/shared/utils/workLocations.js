/** Normalize location strings for matching policy rows to UI selections. */
function norm(s) {
  return (s == null ? "" : String(s)).trim();
}

/**
 * Resolve branch names for Work Location dropdown from organization policy.
 * Matches exact governorate + city first; if none (common when policy uses
 * different city labels than the governorate picker), falls back to all
 * branches registered under the same governorate.
 */
export function resolveBranchesFromPolicy(policyLocations, governorate, city) {
  const rows = Array.isArray(policyLocations) ? policyLocations : [];
  const g = norm(governorate);
  const c = norm(city);
  if (!g) return [];

  const inGov = rows.filter((l) => norm(l?.governorate) === g);
  if (!inGov.length) return [];

  const exact = inGov.find((l) => norm(l?.city) === c);
  if (exact?.branches?.length) return [...exact.branches];

  const merged = [
    ...new Set(inGov.flatMap((l) => (Array.isArray(l?.branches) ? l.branches : []).map(norm)).filter(Boolean)),
  ];
  return merged;
}
