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
import { isAdminRole, isHrOrAdmin } from "../utils/roles.js";
import {
  parseTimeToMinutes,
  excuseCoversLateCheckIn,
} from "../utils/excuseAttendance.js";

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const upload = multer({ storage: multer.memoryStorage() });

/**
 * Helper to parse various time formats (String "HH:mm", "HH:mm:ss", "HH:mm AM/PM", or Date object).
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
 * Calculates total work hours and attendance status based on times and department policy.
 * @param {string} checkIn - "HH:mm" or "HH:mm:ss"
 * @param {string} checkOut - "HH:mm" or "HH:mm:ss"
 * @param {Object} policy - { standardStartTime: "HH:mm", gracePeriod: Number }
 */
const calculateStatus = (
  checkIn,
  checkOut,
  policy = { standardStartTime: "09:00", gracePeriod: 15 },
) => {
  const t1 = parseTime(checkIn);
  const t2 = parseTime(checkOut);
  const shiftStart = parseTime(policy.standardStartTime || "09:00");
  const graceMinutes = policy.gracePeriod ?? 15;

  const totalHours =
    t1 && t2
      ? parseFloat(
          (
            t2.h +
            t2.m / 60 +
            t2.s / 3600 -
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

  // Format to 24-hour HH:MM:SS
  const format24h = (t) => {
    if (!t) return null;
    return `${t.h.toString().padStart(2, "0")}:${t.m.toString().padStart(2, "0")}:${t.s.toString().padStart(2, "0")}`;
  };

  return {
    t1,
    t2,
    totalHours,
    status,
    checkInStr: format24h(t1),
    checkOutStr: format24h(t2),
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
    if (
      excuseCoversLateCheckIn(
        checkInMin,
        es,
        ee,
        shiftStartMin,
        grace,
      )
    ) {
      return ex._id;
    }
  }
  return null;
}

async function resolveAttendanceAccess(user) {
  if (isHrOrAdmin(user)) {
    return {
      scope: "all",
      actions: ["view", "create", "edit", "delete", "import"],
    };
  }

  // HR Head check — use code first, fallback to name
  const hrDept = await Department.findOne({ code: "HR" })
    || await Department.findOne({ name: "HR" });
  if (hrDept && hrDept.head === user.email) {
    return {
      scope: "all",
      actions: ["view", "create", "edit", "delete", "import"],
    };
  }

  // Department Head check
  const isDeptHead = await Department.findOne({ head: user.email });
  if (isDeptHead || user.role === "MANAGER" || user.role === 2) {
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
    if (employeeId) filter.employeeId = employeeId;
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
      return res.status(403).json({ error: "Forbidden" });

    const {
      employeeId,
      date,
      checkIn,
      checkOut,
      status: manualStatus,
      remarks,
    } = req.body;
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

    // Policy lookup
    const dept = employee.departmentId;
    const policy = {
      standardStartTime: dept?.standardStartTime || "09:00",
      gracePeriod: dept?.gracePeriod ?? 15,
    };

    const calc = calculateStatus(checkIn, checkOut, policy);

    let recordStatus = manualStatus || calc.status;
    let excuseLeaveRequestId;
    if (!manualStatus && recordStatus === "LATE" && calc.checkInStr) {
      const exId = await findApprovedExcuseCoveringLate(
        employeeId,
        normalizedDate,
        calc.checkInStr,
        policy,
      );
      if (exId) {
        recordStatus = "EXCUSED";
        excuseLeaveRequestId = exId;
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
      remarks,
      lastManagedBy: req.user.id,
      ...(excuseLeaveRequestId
        ? {
            excuseLeaveRequestId,
            excuseCovered: true,
          }
        : {}),
    });

    await newRecord.save();
    res.status(201).json(newRecord);
  } catch (error) {
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

router.put("/:id", requireAuth, async (req, res) => {
  try {
    const access = await resolveAttendanceAccess(req.user);
    if (!access.actions.includes("edit"))
      return res.status(403).json({ error: "Forbidden" });

    const { checkIn, checkOut, status: manualStatus, remarks, date } = req.body;

    const existing = await Attendance.findById(req.params.id);
    if (!existing)
      return res.status(404).json({ error: "Record not found" });

    let policy = { standardStartTime: "09:00", gracePeriod: 15 };
    try {
      const emp = await Employee.findById(existing.employeeId).populate(
        "departmentId",
      );
      const dept = emp?.departmentId;
      if (dept) {
        policy = {
          standardStartTime: dept.standardStartTime || "09:00",
          gracePeriod: dept.gracePeriod ?? 15,
        };
      }
    } catch (_) {
      /* keep defaults */
    }

    const calc = calculateStatus(checkIn, checkOut, policy);

    let dateForExcuse = existing.date;
    if (date) {
      const nd = new Date(date);
      nd.setUTCHours(0, 0, 0, 0);
      dateForExcuse = nd;
    }

    let recordStatus = manualStatus || calc.status;
    let excuseLeaveRequestId = existing.excuseLeaveRequestId;
    if (!manualStatus && recordStatus === "LATE" && calc.checkInStr) {
      const exId = await findApprovedExcuseCoveringLate(
        existing.employeeId,
        dateForExcuse,
        calc.checkInStr,
        policy,
      );
      if (exId) {
        recordStatus = "EXCUSED";
        excuseLeaveRequestId = exId;
      } else {
        excuseLeaveRequestId = undefined;
      }
    } else if (manualStatus) {
      if (recordStatus !== "EXCUSED") {
        excuseLeaveRequestId = undefined;
      }
    } else if (recordStatus !== "LATE" && recordStatus !== "EXCUSED") {
      excuseLeaveRequestId = undefined;
    }

    const updateData = {
      checkIn: calc.checkInStr,
      checkOut: calc.checkOutStr,
      totalHours: calc.totalHours,
      status: recordStatus,
      remarks,
      lastManagedBy: req.user.id,
      excuseLeaveRequestId: excuseLeaveRequestId || null,
      excuseCovered: Boolean(excuseLeaveRequestId),
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

    // Role check (Admin/HR only)
    if (!isHrOrAdmin(req.user)) {
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

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      let code = row[codeHeader]?.toString().trim();
      const rawDate = row[dateHeader];
      const checkInStr = row[checkInHeader];
      const checkOutStr = row[checkOutHeader];

      // Real Data parsing: If code contains a hyphen (e.g. #CODE-Name), extract only the code
      if (code && code.includes("-")) {
        const match = code.match(/^(#[A-Z0-9]+)/i);
        if (match) code = match[1];
      } else if (code && code.startsWith("#")) {
        code = code.split(" ")[0]; // Handle "#CODE Name"
      }

      // Validate required fields
      if (!code) {
        errors.push(`Row ${i + 2}: Employee Code is empty`);
        skipped++;
        continue;
      }
      if (!rawDate) {
        errors.push(`Row ${i + 2}: Date is empty for employee ${code}`);
        skipped++;
        continue;
      }
      if (!checkInStr) {
        errors.push(`Row ${i + 2}: Check In time is empty for ${code}`);
        skipped++;
        continue;
      }
      if (!checkOutStr) {
        errors.push(`Row ${i + 2}: Check Out time is empty for ${code}`);
        skipped++;
        continue;
      }

      // Parse date - handle both Excel date serial and text formats
      let date;
      if (typeof rawDate === "number") {
        // Excel serial date (number of days since Jan 1, 1900)
        date = new Date((rawDate - 25569) * 86400 * 1000);
      } else {
        date = new Date(rawDate);
      }

      if (isNaN(date.getTime())) {
        errors.push(
          `Row ${i + 2}: Invalid date format "${rawDate}" for employee ${code}. Use YYYY-MM-DD`,
        );
        skipped++;
        continue;
      }

      // Normalize date to UTC midnight
      date.setUTCHours(0, 0, 0, 0);

      // Find employee with department
      const employee = await Employee.findOne({
        $or: [{ employeeCode: code }, { email: code }],
      }).populate("departmentId");

      if (!employee) {
        errors.push(
          `Row ${i + 2}: Employee with code/email "${code}" not found in database`,
        );
        skipped++;
        continue;
      }

      // Check existing record if not overwriting
      if (!overwrite) {
        const existing = await Attendance.findOne({
          employeeId: employee._id,
          date,
        });
        if (existing) {
          errors.push(
            `Row ${i + 2}: Record already exists for ${code} on ${date.toDateString()}`,
          );
          skipped++;
          continue;
        }
      }

      // Policy lookup
      const dept = employee.departmentId;
      const policy = {
        standardStartTime: dept?.standardStartTime || "09:00",
        gracePeriod: dept?.gracePeriod ?? 15,
      };

      // Calculate status
      const calc = calculateStatus(checkInStr, checkOutStr, policy);
      if (!calc.checkInStr || !calc.checkOutStr) {
        errors.push(
          `Row ${i + 2}: Invalid time format. Expected HH:MM format for ${code}`,
        );
        skipped++;
        continue;
      }

      let impStatus = calc.status;
      let impExcuseId;
      if (impStatus === "LATE" && calc.checkInStr) {
        const exId = await findApprovedExcuseCoveringLate(
          employee._id,
          date,
          calc.checkInStr,
          policy,
        );
        if (exId) {
          impStatus = "EXCUSED";
          impExcuseId = exId;
        }
      }

      try {
        await Attendance.findOneAndUpdate(
          { employeeId: employee._id, date },
          {
            employeeId: employee._id,
            employeeCode: code,
            date,
            checkIn: calc.checkInStr,
            checkOut: calc.checkOutStr,
            status: impStatus,
            totalHours: calc.totalHours,
            lastManagedBy: req.user.id,
            ...(impExcuseId
              ? { excuseLeaveRequestId: impExcuseId, excuseCovered: true }
              : { excuseLeaveRequestId: null, excuseCovered: false }),
          },
          { upsert: true },
        );
        logs.push({
          code,
          date: date.toDateString(),
          status: impStatus,
          hours: calc.totalHours,
        });
        console.log(
          `[IMPORT] ✓ Row ${i + 2}: ${code} - ${impStatus} (${calc.totalHours}h)`,
        );
      } catch (dbErr) {
        errors.push(
          `Row ${i + 2}: Database error for ${code}: ${dbErr.message}`,
        );
        skipped++;
      }
    }

    console.log(
      `[IMPORT] Complete: ${logs.length} succeeded, ${skipped} failed`,
    );

    res.json({
      message: `✓ Import complete. ${logs.length} records processed successfully.`,
      summary: {
        total: data.length,
        success: logs.length,
        failed: errors.length,
        skipped,
      },
      records: logs.length > 0 ? logs.slice(0, 10) : undefined, // Show first 10 for verification
      errors: errors.length > 0 ? errors.slice(0, 20) : undefined, // Show first 20 errors
      allErrorsCount: errors.length > 20 ? errors.length - 20 : 0, // Indicate if there are more
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
