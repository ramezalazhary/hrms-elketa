import mongoose from 'mongoose';
import { AttendancePolicy } from './src/models/AttendancePolicy.js';
import { AttendanceEvent } from './src/models/AttendanceEvent.js';
import { AttendanceDaily } from './src/models/AttendanceDaily.js';
import { Employee } from './src/models/Employee.js';
import { AttendanceMetric } from './src/models/AttendanceMetric.js';
import { processDay, generateMetric } from './src/services/attendanceEngine.js';

const MONGODB_URI = "mongodb://127.0.0.1:27017/hr_management";

async function runTest() {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to DB");

  // Clear previous test
  await AttendancePolicy.deleteMany({});
  await AttendanceMetric.deleteMany({});
  await AttendanceEvent.deleteMany({});
  await AttendanceDaily.deleteMany({});
  await Employee.deleteMany({});
  
  // 1. Setup Employee
  const emp = await Employee.create({
    firstName: "Test",
    lastName: "Admin",
    fullName: "Test Admin",
    email: "admin@hr.local",
    employeeCode: "EMP001",
    department: "IT",
    position: "Manager",
    status: "ACTIVE"
  });
  console.log("Created Employee EMP001 with full required fields");

  // 2. Setup Policy
  const policy = await AttendancePolicy.create({
    name: "PRODUCTION_POLICY",
    isDefault: true,
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

  // 3. Create Late Event
  const testDate = "2026-04-10";
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
    console.log("❌ Daily Deduction Incorrect! Got:", daily.lateDeduction);
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

runTest().catch(console.log);
