#!/usr/bin/env node
/**
 * Focused payroll integrity smoke checks.
 *
 * Covers:
 * - compute/snapshot integrity
 * - advance breakdown consistency during finalize
 * - historical inclusion for terminated employees with monthly attendance
 * - assessment-only overtime correctness
 *
 * Run:
 *   node scripts/payroll-integrity-smoke.mjs
 */
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { connectDb } from "../src/config/db.js";
import { Employee } from "../src/models/Employee.js";
import { Attendance } from "../src/models/Attendance.js";
import { Assessment } from "../src/models/Assessment.js";
import { EmployeeAdvance } from "../src/models/EmployeeAdvance.js";
import { PayrollRun } from "../src/models/PayrollRun.js";
import { PayrollRecord } from "../src/models/PayrollRecord.js";
import { PayrollComputeSnapshot } from "../src/models/PayrollComputeSnapshot.js";
import { OrganizationPolicy } from "../src/models/OrganizationPolicy.js";
import { AuditLog } from "../src/models/AuditLog.js";
import {
  runPayrollPipeline as computePayrollRun,
  finalizePayrollRun,
  updatePayrollRecordManually,
} from "../src/services/payrollPipeline/index.js";

const TEST_TAG = `payroll-integrity-${Date.now()}`;
const TEST_EMAIL = `${TEST_TAG}@local.test`;
const TEST_USER = `${TEST_TAG}-runner@local.test`;
const YEAR = 2026;
const MONTH = 3;
const WEEKLY_REST_DAYS = [5, 6];

function utcDate(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

function dayKey(d) {
  return new Date(d).toISOString().slice(0, 10);
}

function getMonthWorkdays(year, month, weeklyRestDays) {
  const out = [];
  const cursor = utcDate(year, month, 1);
  while (cursor.getUTCMonth() === month - 1) {
    if (!weeklyRestDays.includes(cursor.getUTCDay())) {
      out.push(new Date(cursor));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

function getMonthRestdays(year, month, weeklyRestDays) {
  const out = [];
  const cursor = utcDate(year, month, 1);
  while (cursor.getUTCMonth() === month - 1) {
    if (weeklyRestDays.includes(cursor.getUTCDay())) {
      out.push(new Date(cursor));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

function ok(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => console.log(`OK  ${name}`))
    .catch((err) => {
      console.error(`FAIL ${name}:`, err?.message || err);
      process.exitCode = 1;
    });
}

async function seedEmployee({
  fullName,
  employeeCode,
  status = "ACTIVE",
  baseSalary = 22000,
  allowances = 0,
  paymentMethod = "BANK_TRANSFER",
}) {
  return Employee.create({
    fullName,
    email: `${employeeCode.toLowerCase()}@local.test`,
    employeeCode,
    department: "QA",
    status,
    isActive: status !== "TERMINATED" && status !== "RESIGNED",
    dateOfHire: utcDate(2025, 1, 1),
    financial: {
      baseSalary,
      allowances,
      paymentMethod,
      fixedBonus: 0,
      fixedDeduction: 0,
    },
    socialInsurance: {
      status: "NOT_INSURED",
    },
  });
}

async function seedAttendance(employee, dates, { checkOut = "17:00", restDayApproved = false } = {}) {
  if (!dates.length) return;
  await Attendance.insertMany(
    dates.map((date) => ({
      employeeId: employee._id,
      employeeCode: employee.employeeCode,
      date,
      checkIn: "09:00",
      checkOut,
      status: "PRESENT",
      totalHours: 8,
      restDayWorkApproved: restDayApproved,
    })),
  );
}

async function main() {
  let originalPolicy = null;
  const createdEmployeeIds = [];
  const createdRunIds = [];
  const createdAdvanceIds = [];

  await connectDb();

  try {
    originalPolicy = await OrganizationPolicy.findOne({ name: "default" }).lean();
    await OrganizationPolicy.findOneAndUpdate(
      { name: "default" },
      {
        $set: {
          name: "default",
          companyMonthStartDay: 1,
          attendanceRules: {
            standardStartTime: "09:00",
            standardEndTime: "17:00",
            gracePeriodMinutes: 15,
            monthlyGraceUsesEnabled: false,
            monthlyGraceUsesAllowed: 0,
            workingDaysPerMonth: 22,
            lateDeductionTiers: [],
            absenceDeductionDays: 1,
            earlyDepartureDeductionDays: 0,
            incompleteRecordDeductionDays: 0,
            unpaidLeaveDeductionDays: 1,
            excessExcuseDeductionEnabled: true,
            weeklyRestDays: WEEKLY_REST_DAYS,
          },
          assessmentPayrollRules: {
            bonusDaysEnabled: true,
            bonusDayMultiplier: 1,
            overtimeEnabled: true,
            overtimeDayMultiplier: 1.5,
            deductionEnabled: false,
            deductionDayMultiplier: 1,
          },
          payrollConfig: {
            decimalPlaces: 2,
            workingDaysPerMonth: 22,
            hoursPerDay: 8,
            overtimeMultiplier: 1.5,
            personalExemptionAnnual: 20000,
            martyrsFundRate: 0.0005,
            insuranceRates: {
              employeeShare: 0.11,
              companyShare: 0.1875,
              maxInsurableWage: 16700,
              minInsurableWage: 2700,
            },
            taxBrackets: [
              { from: 0, to: 40000, rate: 0 },
              { from: 40000, to: 55000, rate: 0.1 },
              { from: 55000, to: 70000, rate: 0.15 },
              { from: 70000, to: 200000, rate: 0.2 },
              { from: 200000, to: 400000, rate: 0.225 },
              { from: 400000, to: 1200000, rate: 0.25 },
              { from: 1200000, to: null, rate: 0.275 },
            ],
          },
        },
      },
      { upsert: true },
    );

    const evaluator = await seedEmployee({
      fullName: `${TEST_TAG} Evaluator`,
      employeeCode: `${TEST_TAG}-EVAL`,
      baseSalary: 18000,
    });
    const activeAdvance = await seedEmployee({
      fullName: `${TEST_TAG} Advance`,
      employeeCode: `${TEST_TAG}-ADV`,
      baseSalary: 30000,
    });
    const terminatedWithAttendance = await seedEmployee({
      fullName: `${TEST_TAG} Terminated In`,
      employeeCode: `${TEST_TAG}-TERM-IN`,
      status: "TERMINATED",
      baseSalary: 15000,
    });
    const terminatedWithoutAttendance = await seedEmployee({
      fullName: `${TEST_TAG} Terminated Out`,
      employeeCode: `${TEST_TAG}-TERM-OUT`,
      status: "TERMINATED",
      baseSalary: 15000,
    });
    const overtimeEmployee = await seedEmployee({
      fullName: `${TEST_TAG} Overtime`,
      employeeCode: `${TEST_TAG}-OT`,
      baseSalary: 22000,
    });
    createdEmployeeIds.push(
      evaluator._id,
      activeAdvance._id,
      terminatedWithAttendance._id,
      terminatedWithoutAttendance._id,
      overtimeEmployee._id,
    );

    const workdays = getMonthWorkdays(YEAR, MONTH, WEEKLY_REST_DAYS);
    const firstWorkday = workdays[0];
    const overtimeWorkdays = workdays.map((d, idx) =>
      idx === 0 ? new Date(d) : new Date(d),
    );

    await seedAttendance(activeAdvance, workdays, { checkOut: "17:00" });
    await seedAttendance(overtimeEmployee, overtimeWorkdays, { checkOut: "17:00" });
    await Attendance.updateOne(
      { employeeId: overtimeEmployee._id, date: firstWorkday },
      { $set: { checkOut: "21:00", totalHours: 12 } },
    );
    await seedAttendance(terminatedWithAttendance, [firstWorkday], { checkOut: "17:00" });

    const advance = await EmployeeAdvance.create({
      employeeId: activeAdvance._id,
      amount: 5000,
      reason: `${TEST_TAG} advance`,
      paymentType: "ONE_TIME",
      remainingAmount: 5000,
      status: "APPROVED",
      recordedBy: TEST_USER,
      approvedBy: TEST_USER,
      approvedAt: new Date(),
    });
    createdAdvanceIds.push(advance._id);

    await Assessment.create({
      employeeId: overtimeEmployee._id,
      assessment: [
        {
          date: dayKey(firstWorkday),
          period: { year: YEAR, month: MONTH },
          feedback: "approved overtime for payroll integrity smoke",
          reviewPeriod: "monthly",
          evaluatorId: evaluator._id,
          overtime: 1,
          bonusStatus: "APPROVED",
        },
      ],
    });

    const run = await PayrollRun.create({
      period: { year: YEAR, month: MONTH },
      createdBy: TEST_USER,
    });
    createdRunIds.push(run._id);

    await ok("compute creates stable computed run + snapshot", async () => {
      const result = await computePayrollRun(run._id, TEST_USER);
      assert.equal(result.run.status, "COMPUTED");
      assert.equal(result.run.computeVersion, 1);
      assert.ok(result.run.currentSnapshotId);

      const snapshot = await PayrollComputeSnapshot.findById(result.run.currentSnapshotId).lean();
      assert.ok(snapshot);
      assert.equal(snapshot.computeVersion, 1);
      assert.ok((snapshot.records || []).length >= 3);
    });

    await ok("terminated employee with attendance is included; without attendance is excluded", async () => {
      const records = await PayrollRecord.find({ runId: run._id }).lean();
      const included = records.find((r) => String(r.employeeId) === String(terminatedWithAttendance._id));
      const excluded = records.find((r) => String(r.employeeId) === String(terminatedWithoutAttendance._id));

      assert.ok(included, "terminated employee with attendance should be included");
      assert.equal(excluded, undefined);
      assert.equal(included.employeeStatus, "TERMINATED");
      assert.match(included.payrollInclusionReason, /attendance in this payroll period/i);
    });

    await ok("overtime stays assessment-only; attendance checkout overtime is excluded", async () => {
      const record = await PayrollRecord.findOne({ runId: run._id, employeeId: overtimeEmployee._id }).lean();
      assert.ok(record, "overtime employee record missing");
      assert.equal(record.overtimeHours, 0);
      assert.equal(record.overtimePay, 0);
      assert.ok(record.assessmentOvertimeUnits > 0, "expected assessment overtime units");
      assert.ok(record.assessmentOvertimeAmount > 0, "expected assessment overtime amount");
      assert.ok(record.assessmentBonus >= record.assessmentOvertimeAmount);
    });

    await ok("advance breakdown matches computed advance amount before finalize", async () => {
      const record = await PayrollRecord.findOne({ runId: run._id, employeeId: activeAdvance._id }).lean();
      assert.ok(record, "advance employee record missing");
      assert.ok(record.advanceAmount > 0, "advance should be deducted in compute");
      const breakdownSum = (record.advanceBreakdown || []).reduce(
        (sum, row) => sum + (Number(row.deductedThisMonth) || 0),
        0,
      );
      assert.equal(Number(breakdownSum.toFixed(2)), Number(record.advanceAmount.toFixed(2)));
    });

    await ok("manual payroll edit cannot override attendance-derived rest-day count", async () => {
      const restDay = getMonthRestdays(YEAR, MONTH, WEEKLY_REST_DAYS)[0];
      assert.ok(restDay, "expected at least one weekly rest day in period");
      await Attendance.create({
        employeeId: activeAdvance._id,
        employeeCode: activeAdvance.employeeCode,
        date: restDay,
        checkIn: "09:00",
        checkOut: "17:00",
        status: "PRESENT",
        totalHours: 8,
        restDayWorkApproved: true,
      });

      await computePayrollRun(run._id, TEST_USER);
      const before = await PayrollRecord.findOne({ runId: run._id, employeeId: activeAdvance._id }).lean();
      assert.ok(before.extraDaysWorked > 0, "expected approved rest-day count from attendance");

      await updatePayrollRecordManually(
        before._id,
        { extraDaysWorked: 99, fixedBonus: 10 },
        TEST_USER,
      );
      const after = await PayrollRecord.findById(before._id).lean();
      assert.equal(after.extraDaysWorked, before.extraDaysWorked);
      assert.equal(after.fixedBonus, 10);
    });

    await ok("finalize aborts on advance drift and leaves run/advance unchanged", async () => {
      const record = await PayrollRecord.findOne({ runId: run._id, employeeId: activeAdvance._id });
      assert.ok(record, "advance employee record missing for finalize drift check");
      record.advanceBreakdown = (record.advanceBreakdown || []).map((row, idx) => ({
        ...row.toObject?.() || row,
        deductedThisMonth: idx === 0 ? Number(row.deductedThisMonth || 0) + 100 : row.deductedThisMonth,
      }));
      await record.save();

      let threw = false;
      try {
        await finalizePayrollRun(run._id, TEST_USER);
      } catch (err) {
        threw = true;
        assert.match(String(err.message || err), /advance breakdown drift|advance drift/i);
      }
      assert.equal(threw, true, "finalize should reject drifted advance breakdown");

      const freshRun = await PayrollRun.findById(run._id).lean();
      const freshAdvance = await EmployeeAdvance.findById(advance._id).lean();
      assert.equal(freshRun.status, "COMPUTED");
      assert.equal(freshAdvance.remainingAmount, 5000);
      assert.equal((freshAdvance.deductionHistory || []).length, 0);
    });
  } finally {
    await PayrollRecord.deleteMany({ runId: { $in: createdRunIds } });
    await PayrollComputeSnapshot.deleteMany({ runId: { $in: createdRunIds } });
    await PayrollRun.deleteMany({ _id: { $in: createdRunIds } });
    await EmployeeAdvance.deleteMany({ _id: { $in: createdAdvanceIds } });
    await Attendance.deleteMany({ employeeId: { $in: createdEmployeeIds } });
    await Assessment.deleteMany({ employeeId: { $in: createdEmployeeIds } });
    await Employee.deleteMany({ _id: { $in: createdEmployeeIds } });
    await AuditLog.deleteMany({ performedBy: TEST_USER });

    if (originalPolicy) {
      await OrganizationPolicy.replaceOne({ _id: originalPolicy._id }, originalPolicy, { upsert: true });
    } else {
      await OrganizationPolicy.deleteOne({ name: "default" });
    }

    await mongoose.disconnect();
  }

  if (process.exitCode) {
    console.error("\npayroll-integrity-smoke: failures above");
  } else {
    console.log("\npayroll-integrity-smoke: all passed");
  }
}

main().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
