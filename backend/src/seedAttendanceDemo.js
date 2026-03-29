/**
 * Seeds sample attendance rows for demo / QA (last 14 calendar days, weekdays only).
 *
 * Usage (from `backend/`):
 *   npm run seed:attendance
 *
 * Requires existing employees with `employeeCode`. Skips days that already have a record.
 * Uses MONGO_URI from `.env` (same as the main app).
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
import { Attendance } from "./models/Attendance.js";
import { Employee } from "./models/Employee.js";

dotenv.config();

const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/hrms";

function addDaysUTC(d, n) {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

function atUtcMidnight(y, m, day) {
  const d = new Date(Date.UTC(y, m, day));
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

async function seed() {
  await mongoose.connect(mongoUri);
  console.log("Connected:", mongoUri);

  const employees = await Employee.find({
    employeeCode: { $exists: true, $ne: "" },
    status: "ACTIVE",
  })
    .limit(12)
    .lean();

  if (!employees.length) {
    console.warn("No employees with employeeCode found. Run employee seed or create employees first.");
    await mongoose.disconnect();
    process.exit(0);
  }

  let created = 0;
  let skipped = 0;

  const today = new Date();
  const start = addDaysUTC(today, -13);

  for (let dayOff = 0; dayOff < 14; dayOff++) {
    const date = addDaysUTC(start, dayOff);
    const dow = date.getUTCDay();
    if (dow === 0 || dow === 6) continue;

    const y = date.getUTCFullYear();
    const m = date.getUTCMonth();
    const d = date.getUTCDate();
    const normalized = atUtcMidnight(y, m, d);

    for (let i = 0; i < employees.length; i++) {
      const emp = employees[i];
      const exists = await Attendance.findOne({
        employeeId: emp._id,
        date: normalized,
      }).lean();
      if (exists) {
        skipped++;
        continue;
      }

      const late = (i + dayOff) % 7 === 0;
      const checkIn = late ? "09:25:00" : "08:55:00";
      const checkOut = late ? "17:05:00" : "17:00:00";
      const tIn = late ? 9 + 25 / 60 : 8 + 55 / 60;
      const tOut = late ? 17 + 5 / 60 : 17;
      const totalHours = Math.round((tOut - tIn) * 100) / 100;

      await Attendance.create({
        employeeId: emp._id,
        employeeCode: emp.employeeCode || "—",
        date: normalized,
        checkIn,
        checkOut,
        status: late ? "LATE" : "PRESENT",
        totalHours,
        remarks: "Demo seed",
      });
      created++;
    }
  }

  console.log(`Demo attendance: ${created} created, ${skipped} skipped (already existed).`);
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
