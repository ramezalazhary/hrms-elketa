import { Router } from "express";
import { CompanyHoliday } from "../models/CompanyHoliday.js";
import { requireAuth } from "../middleware/auth.js";
import { enforcePolicy } from "../middleware/enforcePolicy.js";

const router = Router();

/**
 * GET /api/holidays
 * List declared holidays. Optional filters: year, month.
 * Accessible to all HR roles.
 */
router.get("/", requireAuth, enforcePolicy("read", "holidays"), async (req, res) => {
  try {
    const filter = {};
    const { year, month } = req.query;
    if (year && month) {
      const y = Number(year);
      const m = Number(month);
      const rangeStart = new Date(Date.UTC(y, m - 1, 1));
      const rangeEnd = new Date(Date.UTC(y, m, 1));
      filter.startDate = { $lt: rangeEnd };
      filter.endDate = { $gte: rangeStart };
    } else if (year) {
      const y = Number(year);
      filter.startDate = { $lt: new Date(Date.UTC(y + 1, 0, 1)) };
      filter.endDate = { $gte: new Date(Date.UTC(y, 0, 1)) };
    }

    const holidays = await CompanyHoliday.find(filter)
      .populate("targetDepartmentId", "name")
      .populate("targetEmployeeId", "fullName employeeCode")
      .sort({ startDate: 1 })
      .lean();

    res.json(holidays);
  } catch (err) {
    console.error("GET /holidays error:", err);
    res.status(500).json({ error: "Failed to fetch holidays" });
  }
});

/**
 * POST /api/holidays
 * Create a new declared holiday. Requires ADMIN or HR_MANAGER.
 */
router.post("/", requireAuth, enforcePolicy("manage", "holidays"), async (req, res) => {
  try {
    const { title, startDate, endDate, scope, targetDepartmentId, targetEmployeeId } = req.body;

    if (!title || !startDate || !endDate) {
      return res.status(400).json({ error: "title, startDate, and endDate are required" });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: "Invalid date format" });
    }
    if (end < start) {
      return res.status(400).json({ error: "endDate must be on or after startDate" });
    }

    const normalizedScope = scope || "COMPANY";
    if (!["COMPANY", "DEPARTMENT", "EMPLOYEE"].includes(normalizedScope)) {
      return res.status(400).json({ error: "scope must be COMPANY, DEPARTMENT, or EMPLOYEE" });
    }
    if (normalizedScope === "DEPARTMENT" && !targetDepartmentId) {
      return res.status(400).json({ error: "targetDepartmentId required for DEPARTMENT scope" });
    }
    if (normalizedScope === "EMPLOYEE" && !targetEmployeeId) {
      return res.status(400).json({ error: "targetEmployeeId required for EMPLOYEE scope" });
    }

    const holiday = new CompanyHoliday({
      title: title.trim(),
      startDate: start,
      endDate: end,
      scope: normalizedScope,
      targetDepartmentId: normalizedScope === "DEPARTMENT" ? targetDepartmentId : null,
      targetEmployeeId: normalizedScope === "EMPLOYEE" ? targetEmployeeId : null,
      createdBy: req.user.id,
    });
    await holiday.save();

    const populated = await CompanyHoliday.findById(holiday._id)
      .populate("targetDepartmentId", "name")
      .populate("targetEmployeeId", "fullName employeeCode")
      .lean();

    res.status(201).json(populated);
  } catch (err) {
    console.error("POST /holidays error:", err);
    res.status(500).json({ error: "Failed to create holiday" });
  }
});

/**
 * PUT /api/holidays/:id
 * Update a declared holiday. Requires ADMIN or HR_MANAGER.
 */
router.put("/:id", requireAuth, enforcePolicy("manage", "holidays"), async (req, res) => {
  try {
    const holiday = await CompanyHoliday.findById(req.params.id);
    if (!holiday) return res.status(404).json({ error: "Holiday not found" });

    const { title, startDate, endDate, scope, targetDepartmentId, targetEmployeeId } = req.body;

    if (title !== undefined) holiday.title = title.trim();
    if (startDate !== undefined) {
      const d = new Date(startDate);
      if (isNaN(d.getTime())) return res.status(400).json({ error: "Invalid startDate" });
      holiday.startDate = d;
    }
    if (endDate !== undefined) {
      const d = new Date(endDate);
      if (isNaN(d.getTime())) return res.status(400).json({ error: "Invalid endDate" });
      holiday.endDate = d;
    }
    if (holiday.endDate < holiday.startDate) {
      return res.status(400).json({ error: "endDate must be on or after startDate" });
    }
    if (scope !== undefined) {
      if (!["COMPANY", "DEPARTMENT", "EMPLOYEE"].includes(scope)) {
        return res.status(400).json({ error: "Invalid scope" });
      }
      holiday.scope = scope;
    }
    holiday.targetDepartmentId = holiday.scope === "DEPARTMENT" ? (targetDepartmentId ?? holiday.targetDepartmentId) : null;
    holiday.targetEmployeeId = holiday.scope === "EMPLOYEE" ? (targetEmployeeId ?? holiday.targetEmployeeId) : null;

    await holiday.save();

    const populated = await CompanyHoliday.findById(holiday._id)
      .populate("targetDepartmentId", "name")
      .populate("targetEmployeeId", "fullName employeeCode")
      .lean();

    res.json(populated);
  } catch (err) {
    console.error("PUT /holidays/:id error:", err);
    res.status(500).json({ error: "Failed to update holiday" });
  }
});

/**
 * DELETE /api/holidays/:id
 * Delete a declared holiday. Requires ADMIN or HR_MANAGER.
 */
router.delete("/:id", requireAuth, enforcePolicy("manage", "holidays"), async (req, res) => {
  try {
    const holiday = await CompanyHoliday.findByIdAndDelete(req.params.id);
    if (!holiday) return res.status(404).json({ error: "Holiday not found" });
    res.json({ message: "Holiday deleted" });
  } catch (err) {
    console.error("DELETE /holidays/:id error:", err);
    res.status(500).json({ error: "Failed to delete holiday" });
  }
});

export default router;
