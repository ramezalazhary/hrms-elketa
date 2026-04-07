/**
 * Redacts employee JSON for org peers (department head / manager scope, team leader, etc.)
 * so GET responses do not expose HR-only or highly sensitive fields. Scope "all" and
 * self-view are unchanged.
 */

/** @param {object | null | undefined} ref */
function shrinkManagerRef(ref) {
  if (ref == null) return ref;
  if (typeof ref !== "object") return ref;
  const id = ref.id ?? ref._id?.toString?.();
  return {
    ...(id != null ? { id } : {}),
    fullName: ref.fullName,
    workEmail: ref.workEmail || undefined,
  };
}

/**
 * @param {{ id?: string, email?: string } | null | undefined} viewer
 * @param {{ scope?: string } | null | undefined} access
 * @param {object} employeePlain
 */
export function shouldRedactEmployeeForViewer(access, viewer, employeePlain) {
  if (!access || access.scope === "all") return false;
  if (!viewer?.id && !viewer?.email) return true;
  const eid = employeePlain.id ?? employeePlain._id?.toString?.();
  if (eid && viewer.id && String(eid) === String(viewer.id)) return false;
  const vEmail = (viewer.email || "").toLowerCase().trim();
  const eEmail = (employeePlain.email || "").toLowerCase().trim();
  if (vEmail && eEmail && vEmail === eEmail) return false;
  return true;
}

/**
 * Removes password hash from any employee JSON sent to clients.
 * @param {object} employeePlain
 */
export function stripEmployeeSecrets(employeePlain) {
  const cloned =
    employeePlain && typeof employeePlain === "object"
      ? JSON.parse(JSON.stringify(employeePlain))
      : {};
  delete cloned.passwordHash;
  return cloned;
}

/**
 * @param {object} employeePlain — plain enriched employee
 * @param {{ viewer: object, access: object, mode?: "read" | "write" }} ctx
 * @returns {object}
 */
export function sanitizeEmployeeApiPayload(employeePlain, { viewer, access, mode = "read" }) {
  const cloned =
    employeePlain && typeof employeePlain === "object"
      ? JSON.parse(JSON.stringify(employeePlain))
      : {};

  delete cloned.passwordHash;

  if (mode === "write") {
    return cloned;
  }

  if (!shouldRedactEmployeeForViewer(access, viewer, cloned)) {
    return cloned;
  }

  const work = cloned.workEmail || null;
  if (work) {
    cloned.email = work;
  } else {
    delete cloned.email;
  }

  const deleteKeys = [
    "financial",
    "socialInsurance",
    "insurance",
    "insurances",
    "medicalCondition",
    "idNumber",
    "nationalIdExpiryDate",
    "address",
    "governorate",
    "city",
    "emergencyPhone",
    "phoneNumber",
    "additionalContact",
    "onlineStorageLink",
    "profilePicture",
    "salaryHistory",
    "annualLeaveCredits",
    "dateOfBirth",
    "gender",
    "maritalStatus",
    "nationality",
  ];
  for (const k of deleteKeys) delete cloned[k];

  if (Array.isArray(cloned.transferHistory)) {
    cloned.transferHistory = cloned.transferHistory.map((t) => {
      if (!t || typeof t !== "object") return t;
      const row = { ...t };
      delete row.newSalary;
      return row;
    });
  }

  if (Array.isArray(cloned.documentChecklist)) {
    cloned.documentChecklist = cloned.documentChecklist.map((d) => ({
      documentName: d.documentName,
      status: d.status,
      submissionDate: d.submissionDate,
      isMandatory: d.isMandatory,
    }));
  }

  if (Array.isArray(cloned.vacationRecords)) {
    cloned.vacationRecords = cloned.vacationRecords.map((v) => ({
      startDate: v.startDate,
      endDate: v.endDate,
      type: v.type,
      source: v.source,
    }));
  }

  cloned.managerId = shrinkManagerRef(cloned.managerId);
  cloned.teamLeaderId = shrinkManagerRef(cloned.teamLeaderId);
  cloned.effectiveManager = shrinkManagerRef(cloned.effectiveManager);
  cloned.effectiveTeamLeader = shrinkManagerRef(cloned.effectiveTeamLeader);

  cloned.apiViewContext = "peer";
  return cloned;
}

/**
 * @param {object[]} rows
 * @param {{ id?: string, email?: string }} viewer
 * @param {{ scope?: string }} access
 */
export function sanitizeEnrichedEmployeeList(rows, viewer, access) {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => sanitizeEmployeeApiPayload(row, { viewer, access }));
}
