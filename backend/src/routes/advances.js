import { Router } from "express";
import { EmployeeAdvance } from "../models/EmployeeAdvance.js";
import { Employee } from "../models/Employee.js";
import { requireAuth } from "../middleware/auth.js";
import { enforcePolicy } from "../middleware/enforcePolicy.js";
import { normalizeRole, ROLE } from "../utils/roles.js";

const router = Router();

// Helper to determine if user is HR/Admin
function isHR(user) {
  const role = normalizeRole(user.role);
  return role === ROLE.ADMIN || role === ROLE.HR_MANAGER || role === ROLE.HR_STAFF;
}

// 1. Get all advances (Employee sees theirs, HR sees all)
router.get(
  "/",
  requireAuth,
  enforcePolicy("view", "payroll", () => ({ pageId: "advances" })),
  async (req, res) => {
  try {
    const filter = {};
    if (!isHR(req.user)) {
      // Regular employees only see their own advances
      filter.employeeId = req.user.id;
    } else {
      // HR can filter by employee
      if (req.query.employeeId) filter.employeeId = req.query.employeeId;
    }

    if (req.query.status) {
      filter.status = req.query.status;
    }

    const advances = await EmployeeAdvance.find(filter)
      .populate("employeeId", "fullName email employeeCode department")
      .sort({ createdAt: -1 });

    res.json(advances);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch advances" });
  }
});

// Personal endpoint: last-month advances only (no payroll-view permission required).
router.get(
  "/mine",
  requireAuth,
  async (req, res) => {
  try {
    const lastMonthCutoff = new Date();
    lastMonthCutoff.setDate(lastMonthCutoff.getDate() - 30);
    const advances = await EmployeeAdvance.find({
      employeeId: req.user.id,
      createdAt: { $gte: lastMonthCutoff },
    })
      .populate("employeeId", "fullName email employeeCode department")
      .sort({ createdAt: -1 });
    res.json(advances);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch your advances" });
  }
});

// 2. Employee requests an advance
router.post(
  "/request",
  requireAuth,
  enforcePolicy("view", "payroll", () => ({ pageId: "advances" })),
  async (req, res) => {
  try {
    const { amount, reason } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: "Invalid amount" });

    const advance = new EmployeeAdvance({
      employeeId: req.user.id,
      amount,
      reason,
      status: "PENDING",
      recordedBy: req.user.email
    });

    await advance.save();
    res.status(201).json(advance);
  } catch (error) {
    res.status(500).json({ error: "Failed to request advance" });
  }
});

// 3. HR creates an advance directly (APPROVED)
router.post(
  "/",
  requireAuth,
  enforcePolicy("manage", "payroll", () => ({ pageId: "advances" })),
  async (req, res) => {
  try {
    if (!isHR(req.user)) return res.status(403).json({ error: "Forbidden: HR only" });

    const { employeeId, amount, reason, paymentType, monthlyDeduction, startYear, startMonth } = req.body;
    
    if (!employeeId || !amount || amount <= 0) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const advance = new EmployeeAdvance({
      employeeId,
      amount,
      reason,
      paymentType: paymentType || "ONE_TIME",
      monthlyDeduction: monthlyDeduction || 0,
      startYear,
      startMonth,
      status: "APPROVED",
      recordedBy: req.user.email,
      approvedBy: req.user.email,
      approvedAt: new Date()
    });

    // Validate: INSTALLMENTS must have monthlyDeduction
    if (advance.paymentType === "INSTALLMENTS" && (!advance.monthlyDeduction || advance.monthlyDeduction <= 0)) {
      return res.status(400).json({ error: "monthlyDeduction is required and must be > 0 for installment advances" });
    }

    // Validate: monthlyDeduction should not exceed amount
    if (advance.monthlyDeduction > advance.amount) {
      return res.status(400).json({ error: "monthlyDeduction cannot exceed the advance amount" });
    }

    // Validate employee exists
    const employee = await Employee.findById(employeeId);
    if (!employee) return res.status(404).json({ error: "Employee not found" });

    await advance.save();
    res.status(201).json(advance);
  } catch (error) {
    res.status(500).json({ error: "Failed to create advance" });
  }
});

// 4. HR Approves / Updates an advance
router.put(
  "/:id/approve",
  requireAuth,
  enforcePolicy("manage", "payroll", () => ({ pageId: "advances" })),
  async (req, res) => {
  try {
    if (!isHR(req.user)) return res.status(403).json({ error: "Forbidden: HR only" });

    const advance = await EmployeeAdvance.findById(req.params.id);
    if (!advance) return res.status(404).json({ error: "Advance not found" });

    if (advance.status === "COMPLETED") {
      return res.status(400).json({ error: "Cannot modify completed advance" });
    }

    const { paymentType, monthlyDeduction, startYear, startMonth, isRejected } = req.body;

    if (isRejected) {
      advance.status = "REJECTED";
    } else {
      advance.status = "APPROVED";
      if (paymentType) advance.paymentType = paymentType;
      if (monthlyDeduction !== undefined) advance.monthlyDeduction = monthlyDeduction;
      if (startYear) advance.startYear = startYear;
      if (startMonth) advance.startMonth = startMonth;

      // Validate: INSTALLMENTS must have monthlyDeduction
      if (advance.paymentType === "INSTALLMENTS" && (!advance.monthlyDeduction || advance.monthlyDeduction <= 0)) {
        return res.status(400).json({ error: "monthlyDeduction is required and must be > 0 for installment advances" });
      }

      advance.approvedBy = req.user.email;
      advance.approvedAt = new Date();
    }

    await advance.save();
    res.json(advance);
  } catch (error) {
    res.status(500).json({ error: "Failed to approve advance" });
  }
});

// 5. Delete / Cancel an advance
router.delete(
  "/:id",
  requireAuth,
  enforcePolicy("view", "payroll", () => ({ pageId: "advances" })),
  async (req, res) => {
  try {
    const advance = await EmployeeAdvance.findById(req.params.id);
    if (!advance) return res.status(404).json({ error: "Advance not found" });

    if (!isHR(req.user) && String(advance.employeeId) !== req.user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    // Employees can only cancel their own PENDING requests
    if (!isHR(req.user)) {
      if (advance.status !== "PENDING") {
        return res.status(400).json({ error: "Cannot delete processed advance" });
      }
      await EmployeeAdvance.findByIdAndDelete(req.params.id);
      return res.json({ success: true });
    }

    // HR can cancel any advance unless completed
    if (advance.status === "COMPLETED") {
      return res.status(400).json({ error: "Cannot delete completed advance" });
    }

    advance.status = "CANCELLED";
    await advance.save();
    res.json({ success: true, message: "Advance cancelled" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete advance" });
  }
});

// 6. Get single advance detail
router.get(
  "/:id",
  requireAuth,
  enforcePolicy("view", "payroll", () => ({ pageId: "advances" })),
  async (req, res) => {
  try {
    const advance = await EmployeeAdvance.findById(req.params.id)
      .populate("employeeId", "fullName email employeeCode department");
    if (!advance) return res.status(404).json({ error: "Advance not found" });

    // Non-HR can only see their own
    if (!isHR(req.user) && String(advance.employeeId._id || advance.employeeId) !== req.user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    res.json(advance);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch advance" });
  }
});

export default router;
