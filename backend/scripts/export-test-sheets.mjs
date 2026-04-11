/**
 * Generates two project-aligned test Excel files from the seeded DB:
 *   1. payroll-full-YYYY-MM.xlsx  — mirrors GET /payroll/runs/:id/export/full
 *   2. Assessment-Monthly.xlsx    — 7 monthly tabs (Oct-2025 → Apr-2026) with seeded employees
 *
 * Usage (from backend/):
 *   node scripts/export-test-sheets.mjs
 *   node scripts/export-test-sheets.mjs --payroll "C:/out/payroll.xlsx" --assessment "C:/out/eval.xlsx"
 *
 * Defaults write to %USERPROFILE%/Downloads/.
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
import * as XLSX from "xlsx";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { connectDb } from "../src/config/db.js";
import { PayrollRun } from "../src/models/PayrollRun.js";
import { PayrollRecord } from "../src/models/PayrollRecord.js";
import { Employee } from "../src/models/Employee.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

function argVal(flag) {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 && process.argv[idx + 1] ? process.argv[idx + 1] : null;
}

const DL =
  process.env.USERPROFILE
    ? path.join(process.env.USERPROFILE, "Downloads")
    : process.env.HOME
      ? path.join(process.env.HOME, "Downloads")
      : ".";

// ───────────────────────── PAYROLL ─────────────────────────

async function buildPayrollWorkbook() {
  const run = await PayrollRun.findOne({ status: "COMPUTED" })
    .sort({ createdAt: -1 })
    .lean();
  if (!run) {
    console.warn("[PAYROLL] No COMPUTED run found — run `npm run seed:real` first.");
    return null;
  }

  const records = await PayrollRecord.find({ runId: run._id })
    .sort({ department: 1, fullName: 1 })
    .lean();

  const period = `${run.period.year}-${String(run.period.month).padStart(2, "0")}`;

  const sheetData = records.map((r) => ({
    Code: r.employeeCode,
    Name: r.fullName,
    "Name (AR)": r.fullNameArabic || "",
    Department: r.department,
    Insured: r.isInsured ? "Yes" : "No",
    "Base Salary": r.baseSalary,
    Allowances: r.allowances,
    Gross: r.grossSalary,
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
    Advance: r.advanceAmount,
    "Total Deductions": r.totalDeductions,
    "Due Before Ins.": r.dueBeforeInsurance,
    "Insured Wage": r.insuredWage,
    "Employee Ins.": r.employeeInsurance,
    "Company Ins.": r.companyInsurance,
    "Monthly Tax": r.monthlyTax,
    "Martyrs Fund": r.martyrsFundDeduction,
    "Net Salary": r.netSalary,
    Payment: r.paymentMethod,
    "Bank Account": r.bankAccount || "",
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheetData), "Report");
  return { wb, period, count: records.length };
}

// ───────────────────── ASSESSMENT ──────────────────────

const MONTH_TABS = [
  { year: 2025, month: 10, label: "Oct-2025" },
  { year: 2025, month: 11, label: "Nov-2025" },
  { year: 2025, month: 12, label: "Dec-2025" },
  { year: 2026, month: 1, label: "Jan-2026" },
  { year: 2026, month: 2, label: "Feb-2026" },
  { year: 2026, month: 3, label: "Mar-2026" },
  { year: 2026, month: 4, label: "Apr-2026" },
];

function randBetween(a, b) {
  return Math.floor(a + Math.random() * (b - a + 1));
}

function pickScore() {
  return randBetween(3, 5);
}

async function buildAssessmentWorkbook() {
  const employees = await Employee.find({
    isActive: true,
    status: "ACTIVE",
    role: { $ne: "ADMIN" },
  })
    .sort({ employeeCode: 1 })
    .select("fullName employeeCode email phoneNumber department")
    .lean();

  if (!employees.length) {
    console.warn("[ASSESSMENT] No active employees — run `npm run seed:real` first.");
    return null;
  }

  const managers = await Employee.find({
    isActive: true,
    role: { $in: ["MANAGER", "HR_MANAGER"] },
  })
    .select("fullName")
    .lean();

  const seniorName = managers[0]?.fullName || "Department Manager";

  const wb = XLSX.utils.book_new();

  for (const tab of MONTH_TABS) {
    const rows = [];
    rows.push(["", `             Senior Name: ${seniorName}`, "", "", "", "", "", "", "", "", "", ""]);
    rows.push(["", "         Evaluation Period", "", "", "", "", "", "", "", "", "", ""]);
    rows.push([
      "Employee Name",
      "Employee Code",
      "days bonus",
      "overtime",
      "Deduction",
      "Commitment",
      "Attitude",
      "Quality",
      "Overall",
      "Notes / Previous Information",
      "Work Number",
      "Work Email",
    ]);

    for (let i = 0; i < employees.length; i += 1) {
      const emp = employees[i];
      const commitment = pickScore();
      const attitude = pickScore();
      const quality = pickScore();
      const overall = pickScore();

      const hasBonusMonth = (tab.month + i) % 3 !== 0;
      const daysBonus = hasBonusMonth ? randBetween(1, 5) : 0;
      const overtime = (tab.month + i) % 4 === 0 ? randBetween(1, 7) : 0;
      const deduction = (tab.month + i) % 7 === 0 ? randBetween(1, 3) : 0;

      const notes =
        overall === 5
          ? "Outstanding performance"
          : overall === 4
            ? "Good performance — meets expectations"
            : "Satisfactory — room for improvement";

      rows.push([
        emp.fullName,
        emp.employeeCode,
        daysBonus || "",
        overtime || "",
        deduction || "",
        commitment,
        attitude,
        quality,
        overall,
        notes,
        emp.phoneNumber || "",
        emp.email,
      ]);
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [
      { wch: 22 },
      { wch: 14 },
      { wch: 12 },
      { wch: 10 },
      { wch: 10 },
      { wch: 12 },
      { wch: 10 },
      { wch: 10 },
      { wch: 10 },
      { wch: 35 },
      { wch: 16 },
      { wch: 30 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, tab.label);
  }

  return { wb, tabs: MONTH_TABS.length, empCount: employees.length };
}

// ───────────────────── MAIN ──────────────────────

async function main() {
  await connectDb();

  const payrollOut =
    argVal("--payroll") || path.join(DL, "payroll-full-2026-04.xlsx");
  const assessmentOut =
    argVal("--assessment") || path.join(DL, "Asmaa.HR Monthly Evaluation.xlsx");

  const payrollResult = await buildPayrollWorkbook();
  if (payrollResult) {
    const dir = path.dirname(payrollOut);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    XLSX.writeFile(payrollResult.wb, payrollOut);
    console.log(
      `✓ Payroll: ${payrollOut}  (${payrollResult.count} records, period ${payrollResult.period})`,
    );
  }

  const assessmentResult = await buildAssessmentWorkbook();
  if (assessmentResult) {
    const dir = path.dirname(assessmentOut);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    XLSX.writeFile(assessmentResult.wb, assessmentOut);
    console.log(
      `✓ Assessment: ${assessmentOut}  (${assessmentResult.tabs} tabs × ${assessmentResult.empCount} employees)`,
    );
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
