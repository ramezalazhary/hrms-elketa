/**
 * @file `/api/alerts` — Returns upcoming alerts for dashboard banners.
 * Alert Types:
 *   - ID Expiry: 60 days before nationalIdExpiryDate
 *   - Salary Increase: 30 days before nextReviewDate
 *   - Assessment Due: monthly reminder for TL/Manager
 */
import { Router } from "express";
import { Employee } from "../models/Employee.js";
import { Assessment } from "../models/Assessment.js";
import { requireAuth } from "../middleware/auth.js";
import { enforcePolicy } from "../middleware/enforcePolicy.js";
import { canAssessEmployee } from "../services/assessmentAccessService.js";

const router = Router();

/**
 * @route GET /api/alerts
 * @desc Get dashboard alerts for the current user's scope
 */
router.get("/", requireAuth, enforcePolicy("read", "alerts"), async (req, res) => {
  try {
    const decision = req.authzDecision;
    const isAdmin = decision.scope === "all";

    if (!isAdmin) {
      const self = await Employee.findOne({ email: req.user.email });
      if (!self) return res.json({ alerts: [] });

      const alerts = [];
      const now = new Date();

      // ID Expiry Alert (60 days)
      if (self.nationalIdExpiryDate) {
        const daysUntilExpiry = Math.ceil(
          (new Date(self.nationalIdExpiryDate) - now) / (1000 * 60 * 60 * 24)
        );
        if (daysUntilExpiry <= 60 && daysUntilExpiry > 0) {
          alerts.push({
            type: "ID_EXPIRY",
            severity: daysUntilExpiry <= 14 ? "critical" : "warning",
            message: `Your National ID expires in ${daysUntilExpiry} day${daysUntilExpiry !== 1 ? "s" : ""}`,
            employeeId: self._id,
            employeeName: self.fullName,
            date: self.nationalIdExpiryDate,
            daysRemaining: daysUntilExpiry,
          });
        }
      }

      return res.json({ alerts });
    }

    // Admin/HR: Get all alerts across the organization
    const now = new Date();
    const sixtyDaysFromNow = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const alerts = [];

    // 1. ID Expiry Alerts (within 60 days)
    const idExpiryEmployees = await Employee.find({
      isActive: true,
      nationalIdExpiryDate: { $gte: now, $lte: sixtyDaysFromNow },
    }).select("fullName email nationalIdExpiryDate department employeeCode");

    for (const emp of idExpiryEmployees) {
      const daysUntilExpiry = Math.ceil(
        (new Date(emp.nationalIdExpiryDate) - now) / (1000 * 60 * 60 * 24)
      );
      alerts.push({
        type: "ID_EXPIRY",
        severity: daysUntilExpiry <= 14 ? "critical" : "warning",
        message: `${emp.fullName}'s National ID expires in ${daysUntilExpiry} day${daysUntilExpiry !== 1 ? "s" : ""}`,
        employeeId: emp._id,
        employeeName: emp.fullName,
        employeeCode: emp.employeeCode,
        department: emp.department,
        date: emp.nationalIdExpiryDate,
        daysRemaining: daysUntilExpiry,
      });
    }

    // 2. Salary Increase Alerts (within 30 days)
    const salaryIncreaseEmployees = await Employee.find({
      isActive: true,
      nextReviewDate: { $gte: now, $lte: thirtyDaysFromNow },
    }).select("fullName email nextReviewDate department employeeCode financial");

    for (const emp of salaryIncreaseEmployees) {
      const daysUntilIncrease = Math.ceil(
        (new Date(emp.nextReviewDate) - now) / (1000 * 60 * 60 * 24)
      );
      alerts.push({
        type: "SALARY_INCREASE",
        severity: daysUntilIncrease <= 7 ? "critical" : "warning",
        message: `${emp.fullName}'s salary increase is due in ${daysUntilIncrease} day${daysUntilIncrease !== 1 ? "s" : ""}`,
        employeeId: emp._id,
        employeeName: emp.fullName,
        employeeCode: emp.employeeCode,
        department: emp.department,
        date: emp.nextReviewDate,
        daysRemaining: daysUntilIncrease,
        currentSalary: emp.financial?.baseSalary,
      });
    }

    // 3. Assessment Due Alerts — check how many employees are un-assessed this month
    const now2 = new Date();
    const curYear = now2.getFullYear();
    const curMonth = now2.getMonth() + 1;
    const dayOfMonth = now2.getDate();

    if (dayOfMonth >= 20) {
      const assessed = await Assessment.find({
        "assessment.period.year": curYear,
        "assessment.period.month": curMonth,
      }).select("employeeId").lean();
      const assessedSet = new Set(assessed.map((d) => d.employeeId.toString()));

      const activeCount = await Employee.countDocuments({ isActive: true });
      const pendingCount = activeCount - assessedSet.size;

      if (pendingCount > 0) {
        const daysLeft = new Date(curYear, curMonth, 0).getDate() - dayOfMonth;
        alerts.push({
          type: "ASSESSMENT_DUE",
          severity: daysLeft <= 5 ? "critical" : "warning",
          message: `${pendingCount} employee${pendingCount !== 1 ? "s" : ""} still need assessment for this month (${daysLeft} day${daysLeft !== 1 ? "s" : ""} left)`,
          daysRemaining: daysLeft,
          pendingCount,
        });
      }
    }

    // Sort by urgency (least days remaining first)
    alerts.sort((a, b) => a.daysRemaining - b.daysRemaining);

    // Summary counts
    const summary = {
      totalAlerts: alerts.length,
      idExpiryCount: alerts.filter((a) => a.type === "ID_EXPIRY").length,
      salaryIncreaseCount: alerts.filter((a) => a.type === "SALARY_INCREASE").length,
      assessmentDueCount: alerts.filter((a) => a.type === "ASSESSMENT_DUE").length,
      criticalCount: alerts.filter((a) => a.severity === "critical").length,
    };

    return res.json({ alerts, summary });
  } catch (error) {
    console.error("GET /api/alerts:", error);
    return res.status(500).json({ error: "Failed to load alerts" });
  }
});

/**
 * @route GET /api/alerts/salary-increase-summary
 * @desc Get count of employees with salary increase in next 30 days (for dashboard widget)
 */
router.get("/salary-increase-summary", requireAuth, enforcePolicy("manage", "alerts"), async (req, res) => {
  try {

    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const count = await Employee.countDocuments({
      isActive: true,
      nextReviewDate: { $gte: now, $lte: thirtyDaysFromNow },
    });

    const employees = await Employee.find({
      isActive: true,
      nextReviewDate: { $gte: now, $lte: thirtyDaysFromNow },
    })
      .select("fullName email department employeeCode nextReviewDate financial")
      .sort({ nextReviewDate: 1 });

    return res.json({ count, employees });
  } catch (error) {
    console.error("GET /api/alerts/salary-increase-summary:", error);
    return res.status(500).json({ error: "Failed to load salary increase summary" });
  }
});

export default router;
