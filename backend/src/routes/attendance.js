import { Router } from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import * as XLSX from "xlsx";
import { Attendance } from "../models/Attendance.js";
import { LeaveRequest } from "../models/LeaveRequest.js";
import { Employee } from "../models/Employee.js";
import { Department } from "../models/Department.js";
import { Team } from "../models/Team.js";
import { requireAuth } from "../middleware/auth.js";
import mongoose from "mongoose";
import { createAuditLog } from "../services/auditService.js";
import { normalizeRole, ROLE } from "../utils/roles.js";
import {
  parseTimeToMinutes,
  excuseCoversLateCheckIn,
  computeMidDayExcuseCredit,
} from "../utils/excuseAttendance.js";
import { OrganizationPolicy } from "../models/OrganizationPolicy.js";
import { computeMonthlyAnalysis } from "../services/attendanceAnalysisService.js";
import { mapSummaryForMonthlyReportApi } from "../utils/monthlyReportPublicDto.js";

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const upload = multer({ storage: multer.memoryStorage() });

/**
 ** Helper to parse various time formats (String "HH:mm", "HH:mm:ss", "HH:mm AM/PM", or Date object).
 */
const parseTime = (timeStr) => {
  if (timeStr === undefined || timeStr === null || timeStr === "") return null;

  if (timeStr instanceof Date)
    return {
      h: timeStr.getHours(),
      m: timeStr.getMinutes(),
      s: timeStr.getSeconds(),
    };

  // Handle Excel numeric time (fractional day)
  if (typeof timeStr === "number") {
    const totalSeconds = Math.round(timeStr * 86400);
    return {
      h: Math.floor(totalSeconds / 3600),
      m: Math.floor((totalSeconds % 3600) / 60),
      s: totalSeconds % 60,
    };
  }

  const str = timeStr.toString().trim().toUpperCase();
  // Regex for HH:mm:ss AM/PM
  const match = str.match(/(\d+):(\d+)(?::(\d+))?\s*(AM|PM)?/i);
  if (!match) return null;

  let h = parseInt(match[1]);
  const m = parseInt(match[2]);
  const s = match[3] ? parseInt(match[3]) : 0;
  const ampm = match[4];

  if (ampm === "PM" && h < 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;

  return { h, m, s };
};

/**
 * Calculates total work hours and attendance status based on times and policy.
 * @param {string} checkIn
 * @param {string} checkOut
 * @param {Object} policy - { standardStartTime, standardEndTime, gracePeriod }
 */
const calculateStatus = (
  checkIn,
  checkOut,
  policy = { standardStartTime: "09:00", standardEndTime: "17:00", gracePeriod: 15 },
) => {
  const t1 = parseTime(checkIn);
  const t2 = parseTime(checkOut);
  const shiftStart = parseTime(policy.standardStartTime || "09:00");
  const shiftEnd = parseTime(policy.standardEndTime || "17:00");
  const graceMinutes = policy.gracePeriod ?? 15;

  const format24h = (t) => {
    if (!t) return null;
    return `${t.h.toString().padStart(2, "0")}:${t.m.toString().padStart(2, "0")}:${t.s.toString().padStart(2, "0")}`;
  };

  if (t1 && !t2) {
    return {
      t1, t2: null, totalHours: 0, status: "INCOMPLETE",
      checkInStr: format24h(t1), checkOutStr: null,
    };
  }

  const totalHours =
    t1 && t2
      ? parseFloat(
          (
            t2.h + t2.m / 60 + t2.s / 3600 -
            (t1.h + t1.m / 60 + t1.s / 3600)
          ).toFixed(2),
        )
      : 0;

  let status = "PRESENT";

  if (t1 && shiftStart) {
    const checkInMinutes = t1.h * 60 + t1.m;
    const limitMinutes = shiftStart.h * 60 + shiftStart.m + graceMinutes;
    if (checkInMinutes > limitMinutes) {
      status = "LATE";
    }
  }

  if (status === "PRESENT" && t2 && shiftEnd) {
    const checkOutMinutes = t2.h * 60 + t2.m;
    const endMinutes = shiftEnd.h * 60 + shiftEnd.m;
    if (checkOutMinutes < endMinutes) {
      status = "EARLY_DEPARTURE";
    }
  }

  return {
    t1, t2, totalHours, status,
    checkInStr: format24h(t1), checkOutStr: format24h(t2),
  };
};

/**
 * If status would be LATE, an approved excuse on that day may clear lateness.
 * @returns {Promise<import("mongoose").Types.ObjectId | null>}
 */
async function findApprovedExcuseCoveringLate(
  employeeId,
  normalizedDate,
  checkInStr,
  policy,
) {
  const shiftStartMin = parseTimeToMinutes(
    policy.standardStartTime || "09:00",
  );
  const grace = policy.gracePeriod ?? 15;
  const checkInMin = parseTimeToMinutes(checkInStr);
  if (shiftStartMin == null || checkInMin == null) return null;

  const dayStart = new Date(normalizedDate);
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  const excuses = await LeaveRequest.find({
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
 */
async function findApprovedLeaveCoverage(employeeId, normalizedDate) {
  const dayStart = new Date(normalizedDate);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

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
      return {
        standardStartTime: ar.standardStartTime,
        standardEndTime: ar.standardEndTime || "17:00",
        gracePeriod: ar.gracePeriodMinutes ?? 15,
      };
    }
  } catch (_) { /* fall through to system defaults */ }
  return {
    standardStartTime: "09:00",
    standardEndTime: "17:00",
    gracePeriod: 15,
  };
}

/**
 * Find approved mid-day excuses for a date and compute credited minutes.
 * Also returns whether the excuse covers through end of day.
 */
async function resolveMidDayExcuseCredit(employeeId, normalizedDate, policy) {
  const shiftStartMin = parseTimeToMinutes(policy.standardStartTime || "09:00");
  const shiftEndMin = parseTimeToMinutes(policy.standardEndTime || "17:00");
  const grace = policy.gracePeriod ?? 15;
  if (shiftStartMin == null || shiftEndMin == null) {
    return { creditMinutes: 0, coversEndOfDay: false };
  }

  const dayStart = new Date(normalizedDate);
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  const excuses = await LeaveRequest.find({
    employeeId,
    kind: "EXCUSE",
    status: "APPROVED",
    excuseDate: { $gte: dayStart, $lt: dayEnd },
  }).lean();

  if (excuses.length === 0) return { creditMinutes: 0, coversEndOfDay: false };
  return computeMidDayExcuseCredit(excuses, shiftStartMin, shiftEndMin, grace);
}

async function resolveAttendanceAccess(user) {
  const role = normalizeRole(user.role);
  if (role === ROLE.ADMIN || role === ROLE.HR_MANAGER || role === ROLE.HR_STAFF) {
    return {
      scope: "all",
      actions: ["view", "create", "edit", "delete", "import"],
    };
  }

  const hrDept = await Department.findOne({ code: "HR" })
    || await Department.findOne({ name: "HR" });
  if (hrDept && hrDept.head === user.email) {
    return {
      scope: "all",
      actions: ["view", "create", "edit", "delete", "import"],
    };
  }

  const isDeptHead = await Department.findOne({ head: user.email });
  if (isDeptHead || role === ROLE.MANAGER) {
    return { scope: "department", actions: ["view", "edit"] };
  }

  // Team Leader check — search BOTH embedded AND standalone Team collection
  const managedTeamNames = [];
  const deptsWithTeams = await Department.find({ "teams.leaderEmail": user.email });
  deptsWithTeams.forEach((d) => {
    d.teams.forEach((t) => {
      if (t.leaderEmail === user.email) managedTeamNames.push(t.name);
    });
  });
  const standaloneTeams = await Team.find({ leaderEmail: user.email, status: "ACTIVE" });
  standaloneTeams.forEach((t) => {
    if (!managedTeamNames.includes(t.name)) managedTeamNames.push(t.name);
  });

  if (user.role === "TEAM_LEADER" || managedTeamNames.length > 0) {
    return { scope: "team", actions: ["view"], teams: managedTeamNames };
  }

  return { scope: "self", actions: ["view"] };
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

function canAccessMonthlyAttendanceReport(user) {
  const role = normalizeRole(user?.role);
  return (
    role === ROLE.ADMIN ||
    role === ROLE.HR_STAFF ||
    role === ROLE.HR_MANAGER
  );
}

router.get("/", requireAuth, async (req, res) => {
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

    if (access.scope === "subordinates") {
      // Direct Reports for Managers
      const subordinateIds = await Employee.find({
        managerId: req.user.id,
      }).distinct("_id");
      filter.employeeId = { $in: subordinateIds };
    } else if (access.scope === "team") {
      // Team Members for Team Leaders — search BOTH embedded AND standalone teams
      const memberEmails = [];

      // 1. Embedded teams in Department.teams[]
      const departments = await Department.find({ "teams.leaderEmail": req.user.email });
      departments.forEach((d) => {
        d.teams
          .filter((t) => t.leaderEmail === req.user.email)
          .forEach((t) => memberEmails.push(...t.members));
      });

      // 2. Standalone Team collection
      const standaloneTeams = await Team.find({ leaderEmail: req.user.email, status: "ACTIVE" });
      standaloneTeams.forEach((t) => {
        t.members.forEach((m) => { if (!memberEmails.includes(m)) memberEmails.push(m); });
      });

      const memberIds = await Employee.find({
        email: { $in: memberEmails },
      }).distinct("_id");
      filter.employeeId = { $in: memberIds };
    } else if (access.scope === "department") {
      // All in Headed Department
      const managedDeptNames = await Department.find({
        head: req.user.email,
      }).distinct("name");
      const deptEmployees = await Employee.find({
        department: { $in: managedDeptNames },
      }).distinct("_id");
      filter.employeeId = { $in: deptEmployees };
    } else if (access.scope === "self") {
      filter.employeeId = req.user.id;
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
      if (access.scope === "self" && String(employeeId) !== String(req.user.id)) {
        return res.status(403).json({ error: "Forbidden: Cannot view other employees" });
      }
      if (access.scope !== "all") {
        const scopedIds = filter.employeeId?.$in;
        if (scopedIds) {
          const allowed = scopedIds.some((id) => String(id) === String(employeeId));
          if (!allowed) {
            return res.status(403).json({ error: "Forbidden: Employee not in your scope" });
          }
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

    res.json(
      isPaginated
        ? {
            attendance,
            pagination: {
              currentPage: pageNum,
              totalPages: Math.ceil(totalCount / limitNum),
              totalCount,
              limit: limitNum,
            },
          }
        : attendance,
    );
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch attendance data" });
  }
});

/**
 * GET /api/attendance/employee/:id
 * Fetches the last 30 days of attendance for a specific employee.
 */
router.get("/employee/:id", requireAuth, async (req, res) => {
  try {
    const access = await resolveAttendanceAccess(req.user);
    if (access.scope === "self" && req.user.id !== req.params.id) {
      return res
        .status(403)
        .json({ error: "Forbidden: Can only view self attendance" });
    }
    // TODO: Add more granular scope checks if needed (e.g., manager check)

    const attendance = await Attendance.find({ employeeId: req.params.id })
      .sort({ date: -1 })
      .limit(30);
    res.json(attendance);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch employee attendance" });
  }
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const access = await resolveAttendanceAccess(req.user);
    if (!access.actions.includes("create"))
      return res.status(403).json({ error: "Cannot create attendance" });

    const {
      employeeId,
      date,
      checkIn,
      checkOut,
      status: manualStatus,
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
    const calc = calculateStatus(checkIn, checkOut, policy);

    let recordStatus = manualStatus || calc.status;
    let excuseLeaveRequestId;
    let leaveRequestId;
    let onApprovedLeave = false;
    let originalStatus;
    let excusedMinutes = 0;
    let excessExcuse = false;
    let excessExcuseFraction = 0;

    if (recordStatus === "LATE" && calc.checkInStr) {
      const excuseDoc = await findApprovedExcuseCoveringLate(
        employeeId, normalizedDate, calc.checkInStr, policy,
      );
      if (excuseDoc) {
        originalStatus = recordStatus;
        recordStatus = "EXCUSED";
        excuseLeaveRequestId = excuseDoc._id;
        excusedMinutes = excuseDoc.computed?.minutes || 0;
        if (excuseDoc.quotaExceeded && excuseDoc.excessDeductionMethod === "SALARY") {
          excessExcuse = true;
          const hoursPerDay = 8;
          excessExcuseFraction = excuseDoc.excessDeductionAmount
            || (excusedMinutes / (hoursPerDay * 60));
        }
      }
    }

    const midDay = await resolveMidDayExcuseCredit(employeeId, normalizedDate, policy);
    if (midDay.creditMinutes > 0 && !excuseLeaveRequestId) {
      excusedMinutes = midDay.creditMinutes;
    }
    if (recordStatus === "EARLY_DEPARTURE" && midDay.coversEndOfDay) {
      recordStatus = "PRESENT";
    }

    if (recordStatus === "ABSENT") {
      const covered = await findApprovedLeaveCoverage(employeeId, normalizedDate);
      if (covered) {
        originalStatus = recordStatus;
        recordStatus = covered.status;
        leaveRequestId = covered.leaveRequestId;
        onApprovedLeave = true;
      }
    }

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
router.get("/template", requireAuth, (req, res) => {
  try {
    const templatePath = path.join(__dirname, "../AttendanceTemplate.xlsx");
    res.download(templatePath, "AttendanceImportTemplate.xlsx");
  } catch (error) {
    console.error("Template download error:", error);
    res.status(500).json({ error: "Failed to download template" });
  }
});

// ─── Monthly Analysis & Report (must be before /:id to avoid param capture) ──

/** Full computeMonthlyAnalysis payload (includes salary-style fields). Prefer `/monthly-report` for HR UI exports without EGP. */
router.get("/monthly-analysis", requireAuth, async (req, res) => {
  try {
    if (!canAccessMonthlyAttendanceReport(req.user)) {
      return res
        .status(403)
        .json({ error: "Forbidden: monthly report is available for HR/Admin only" });
    }
    const parsed = validateReportPeriodParams(req, res);
    if (!parsed) return;
    const { year, month } = parsed;
    const departmentId = req.query.departmentId || undefined;
    const result = await computeMonthlyAnalysis(year, month, departmentId, {
      includeDetails: true,
    });
    res.json(result);
  } catch (error) {
    console.error("GET /attendance/monthly-analysis error:", error.message);
    res.status(500).json({ error: "Failed to compute monthly analysis" });
  }
});

/** Attendance-focused summary: deduction amounts in days only; `approvedOvertimeUnits` from assessments; no net salary. */
router.get("/monthly-report", requireAuth, async (req, res) => {
  try {
    if (!canAccessMonthlyAttendanceReport(req.user)) {
      return res
        .status(403)
        .json({ error: "Forbidden: monthly report is available for HR/Admin only" });
    }
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
});

router.get("/monthly-report/export", requireAuth, async (req, res) => {
  try {
    if (!canAccessMonthlyAttendanceReport(req.user)) {
      return res
        .status(403)
        .json({ error: "Forbidden: monthly report is available for HR/Admin only" });
    }
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
});

// ─── CRUD with :id param ─────────────────────────────────────────────────────

router.put("/:id", requireAuth, async (req, res) => {
  try {
    const access = await resolveAttendanceAccess(req.user);
    if (!access.actions.includes("edit"))
      return res.status(403).json({ error: "Forbidden" });

    const { checkIn, checkOut, status: manualStatus, remarks, date } = req.body;

    const existing = await Attendance.findById(req.params.id);
    if (!existing)
      return res.status(404).json({ error: "Record not found" });

    const policy = await resolveAttendancePolicy();
    const calc = calculateStatus(checkIn, checkOut, policy);

    let dateForExcuse = existing.date;
    if (date) {
      const nd = new Date(date);
      nd.setUTCHours(0, 0, 0, 0);
      dateForExcuse = nd;
    }

    let recordStatus = manualStatus || calc.status;
    let excuseLeaveRequestId = existing.excuseLeaveRequestId;
    let leaveRequestId = existing.leaveRequestId;
    let onApprovedLeave = Boolean(existing.onApprovedLeave);
    let originalStatus = existing.originalStatus;
    let excusedMinutes = 0;
    let excessExcuse = Boolean(existing.excessExcuse);
    let excessExcuseFraction = existing.excessExcuseFraction || 0;

    if (recordStatus === "LATE" && calc.checkInStr) {
      const excuseDoc = await findApprovedExcuseCoveringLate(
        existing.employeeId, dateForExcuse, calc.checkInStr, policy,
      );
      if (excuseDoc) {
        originalStatus = recordStatus;
        recordStatus = "EXCUSED";
        excuseLeaveRequestId = excuseDoc._id;
        excusedMinutes = excuseDoc.computed?.minutes || 0;
        if (excuseDoc.quotaExceeded && excuseDoc.excessDeductionMethod === "SALARY") {
          excessExcuse = true;
          const hoursPerDay = 8;
          excessExcuseFraction = excuseDoc.excessDeductionAmount
            || (excusedMinutes / (hoursPerDay * 60));
        } else {
          excessExcuse = false;
          excessExcuseFraction = 0;
        }
      } else {
        excuseLeaveRequestId = undefined;
        excessExcuse = false;
        excessExcuseFraction = 0;
      }
    } else if (recordStatus !== "LATE" && recordStatus !== "EXCUSED") {
      excuseLeaveRequestId = undefined;
      excessExcuse = false;
      excessExcuseFraction = 0;
    }

    const midDay = await resolveMidDayExcuseCredit(existing.employeeId, dateForExcuse, policy);
    if (midDay.creditMinutes > 0 && !excuseLeaveRequestId) {
      excusedMinutes = midDay.creditMinutes;
    }
    if (recordStatus === "EARLY_DEPARTURE" && midDay.coversEndOfDay) {
      recordStatus = "PRESENT";
    }

    if (recordStatus === "ABSENT") {
      const covered = await findApprovedLeaveCoverage(existing.employeeId, dateForExcuse);
      if (covered) {
        originalStatus = "ABSENT";
        recordStatus = covered.status;
        leaveRequestId = covered.leaveRequestId;
        onApprovedLeave = true;
      } else {
        leaveRequestId = null;
        onApprovedLeave = false;
        originalStatus = undefined;
      }
    } else if (recordStatus !== "ON_LEAVE" && recordStatus !== "EXCUSED") {
      leaveRequestId = null;
      onApprovedLeave = false;
      originalStatus = undefined;
    }

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
});

/**
 * DELETE /api/attendance/bulk
 * Admin only: Bulk delete records by an array of IDs.
 */
router.delete("/bulk", requireAuth, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res
        .status(400)
        .json({ error: "No IDs provided for bulk deletion" });
    }

    const bulkRole = normalizeRole(req.user.role);
    if (bulkRole !== ROLE.ADMIN && bulkRole !== ROLE.HR_MANAGER && bulkRole !== ROLE.HR_STAFF) {
      return res
        .status(403)
        .json({ error: "Forbidden: Only Admin/HR can bulk delete." });
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
});

router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const access = await resolveAttendanceAccess(req.user);
    if (!access.actions.includes("delete"))
      return res.status(403).json({ error: "Forbidden" });

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
});

router.post("/import", requireAuth, upload.single("file"), async (req, res) => {
  try {
    const access = await resolveAttendanceAccess(req.user);
    if (!access.actions.includes("import"))
      return res.status(403).json({ error: "Forbidden" });
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

      const policy = await resolveAttendancePolicy();
      const calc = calculateStatus(mergedCheckIn, mergedCheckOut, policy);

      if (!calc.checkInStr) {
        errors.push(`${code} on ${date.toDateString()}: Invalid check-in time`);
        skipped += punches.length;
        continue;
      }

      let impStatus = calc.status;
      let impExcuseId;
      let impLeaveRequestId = null;
      let impOnApprovedLeave = false;
      let impOriginalStatus;
      let excusedMinutes = 0;
      let impExcessExcuse = false;
      let impExcessExcuseFraction = 0;

      if (impStatus === "LATE" && calc.checkInStr) {
        const excuseDoc = await findApprovedExcuseCoveringLate(
          employee._id, date, calc.checkInStr, policy,
        );
        if (excuseDoc) {
          impOriginalStatus = impStatus;
          impStatus = "EXCUSED";
          impExcuseId = excuseDoc._id;
          excusedMinutes = excuseDoc.computed?.minutes || 0;
          if (excuseDoc.quotaExceeded && excuseDoc.excessDeductionMethod === "SALARY") {
            impExcessExcuse = true;
            impExcessExcuseFraction = excuseDoc.excessDeductionAmount
              || (excusedMinutes / (8 * 60));
          }
        }
      }

      const midDay = await resolveMidDayExcuseCredit(employee._id, date, policy);
      if (midDay.creditMinutes > 0 && !impExcuseId) {
        excusedMinutes = midDay.creditMinutes;
      }
      if (impStatus === "EARLY_DEPARTURE" && midDay.coversEndOfDay) {
        impStatus = "PRESENT";
      }

      if (impStatus === "ABSENT") {
        const covered = await findApprovedLeaveCoverage(employee._id, date);
        if (covered) {
          impOriginalStatus = "ABSENT";
          impStatus = covered.status;
          impLeaveRequestId = covered.leaveRequestId;
          impOnApprovedLeave = true;
        }
      }

      try {
        const existingProtectedRow = await Attendance.findOne({
          employeeId: employee._id,
          date,
          $or: [
            { leaveRequestId: { $ne: null }, status: "ON_LEAVE" },
            { excuseLeaveRequestId: { $ne: null }, status: "EXCUSED" },
          ],
        }).select("_id status").lean();
        if (existingProtectedRow) {
          skipped += punches.length;
          logs.push({ code: employee.employeeCode, date: date.toDateString(), status: "SKIPPED", note: `Preserved leave-synced ${existingProtectedRow.status} row` });
          continue;
        }

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
});

export default router;
