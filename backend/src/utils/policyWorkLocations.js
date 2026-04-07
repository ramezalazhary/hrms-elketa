/**
 * Organization policy workplaces: branch entries align with {@link ../models/Branch.js Branch}
 * (name, code, insuranceNumber, location[], city, country, managerId?, status).
 * Legacy DB rows may still store branch labels as plain strings; normalize on read/write.
 */

const STATUSES = ["ACTIVE", "INACTIVE", "CLOSED"];

function normStr(v) {
  return v == null ? "" : String(v).trim();
}

/**
 * Coerce one branch entry from client/legacy to a plain object for persistence.
 * @param {unknown} b
 * @param {string} parentCity
 * @returns {Record<string, unknown>|null}
 */
export function sanitizePolicyBranch(b, parentCity) {
  const pc = normStr(parentCity);

  if (typeof b === "string") {
    const name = b.trim();
    if (!name) return null;
    return {
      name,
      code: undefined,
      insuranceNumber: undefined,
      location: [],
      city: pc || undefined,
      country: "Egypt",
      status: "ACTIVE",
    };
  }

  if (!b || typeof b !== "object") return null;

  const name = normStr(b.name);
  const code = normStr(b.code).toUpperCase();
  if (!name && !code) return null;

  let location = [];
  if (Array.isArray(b.location)) {
    location = b.location.map((x) => normStr(x)).filter(Boolean);
  } else if (typeof b.location === "string" && b.location.trim()) {
    location = b.location
      .split(/[,،;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  const out = {
    name: name || code,
    location,
    city: normStr(b.city) || pc || undefined,
    country: normStr(b.country) || "Egypt",
    status: STATUSES.includes(b.status) ? b.status : "ACTIVE",
  };

  if (code) out.code = code;
  const ins = normStr(b.insuranceNumber);
  if (ins) out.insuranceNumber = ins;
  const mid = b.managerId != null ? String(b.managerId).trim() : "";
  if (/^[a-f\d]{24}$/i.test(mid)) out.managerId = mid;

  return out;
}

/**
 * Sanitize full workLocations payload for DB (PUT / internal save).
 * @param {unknown} workLocations
 * @returns {Array<{ governorate: string, city: string, branches: object[] }>}
 */
export function sanitizeWorkLocationsForSave(workLocations) {
  const rows = Array.isArray(workLocations) ? workLocations : [];
  return rows
    .filter((loc) => normStr(loc?.governorate) && normStr(loc?.city))
    .map((loc) => {
      const parentGov = normStr(loc.governorate);
      const parentCity = normStr(loc.city);
      const branches = (loc.branches || [])
        .map((b) => sanitizePolicyBranch(b, parentCity))
        .filter(Boolean);
      return { governorate: parentGov, city: parentCity, branches };
    });
}

/**
 * Normalize workLocations for JSON API responses (legacy strings → branch-shaped objects).
 * @param {unknown} workLocations
 */
export function normalizeWorkLocationsForApiResponse(workLocations) {
  const rows = Array.isArray(workLocations) ? workLocations : [];
  return rows.map((loc) => {
    const parentCity = normStr(loc?.city);
    const parentGov = normStr(loc?.governorate);
    const branches = (loc?.branches || [])
      .map((b) => sanitizePolicyBranch(b, parentCity))
      .filter(Boolean);
    return { governorate: parentGov, city: parentCity, branches };
  });
}
