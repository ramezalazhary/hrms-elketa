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
  /** If true, use firstYearDays / afterFirstYearDays from hire anniversary; else use annualDays only. */
  entitlementVariesByYear: false,
  firstYearDays: 15,
  afterFirstYearDays: 21,
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
 * Company "month" start (1–31). Day is clamped per calendar month (e.g. 31 → last day in February).
 * @param {{ companyMonthStartDay?: number } | null | undefined} policyDoc
 */
export function getCompanyMonthStartDay(policyDoc) {
  const d = Number(policyDoc?.companyMonthStartDay);
  if (!Number.isFinite(d) || d < 1) return 1;
  return Math.min(31, Math.floor(d));
}

/**
 * UTC instant at start of the company's fiscal month containing `isoDate`, when months begin on day `rawStartDay`.
 * If `rawStartDay` is 1, returns first day of the calendar month (UTC).
 */
export function fiscalMonthPeriodStartUtc(isoDate, rawStartDay) {
  const S = Math.max(1, Math.min(31, Number(rawStartDay) || 1));
  const z = new Date(isoDate);
  const y = z.getUTCFullYear();
  const monthIndex = z.getUTCMonth();

  const daysInMonth = (yy, idx) =>
    new Date(Date.UTC(yy, idx + 1, 0)).getUTCDate();

  const anchorDom = (yy, idx) => Math.min(S, daysInMonth(yy, idx));

  const periodStartFor = (yy, idx) =>
    new Date(Date.UTC(yy, idx, anchorDom(yy, idx)));

  if (S <= 1) {
    return new Date(Date.UTC(y, monthIndex, 1));
  }

  const thisStart = periodStartFor(y, monthIndex);
  if (z.getTime() >= thisStart.getTime()) {
    return thisStart;
  }
  const pm = monthIndex === 0 ? 11 : monthIndex - 1;
  const py = monthIndex === 0 ? y - 1 : y;
  return periodStartFor(py, pm);
}

/**
 * Period key for excuse limits / monthly excuse usage (UTC).
 * MONTH with company start day 1 keeps legacy `M|YYYY-MM` keys; otherwise `M|YYYY-MM-DD` of period start.
 * @param {Date|string} excuseDate
 * @param {string} periodRaw WEEK | MONTH | YEAR
 * @param {number} [companyMonthStartDay=1] from organization policy
 */
export function excusePeriodKeyUtc(
  excuseDate,
  periodRaw,
  companyMonthStartDay = 1,
) {
  const d = new Date(excuseDate);
  const p = String(periodRaw || "MONTH").toUpperCase();
  const y = d.getUTCFullYear();
  const mo = d.getUTCMonth() + 1;
  const S = getCompanyMonthStartDay({ companyMonthStartDay });

  if (p === "YEAR") return `Y|${y}`;

  if (p === "MONTH") {
    if (S <= 1) {
      return `M|${y}-${String(mo).padStart(2, "0")}`;
    }
    const ps = fiscalMonthPeriodStartUtc(d, S);
    return `M|${ps.getUTCFullYear()}-${String(ps.getUTCMonth() + 1).padStart(2, "0")}-${String(ps.getUTCDate()).padStart(2, "0")}`;
  }

  if (p === "WEEK") {
    const day = d.getUTCDate();
    const x = new Date(Date.UTC(y, mo - 1, day));
    const dow = x.getUTCDay();
    const mondayDelta = dow === 0 ? -6 : 1 - dow;
    x.setUTCDate(x.getUTCDate() + mondayDelta);
    return `W|${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, "0")}-${String(x.getUTCDate()).padStart(2, "0")}`;
  }

  return `M|${y}-${String(mo).padStart(2, "0")}`;
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

/**
 * Annual vacation days for balance (policy + hire anniversary when entitlementVariesByYear).
 * @param {{ dateOfHire?: Date | string }} employee
 * @param {object} vr vacationRules from resolveActiveLeavePolicy
 */
export function resolveAnnualDaysForEmployee(employee, vr) {
  const varies = Boolean(vr?.entitlementVariesByYear);
  if (!varies) {
    return Number(vr?.annualDays) || 21;
  }
  if (!employee?.dateOfHire) {
    return Number(vr?.afterFirstYearDays) || 21;
  }
  const ms = Date.now() - new Date(employee.dateOfHire).getTime();
  const yearsFromHire = ms / (365.25 * 86400000);
  if (yearsFromHire < 1) {
    return Number(vr?.firstYearDays) || 15;
  }
  return Number(vr?.afterFirstYearDays) || 21;
}

/** True when entitlementVariesByYear and employee is within first 365.25d since hire. */
export function isFirstVacationYear(employee, vr) {
  if (!vr?.entitlementVariesByYear || !employee?.dateOfHire) return false;
  const ms = Date.now() - new Date(employee.dateOfHire).getTime();
  return ms / (365.25 * 86400000) < 1;
}
