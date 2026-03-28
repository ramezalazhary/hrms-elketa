/**
 * seedAttendance.js — Seeds default attendance policies + 1 month of test events
 *
 * Usage:  node --experimental-modules src/seedAttendance.js
 */
import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { connectDb } from "./config/db.js";
import { AttendancePolicy } from "./models/AttendancePolicy.js";
import { AttendanceEvent } from "./models/AttendanceEvent.js";
import { AttendanceDaily } from "./models/AttendanceDaily.js";
import { AttendanceMetric } from "./models/AttendanceMetric.js";
import { Employee } from "./models/Employee.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function setTime(date, hours, minutes = 0) {
  const d = new Date(date);
  d.setUTCHours(hours, minutes, 0, 0);
  return d;
}

function isWeekend(date) {
  const day = date.getUTCDay();
  return day === 0 || day === 6; // Sun = 0, Sat = 6
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function seed() {
  await connectDb();
  console.log("🗑️  Clearing attendance collections...");
  await AttendanceEvent.deleteMany({});
  await AttendanceDaily.deleteMany({});
  await AttendanceMetric.deleteMany({});
  await AttendancePolicy.deleteMany({});

  // ── Step 1: Create Policies ─────────────────────────────────────────────────
  console.log("📋 Creating attendance policies...");

  const standardPolicy = await AttendancePolicy.create({
    name: "Standard 9-5",
    description: "Default fixed-shift policy for regular office employees",
    isDefault: true,
    shiftType: "FIXED",
    workStartTime: "09:00",
    workEndTime: "17:00",
    scheduledHours: 8,
    graceMinutes: 15,
    halfDayThresholdHours: 4,
    minHoursForPresent: 6,
    overtimeThresholdMin: 30,
    autoBreakDeductMin: 60,
    workingDays: ["MON", "TUE", "WED", "THU", "FRI"],
    overtimeRate: 1.5,
    appliesTo: "ALL",
  });
  console.log(`   ✅ "${standardPolicy.name}" (default)`);

  const nightPolicy = await AttendancePolicy.create({
    name: "Night Shift",
    description: "Night shift for security and operations teams",
    shiftType: "NIGHT",
    workStartTime: "22:00",
    workEndTime: "06:00",
    scheduledHours: 8,
    graceMinutes: 15,
    halfDayThresholdHours: 4,
    minHoursForPresent: 6,
    overtimeThresholdMin: 30,
    autoBreakDeductMin: 60,
    workingDays: ["MON", "TUE", "WED", "THU", "FRI"],
    isNightShift: true,
    nightShiftCutoff: "04:00",
    overtimeRate: 1.75,
    appliesTo: "DEPARTMENT",
  });
  console.log(`   ✅ "${nightPolicy.name}"`);

  const splitPolicy = await AttendancePolicy.create({
    name: "Split Shift",
    description: "Split shift for customer-facing roles (morning + evening)",
    shiftType: "SPLIT",
    workStartTime: "09:00",
    workEndTime: "13:00",
    splitStartTime: "16:00",
    splitEndTime: "20:00",
    scheduledHours: 8,
    graceMinutes: 10,
    halfDayThresholdHours: 4,
    minHoursForPresent: 6,
    overtimeThresholdMin: 30,
    autoBreakDeductMin: 0,
    workingDays: ["SUN", "MON", "TUE", "WED", "THU"],
    overtimeRate: 1.5,
    appliesTo: "DEPARTMENT",
  });
  console.log(`   ✅ "${splitPolicy.name}"`);

  const flexiblePolicy = await AttendancePolicy.create({
    name: "Flexible Hours",
    description: "Flexible hours for senior/remote employees (core hours 10-15)",
    shiftType: "FLEXIBLE",
    workStartTime: "07:00",
    workEndTime: "19:00",
    scheduledHours: 8,
    graceMinutes: 60,
    halfDayThresholdHours: 4,
    minHoursForPresent: 6,
    overtimeThresholdMin: 60,
    autoBreakDeductMin: 60,
    workingDays: ["MON", "TUE", "WED", "THU", "FRI"],
    overtimeRate: 1.5,
    appliesTo: "INDIVIDUAL",
  });
  console.log(`   ✅ "${flexiblePolicy.name}"`);

  // ── Step 2: Generate Test Events ────────────────────────────────────────────
  console.log("\n📅 Generating test attendance events for March 2026...");

  const employees = await Employee.find({}).lean();
  if (employees.length === 0) {
    console.error("❌ No employees found. Run seedUsers.js first.");
    process.exit(1);
  }

  const startDate = new Date("2026-03-01T00:00:00Z");
  const endDate = new Date("2026-03-31T00:00:00Z");
  const allEvents = [];
  const batchId = `seed_${Date.now()}`;

  for (const emp of employees) {
    const email = emp.email;
    let scenario = "standard"; // default

    // Assign scenarios based on role/email
    if (email === "devops1@hr.local") scenario = "perfect";       // Never late, no absences
    if (email === "devops2@hr.local") scenario = "problematic";   // 3 late, 1 absent, OT
    if (email === "fe1@hr.local")     scenario = "wfh_mix";       // 5 WFH, 17 office
    if (email === "sales1@hr.local")  scenario = "standard";      // Normal employee
    if (email === "salesmgr@hr.local") scenario = "overtime";     // Regular overtime
    if (email === "itmgr@hr.local")   scenario = "manager";       // Manager pattern
    if (email === "devopsleader@hr.local") scenario = "leader";   // Leader pattern
    if (email === "feleader@hr.local") scenario = "standard";
    if (email === "hrhead@hr.local")  scenario = "standard";
    if (email === "admin@hr.local")   scenario = "standard";

    const current = new Date(startDate);
    let dayIndex = 0;

    while (current <= endDate) {
      const dateStr = current.toISOString().slice(0, 10);

      if (!isWeekend(current)) {
        const events = generateDayEvents(emp, current, scenario, dayIndex);
        allEvents.push(...events.map(e => ({
          ...e,
          importBatchId: batchId,
          source: "SYSTEM",
        })));
        dayIndex++;
      }

      current.setUTCDate(current.getUTCDate() + 1);
    }
  }

  if (allEvents.length > 0) {
    await AttendanceEvent.insertMany(allEvents);
  }

  console.log(`   ✅ Created ${allEvents.length} events for ${employees.length} employees`);

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════════");
  console.log("✅ Attendance seed complete!");
  console.log(`   Policies:  ${await AttendancePolicy.countDocuments()}`);
  console.log(`   Events:    ${await AttendanceEvent.countDocuments()}`);
  console.log(`   Daily:     ${await AttendanceDaily.countDocuments()} (run engine to populate)`);
  console.log(`   Metrics:   ${await AttendanceMetric.countDocuments()} (run aggregation to populate)`);
  console.log("═══════════════════════════════════════════════");

  await mongoose.disconnect();
}

// ─── Event Generators ─────────────────────────────────────────────────────────

function generateDayEvents(employee, date, scenario, dayIndex) {
  const events = [];
  const empId = employee._id;
  const empCode = employee.employeeCode;

  switch (scenario) {
    case "perfect": {
      // Always on time: 08:55-09:00 → 17:00-17:05
      const ciH = 8, ciM = randomBetween(50, 59);
      const coH = 17, coM = randomBetween(0, 5);
      events.push(makeEvent(empId, empCode, date, ciH, ciM, "CHECK_IN"));
      events.push(makeEvent(empId, empCode, date, coH, coM, "CHECK_OUT"));
      break;
    }

    case "problematic": {
      // Day 5, 12, 18: late (09:25-09:40)
      // Day 8: absent (no events)
      // Day 20, 21: overtime (stay until 20:00)
      if (dayIndex === 7) break; // absent — no events

      const isLateDay = [4, 11, 17].includes(dayIndex);
      const isOTDay = [19, 20].includes(dayIndex);

      const ciH = 9, ciM = isLateDay ? randomBetween(25, 40) : randomBetween(0, 10);
      const coH = isOTDay ? 20 : 17;
      const coM = randomBetween(0, 15);

      events.push(makeEvent(empId, empCode, date, ciH, ciM, "CHECK_IN"));
      events.push(makeEvent(empId, empCode, date, coH, coM, "CHECK_OUT"));
      break;
    }

    case "wfh_mix": {
      // Days 0-4: WFH
      const isWFH = dayIndex < 5;
      const ciH = isWFH ? randomBetween(8, 9) : 9;
      const ciM = randomBetween(0, 15);
      const coH = 17, coM = randomBetween(0, 30);

      events.push({
        employeeId: empId,
        employeeCode: empCode,
        timestamp: setTime(date, ciH, ciM),
        eventType: "CHECK_IN",
        source: isWFH ? "WFH" : "SYSTEM",
      });
      events.push({
        employeeId: empId,
        employeeCode: empCode,
        timestamp: setTime(date, coH, coM),
        eventType: "CHECK_OUT",
        source: isWFH ? "WFH" : "SYSTEM",
      });
      break;
    }

    case "overtime": {
      // Regular OT: stay 1-2 hours extra most days
      const ciH = 8, ciM = randomBetween(45, 59);
      const coH = randomBetween(18, 19), coM = randomBetween(0, 30);
      events.push(makeEvent(empId, empCode, date, ciH, ciM, "CHECK_IN"));
      events.push(makeEvent(empId, empCode, date, coH, coM, "CHECK_OUT"));
      break;
    }

    case "manager":
    case "leader": {
      // Arrive early, leave on time or slightly late
      const ciH = 8, ciM = randomBetween(30, 55);
      const coH = 17, coM = randomBetween(0, 30);
      events.push(makeEvent(empId, empCode, date, ciH, ciM, "CHECK_IN"));
      events.push(makeEvent(empId, empCode, date, coH, coM, "CHECK_OUT"));
      break;
    }

    default: {
      // Standard: mostly on time, occasional slight lateness
      const ciH = 9, ciM = randomBetween(0, 12);
      const coH = 17, coM = randomBetween(0, 10);
      events.push(makeEvent(empId, empCode, date, ciH, ciM, "CHECK_IN"));
      events.push(makeEvent(empId, empCode, date, coH, coM, "CHECK_OUT"));
      break;
    }
  }

  return events;
}

function makeEvent(employeeId, employeeCode, date, hour, minute, eventType) {
  return {
    employeeId,
    employeeCode,
    timestamp: setTime(date, hour, minute),
    eventType,
  };
}

seed().catch(err => {
  console.error("Seed failed:", err);
  process.exit(1);
});
