/**
 * Helpers for organization policy workplace branches (aligned with Branch model).
 * Entries may be legacy strings or objects { name, code, location[], ... }.
 */

export function policyBranchDisplayName(b) {
  if (b == null) return "";
  if (typeof b === "string") return String(b).trim();
  return String(b.name || b.code || "").trim();
}

/** Lowercased keys for matching employee / Branch records (name + code). */
export function policyBranchMatchKeys(b) {
  if (b == null) return [];
  if (typeof b === "string") {
    const s = String(b).trim().toLowerCase();
    return s ? [s] : [];
  }
  const keys = [b.name, b.code].map((x) => (x == null ? "" : String(x).trim().toLowerCase())).filter(Boolean);
  return [...new Set(keys)];
}

/** API → Organization Rules editor state (location lines in a textarea). */
export function normalizeWorkLocationsForEditor(rows) {
  return (rows || []).map((loc) => ({
    governorate: loc.governorate || "",
    city: loc.city || "",
    branches: (loc.branches || []).map((b) => {
      if (typeof b === "string") {
        return {
          name: b,
          code: "",
          insuranceNumber: "",
          locationText: "",
          city: loc.city || "",
          country: "Egypt",
          status: "ACTIVE",
        };
      }
      const locArr = Array.isArray(b.location) ? b.location : [];
      return {
        name: b.name || "",
        code: b.code || "",
        insuranceNumber: b.insuranceNumber || "",
        locationText: locArr.join("\n"),
        city: b.city || loc.city || "",
        country: b.country || "Egypt",
        status: ["ACTIVE", "INACTIVE", "CLOSED"].includes(b.status) ? b.status : "ACTIVE",
      };
    }),
  }));
}

export function emptyPolicyBranchRow(parentCity = "") {
  return {
    name: "",
    code: "",
    insuranceNumber: "",
    locationText: "",
    city: parentCity,
    country: "Egypt",
    status: "ACTIVE",
  };
}

/** Editor state → API payload (same shape backend sanitize expects). */
export function workLocationsToApiPayload(rows) {
  return (rows || [])
    .filter((loc) => (loc.governorate || "").trim() && (loc.city || "").trim())
    .map((loc) => {
      const parentCity = loc.city.trim();
      const parentGov = loc.governorate.trim();
      const branches = (loc.branches || [])
        .map((b) => {
          const name = (b.name || "").trim();
          const code = (b.code || "").trim().toUpperCase();
          if (!name && !code) return null;
          const location = String(b.locationText ?? "")
            .split(/[\n,،;]+/)
            .map((s) => s.trim())
            .filter(Boolean);
          const o = {
            name: name || code,
            location,
            city: (b.city || parentCity || "").trim() || undefined,
            country: (b.country || "Egypt").trim(),
            status: ["ACTIVE", "INACTIVE", "CLOSED"].includes(b.status) ? b.status : "ACTIVE",
          };
          if (code) o.code = code;
          const ins = (b.insuranceNumber || "").trim();
          if (ins) o.insuranceNumber = ins;
          return o;
        })
        .filter(Boolean);
      return { governorate: parentGov, city: parentCity, branches };
    });
}

/** Collapse Branch.location (string | string[]) for substring matching. */
export function branchRecordLocationText(b) {
  if (!b?.location) return "";
  if (Array.isArray(b.location)) return b.location.join(" ").toLowerCase();
  return String(b.location).trim().toLowerCase();
}
