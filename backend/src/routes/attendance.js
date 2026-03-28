import { Router } from "express";
import multer from "multer";
import { read, utils } from "xlsx";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { AttendanceEvent } from "../models/AttendanceEvent.js";
import { AttendanceDaily } from "../models/AttendanceDaily.js";
import { AttendancePolicy } from "../models/AttendancePolicy.js";
import { AttendanceMetric } from "../models/AttendanceMetric.js";
import { Employee } from "../models/Employee.js";
import {
  processDay,
  processBulk,
  generateMetric,
  generateMonthlyMetrics,
} from "../services/attendanceEngine.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// All routes require authentication
router.use(requireAuth);

// ═════════════════════════════════════════════════════════════════════════════
// EVENTS
// ═════════════════════════════════════════════════════════════════════════════

/** POST /events — Add manual event */
router.post("/events", requireRole(["ADMIN", "HR_STAFF"]), async (req, res) => {
  try {
    const { employeeId, timestamp, eventType, source, notes, deviceId } = req.body;

    if (!employeeId || !timestamp || !eventType) {
      return res.status(400).json({ error: "employeeId, timestamp, and eventType are required" });
    }

    const employee = await Employee.findById(employeeId).lean();
    if (!employee) return res.status(404).json({ error: "Employee not found" });

    const event = await AttendanceEvent.create({
      employeeId,
      employeeCode: employee.employeeCode,
      timestamp: new Date(timestamp),
      eventType,
      source: source || "MANUAL",
      notes,
      deviceId,
      addedBy: req.user?.id,
    });

    res.status(201).json({ event });
  } catch (err) {
    console.error("Add event error:", err);
    res.status(500).json({ error: err.message });
  }
});

/** POST /events/import — Excel bulk import */
router.post("/events/import", requireRole(["ADMIN", "HR_STAFF"]), upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const workbook = read(req.file.buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = utils.sheet_to_json(sheet);

    const batchId = `import_${Date.now()}`;
    let imported = 0;
    const errors = [];

    // Cache employee lookups
    const employeeCache = new Map();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const code = String(row.employeeCode || row.EmployeeCode || "").trim();
      const dateStr = row.date || row.Date;
      const checkIn = row.checkIn || row.CheckIn;
      const checkOut = row.checkOut || row.CheckOut;

      if (!code) {
        errors.push({ row: i + 2, reason: "Missing employeeCode" });
        continue;
      }

      // Resolve employee
      let employee = employeeCache.get(code);
      if (!employee) {
        employee = await Employee.findOne({ employeeCode: code }).lean();
        if (employee) employeeCache.set(code, employee);
      }

      if (!employee) {
        errors.push({ row: i + 2, reason: `Employee code "${code}" not found` });
        continue;
      }

      const baseDate = new Date(dateStr);
      if (isNaN(baseDate.getTime())) {
        errors.push({ row: i + 2, reason: `Invalid date: ${dateStr}` });
        continue;
      }

      const events = [];

      if (checkIn) {
        const [h, m] = String(checkIn).split(":").map(Number);
        const ts = new Date(baseDate);
        ts.setUTCHours(h || 0, m || 0, 0, 0);
        events.push({
          employeeId: employee._id,
          employeeCode: code,
          timestamp: ts,
          eventType: "CHECK_IN",
          source: "EXCEL",
          importBatchId: batchId,
          rawPayload: row,
        });
      }

      if (checkOut) {
        const [h, m] = String(checkOut).split(":").map(Number);
        const ts = new Date(baseDate);
        ts.setUTCHours(h || 0, m || 0, 0, 0);
        events.push({
          employeeId: employee._id,
          employeeCode: code,
          timestamp: ts,
          eventType: "CHECK_OUT",
          source: "EXCEL",
          importBatchId: batchId,
          rawPayload: row,
        });
      }

      if (events.length > 0) {
        await AttendanceEvent.insertMany(events);
        imported += events.length;
      }
    }

    res.json({ imported, skipped: errors.length, errors, batchId });
  } catch (err) {
    console.error("Import error:", err);
    res.status(500).json({ error: err.message });
  }
});

/** GET /events — Query events */
router.get("/events", requireRole(["ADMIN", "HR_STAFF", "MANAGER"]), async (req, res) => {
  try {
    const { employeeId, from, to, source, eventType, batchId, limit = 200 } = req.query;
    const filter = {};

    if (employeeId) filter.employeeId = employeeId;
    if (source) filter.source = source;
    if (eventType) filter.eventType = eventType;
    if (batchId) filter.importBatchId = batchId;
    if (from || to) {
      filter.timestamp = {};
      if (from) filter.timestamp.$gte = new Date(from);
      if (to) filter.timestamp.$lte = new Date(to);
    }

    const events = await AttendanceEvent.find(filter)
      .sort({ timestamp: -1 })
      .limit(Number(limit))
      .lean();

    res.json(events.map(e => ({ ...e, id: e._id?.toString() })));
  } catch (err) {
    console.error("Query events error:", err);
    res.status(500).json({ error: err.message });
  }
});

/** PUT /events/:id/void — Void an event */
router.put("/events/:id/void", requireRole("ADMIN"), async (req, res) => {
  try {
    const event = await AttendanceEvent.findByIdAndUpdate(
      req.params.id,
      { isVoided: true, voidReason: req.body.reason || "Voided by admin" },
      { new: true },
    );
    if (!event) return res.status(404).json({ error: "Event not found" });
    res.json({ event });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// ENGINE — Processing
// ═════════════════════════════════════════════════════════════════════════════

/** POST /process — Process a single day for an employee */
router.post("/process", requireRole(["ADMIN", "HR_STAFF"]), async (req, res) => {
  try {
    const { employeeId, date } = req.body;
    if (!employeeId || !date) {
      return res.status(400).json({ error: "employeeId and date are required" });
    }
    const result = await processDay(employeeId, new Date(date));
    res.json({ daily: result });
  } catch (err) {
    console.error("Process error:", err);
    res.status(500).json({ error: err.message });
  }
});

/** POST /process/bulk — Process a date range */
router.post("/process/bulk", requireRole("ADMIN"), async (req, res) => {
  try {
    const { employeeId, startDate, endDate } = req.body;
    if (!startDate || !endDate) {
      return res.status(400).json({ error: "startDate and endDate are required" });
    }
    const result = await processBulk({
      employeeId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    });
    res.json(result);
  } catch (err) {
    console.error("Bulk process error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// DAILY RECORDS
// ═════════════════════════════════════════════════════════════════════════════

/** GET /daily — Query daily records */
router.get("/daily", async (req, res) => {
  try {
    const { employeeId, from, to, status, department, limit = 500 } = req.query;
    const filter = {};

    if (employeeId) filter.employeeId = employeeId;
    if (status) filter.status = status;
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = new Date(from);
      if (to) filter.date.$lte = new Date(to);
    }

    let query = AttendanceDaily.find(filter)
      .sort({ date: -1 })
      .limit(Number(limit));

    // If department filter, need to join
    if (department) {
      const empIds = await Employee.find({ department }).distinct("_id");
      filter.employeeId = { $in: empIds };
      query = AttendanceDaily.find(filter).sort({ date: -1 }).limit(Number(limit));
    }

    const records = await query.lean();

    // Calculate summary
    const workDayRecords = records.filter(r => !["WEEKEND", "HOLIDAY"].includes(r.status));
    const summary = {
      presentDays: records.filter(r => r.status === "PRESENT" || r.status === "LATE").length,
      absentDays: records.filter(r => r.status === "ABSENT").length,
      lateDays: records.filter(r => r.status === "LATE").length,
      totalWorkHours: Math.round(workDayRecords.reduce((s, r) => s + (r.workHours || 0), 0) * 100) / 100,
      totalOvertimeHours: Math.round(workDayRecords.reduce((s, r) => s + (r.overtimeHours || 0), 0) * 100) / 100,
    };

    res.json({
      records: records.map(r => ({ ...r, id: r._id?.toString() })),
      summary,
    });
  } catch (err) {
    console.error("Query daily error:", err);
    res.status(500).json({ error: err.message });
  }
});

/** GET /daily/:employeeId — Employee's daily records */
router.get("/daily/:employeeId", async (req, res) => {
  try {
    const { from, to } = req.query;
    const filter = { employeeId: req.params.employeeId };

    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = new Date(from);
      if (to) filter.date.$lte = new Date(to);
    }

    const records = await AttendanceDaily.find(filter).sort({ date: -1 }).lean();
    res.json(records.map(r => ({ ...r, id: r._id?.toString() })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** PUT /daily/:id/override — Manual override */
router.put("/daily/:id/override", requireRole(["ADMIN", "HR_STAFF"]), async (req, res) => {
  try {
    const { status, workHours, overtimeHours, lateMinutes, overtimeApproved, overrideReason } = req.body;
    const update = { processedBy: "MANUAL_OVERRIDE", overrideReason };

    if (status !== undefined) update.status = status;
    if (workHours !== undefined) update.workHours = workHours;
    if (overtimeHours !== undefined) update.overtimeHours = overtimeHours;
    if (lateMinutes !== undefined) update.lateMinutes = lateMinutes;
    if (overtimeApproved !== undefined) update.overtimeApproved = overtimeApproved;

    const record = await AttendanceDaily.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!record) return res.status(404).json({ error: "Record not found" });
    res.json({ daily: record });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// POLICIES
// ═════════════════════════════════════════════════════════════════════════════

/** GET /policies */
router.get("/policies", requireRole(["ADMIN", "HR_STAFF"]), async (_req, res) => {
  try {
    const policies = await AttendancePolicy.find().sort({ isDefault: -1, name: 1 }).lean();
    res.json(policies.map(p => ({ ...p, id: p._id?.toString() })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /policies */
router.post("/policies", requireRole("ADMIN"), async (req, res) => {
  try {
    const policy = await AttendancePolicy.create(req.body);
    res.status(201).json({ policy });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** PUT /policies/:id */
router.put("/policies/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    const policy = await AttendancePolicy.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!policy) return res.status(404).json({ error: "Policy not found" });
    res.json({ policy });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** DELETE /policies/:id */
router.delete("/policies/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    const policy = await AttendancePolicy.findByIdAndDelete(req.params.id);
    if (!policy) return res.status(404).json({ error: "Policy not found" });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// METRICS / ANALYTICS
// ═════════════════════════════════════════════════════════════════════════════

/** GET /metrics — Query aggregated metrics */
router.get("/metrics", requireRole(["ADMIN", "HR_STAFF", "MANAGER"]), async (req, res) => {
  try {
    const { employeeId, periodType, periodLabel, scope, limit = 100 } = req.query;
    const filter = {};

    if (employeeId) filter.employeeId = employeeId;
    if (periodType) filter.periodType = periodType;
    if (periodLabel) filter.periodLabel = periodLabel;
    if (scope) filter.scope = scope;

    const metrics = await AttendanceMetric.find(filter)
      .sort({ periodStart: -1 })
      .limit(Number(limit))
      .lean();

    res.json(metrics.map(m => ({ ...m, id: m._id?.toString() })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /metrics/generate — Trigger aggregation */
router.post("/metrics/generate", requireRole("ADMIN"), async (req, res) => {
  try {
    const { year, month } = req.body;
    if (!year || !month) {
      return res.status(400).json({ error: "year and month are required" });
    }
    const result = await generateMonthlyMetrics(Number(year), Number(month));
    res.json(result);
  } catch (err) {
    console.error("Metrics generation error:", err);
    res.status(500).json({ error: err.message });
  }
});

/** GET /metrics/payroll-summary — Payroll-ready report */
router.get("/metrics/payroll-summary", requireRole(["ADMIN", "HR_STAFF"]), async (req, res) => {
  try {
    const { month } = req.query; // "2026-03"
    if (!month) return res.status(400).json({ error: "month query param is required (YYYY-MM)" });

    const metrics = await AttendanceMetric.find({
      periodType: "MONTHLY",
      periodLabel: month,
      scope: "EMPLOYEE",
    }).lean();

    // Enrich with employee names
    const empIds = metrics.map(m => m.employeeId);
    const employees = await Employee.find({ _id: { $in: empIds } }).lean();
    const empMap = new Map(employees.map(e => [e._id.toString(), e]));

    const summary = metrics.map(m => {
      const emp = empMap.get(m.employeeId?.toString());
      return {
        employeeId: m.employeeId,
        employeeName: emp?.fullName || "Unknown",
        employeeCode: emp?.employeeCode || "",
        department: emp?.department || "",
        totalWorkHours: m.totalWorkHours,
        overtimeHours: m.totalOvertimeHours,
        approvedOvertimeHours: m.approvedOvertimeHours,
        lateMinutes: m.totalLateMinutes,
        absentDays: m.absentDays,
        halfDays: m.halfDays,
        deductionTriggerCount: m.deductionTriggerCount,
        attendanceScore: m.attendanceScore,
      };
    });

    res.json({ period: month, employees: summary });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ═════════════════════════════════════════════════════════════════════════════

/** GET /dashboard/today — Today's live snapshot */
router.get("/dashboard/today", requireRole(["ADMIN", "HR_STAFF", "MANAGER"]), async (_req, res) => {
  try {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const records = await AttendanceDaily.find({ date: today }).lean();
    const totalEmployees = await Employee.countDocuments({ status: "ACTIVE" });

    const counts = {
      present: records.filter(r => r.status === "PRESENT").length,
      absent: records.filter(r => r.status === "ABSENT").length,
      late: records.filter(r => r.status === "LATE").length,
      onLeave: records.filter(r => r.status === "ON_LEAVE").length,
      wfh: records.filter(r => r.status === "WFH").length,
      halfDay: records.filter(r => r.status === "HALF_DAY").length,
      notRecorded: totalEmployees - records.length,
    };

    // Recent check-ins (enrich with names)
    const enriched = await Promise.all(
      records.slice(0, 50).map(async r => {
        const emp = await Employee.findById(r.employeeId).select("fullName email department").lean();
        return {
          ...r,
          id: r._id?.toString(),
          employeeName: emp?.fullName,
          employeeEmail: emp?.email,
          department: emp?.department,
        };
      }),
    );

    res.json({ date: today, totalEmployees, counts, records: enriched });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /dashboard/summary — Period summary */
router.get("/dashboard/summary", requireRole(["ADMIN", "HR_STAFF", "MANAGER"]), async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) {
      return res.status(400).json({ error: "from and to date params required" });
    }

    const records = await AttendanceDaily.find({
      date: { $gte: new Date(from), $lte: new Date(to) },
    }).lean();

    const byStatus = {};
    for (const r of records) {
      byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    }

    const totalHours = records.reduce((s, r) => s + (r.workHours || 0), 0);
    const totalOT = records.reduce((s, r) => s + (r.overtimeHours || 0), 0);
    const totalLate = records.reduce((s, r) => s + (r.lateMinutes || 0), 0);

    res.json({
      period: { from, to },
      totalRecords: records.length,
      byStatus,
      totalWorkHours: Math.round(totalHours * 100) / 100,
      totalOvertimeHours: Math.round(totalOT * 100) / 100,
      totalLateMinutes: Math.round(totalLate * 100) / 100,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
