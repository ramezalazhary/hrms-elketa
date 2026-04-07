import { policyBranchDisplayName } from "./policyWorkLocationBranches";

/** Normalize location strings for matching policy rows to UI selections. */
function norm(s) {
  return (s == null ? "" : String(s)).trim();
}

function branchLabels(list) {
  return (Array.isArray(list) ? list : [])
    .map(policyBranchDisplayName)
    .filter(Boolean);
}

/**
 * Resolve branch display names for workplace pickers from organization policy.
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
  if (exact?.branches?.length) return [...branchLabels(exact.branches)];

  const merged = [
    ...new Set(inGov.flatMap((l) => branchLabels(l?.branches)).map(norm).filter(Boolean)),
  ];
  return merged;
}
