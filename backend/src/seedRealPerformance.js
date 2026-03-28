/**
 * seedRealPerformance.js
 * Comprehensive seed for Attendance with Realistic Employee Performance Scenarios (April 2026)
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
import { Department } from "./models/Department.js";
import { Team } from "./models/Team.js";
import { processBulk, generateMonthlyMetrics } from "./services/attendanceEngine.js";

// -- Help Functions --
function random(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function setTime(date, h, m=0) { const d = new Date(date); d.setUTCHours(h, m, 0, 0); return d; }
function isWeekend(date) { const day = date.getUTCDay(); return day === 0 || day === 6; }

async function run() {
  await connectDb();
  console.log("🧹 Cleaning up old attendance data (April 2026 logs)...");
  await AttendanceEvent.deleteMany({ timestamp: { $gte: new Date("2026-04-01"), $lt: new Date("2026-05-01") } });
  await AttendanceDaily.deleteMany({ date: { $gte: new Date("2026-04-01"), $lt: new Date("2026-05-01") } });
  await AttendanceMetric.deleteMany({ periodLabel: "2026-04" });

  const depts = await Department.find();
  const teams = await Team.find();
  
  // Seed Some Realistic Employees if not enough
  console.log("👤 Syncing Employees for Performance Scenarios...");
  const employees = await Employee.find();
  
  const startDate = new Date("2026-04-01T00:00:00Z");
  const endDate = new Date("2026-04-30T00:00:00Z");
  const events = [];
  const batchId = `REAL_PERF_APRIL_${Date.now()}`;

  const scenarios = [
    { type: "PERFECT", name: "The Consistent Expert", role: "Software Engineer", email_key: "devops1" },
    { type: "LATE_BIRD", name: "The Morning Struggler", role: "Sales Associate", email_key: "sales1" },
    { type: "WORKAHOLIC", name: "The Late Night Runner", role: "Finance Analyst", email_key: "itmgr" },
    { type: "HYBRID", name: "The Remote Master", role: "Frontend Dev", email_key: "fe1" },
    { type: "CHAOTIC", name: "The Forgetful Sync", role: "UX Designer", email_key: "devops2" }, // Missing check-outs
    { type: "STANDARD", name: "The Average Regular", role: "HR Officer", email_key: "hrhead" },
  ];

  for (const emp of employees) {
    const sc = scenarios.find(s => emp.email.includes(s.email_key)) || { type: "STANDARD" };
    console.log(`📡 Generating events for ${emp.fullName} (${sc.type})`);

    const curr = new Date(startDate);
    let dayIdx = 0;
    while (curr <= endDate) {
      if (!isWeekend(curr)) {
        const dayEvents = genScenario(emp, curr, sc.type, dayIdx);
        events.push(...dayEvents.map(e => ({ ...e, importBatchId: batchId, source: e.source || "BIOMETRIC" })));
        dayIdx++;
      }
      curr.setUTCDate(curr.getUTCDate() + 1);
    }
  }

  console.log(`📥 Inserting ${events.length} events...`);
  await AttendanceEvent.insertMany(events);

  console.log("⚙️  Running Processing Engine for April 2026...");
  const bulkResult = await processBulk({ startDate, endDate });
  console.log(`✅ Processed ${bulkResult.processed} daily records.`);

  console.log("📊 Aggregating Monthly Metrics for April 2026...");
  const metricResult = await generateMonthlyMetrics(2026, 4);
  console.log(`✅ Created ${metricResult.generated} monthly metrics.`);

  console.log("🚀 Done! APRIL 2026 is now fully populated with REALISTIC data.");
  await mongoose.disconnect();
}

function genScenario(emp, date, type, idx) {
  const evs = [];
  const meta = { employeeId: emp._id, employeeCode: emp.employeeCode };

  switch(type) {
    case "PERFECT":
      evs.push({ ...meta, timestamp: setTime(date, 8, random(50, 59)), eventType: "CHECK_IN" });
      evs.push({ ...meta, timestamp: setTime(date, 17, random(2, 8)), eventType: "CHECK_OUT" });
      break;
    
    case "LATE_BIRD":
      const isLate = idx % 2 === 0;
      evs.push({ ...meta, timestamp: setTime(date, 9, isLate ? random(25, 50) : random(0, 5)), eventType: "CHECK_IN" });
      evs.push({ ...meta, timestamp: setTime(date, 17, random(0, 10)), eventType: "CHECK_OUT" });
      break;

    case "WORKAHOLIC":
      evs.push({ ...meta, timestamp: setTime(date, 8, random(10, 30)), eventType: "CHECK_IN" });
      evs.push({ ...meta, timestamp: setTime(date, random(19, 21), random(0, 45)), eventType: "CHECK_OUT" });
      break;

    case "HYBRID":
      const isRem = idx % 3 === 0;
      evs.push({ ...meta, timestamp: setTime(date, 9, random(0, 15)), eventType: "CHECK_IN", source: isRem ? "WFH" : "BIOMETRIC" });
      evs.push({ ...meta, timestamp: setTime(date, 17, random(0, 15)), eventType: "CHECK_OUT", source: isRem ? "WFH" : "BIOMETRIC" });
      break;

    case "CHAOTIC":
      const missingOut = idx % 4 === 0;
      evs.push({ ...meta, timestamp: setTime(date, 9, random(5, 20)), eventType: "CHECK_IN" });
      if (!missingOut) evs.push({ ...meta, timestamp: setTime(date, 17, random(0, 30)), eventType: "CHECK_OUT" });
      break;

    default:
      if (idx % 10 === 0) break; // Random absence
      evs.push({ ...meta, timestamp: setTime(date, 9, random(5, 12)), eventType: "CHECK_IN" });
      evs.push({ ...meta, timestamp: setTime(date, 17, random(0, 5)), eventType: "CHECK_OUT" });
      break;
  }
  return evs;
}

run().catch(console.error);
