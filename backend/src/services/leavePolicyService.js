/**
 * Resolve leave policies and build immutable policySnapshot for LeaveRequest.
 * Active rules = the leavePolicies entry with the highest `version`.
 */
import { OrganizationPolicy } from "../models/OrganizationPolicy.js";

const DEFAULT_VACATION_RULES = {
  annualDays: 21,
  accrualModel: "YEARLY",
  minNoticeDays: 0,
  maxConsecutiveDays: 365,
  /** Calendar days after `dateOfHire` before vacation requests are allowed (0 = from hire day). */
  minDaysAfterHire: 0,
};

const DEFAULT_EXCUSE_RULES = {
  /** Max hours allowed for one excuse (single occurrence). */
  maxHoursPerExcuse: 8,
  /** Legacy: used if maxHoursPerExcuse is missing. */
  maxMinutesPerRequest: 8 * 60,
  maxMinutesPerDay: 8 * 60,
  maxMinutesPerMonth: 40 * 60,
  roundingMinutes: 15,
  /** Calendar days after `dateOfHire` before excuse requests are allowed (0 = from hire day). */
  minDaysAfterHire: 0,
  /** Max number of excuse requests in the period below (0 = unlimited). */
  maxExcusesPerPeriod: 0,
  /** WEEK | MONTH | YEAR — applies with maxExcusesPerPeriod. */
  excuseLimitPeriod: "MONTH",
};

/**
 * @returns {Promise<import("mongoose").Document | null>}
 */
export async function getDefaultPolicyDoc() {
  return OrganizationPolicy.findOne({ name: "default" });
}

export function getCompanyTimezone(policyDoc) {
  return policyDoc?.companyTimezone || "Africa/Cairo";
}

/**
 * Pick active leave policy: highest `version` wins.
 * @param {Array<{ version: number, vacationRules?: object, excuseRules?: object }>} leavePolicies
 */
export function resolveActiveLeavePolicy(leavePolicies) {
  if (!Array.isArray(leavePolicies) || leavePolicies.length === 0) {
    return {
      version: 1,
      vacationRules: { ...DEFAULT_VACATION_RULES },
      excuseRules: { ...DEFAULT_EXCUSE_RULES },
    };
  }
  const block = leavePolicies.reduce((best, cur) => {
    const v = Number(cur.version) || 0;
    const bv = Number(best.version) || 0;
    return v >= bv ? cur : best;
  }, leavePolicies[0]);

  return {
    version: Number(block.version) || 1,
    vacationRules: {
      ...DEFAULT_VACATION_RULES,
      ...(block.vacationRules || {}),
    },
    excuseRules: {
      ...DEFAULT_EXCUSE_RULES,
      ...(block.excuseRules || {}),
    },
  };
}

/**
 * Immutable snapshot: everything needed to validate, balance, and compute duration.
 * @param {import("mongoose").Document} policyDoc
 * @param {"VACATION"|"EXCUSE"} kind
 */
export function buildPolicySnapshot(policyDoc, kind) {
  const companyTimezone = getCompanyTimezone(policyDoc);
  const active = resolveActiveLeavePolicy(policyDoc?.leavePolicies || []);
  return {
    companyTimezone,
    policyVersion: active.version,
    vacationRules: active.vacationRules,
    excuseRules: active.excuseRules,
    kindAtSubmit: kind,
  };
}
