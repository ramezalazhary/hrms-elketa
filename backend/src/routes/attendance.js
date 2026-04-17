import { Router } from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import * as XLSX from "xlsx";
import { Attendance } from "../models/Attendance.js";
import { LeaveRequest } from "../models/LeaveRequest.js";
import { Employee } from "../models/Employee.js";
import { requireAuth } from "../middleware/auth.js";
import { enforcePolicy } from "../middleware/enforcePolicy.js";
import { enforceScope } from "../middleware/enforceScope.js";
import mongoose from "mongoose";
import { createAuditLog } from "../services/auditService.js";
import {
  parseTimeToMinutes,
  excuseCoversLateCheckIn,
  computeMidDayExcuseCredit,
} from "../utils/excuseAttendance.js";
import { OrganizationPolicy } from "../models/OrganizationPolicy.js";
import { CompanyHoliday } from "../models/CompanyHoliday.js";
import { computeMonthlyAnalysis } from "../services/payrollPipeline/index.js";
import { mapSummaryForMonthlyReportApi } from "../utils/monthlyReportPublicDto.js";
import { parseAttendanceClock } from "../utils/attendanceClockParse.js";
import {
  calculateTimingStatus,
  countMonthlyGraceUsesBeforeTarget,
  effectiveLateGraceAddMinutes,
} from "../utils/attendanceTimingCore.js";
import {
  fiscalMonthRangeContainingUtcDate,
  getCompanyMonthStartDay,
} from "../services/leavePolicyService.js";
import { resolveEmployeeScopeIds, resolveTargetEmployee } from "../services/scopeService.js";

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const upload = multer({ storage: multer.memoryStorage() });

async function resolveAttendanceTargetEmployee(req) {
  if (req.params?.id && mongoose.Types.ObjectId.isValid(String(req.params.id))) {
    const attendance = await Attendance.findById(req.params.id)
      .select("employeeId")
      .lean();
    if (attendance?.employeeId) {
      return Employee.findById(attendance.employeeId)
        .select("_id departmentId teamId role email")
        .lean();
    }
  }
  return resolveTargetEmployee(req);
}


/** @deprecated use parseAttendanceClock — kept alias for local call sites */
const parseTime = parseAttendanceClock;

/**
 * Calculates total work hours and attendance status from punch times vs shift policy.
 * Delegates to {@link calculateTimingStatus} so analysis + routes share one implementation.
 * @param {{ lateGraceAddMinutes?: number }} [timingOptions] — optional override for monthly grace exhaustion
 */
const calculateStatus = (checkIn, checkOut, policy, timingOptions = {}) => {
  return calculateTimingStatus(checkIn, checkOut, policy, timingOptions);
};

/** UTC calendar day key `YYYY-MM-DD` for grouping batched leave rows. */
function utcDayKeyFromDate(d) {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x.toISOString().slice(0, 10);
}

/**
 * One batched load of EXCUSE + VACATION rows for an employee across attendance row dates
 * (used by GET /employee/:id to avoid per-day duplicate queries).
 */
async function prefetchLeaveBundleForEmployee(employeeId, attendanceDocs) {
  if (!employeeId || !attendanceDocs?.length) return null;
  const times = attendanceDocs.map((r) => new Date(r.date).getTime());
  const min = new Date(Math.min(...times));
  const max = new Date(Math.max(...times));
  min.setUTCHours(0, 0, 0, 0);
  const rangeEndExclusive = new Date(max);
  rangeEndExclusive.setUTCHours(0, 0, 0, 0);
  rangeEndExclusive.setUTCDate(rangeEndExclusive.getUTCDate() + 1);

  const excuseRows = await LeaveRequest.find({
    employeeId,
    kind: "EXCUSE",
    status: "APPROVED",
    excuseDate: { $gte: min, $lt: rangeEndExclusive },
  }).lean();

  const excusesByDayKey = new Map();
  for (const ex of excuseRows) {
    const key = utcDayKeyFromDate(ex.excuseDate);
    if (!excusesByDayKey.has(key)) excusesByDayKey.set(key, []);
    excusesByDayKey.get(key).push(ex);
  }

  const vacations = await LeaveRequest.find({
    employeeId,
    kind: "VACATION",
    status: "APPROVED",
    startDate: { $lt: rangeEndExclusive },
    endDate: { $gte: min },
  })
    .select("_id startDate endDate")
    .lean();

  return { excusesByDayKey, vacations };
}

/**
 * If status would be LATE, an approved excuse on that day may clear lateness.
 * @param {import("mongoose").Types.ObjectId | string} employeeId
 * @param {Array<object> | undefined} prefetchedExcusesForDay — when set (including `[]`), skips DB read for that day.
 * @returns {Promise<import("mongoose").Types.ObjectId | null>}
 */
async function findApprovedExcuseCoveringLate(
  employeeId,
  normalizedDate,
  checkInStr,
  policy,
  prefetchedExcusesForDay = undefined,
  effectiveGraceMinutes = undefined,
) {
  const shiftStartMin = parseTimeToMinutes(
    policy.standardStartTime || "09:00",
  );
  const grace =
    effectiveGraceMinutes !== undefined && effectiveGraceMinutes !== null
      ? effectiveGraceMinutes
      : (policy.gracePeriod ?? policy.gracePeriodMinutes ?? 15);
  const checkInMin = parseTimeToMinutes(checkInStr);
  if (shiftStartMin == null || checkInMin == null) return null;

  const dayStart = new Date(normalizedDate);
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  const excuses = prefetchedExcusesForDay !== undefined
    ? prefetchedExcusesForDay
    : await LeaveRequest.find({
      employeeId,
      kind: "EXCUSE",
      status: "APPROVED",
      excuseDate: { $gte: dayStart, $lt: dayEnd },
    }).lean();

  for (const ex of excuses) {
    const es = parseTimeToMinutes(ex.startTime);
    const ee = parseTimeToMinutes(ex.endTime);
    if (es == null || ee == null) continue;
    const coversCheckIn = excuseCoversLateCheckIn(checkInMin, es, ee, shiftStartMin, grace);
    const coversShiftStart = ee > shiftStartMin;
    if (coversCheckIn || coversShiftStart) {
      return ex;
    }
  }
  return null;
}

/**
 * For a specific day, resolve approved absence coverage:
 * - Approved VACATION covering that day => ON_LEAVE
 * - Approved EXCUSE on that day without time window => EXCUSED (full-day excuse)
 * @param {{ vacations: object[], dayExcuses: object[] } | undefined} prefetched — when set, skips DB reads.
 */
async function findApprovedLeaveCoverage(employeeId, normalizedDate, prefetched = undefined) {
  const dayStart = new Date(normalizedDate);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  if (prefetched) {
    const vacation = prefetched.vacations.find(
      (v) => v.startDate < dayEnd && v.endDate >= dayStart,
    );
    if (vacation?._id) {
      return { status: "ON_LEAVE", leaveRequestId: vacation._id };
    }
    const excuse = prefetched.dayExcuses.find(
      (ex) => ex._id && !ex.startTime && !ex.endTime,
    );
    if (excuse?._id) {
      return { status: "EXCUSED", leaveRequestId: excuse._id };
    }
    return null;
  }

  const vacation = await LeaveRequest.findOne({
    employeeId,
    kind: "VACATION",
    status: "APPROVED",
    startDate: { $lt: dayEnd },
    endDate: { $gte: dayStart },
  })
    .select("_id")
    .lean();
  if (vacation?._id) {
    return { status: "ON_LEAVE", leaveRequestId: vacation._id };
  }

  const excuse = await LeaveRequest.findOne({
    employeeId,
    kind: "EXCUSE",
    status: "APPROVED",
    excuseDate: { $gte: dayStart, $lt: dayEnd },
  })
    .select("_id startTime endTime")
    .lean();
  if (excuse?._id && !excuse.startTime && !excuse.endTime) {
    return { status: "EXCUSED", leaveRequestId: excuse._id };
  }

  return null;
}

/**
 * Resolve global attendance policy from OrganizationPolicy,
 * falling back to system defaults.
 */
async function resolveAttendancePolicy() {
  try {
    const orgPolicy = await OrganizationPolicy.findOne({ name: "default" }).lean();
    const ar = orgPolicy?.attendanceRules;
    if (ar && ar.standardStartTime) {
      const g = ar.gracePeriodMinutes ?? 15;
      return {
        standardStartTime: ar.standardStartTime,
        standardEndTime: ar.standardEndTime || "17:00",
        gracePeriod: g,
        gracePeriodMinutes: g,
        weeklyRestDays: ar.weeklyRestDays,
        monthlyGraceUsesEnabled: ar.monthlyGraceUsesEnabled === true,
        monthlyGraceUsesAllowed: (() => {
          const n = Number(ar.monthlyGraceUsesAllowed);
          if (!Number.isFinite(n)) return 0;
          return Math.max(0, Math.min(31, Math.floor(n)));
        })(),
        companyMonthStartDay: getCompanyMonthStartDay(orgPolicy),
      };
    }
  } catch (_) { /* fall through to system defaults */ }
  return {
    standardStartTime: "09:00",
    standardEndTime: "17:00",
    gracePeriod: 15,
    gracePeriodMinutes: 15,
    weeklyRestDays: undefined,
    monthlyGraceUsesEnabled: false,
    monthlyGraceUsesAllowed: 0,
    companyMonthStartDay: 1,
  };
}

/**
 * Find approved mid-day excuses for a date and compute credited minutes.
 * Also returns whether the excuse covers through end of day.
 */
async function resolveMidDayExcuseCredit(
  employeeId,
  normalizedDate,
  policy,
  prefetchedExcusesForDay = undefined,
) {
  const shiftStartMin = parseTimeToMinutes(policy.standardStartTime || "09:00");
  const shiftEndMin = parseTimeToMinutes(policy.standardEndTime || "17:00");
  const grace = policy.gracePeriod ?? 15;
  if (shiftStartMin == null || shiftEndMin == null) {
    return { creditMinutes: 0, coversEndOfDay: false };
  }

  const dayStart = new Date(normalizedDate);
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  const excuses = prefetchedExcusesForDay !== undefined
    ? prefetchedExcusesForDay
    : await LeaveRequest.find({
      employeeId,
      kind: "EXCUSE",
      status: "APPROVED",
      excuseDate: { $gte: dayStart, $lt: dayEnd },
    }).lean();

  if (excuses.length === 0) return { creditMinutes: 0, coversEndOfDay: false };
  return computeMidDayExcuseCredit(excuses, shiftStartMin, shiftEndMin, grace);
}

function resolveExcuseAllowanceMinutes(excuseDoc) {
  const computedMinutes = Number(excuseDoc?.computed?.minutes) || 0;
  const policyRules = excuseDoc?.policySnapshot?.excuseRules || {};
  const maxHours = Number(policyRules.maxHoursPerExcuse);
  const maxMinutesPerRequest = Number(policyRules.maxMinutesPerRequest);
  const policyMinutes = Number.isFinite(maxHours) && maxHours > 0
    ? maxHours * 60
    : (Number.isFinite(maxMinutesPerRequest) && maxMinutesPerRequest > 0
      ? maxMinutesPerRequest
      : 0);
  return Math.max(0, computedMinutes, policyMinutes);
}

function mapExcuseOverageToDeductionFraction(overageMinutes, workdayMinutes = 8 * 60) {
  if (!Number.isFinite(overageMinutes) || overageMinutes <= 0) return 0;
  const quarter = workdayMinutes / 4;
  const half = workdayMinutes / 2;
  if (overageMinutes > half) return 0.5;
  if (overageMinutes > quarter) return 0.25;
  return 0;
}

function normalizeDecisionSource(value) {
  const v = String(value || "").toUpperCase();
  return v === "SALARY" || v === "VACATION_BALANCE" ? v : undefined;
}

/**
 * Single source of truth for a row: `calculateStatus` from clock times + policy,
 * then approved late excuse, mid-day credit, and leave coverage.
 * Client-supplied `status` must not override this chain (use only for display after recompute).
 */
async function finalizeAttendanceTimingStatus({
  employeeId,
  normalizedDate,
  checkIn,
  checkOut,
  policy,
  leavePrefetch = null,
  existingDecision = null,
}) {
  const baseGrace = policy.gracePeriod ?? policy.gracePeriodMinutes ?? 15;
  const monthlyAllowed = Math.floor(Number(policy.monthlyGraceUsesAllowed)) || 0;
  const monthlyOn = policy.monthlyGraceUsesEnabled === true && monthlyAllowed > 0;

  let usesBefore = 0;
  if (monthlyOn && employeeId) {
    const monthAnchor = policy.companyMonthStartDay ?? 1;
    const { periodStart, periodEnd } = fiscalMonthRangeContainingUtcDate(
      normalizedDate,
      monthAnchor,
    );
    const [sortedMonth, holidays, empLean] = await Promise.all([
      Attendance.find({
        employeeId,
        date: { $gte: periodStart, $lt: periodEnd },
      })
        .sort({ date: 1 })
        .lean(),
      CompanyHoliday.find({
        startDate: { $lte: periodEnd },
        endDate: { $gte: periodStart },
      }).lean(),
      Employee.findById(employeeId).select("departmentId").lean(),
    ]);
    usesBefore = countMonthlyGraceUsesBeforeTarget({
      sortedMonthRowsAsc: sortedMonth,
      targetUtcMidnight: normalizedDate,
      shiftStartStr: policy.standardStartTime || "09:00",
      baseGraceMinutes: baseGrace,
      monthlyGraceUsesEnabled: true,
      monthlyGraceUsesAllowed: monthlyAllowed,
      weeklyRestDays: policy.weeklyRestDays,
      holidays,
      employeeId,
      departmentId: empLean?.departmentId,
    });
  }

  const lateGraceAdd = effectiveLateGraceAddMinutes({
    monthlyGraceUsesEnabled: monthlyOn,
    monthlyGraceUsesAllowed: monthlyAllowed,
    graceUsesBeforeTargetDate: usesBefore,
    baseGraceMinutes: baseGrace,
  });

  const calc = calculateStatus(checkIn, checkOut, policy, {
    lateGraceAddMinutes: lateGraceAdd,
  });
  let recordStatus = calc.status;
  let excuseLeaveRequestId;
  let leaveRequestId = null;
  let onApprovedLeave = false;
  let originalStatus;
  let excusedMinutes = 0;
  let excessExcuse = false;
  let excessExcuseFraction = 0;
  let excuseOverageMinutes = 0;
  let requiresDeductionDecision = false;
  let deductionSource;
  let deductionValueType;
  let deductionValue;

  const dayKey = utcDayKeyFromDate(normalizedDate);
  const prefDayExcuses = leavePrefetch?.excusesByDayKey
    ? (leavePrefetch.excusesByDayKey.get(dayKey) ?? [])
    : undefined;
  const prefLeave = leavePrefetch?.vacations
    ? { vacations: leavePrefetch.vacations, dayExcuses: prefDayExcuses ?? [] }
    : undefined;

  if (recordStatus === "LATE" && calc.checkInStr) {
    const excuseDoc = await findApprovedExcuseCoveringLate(
      employeeId, normalizedDate, calc.checkInStr, policy,
      prefDayExcuses,
      lateGraceAdd,
    );
    if (excuseDoc) {
      originalStatus = recordStatus;
      recordStatus = "EXCUSED";
      excuseLeaveRequestId = excuseDoc._id;
      excusedMinutes = excuseDoc.computed?.minutes || 0;
      const shiftStartMin = parseTimeToMinutes(policy.standardStartTime || "09:00");
      const checkInMin = parseTimeToMinutes(calc.checkInStr);
      const lateFromShiftStart =
        shiftStartMin != null && checkInMin != null
          ? Math.max(0, checkInMin - shiftStartMin)
          : 0;
      const allowanceMinutes = resolveExcuseAllowanceMinutes(excuseDoc);
      const overage = Math.max(0, lateFromShiftStart - allowanceMinutes);

      if (overage > 0) {
        recordStatus = "PARTIAL_EXCUSED";
        excuseOverageMinutes = overage;
        excessExcuse = true;
        excessExcuseFraction = Number(excuseDoc.excessDeductionAmount) > 0
          ? Number(excuseDoc.excessDeductionAmount)
          : mapExcuseOverageToDeductionFraction(overage);
        requiresDeductionDecision = true;

        // Preserve HR-resolved source/decision flags on recompute.
        const persistedSource = normalizeDecisionSource(existingDecision?.deductionSource);
        const persistedType = String(existingDecision?.deductionValueType || "").toUpperCase();
        const persistedValue = Number(existingDecision?.deductionValue);
        const persistedResolved =
          Boolean(existingDecision?.deductionDecisionAt)
          || (Boolean(persistedSource)
            && (persistedType === "AMOUNT"
              || (persistedType === "DAYS" && Number.isFinite(persistedValue) && persistedValue > 0)));
        if (persistedResolved) {
          deductionSource = persistedSource;
          deductionValueType = persistedType === "AMOUNT" ? "AMOUNT" : "DAYS";
          deductionValue = Number.isFinite(persistedValue) && persistedValue > 0
            ? persistedValue
            : (deductionValueType === "DAYS" ? excessExcuseFraction : undefined);
          requiresDeductionDecision = !deductionSource || !deductionValue;
        } else {
          deductionValueType = "DAYS";
          deductionValue = excessExcuseFraction;
        }
      } else if (excuseDoc.quotaExceeded && excuseDoc.excessDeductionMethod === "SALARY") {
        excessExcuse = true;
        excessExcuseFraction = excuseDoc.excessDeductionAmount
          || (excusedMinutes / (8 * 60));
        deductionSource = excuseDoc.excessDeductionMethod;
      }
    }
  }

  const midDay = await resolveMidDayExcuseCredit(
    employeeId, normalizedDate, policy, prefDayExcuses,
  );
  if (midDay.creditMinutes > 0 && !excuseLeaveRequestId) {
    excusedMinutes = midDay.creditMinutes;
  }
  if (recordStatus === "EARLY_DEPARTURE" && midDay.coversEndOfDay) {
    recordStatus = "PRESENT";
  }

  if (recordStatus === "ABSENT") {
    const covered = await findApprovedLeaveCoverage(
      employeeId, normalizedDate, prefLeave,
    );
    if (covered) {
      originalStatus = recordStatus;
      recordStatus = covered.status;
      leaveRequestId = covered.leaveRequestId;
      onApprovedLeave = true;
    }
  }

  return {
    calc,
    recordStatus,
    excuseLeaveRequestId,
    leaveRequestId,
    onApprovedLeave,
    originalStatus,
    excusedMinutes,
    excessExcuse,
    excessExcuseFraction,
    excuseOverageMinutes,
    requiresDeductionDecision,
    deductionSource,
    deductionValueType,
    deductionValue,
  };
}

function attendanceEmployeeId(doc) {
  const ref = doc?.employeeId;
  if (!ref) return null;
  if (typeof ref === "object" && ref._id != null) return ref._id;
  return ref;
}

/** Recompute status/times/hours from DB row + current policy (read paths). */
async function withAuthoritativeAttendanceFields(doc, policy, leavePrefetch = null) {
  const plain = typeof doc?.toObject === "function" ? doc.toObject() : { ...doc };
  const employeeId = attendanceEmployeeId(doc);
  if (!employeeId || !plain.date) return plain;

  const nd = new Date(plain.date);
  nd.setUTCHours(0, 0, 0, 0);
  const restDays = Array.isArray(policy?.weeklyRestDays) && policy.weeklyRestDays.length > 0
    ? policy.weeklyRestDays
    : [5, 6];
  const isWeeklyRestDay = restDays.includes(nd.getUTCDay());
  const fin = await finalizeAttendanceTimingStatus({
    employeeId,
    normalizedDate: nd,
    checkIn: plain.checkIn,
    checkOut: plain.checkOut,
    policy,
    leavePrefetch,
    existingDecision: {
      deductionSource: plain.deductionSource,
      deductionDecisionAt: plain.deductionDecisionAt,
      deductionValueType: plain.deductionValueType,
      deductionValue: plain.deductionValue,
    },
  });

  return {
    ...plain,
    isWeeklyRestDay,
    checkIn: fin.calc.checkInStr,
    checkOut: fin.calc.checkOutStr,
    totalHours: fin.calc.totalHours,
    status: fin.recordStatus,
    excusedMinutes: fin.excusedMinutes,
    excuseLeaveRequestId: fin.excuseLeaveRequestId ?? null,
    excuseCovered: Boolean(fin.excuseLeaveRequestId),
    leaveRequestId: fin.leaveRequestId ?? null,
    onApprovedLeave: fin.onApprovedLeave,
    originalStatus: fin.originalStatus ?? undefined,
    excessExcuse: fin.excessExcuse,
    excessExcuseFraction: fin.excessExcuseFraction,
    excuseOverageMinutes: fin.excuseOverageMinutes,
    requiresDeductionDecision: fin.requiresDeductionDecision,
    deductionSource: fin.deductionSource,
    deductionValueType: fin.deductionValueType,
    deductionValue: fin.deductionValue,
    deductionDecisionBy: plain.deductionDecisionBy ?? undefined,
    deductionDecisionAt: plain.deductionDecisionAt ?? undefined,
    restDayWorkApproved: Boolean(plain.restDayWorkApproved),
    restDayWorkDecisionBy: plain.restDayWorkDecisionBy ?? undefined,
    restDayWorkDecisionAt: plain.restDayWorkDecisionAt ?? undefined,
  };
}

async function resolveAttendanceAccess(user) {
  const scoped = await resolveEmployeeScopeIds(user);
  if (scoped.scope === "all") {
    return {
      scope: "all",
      employeeIds: null,
      actions: ["view", "create", "edit", "delete", "import"],
    };
  }
  return {
    scope: "scoped",
    employeeIds: Array.isArray(scoped.employeeIds)
      ? scoped.employeeIds.map((id) => String(id))
      : [],
    actions: ["view"],
  };
}

function validateReportPeriodParams(req, res) {
  const now = new Date();
  const rawYear = req.query.year;
  const rawMonth = req.query.month;

  const year =
    rawYear === undefined ? now.getUTCFullYear() : Number.parseInt(rawYear, 10);
  const month =
    rawMonth === undefined
      ? now.getUTCMonth() + 1
      : Number.parseInt(rawMonth, 10);

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    res
      .status(400)
      .json({ error: "Invalid year. Expected an integer between 2000 and 2100." });
    return null;
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    res
      .status(400)
      .json({ error: "Invalid month. Expected an integer between 1 and 12." });
    return null;
  }

  return { year, month };
}

router.get("/", requireAuth, enforcePolicy("read", "attendance"), async (req, res) => {
  try {
    const access = await resolveAttendanceAccess(req.user);
    const {
      startDate,
      endDate,
      employeeId,
      employeeCode,
      todayOnly,
      page = 1,
      limit = 50,
    } = req.query;
    let filter = {};

    if (access.scope !== "all") {
      filter.employeeId = { $in: access.employeeIds };
    }

    // Special Filter: Today/Most Recent for Leaders
    if (todayOnly === "true") {
      const latest = await Attendance.findOne(filter).sort({ date: -1 });
      if (latest) {
        const latestDate = new Date(latest.date);
        latestDate.setUTCHours(0, 0, 0, 0);
        filter.date = latestDate;
      }
    }
    if (employeeId) {
      if (access.scope !== "all") {
        const allowed = access.employeeIds.some((id) => String(id) === String(employeeId));
        if (!allowed) {
          return res.status(403).json({ error: "Forbidden: Employee not in your scope" });
        }
      }
      filter.employeeId = employeeId;
    }
    if (employeeCode) {
      filter.employeeCode = { $regex: employeeCode, $options: "i" };
    }
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.date.$lte = end;
      }
    }
    // Check if pagination is explicitly requested
    const isPaginated =
      req.query.page !== undefined || req.query.limit !== undefined;

    // Convert pagination parameters
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Get total count for pagination (only if paginated)
    const totalCount = isPaginated
      ? await Attendance.countDocuments(filter)
      : 0;

    const attendance = await Attendance.find(filter)
      .populate("employeeId", "fullName email employeeCode department")
      .sort({ date: -1 })
      .skip(skip)
      .limit(limitNum);

    const policy = await resolveAttendancePolicy();
    const attendanceOut = await Promise.all(
      attendance.map((d) => withAuthoritativeAttendanceFields(d, policy)),
    );

    res.json(
      isPaginated
        ? {
          attendance: attendanceOut,
          pagination: {
            currentPage: pageNum,
            totalPages: Math.ceil(totalCount / limitNum),
            totalCount,
            limit: limitNum,
          },
        }
        : attendanceOut,
    );
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch attendance data" });
  }
});

/**
 * GET /api/attendance/employee/:id
 * Fetches the last 30 days of attendance for a specific employee.
 */
router.get(
  "/me",
  requireAuth,
  enforcePolicy("read", "attendance"),
  async (req, res) => {
    try {
      const lastMonthCutoff = new Date();
      lastMonthCutoff.setDate(lastMonthCutoff.getDate() - 30);
      const attendance = await Attendance.find({
        employeeId: req.user.id,
        date: { $gte: lastMonthCutoff },
      })
        .sort({ date: -1 })
        .limit(31);
      const policy = await resolveAttendancePolicy();
      const leavePrefetch = await prefetchLeaveBundleForEmployee(req.user.id, attendance);
      const attendanceOut = await Promise.all(
        attendance.map((d) => withAuthoritativeAttendanceFields(d, policy, leavePrefetch)),
      );
      return res.json(attendanceOut);
    } catch {
      return res.status(500).json({ error: "Failed to fetch your attendance" });
    }
  },
);

router.get(
  "/employee/:id",
  requireAuth,
  enforcePolicy("read", "attendance"),
  enforceScope(resolveTargetEmployee),
  async (req, res) => {
  try {
    const access = await resolveAttendanceAccess(req.user);
    if (access.scope !== "all") {
      const allowed = access.employeeIds.some((id) => String(id) === String(req.params.id));
      if (!allowed) {
        return res
          .status(403)
          .json({ error: "Forbidden: Employee not in your scope" });
      }
    }

    const attendance = await Attendance.find({ employeeId: req.params.id })
      .sort({ date: -1 })
      .limit(30);
    const policy = await resolveAttendancePolicy();
    const leavePrefetch = await prefetchLeaveBundleForEmployee(req.params.id, attendance);
    const attendanceOut = await Promise.all(
      attendance.map((d) => withAuthoritativeAttendanceFields(d, policy, leavePrefetch)),
    );
    res.json(attendanceOut);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch employee attendance" });
  }
},
);

router.post("/", requireAuth, enforcePolicy("manage", "attendance"), async (req, res) => {
  try {
    const {
      employeeId,
      date,
      checkIn,
      checkOut,
      remarks,
    } = req.body || {};

    if (!employeeId || !date)
      return res.status(400).json({ error: "Employee and Date are required" });

    const normalizedDate = new Date(date);
    normalizedDate.setUTCHours(0, 0, 0, 0);

    const existing = await Attendance.findOne({
      employeeId,
      date: normalizedDate,
    });
    if (existing)
      return res
        .status(409)
        .json({ error: "Attendance already exists for this date." });

    const employee =
      await Employee.findById(employeeId).populate("departmentId");
    if (!employee) return res.status(404).json({ error: "Employee not found" });

    const policy = await resolveAttendancePolicy();
    const fin = await finalizeAttendanceTimingStatus({
      employeeId,
      normalizedDate,
      checkIn,
      checkOut,
      policy,
    });
    const {
      calc,
      recordStatus,
      excuseLeaveRequestId,
      leaveRequestId,
      onApprovedLeave,
      originalStatus,
      excusedMinutes,
      excessExcuse,
      excessExcuseFraction,
      excuseOverageMinutes,
      requiresDeductionDecision,
      deductionSource,
      deductionValueType,
      deductionValue,
    } = fin;

    const newRecord = new Attendance({
      employeeId,
      employeeCode: employee.employeeCode,
      date: normalizedDate,
      checkIn: calc.checkInStr,
      checkOut: calc.checkOutStr,
      status: recordStatus,
      totalHours: calc.totalHours,
      excusedMinutes,
      leaveRequestId: leaveRequestId || null,
      onApprovedLeave,
      originalStatus: originalStatus || undefined,
      remarks,
      lastManagedBy: req.user.id,
      excessExcuse,
      excessExcuseFraction,
      excuseOverageMinutes,
      requiresDeductionDecision,
      deductionSource,
      deductionValueType,
      deductionValue,
      ...(excuseLeaveRequestId
        ? { excuseLeaveRequestId, excuseCovered: true }
        : {}),
    });

    await newRecord.save();
    res.status(201).json(newRecord);
  } catch (error) {
    console.error("POST /attendance create error:", error);
    res.status(500).json({ error: "Failed to create attendance" });
  }
});

/**
 * GET /attendance/template - Download the Excel import template
 */
router.get(
  "/template",
  requireAuth,
  enforcePolicy("manage", "attendance"),
  (req, res) => {
  try {
    const templatePath = path.join(__dirname, "../AttendanceTemplate.xlsx");
    res.download(templatePath, "AttendanceImportTemplate.xlsx");
  } catch (error) {
    console.error("Template download error:", error);
    res.status(500).json({ error: "Failed to download template" });
  }
},
);

// ─── Monthly Analysis & Report (must be before /:id to avoid param capture) ──

/** Attendance-focused summary: deduction amounts in days only; `approvedOvertimeUnits` from assessments; no net salary. */
router.get(
  "/monthly-report",
  requireAuth,
  enforcePolicy("read", "attendance"),
  async (req, res) => {
  try {
    const parsed = validateReportPeriodParams(req, res);
    if (!parsed) return;
    const { year, month } = parsed;
    const departmentId = req.query.departmentId || undefined;
    const includeDetail = req.query.detail === "true";
    const result = await computeMonthlyAnalysis(year, month, departmentId, {
      includeDetails: includeDetail,
    });
    const payload = {
      period: result.period,
      policySnapshot: result.policySnapshot,
      summary: result.summary.map(mapSummaryForMonthlyReportApi),
    };
    if (includeDetail) payload.details = result.details;
    res.json(payload);
  } catch (error) {
    console.error("GET /attendance/monthly-report error:", error.message);
    res.status(500).json({ error: "Failed to generate monthly report" });
  }
},
);

router.get(
  "/monthly-report/export",
  requireAuth,
  enforcePolicy("read", "attendance"),
  async (req, res) => {
  try {
    const parsed = validateReportPeriodParams(req, res);
    if (!parsed) return;
    const { year, month } = parsed;
    const departmentId = req.query.departmentId || undefined;
    const result = await computeMonthlyAnalysis(year, month, departmentId, {
      includeDetails: true,
    });

    const summaryRows = result.summary.map((s) => ({
      "Employee Code": s.employeeCode,
      "Full Name": s.fullName,
      "Department": s.department,
      "Working Days": s.workingDays,
      "Present": s.presentDays,
      "Late": s.lateDays,
      "Absent": s.absentDays,
      "On Leave": s.onLeaveDays,
      "Paid Leave": s.paidLeaveDays,
      "Unpaid Leave": s.unpaidLeaveDays,
      "Excused": s.excusedDays,
      "Early Departure": s.earlyDepartureDays,
      "Incomplete": s.incompleteDays,
      "Total Hours": s.totalHoursWorked,
      "Avg Daily Hours": s.avgDailyHours,
      "Late Deduction (Days)": s.deductions.lateDays,
      "Absence Deduction (Days)": s.deductions.absenceDays,
      "Unpaid Leave Deduction (Days)": s.deductions.unpaidLeaveDays,
      "Early Dept Deduction (Days)": s.deductions.earlyDepartureDays,
      "Incomplete Deduction (Days)": s.deductions.incompleteDays,
      "Total Deduction (Days)": s.deductions.totalDeductionDays,
      "Net Effective Days": s.netEffectiveDays,
      "Approved overtime (units)": s.assessmentApprovedOvertimeUnits ?? 0,
    }));

    const detailRows = [];
    for (const emp of result.details) {
      for (const day of emp.days) {
        detailRows.push({
          "Employee Code": emp.employeeCode, "Full Name": emp.fullName,
          "Department": emp.department, "Date": day.date, "Status": day.status,
          "Check In": day.checkIn || "", "Check Out": day.checkOut || "",
          "Raw Hours": day.rawHours, "Excused Min": day.excusedMinutes,
          "Effective Hours": Math.round(day.effectiveHours * 100) / 100,
          "Deduction": day.deduction, "Notes": day.notes.join("; "),
        });
      }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), "Summary");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detailRows), "Daily Detail");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const filename = `Attendance_Report_${year}-${String(month).padStart(2, "0")}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(Buffer.from(buf));
  } catch (error) {
    console.error("GET /attendance/monthly-report/export error:", error.message);
    res.status(500).json({ error: "Failed to export report" });
  }
},
);

// ─── CRUD with :id param ─────────────────────────────────────────────────────

router.put(
  "/:id",
  requireAuth,
  enforcePolicy("manage", "attendance"),
  enforceScope(resolveAttendanceTargetEmployee),
  async (req, res) => {
  try {
    const { checkIn, checkOut, remarks, date } = req.body || {};

    const existing = await Attendance.findById(req.params.id);
    if (!existing)
      return res.status(404).json({ error: "Record not found" });

    let dateForExcuse = existing.date;
    if (date) {
      const nd = new Date(date);
      nd.setUTCHours(0, 0, 0, 0);
      dateForExcuse = nd;
    }

    const body = req.body || {};
    const effectiveCheckIn = Object.prototype.hasOwnProperty.call(body, "checkIn")
      ? checkIn
      : existing.checkIn;
    const effectiveCheckOut = Object.prototype.hasOwnProperty.call(body, "checkOut")
      ? checkOut
      : existing.checkOut;

    const policy = await resolveAttendancePolicy();
    const fin = await finalizeAttendanceTimingStatus({
      employeeId: existing.employeeId,
      normalizedDate: dateForExcuse,
      checkIn: effectiveCheckIn,
      checkOut: effectiveCheckOut,
      policy,
      existingDecision: {
        deductionSource: existing.deductionSource,
        deductionDecisionAt: existing.deductionDecisionAt,
        deductionValueType: existing.deductionValueType,
        deductionValue: existing.deductionValue,
      },
    });
    const {
      calc,
      recordStatus,
      excuseLeaveRequestId,
      leaveRequestId,
      onApprovedLeave,
      originalStatus,
      excusedMinutes,
      excessExcuse,
      excessExcuseFraction,
      excuseOverageMinutes,
      requiresDeductionDecision,
      deductionSource,
      deductionValueType,
      deductionValue,
    } = fin;

    const updateData = {
      checkIn: calc.checkInStr,
      checkOut: calc.checkOutStr,
      totalHours: calc.totalHours,
      status: recordStatus,
      excusedMinutes,
      remarks,
      lastManagedBy: req.user.id,
      excuseLeaveRequestId: excuseLeaveRequestId || null,
      excuseCovered: Boolean(excuseLeaveRequestId),
      leaveRequestId: leaveRequestId || null,
      onApprovedLeave,
      originalStatus: originalStatus || undefined,
      excessExcuse,
      excessExcuseFraction,
      excuseOverageMinutes,
      requiresDeductionDecision,
      deductionSource,
      deductionValueType,
      deductionValue,
      deductionDecisionBy:
        recordStatus === "PARTIAL_EXCUSED" ? existing.deductionDecisionBy : undefined,
      deductionDecisionAt:
        recordStatus === "PARTIAL_EXCUSED" ? existing.deductionDecisionAt : undefined,
    };

    if (date) {
      updateData.date = dateForExcuse;
    }

    const updated = await Attendance.findByIdAndUpdate(
      existing._id,
      { $set: updateData },
      { new: true },
    );
    if (!updated) return res.status(404).json({ error: "Record not found" });

    res.json(updated);
  } catch (error) {
    console.error("PUT /attendance/:id error:", error.message, error.stack);
    res.status(500).json({ error: "Internal server error" });
  }
},
);

router.patch(
  "/:id/deduction-source",
  requireAuth,
  enforcePolicy("manage", "attendance"),
  enforceScope(resolveAttendanceTargetEmployee),
  async (req, res) => {
    try {
      const { deductionSource } = req.body || {};
      const { deductionValueType, deductionValue } = req.body || {};
      if (!["SALARY", "VACATION_BALANCE"].includes(String(deductionSource || ""))) {
        return res.status(400).json({
          error: "deductionSource is required and must be SALARY or VACATION_BALANCE",
        });
      }
      const normalizedType = String(deductionValueType || "").toUpperCase();
      if (!["DAYS", "AMOUNT"].includes(normalizedType)) {
        return res.status(400).json({
          error: "deductionValueType is required and must be DAYS or AMOUNT",
        });
      }
      const numericValue = Number(deductionValue);
      if (!Number.isFinite(numericValue) || numericValue <= 0) {
        return res.status(400).json({
          error: "deductionValue must be a positive number",
        });
      }
      if (deductionSource === "VACATION_BALANCE" && normalizedType !== "DAYS") {
        return res.status(400).json({
          error: "VACATION_BALANCE deduction must use deductionValueType DAYS",
        });
      }

      const existing = await Attendance.findById(req.params.id);
      if (!existing) return res.status(404).json({ error: "Record not found" });

      if (existing.status !== "PARTIAL_EXCUSED") {
        return res.status(409).json({
          error: "Deduction source can only be set for PARTIAL_EXCUSED records",
        });
      }

      existing.deductionSource = deductionSource;
      existing.deductionValueType = normalizedType;
      existing.deductionValue = numericValue;
      if (normalizedType === "DAYS") {
        existing.excessExcuseFraction = numericValue;
      }
      existing.requiresDeductionDecision = false;
      existing.deductionDecisionBy = req.user.id;
      existing.deductionDecisionAt = new Date();
      await existing.save();

      const policy = await resolveAttendancePolicy();
      const out = await withAuthoritativeAttendanceFields(existing, policy);
      return res.json(out);
    } catch (error) {
      console.error("PATCH /attendance/:id/deduction-source error:", error.message);
      return res.status(500).json({ error: "Failed to update deduction source" });
    }
  },
);

router.patch(
  "/:id/rest-day-work",
  requireAuth,
  enforcePolicy("manage", "attendance"),
  enforceScope(resolveAttendanceTargetEmployee),
  async (req, res) => {
    try {
      const { approved } = req.body || {};
      if (approved !== true && approved !== false) {
        return res.status(400).json({ error: "approved must be boolean" });
      }

      const existing = await Attendance.findById(req.params.id);
      if (!existing) return res.status(404).json({ error: "Record not found" });

      const policy = await resolveAttendancePolicy();
      const nd = new Date(existing.date);
      nd.setUTCHours(0, 0, 0, 0);
      const restDays =
        Array.isArray(policy?.weeklyRestDays) && policy.weeklyRestDays.length > 0
          ? policy.weeklyRestDays
          : [5, 6];
      const isWeeklyRestDay = restDays.includes(nd.getUTCDay());
      if (!isWeeklyRestDay) {
        return res.status(409).json({ error: "This attendance row is not on a weekly rest day" });
      }

      const normalizedStatus = String(existing.status || "").toUpperCase();
      if (!["PRESENT", "LATE", "EXCUSED"].includes(normalizedStatus)) {
        return res.status(409).json({
          error: "Rest-day work approval can only be set for PRESENT/LATE/EXCUSED rows",
        });
      }

      existing.restDayWorkApproved = approved;
      existing.restDayWorkDecisionBy = req.user.id;
      existing.restDayWorkDecisionAt = new Date();
      await existing.save();

      const out = await withAuthoritativeAttendanceFields(existing, policy);
      return res.json(out);
    } catch (error) {
      console.error("PATCH /attendance/:id/rest-day-work error:", error.message);
      return res.status(500).json({ error: "Failed to update rest-day work approval" });
    }
  },
);

/**
 * DELETE /api/attendance/bulk
 * Admin only: Bulk delete records by an array of IDs.
 */
router.delete(
  "/bulk",
  requireAuth,
  enforcePolicy("manage", "attendance"),
  async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res
        .status(400)
        .json({ error: "No IDs provided for bulk deletion" });
    }

    console.log(
      `[BULK DELETE] Auth User: ${req.user.email}, Role: ${req.user.role}`,
    );
    console.log(`[BULK DELETE] Received IDs:`, ids);

    // Cast strings to ObjectIds for the $in filter
    const objectIds = ids.map((id) => new mongoose.Types.ObjectId(id));

    // Get records before deletion for audit
    const recordsToDelete = await Attendance.find({
      _id: { $in: objectIds },
    }).select("_id employeeId date");

    const result = await Attendance.deleteMany({ _id: { $in: objectIds } });

    // Create audit log for bulk deletion
    await createAuditLog({
      entityType: "Attendance",
      entityId: "BULK_DELETE",
      operation: "BULK_DELETE",
      changes: { deletedCount: result.deletedCount, ids: ids },
      previousValues: {
        records: recordsToDelete.map((r) => ({
          id: r._id,
          employeeId: r.employeeId,
          date: r.date,
        })),
      },
      performedBy: req.user.email,
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    });

    console.log(`[BULK DELETE] Result:`, result);
    res.json({
      message: `Successfully deleted ${result.deletedCount} records.`,
    });
  } catch (error) {
    console.error("Bulk Delete Error:", error);
    res.status(500).json({ error: "Failed to perform bulk delete" });
  }
},
);

router.delete(
  "/:id",
  requireAuth,
  enforcePolicy("manage", "attendance"),
  enforceScope(resolveAttendanceTargetEmployee),
  async (req, res) => {
  try {
    // Get the attendance record before deletion for audit
    const attendanceRecord = await Attendance.findById(req.params.id).populate(
      "employeeId",
      "fullName employeeCode",
    );
    if (!attendanceRecord) {
      return res.status(404).json({ error: "Record not found" });
    }

    await Attendance.findByIdAndDelete(req.params.id);

    // Create audit log
    await createAuditLog({
      entityType: "Attendance",
      entityId: req.params.id,
      operation: "DELETE",
      previousValues: attendanceRecord.toObject(),
      performedBy: req.user.email,
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete record" });
  }
},
);

router.post(
  "/import",
  requireAuth,
  enforcePolicy("manage", "attendance"),
  upload.single("file"),
  async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ error: "Please upload an Excel file" });

    const overwrite = req.body.overwrite === "true";

    // Parse workbook with cellDates for proper date handling
    const workbook = XLSX.read(req.file.buffer, {
      type: "buffer",
      cellDates: true,
    });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName)
      return res.status(400).json({ error: "Excel file has no sheets" });

    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { defval: "" }); // Include empty cells

    console.log(`[IMPORT] Sheet: ${sheetName}, Total rows: ${data.length}`);
    console.log(`[IMPORT] Headers: ${Object.keys(data[0] || {}).join(", ")}`);
    if (data.length === 0)
      return res.status(400).json({ error: "Excel file is empty" });

    // Find headers (case-insensitive, trimmed comparison)
    let firstRow = data[0];
    let headers = Object.keys(firstRow);

    // Dynamic header mapping: check both the key and the value of the first row
    const findHeader = (possibleNames) => {
      // 1. Check if any key matches
      let found = headers.find((h) =>
        possibleNames.includes(h.toLowerCase().trim()),
      );
      if (found) return found;

      // 2. Check if the value in the first row matches (common in some exports)
      found = headers.find((h) => {
        const val = firstRow[h]?.toString().toLowerCase().trim();
        return val && possibleNames.includes(val);
      });
      return found;
    };

    const codeHeader = findHeader([
      "employee code",
      "employee",
      "code",
      "emp code",
      "employee_code",
      "name",
      "__empty",
    ]);
    const dateHeader = findHeader([
      "date",
      "attendance date",
      "attendance_date",
      "max of date",
      "data",
    ]);
    const checkInHeader = findHeader([
      "check in",
      "check-in",
      "checkin",
      "clock in",
      "clock_in",
      "start time",
      "min of time",
    ]);
    const checkOutHeader = findHeader([
      "check out",
      "check-out",
      "checkout",
      "clock out",
      "clock_out",
      "end time",
      "max of time2",
    ]);

    const missingHeaders = [];
    if (!codeHeader) missingHeaders.push("Employee Code");
    if (!dateHeader) missingHeaders.push("Date");
    if (!checkInHeader) missingHeaders.push("Check In");
    if (!checkOutHeader) missingHeaders.push("Check Out");

    if (missingHeaders.length > 0) {
      return res.status(400).json({
        error: `Missing required columns: ${missingHeaders.join(", ")}`,
        receivedHeaders: headers,
        firstRowValues: firstRow,
        tip: "Excel file should have columns: Employee Code, Date, Check In, Check Out",
      });
    }

    // If the first row was actually the header row (contains "Name", "Date", etc.), skip it
    const isHeaderRow =
      firstRow[codeHeader]?.toString().toLowerCase().includes("name") ||
      firstRow[codeHeader]?.toString().toLowerCase().includes("code") ||
      firstRow[dateHeader]?.toString().toLowerCase().includes("date");

    if (isHeaderRow) {
      data.shift();
    }

    const logs = [];
    const errors = [];
    let skipped = 0;

    console.log(`[IMPORT] Starting import - Overwrite: ${overwrite}`);
    console.log(`[IMPORT] Processing ${data.length} rows...`);

    // --- Phase 0b: pre-group rows by (code + date) to merge multiple punches ---
    const parseCode = (raw) => {
      let code = (raw ?? "").toString().trim();
      if (code && code.includes("-")) {
        const m = code.match(/^(#[A-Z0-9]+)/i);
        if (m) code = m[1];
      } else if (code && code.startsWith("#")) {
        code = code.split(" ")[0];
      }
      return code;
    };

    const parseExcelDate = (rawDate) => {
      if (rawDate == null || rawDate === "") return null;
      let d;
      if (typeof rawDate === "number") {
        d = new Date((rawDate - 25569) * 86400 * 1000);
      } else {
        d = new Date(rawDate);
      }
      if (isNaN(d.getTime())) return null;
      d.setUTCHours(0, 0, 0, 0);
      return d;
    };

    const timeToMinutes = (t) => {
      const p = parseTime(t);
      if (!p) return null;
      return p.h * 60 + p.m + p.s / 60;
    };

    /** Grouped rows: key = "code|dateISO", value = { code, date, punches[] } */
    const grouped = new Map();
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const code = parseCode(row[codeHeader]);
      const rawDate = row[dateHeader];
      const cin = row[checkInHeader];
      const cout = row[checkOutHeader];

      if (!code) { errors.push(`Row ${i + 2}: Employee Code is empty`); skipped++; continue; }
      if (!rawDate) { errors.push(`Row ${i + 2}: Date is empty for ${code}`); skipped++; continue; }

      const date = parseExcelDate(rawDate);
      if (!date) {
        errors.push(`Row ${i + 2}: Invalid date "${rawDate}" for ${code}`);
        skipped++;
        continue;
      }

      if (!cin && !cout) {
        errors.push(`Row ${i + 2}: Both check-in and check-out are empty for ${code}`);
        skipped++;
        continue;
      }

      const key = `${code}|${date.toISOString()}`;
      if (!grouped.has(key)) {
        grouped.set(key, { code, date, punches: [] });
      }
      grouped.get(key).punches.push({ cin, cout, rowNum: i + 2 });
    }

    // Employee cache to avoid repeated DB lookups
    const empCache = new Map();
    async function resolveEmployee(code) {
      if (empCache.has(code)) return empCache.get(code);
      let emp = await Employee.findOne({
        $or: [{ employeeCode: code }, { email: code }],
      }).populate("departmentId");
      // Phase 0d: fallback to transfer history if current code not found
      if (!emp) {
        emp = await Employee.findOne({
          "transferHistory.previousEmployeeCode": code,
        }).populate("departmentId");
        if (emp) {
          console.log(`[IMPORT] Resolved old code ${code} -> current ${emp.employeeCode}`);
        }
      }
      empCache.set(code, emp || null);
      return emp || null;
    }

    const importPolicy = await resolveAttendancePolicy();

    for (const [, group] of grouped) {
      const { code, date, punches } = group;

      const employee = await resolveEmployee(code);
      if (!employee) {
        errors.push(`${code}: Employee not found in database`);
        skipped += punches.length;
        continue;
      }

      if (!overwrite) {
        const existing = await Attendance.findOne({ employeeId: employee._id, date });
        if (existing) {
          errors.push(`${code} on ${date.toDateString()}: Record already exists`);
          skipped += punches.length;
          continue;
        }
      }

      // Merge multiple punches: earliest check-in, latest check-out
      let earliestIn = null;
      let latestOut = null;
      for (const p of punches) {
        const cinMin = p.cin ? timeToMinutes(p.cin) : null;
        const coutMin = p.cout ? timeToMinutes(p.cout) : null;
        if (cinMin != null && (earliestIn == null || cinMin < earliestIn.min)) {
          earliestIn = { min: cinMin, raw: p.cin };
        }
        if (coutMin != null && (latestOut == null || coutMin > latestOut.min)) {
          latestOut = { min: coutMin, raw: p.cout };
        }
      }

      const mergedCheckIn = earliestIn?.raw ?? null;
      const mergedCheckOut = latestOut?.raw ?? null;

      if (!mergedCheckIn && !mergedCheckOut) {
        errors.push(`${code} on ${date.toDateString()}: No valid times after merge`);
        skipped += punches.length;
        continue;
      }

      const fin = await finalizeAttendanceTimingStatus({
        employeeId: employee._id,
        normalizedDate: date,
        checkIn: mergedCheckIn,
        checkOut: mergedCheckOut,
        policy: importPolicy,
        existingDecision: await Attendance.findOne({ employeeId: employee._id, date })
          .select("deductionSource deductionDecisionAt deductionValueType deductionValue")
          .lean(),
      });
      const calc = fin.calc;

      if (!calc.checkInStr) {
        errors.push(`${code} on ${date.toDateString()}: Invalid check-in time`);
        skipped += punches.length;
        continue;
      }

      const impStatus = fin.recordStatus;
      const impExcuseId = fin.excuseLeaveRequestId;
      const impLeaveRequestId = fin.leaveRequestId;
      const impOnApprovedLeave = fin.onApprovedLeave;
      const impOriginalStatus = fin.originalStatus;
      const excusedMinutes = fin.excusedMinutes;
      const impExcessExcuse = fin.excessExcuse;
      const impExcessExcuseFraction = fin.excessExcuseFraction;
      const impExcuseOverageMinutes = fin.excuseOverageMinutes;
      const impRequiresDeductionDecision = fin.requiresDeductionDecision;
      const impDeductionSource = fin.deductionSource;
      const impDeductionValueType = fin.deductionValueType;
      const impDeductionValue = fin.deductionValue;

      try {
        const existingProtectedRow = await Attendance.findOne({
          employeeId: employee._id,
          date,
          $or: [
            { leaveRequestId: { $ne: null }, status: "ON_LEAVE" },
            {
              excuseLeaveRequestId: { $ne: null },
              status: { $in: ["EXCUSED", "PARTIAL_EXCUSED"] },
            },
          ],
        }).select("_id status").lean();
        if (existingProtectedRow) {
          skipped += punches.length;
          logs.push({ code: employee.employeeCode, date: date.toDateString(), status: "SKIPPED", note: `Preserved leave-synced ${existingProtectedRow.status} row` });
          continue;
        }

        const existingRow = await Attendance.findOne({ employeeId: employee._id, date })
          .select("deductionDecisionBy deductionDecisionAt deductionSource deductionValueType deductionValue status")
          .lean();

        await Attendance.findOneAndUpdate(
          { employeeId: employee._id, date },
          {
            employeeId: employee._id,
            employeeCode: employee.employeeCode,
            date,
            checkIn: calc.checkInStr,
            checkOut: calc.checkOutStr,
            status: impStatus,
            totalHours: calc.totalHours,
            excusedMinutes,
            rawPunches: punches.length,
            lastManagedBy: req.user.id,
            excessExcuse: impExcessExcuse,
            excessExcuseFraction: impExcessExcuseFraction,
            excuseOverageMinutes: impExcuseOverageMinutes,
            requiresDeductionDecision: impRequiresDeductionDecision,
            deductionSource: impDeductionSource,
            deductionValueType: impDeductionValueType,
            deductionValue: impDeductionValue,
            deductionDecisionBy:
              impStatus === "PARTIAL_EXCUSED" ? existingRow?.deductionDecisionBy : undefined,
            deductionDecisionAt:
              impStatus === "PARTIAL_EXCUSED" ? existingRow?.deductionDecisionAt : undefined,
            ...(impExcuseId
              ? { excuseLeaveRequestId: impExcuseId, excuseCovered: true }
              : { excuseLeaveRequestId: null, excuseCovered: false }),
            leaveRequestId: impLeaveRequestId,
            onApprovedLeave: impOnApprovedLeave,
            originalStatus: impOriginalStatus || undefined,
          },
          { upsert: true },
        );
        const mergeNote = punches.length > 1 ? ` (merged ${punches.length} rows)` : "";
        logs.push({
          code: employee.employeeCode,
          date: date.toDateString(),
          status: impStatus,
          hours: calc.totalHours,
          merged: punches.length,
        });
        console.log(
          `[IMPORT] OK ${employee.employeeCode} - ${impStatus} (${calc.totalHours}h)${mergeNote}`,
        );
      } catch (dbErr) {
        errors.push(`${code} on ${date.toDateString()}: DB error: ${dbErr.message}`);
        skipped += punches.length;
      }
    }

    const mergedCount = [...grouped.values()].filter((g) => g.punches.length > 1).length;
    console.log(
      `[IMPORT] Complete: ${logs.length} succeeded, ${skipped} failed, ${mergedCount} merged`,
    );

    res.json({
      message: `Import complete. ${logs.length} records processed${mergedCount ? `, ${mergedCount} multi-punch days merged` : ""}.`,
      summary: {
        total: data.length,
        success: logs.length,
        failed: errors.length,
        skipped,
        merged: mergedCount,
      },
      records: logs.length > 0 ? logs.slice(0, 10) : undefined,
      errors: errors.length > 0 ? errors.slice(0, 20) : undefined,
      allErrorsCount: errors.length > 20 ? errors.length - 20 : 0,
    });
  } catch (error) {
    console.error("[IMPORT] Error:", error);
    res.status(500).json({
      error: "Failed to process Excel file",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
},
);

export default router;
