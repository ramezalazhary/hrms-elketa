import { Employee } from "../models/Employee.js";
import { ROLE } from "../utils/roles.js";

const LEGACY_ROLE_MAP = Object.freeze({
  TL: ROLE.TEAM_LEADER,
  TEAMLEADER: ROLE.TEAM_LEADER,
  "TEAM LEADER": ROLE.TEAM_LEADER,
  TEAM_LEAD: ROLE.TEAM_LEADER,
  MGR: ROLE.MANAGER,
  HUMAN_RESOURCES: ROLE.HR,
});

function canonicalizeRole(rawRole) {
  if (rawRole == null) return null;
  const normalized = String(rawRole).trim().toUpperCase();
  if (!normalized) return null;
  if (Object.values(ROLE).includes(normalized)) return normalized;
  if (Object.prototype.hasOwnProperty.call(LEGACY_ROLE_MAP, normalized)) {
    return LEGACY_ROLE_MAP[normalized];
  }
  return null;
}

export async function normalizeLegacyEmployeeRoles({ apply = false } = {}) {
  const employees = await Employee.find({}).select("_id email role").lean();
  const updates = [];
  const unknown = [];

  for (const row of employees) {
    const current = String(row.role ?? "").trim().toUpperCase();
    const canonical = canonicalizeRole(row.role);
    if (!canonical) {
      unknown.push({ id: String(row._id), email: row.email, role: row.role });
      continue;
    }
    if (canonical !== current) {
      updates.push({
        id: String(row._id),
        email: row.email,
        from: row.role,
        to: canonical,
      });
    }
  }

  let modifiedCount = 0;
  if (apply && updates.length) {
    for (const item of updates) {
      const res = await Employee.updateOne(
        { _id: item.id, role: item.from },
        { $set: { role: item.to } },
      );
      modifiedCount += Number(res.modifiedCount || 0);
    }
  }

  return {
    scanned: employees.length,
    candidates: updates.length,
    modifiedCount,
    updates,
    unknown,
  };
}
