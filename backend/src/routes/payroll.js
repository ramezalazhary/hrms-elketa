import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { enforcePolicy } from "../middleware/enforcePolicy.js";
import { PayrollRun } from "../models/PayrollRun.js";
import { PayrollRecord } from "../models/PayrollRecord.js";
import { EmployeeAdvance } from "../models/EmployeeAdvance.js";
import { OrganizationPolicy } from "../models/OrganizationPolicy.js";
import {
  computePayrollRun,
  finalizePayrollRun,
  updatePayrollRecordManually,
  repairPayrollRunTotals,
} from "../services/payrollComputationService.js";
import { createAuditLog } from "../services/auditService.js";
import xlsx from "xlsx";

const router = Router();
router.use(requireAuth);

// ─── Payroll Runs ────────────────────────────────────────────

router.get("/runs", enforcePolicy("view", "payroll"), async (req, res) => {
  try {
    const { year, month } = req.query;
    const filter = {};
    if (year) filter["period.year"] = Number(year);
    if (month) filter["period.month"] = Number(month);
    const runs = await PayrollRun.find(filter)
      .sort({ createdAt: -1 })
      .populate("departmentId", "name")
      .lean();
    res.json(runs);
  } catch (err) {
    console.error("GET /payroll/runs error:", err);
    res.status(500).json({ error: "Failed to fetch payroll runs" });
  }
});

router.post("/runs", enforcePolicy("manage", "payroll"), async (req, res) => {
  try {
    const { year, month, departmentId } = req.body;
    if (!year || !month) return res.status(400).json({ error: "year and month are required" });

    const existing = await PayrollRun.findOne({
      "period.year": Number(year),
      "period.month": Number(month),
      departmentId: departmentId || null,
      status: "FINALIZED",
    });
    if (existing) {
      return res.status(409).json({ error: "A finalized run already exists for this period" });
    }

    const run = new PayrollRun({
      period: { year: Number(year), month: Number(month) },
      departmentId: departmentId || null,
      createdBy: req.user.email,
    });
    await run.save();

    await createAuditLog({
      entityType: "PayrollRun",
      entityId: run._id,
      operation: "CREATE",
      newValues: { period: run.period },
      performedBy: req.user.email,
    });

    res.status(201).json(run.toObject());
  } catch (err) {
    console.error("POST /payroll/runs error:", err);
    res.status(500).json({ error: "Failed to create payroll run" });
  }
});

router.get("/runs/:id", enforcePolicy("view", "payroll"), async (req, res) => {
  try {
    const run = await PayrollRun.findById(req.params.id)
      .populate("departmentId", "name")
      .lean();
    if (!run) return res.status(404).json({ error: "Run not found" });
    res.json(run);
  } catch (err) {
    console.error("GET /payroll/runs/:id error:", err);
    res.status(500).json({ error: "Failed to fetch run" });
  }
});

router.post("/runs/:id/compute", enforcePolicy("manage", "payroll"), async (req, res) => {
  try {
    const result = await computePayrollRun(req.params.id, req.user.email);
    res.json(result);
  } catch (err) {
    console.error("POST /payroll/runs/:id/compute error:", err);
    res.status(400).json({ error: err.message || "Computation failed" });
  }
});

router.post("/runs/:id/finalize", enforcePolicy("manage", "payroll"), async (req, res) => {
  try {
    const run = await finalizePayrollRun(req.params.id, req.user.email);
    res.json(run);
  } catch (err) {
    console.error("POST /payroll/runs/:id/finalize error:", err);
    res.status(400).json({ error: err.message || "Finalization failed" });
  }
});

/** Re-sum header totals from all lines (recovery if aggregates drifted). */
router.post("/runs/:id/repair-totals", enforcePolicy("manage", "payroll"), async (req, res) => {
  try {
    const run = await repairPayrollRunTotals(req.params.id, req.user.email);
    res.json(run);
  } catch (err) {
    console.error("POST /payroll/runs/:id/repair-totals error:", err);
    const msg = err.message || "Repair failed";
    const status = msg.includes("not found") ? 404 : 500;
    res.status(status).json({ error: msg });
  }
});

router.delete("/runs/:id", enforcePolicy("manage", "payroll"), async (req, res) => {
  try {
    const run = await PayrollRun.findById(req.params.id);
    if (!run) return res.status(404).json({ error: "Run not found" });
    if (run.status === "FINALIZED") return res.status(400).json({ error: "Cannot delete a finalized run" });

    await PayrollRecord.deleteMany({ runId: run._id });
    await run.deleteOne();

    await createAuditLog({
      entityType: "PayrollRun",
      entityId: run._id,
      operation: "DELETE",
      previousValues: { period: run.period, status: run.status },
      performedBy: req.user.email,
    });

    res.json({ message: "Run deleted" });
  } catch (err) {
    console.error("DELETE /payroll/runs/:id error:", err);
    res.status(500).json({ error: "Failed to delete run" });
  }
});

// ─── Payroll Records ─────────────────────────────────────────

router.get("/runs/:id/records", enforcePolicy("view", "payroll"), async (req, res) => {
  try {
    const records = await PayrollRecord.find({ runId: req.params.id })
      .sort({ department: 1, fullName: 1 })
      .lean();
    res.json(records);
  } catch (err) {
    console.error("GET /payroll/runs/:id/records error:", err);
    res.status(500).json({ error: "Failed to fetch records" });
  }
});

router.patch("/runs/:runId/records/:recordId", enforcePolicy("manage", "payroll"), async (req, res) => {
  try {
    const existing = await PayrollRecord.findById(req.params.recordId);
    if (!existing) return res.status(404).json({ error: "Record not found" });
    if (String(existing.runId) !== String(req.params.runId)) {
      return res.status(400).json({ error: "Record does not belong to this run" });
    }
    const updated = await updatePayrollRecordManually(req.params.recordId, req.body, req.user.email);
    res.json(updated);
  } catch (err) {
    console.error("PATCH /payroll/runs/:runId/records/:recordId error:", err);
    const msg = err.message || "Update failed";
    const status = msg.includes("not found") ? 404 : msg.includes("finalized") || msg.includes("Cannot") ? 400 : 500;
    res.status(status).json({ error: msg });
  }
});

router.get("/employees/:employeeId/history", enforcePolicy("view", "payroll"), async (req, res) => {
  try {
    const records = await PayrollRecord.find({ employeeId: req.params.employeeId })
      .populate("runId", "period status finalizedAt")
      .sort({ createdAt: -1 })
      .lean();
    res.json(records);
  } catch (err) {
    console.error("GET /payroll/employees/:id/history error:", err);
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

// ─── Reports ─────────────────────────────────────────────────

router.get("/runs/:id/payment-list", enforcePolicy("manage", "payroll"), async (req, res) => {
  try {
    const records = await PayrollRecord.find({ runId: req.params.id })
      .sort({ paymentMethod: 1, fullName: 1 })
      .lean();
    const cash = records.filter((r) => r.paymentMethod === "CASH");
    const visa = records.filter((r) => r.paymentMethod !== "CASH");
    res.json({
      cash: cash.map((r) => ({ fullName: r.fullName, employeeCode: r.employeeCode, department: r.department, netSalary: r.netSalary })),
      visa: visa.map((r) => ({ fullName: r.fullName, employeeCode: r.employeeCode, department: r.department, bankAccount: r.bankAccount, netSalary: r.netSalary })),
      cashTotal: cash.reduce((s, r) => s + r.netSalary, 0),
      visaTotal: visa.reduce((s, r) => s + r.netSalary, 0),
    });
  } catch (err) {
    console.error("GET /payroll/runs/:id/payment-list error:", err);
    res.status(500).json({ error: "Failed to generate payment list" });
  }
});

router.get("/runs/:id/insurance-report", enforcePolicy("manage", "payroll"), async (req, res) => {
  try {
    const records = await PayrollRecord.find({ runId: req.params.id, isInsured: true })
      .sort({ fullName: 1 })
      .lean();
    const rows = records.map((r) => ({
      fullName: r.fullName,
      employeeCode: r.employeeCode,
      insuranceNumber: r.insuranceNumber,
      insuredWage: r.insuredWage,
      employeeShare: r.employeeInsurance,
      companyShare: r.companyInsurance,
    }));
    const totalEmployee = rows.reduce((s, r) => s + r.employeeShare, 0);
    const totalCompany = rows.reduce((s, r) => s + r.companyShare, 0);
    res.json({ rows, totalEmployee, totalCompany, totalCombined: totalEmployee + totalCompany });
  } catch (err) {
    console.error("GET /payroll/runs/:id/insurance-report error:", err);
    res.status(500).json({ error: "Failed to generate insurance report" });
  }
});

router.get("/runs/:id/tax-report", enforcePolicy("manage", "payroll"), async (req, res) => {
  try {
    const records = await PayrollRecord.find({ runId: req.params.id, isInsured: true, monthlyTax: { $gt: 0 } })
      .sort({ fullName: 1 })
      .lean();
    const rows = records.map((r) => ({
      fullName: r.fullName,
      employeeCode: r.employeeCode,
      grossSalary: r.grossSalary,
      taxableAnnual: r.taxableAnnual,
      annualTax: r.annualTax,
      monthlyTax: r.monthlyTax,
    }));
    const totalMonthlyTax = rows.reduce((s, r) => s + r.monthlyTax, 0);
    res.json({ rows, totalMonthlyTax });
  } catch (err) {
    console.error("GET /payroll/runs/:id/tax-report error:", err);
    res.status(500).json({ error: "Failed to generate tax report" });
  }
});

// ─── Excel Export ────────────────────────────────────────────

router.get("/runs/:id/export/:type", enforcePolicy("manage", "payroll"), async (req, res) => {
  try {
    const { type } = req.params;
    const records = await PayrollRecord.find({ runId: req.params.id }).sort({ department: 1, fullName: 1 }).lean();
    const run = await PayrollRun.findById(req.params.id).lean();
    if (!run) return res.status(404).json({ error: "Run not found" });

    let sheetData;
    let filename;
    const period = `${run.period.year}-${String(run.period.month).padStart(2, "0")}`;

    if (type === "full") {
      filename = `payroll-full-${period}.xlsx`;
      sheetData = records.map((r) => ({
        "Code": r.employeeCode,
        "Name": r.fullName,
        "Name (AR)": r.fullNameArabic,
        "Department": r.department,
        "Insured": r.isInsured ? "Yes" : "No",
        "Base Salary": r.baseSalary,
        "Allowances": r.allowances,
        "Gross": r.grossSalary,
        "OT Hours": r.overtimeHours,
        "OT Pay": r.overtimePay,
        "Extra Days": r.extraDaysWorked,
        "Extra Pay": r.extraDaysPay,
        "Fixed Bonus": r.fixedBonus,
        "Assessment Bonus": r.assessmentBonus,
        "Total Additions": r.totalAdditions,
        "Absent Deduction": r.absentDeduction,
        "Attendance Ded.": r.attendanceDeduction,
        "Fixed Deduction": r.fixedDeduction,
        "Advance": r.advanceAmount,
        "Total Deductions": r.totalDeductions,
        "Due Before Ins.": r.dueBeforeInsurance,
        "Insured Wage": r.insuredWage,
        "Employee Ins.": r.employeeInsurance,
        "Company Ins.": r.companyInsurance,
        "Monthly Tax": r.monthlyTax,
        "Martyrs Fund": r.martyrsFundDeduction,
        "Net Salary": r.netSalary,
        "Payment": r.paymentMethod,
        "Bank Account": r.bankAccount,
      }));
    } else if (type === "payment") {
      filename = `payment-list-${period}.xlsx`;
      sheetData = records.map((r) => ({
        "Code": r.employeeCode,
        "Name": r.fullName,
        "Department": r.department,
        "Payment Method": r.paymentMethod === "CASH" ? "Cash" : "Bank Transfer",
        "Bank Account": r.bankAccount || "—",
        "Net Salary": r.netSalary,
      }));
    } else if (type === "insurance") {
      filename = `insurance-report-${period}.xlsx`;
      sheetData = records.filter((r) => r.isInsured).map((r) => ({
        "Code": r.employeeCode,
        "Name": r.fullName,
        "Insurance #": r.insuranceNumber,
        "Insured Wage": r.insuredWage,
        "Employee Share (11%)": r.employeeInsurance,
        "Company Share (18.75%)": r.companyInsurance,
        "Total": r.employeeInsurance + r.companyInsurance,
      }));
    } else if (type === "tax") {
      filename = `tax-report-${period}.xlsx`;
      sheetData = records.filter((r) => r.monthlyTax > 0).map((r) => ({
        "Code": r.employeeCode,
        "Name": r.fullName,
        "Gross": r.grossSalary,
        "Taxable (Annual)": r.taxableAnnual,
        "Annual Tax": r.annualTax,
        "Monthly Tax": r.monthlyTax,
      }));
    } else {
      return res.status(400).json({ error: "Invalid export type. Use: full, payment, insurance, tax" });
    }

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(sheetData);
    xlsx.utils.book_append_sheet(wb, ws, "Report");
    const buf = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buf);
  } catch (err) {
    console.error("GET /payroll/runs/:id/export error:", err);
    res.status(500).json({ error: "Export failed" });
  }
});

// ─── Advances (سلف) — Legacy routes kept for backward compatibility ──────────
// Full advance management is now at /api/advances

router.get("/advances/:employeeId", enforcePolicy("view", "payroll"), async (req, res) => {
  try {
    const advances = await EmployeeAdvance.find({ employeeId: req.params.employeeId })
      .sort({ createdAt: -1 })
      .lean();
    res.json(advances);
  } catch (err) {
    console.error("GET /payroll/advances error:", err);
    res.status(500).json({ error: "Failed to fetch advances" });
  }
});

router.post("/advances", enforcePolicy("manage", "payroll"), async (req, res) => {
  try {
    const { employeeId, amount, reason, paymentType, monthlyDeduction, startYear, startMonth } = req.body;
    if (!employeeId || !amount || amount <= 0) {
      return res.status(400).json({ error: "employeeId and positive amount are required" });
    }
    if (paymentType === "INSTALLMENTS" && (!monthlyDeduction || monthlyDeduction <= 0)) {
      return res.status(400).json({ error: "monthlyDeduction is required for installment advances" });
    }
    const advance = new EmployeeAdvance({
      employeeId,
      amount: Number(amount),
      reason: reason || "",
      paymentType: paymentType || "ONE_TIME",
      monthlyDeduction: Number(monthlyDeduction) || 0,
      startYear: startYear || undefined,
      startMonth: startMonth || undefined,
      status: "APPROVED",
      recordedBy: req.user.email,
      approvedBy: req.user.email,
      approvedAt: new Date(),
    });
    await advance.save();
    res.status(201).json(advance.toObject());
  } catch (err) {
    console.error("POST /payroll/advances error:", err);
    res.status(500).json({ error: "Failed to record advance" });
  }
});

router.delete("/advances/:id", enforcePolicy("manage", "payroll"), async (req, res) => {
  try {
    const adv = await EmployeeAdvance.findById(req.params.id);
    if (!adv) return res.status(404).json({ error: "Advance not found" });
    if (adv.status === "COMPLETED") return res.status(400).json({ error: "Cannot cancel a fully deducted advance" });
    if (adv.status === "ACTIVE" && adv.deductionHistory?.length > 0) {
      return res.status(400).json({ error: "Cannot cancel an advance with existing deductions. Contact admin." });
    }
    adv.status = "CANCELLED";
    await adv.save();
    res.json({ message: "Advance cancelled" });
  } catch (err) {
    console.error("DELETE /payroll/advances error:", err);
    res.status(500).json({ error: "Failed to cancel advance" });
  }
});

// ─── Payroll Config ──────────────────────────────────────────

router.get("/config", enforcePolicy("manage", "payroll"), async (req, res) => {
  try {
    const policy = await OrganizationPolicy.findOne({ name: "default" }).lean();
    res.json(policy?.payrollConfig || {});
  } catch (err) {
    console.error("GET /payroll/config error:", err);
    res.status(500).json({ error: "Failed to fetch config" });
  }
});

export default router;
