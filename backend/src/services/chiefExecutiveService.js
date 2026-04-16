import { OrganizationPolicy } from "../models/OrganizationPolicy.js";

export async function getChiefExecutivePolicy() {
  return OrganizationPolicy.findOne({ name: "default" })
    .select("chiefExecutiveEmployeeId")
    .lean();
}

export async function getChiefExecutiveId() {
  const policy = await getChiefExecutivePolicy();
  return policy?.chiefExecutiveEmployeeId ? String(policy.chiefExecutiveEmployeeId) : null;
}

export async function isChiefExecutiveUser(userId) {
  if (!userId) return false;
  const chiefExecutiveId = await getChiefExecutiveId();
  return Boolean(chiefExecutiveId && String(chiefExecutiveId) === String(userId));
}

export async function assertNotCurrentChiefExecutive(targetEmployeeId, reasonMessage) {
  if (!targetEmployeeId) return;
  const chiefExecutiveId = await getChiefExecutiveId();
  if (chiefExecutiveId && String(chiefExecutiveId) === String(targetEmployeeId)) {
    const err = new Error(
      reasonMessage ||
        "Cannot modify the current Chief Executive in a way that leaves the company without an active Chief Executive",
    );
    err.statusCode = 400;
    throw err;
  }
}
