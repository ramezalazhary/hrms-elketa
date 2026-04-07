/**
 * Client-side mirror of backend `getMergedTeamsForDepartment` (orgResolutionService).
 * Merges embedded `department.teams` with standalone `Team` API rows for the same department.
 */

/** Resolve department id string from a standalone team payload (populate-safe). */
export function standaloneTeamDepartmentIdKey(team) {
  const d = team?.departmentId;
  if (d == null || d === "") return "";
  if (typeof d === "object" && d !== null) {
    return String(d.id ?? d._id ?? "").trim();
  }
  return String(d).trim();
}

/**
 * @param {object[]} teams — typically `getTeamsApi()` result
 * @returns {Map<string, object[]>}
 */
export function groupStandaloneTeamsByDepartmentId(teams) {
  const map = new Map();
  for (const t of teams || []) {
    const key = standaloneTeamDepartmentIdKey(t);
    if (!key) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(t);
  }
  return map;
}

/**
 * @param {object} department — dept from store/API (`id`, `teams[]`)
 * @param {object[]} standaloneTeamsForDept — teams where `departmentId` matches this department
 * @returns {object[]} merged plain team-like objects (embedded + standalone, deduped by id)
 */
export function mergeTeamsForDepartment(department, standaloneTeamsForDept) {
  const standalone = (standaloneTeamsForDept || []).filter(
    (t) => !t.status || t.status === "ACTIVE",
  );
  const standaloneIds = new Set(
    standalone
      .map((t) => String(t.id ?? t._id ?? "").trim())
      .filter(Boolean),
  );
  const embedded = department?.teams || [];
  const embeddedFiltered = embedded.filter((t) => {
    const tid = t.id ?? t._id;
    const ts = tid != null && tid !== "" ? String(tid).trim() : "";
    return !ts || !standaloneIds.has(ts);
  });
  return [
    ...embeddedFiltered.map((t) => ({ ...t })),
    ...standalone.map((t) => ({ ...t })),
  ];
}

export function mergedTeamNamesForDepartment(department, standaloneTeamsForDept) {
  const merged = mergeTeamsForDepartment(department, standaloneTeamsForDept);
  return [...new Set(merged.map((t) => t.name).filter(Boolean))];
}

/**
 * Client mirror of backend `employeeOnTeamRoster` (assessmentAccessService).
 * @param {object} emp
 * @param {object} team
 */
export function employeeOnTeamRosterClient(emp, team) {
  if (!team || !emp) return false;
  const empEmail = String(emp.email || "").toLowerCase().trim();
  const teamName = String(team.name || "").trim();
  const empTeam = String(emp.team || "").trim();
  if (
    teamName &&
    empTeam &&
    teamName.toLowerCase() === empTeam.toLowerCase()
  ) {
    return true;
  }
  const members = Array.isArray(team.members) ? team.members : [];
  for (const m of members) {
    if (String(m).toLowerCase().trim() === empEmail) return true;
  }
  const memberIds = Array.isArray(team.memberIds) ? team.memberIds : [];
  const eid = String(emp.id ?? emp._id ?? "").trim();
  for (const mid of memberIds) {
    const id = mid?.id ?? mid?._id ?? mid;
    if (eid && id != null && String(eid) === String(id)) return true;
  }
  return false;
}
