import mongoose from 'mongoose';
import { AttendancePolicy } from '../backend/src/models/AttendancePolicy.js';
import { AttendanceEvent } from '../backend/src/models/AttendanceEvent.js';
import { AttendanceDaily } from '../backend/src/models/AttendanceDaily.js';
import { Employee } from '../backend/src/models/Employee.js';
import { processDay, generateMetric } from '../backend/src/services/attendanceEngine.js';

const MONGODB_URI = "mongodb://127.0.0.1:27017/hr_management";

async function runTest() {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to DB");

  // 1. Setup Policy
  await AttendancePolicy.deleteMany({ name: "TEST_POLICY" });
  const policy = await AttendancePolicy.create({
    name: "TEST_POLICY",
    isDefault: false,
    appliesTo: "ALL",
    workStartTime: "09:00",
    workEndTime: "17:00",
    graceMinutes: 15,
    lateDeductionRules: [
      { fromMinutes: 15, toMinutes: 60, deductionValue: 0.5, deductionUnit: "DAYS" }
    ],
    absentDeductionDays: 1,
    scheduledHours: 8,
    workingDays: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]
  });
  console.log("Setup Policy with 15-60m = 0.5d deduction");

  // 2. Find Employee
  const emp = await Employee.findOne({ email: "admin@hr.local" });
  if (!emp) throw new Error("Admin employee not found");

  // 3. Create Late Event
  const testDate = "2026-04-10";
  await AttendanceEvent.deleteMany({ employeeId: emp._id, timestamp: { 
    $gte: new Date(testDate + "T00:00:00Z"), 
    $lte: new Date(testDate + "T23:59:59Z") 
  }});
  
  // Check-in at 09:45 (45 mins late)
  const checkIn = new Date(testDate + "T09:45:00Z");
  await AttendanceEvent.create({
    employeeId: emp._id,
    eventType: "CHECK_IN",
    timestamp: checkIn,
    source: "WEB"
  });
  console.log("Created late check-in at 09:45");

  // 4. Process Day
  console.log("Processing day...");
  const daily = await processDay(emp._id, new Date(testDate));
  
  console.log("Daily Result:");
  console.log("- Status:", daily.status);
  console.log("- Late Minutes:", daily.lateMinutes);
  console.log("- Late Deduction:", daily.lateDeduction, daily.lateDeductionUnit);

  if (daily.lateDeduction === 0.5) {
    console.log("✅ Daily Deduction Correct!");
  } else {
    console.log("❌ Daily Deduction Incorrect!");
  }

  // 5. Generate Metric
  console.log("Generating monthly metric...");
  const metric = await generateMetric({
    employeeId: emp._id,
    periodType: "MONTHLY",
    periodStart: new Date("2026-04-01"),
    periodEnd: new Date("2026-04-30")
  });

  console.log("Metric Result:");
  console.log("- Total Late Deduction Days:", metric.totalLateDeductionDays);

  if (metric.totalLateDeductionDays === 0.5) {
    console.log("✅ Metric Aggregation Correct!");
  } else {
    console.log("❌ Metric Aggregation Incorrect!");
  }

  await mongoose.disconnect();
}

runTest().catch(console.error);
