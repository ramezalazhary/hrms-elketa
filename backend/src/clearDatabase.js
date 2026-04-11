/**
 * @file Dev / recovery utility: drops the entire MongoDB database, then seeds one ADMIN (superadmin) user.
 *
 * ⚠️  Destroys ALL collections (payroll, attendance, policies, etc.) in the database from MONGODB_URI.
 *
 * Usage:
 *   npm run clearDatabase
 *
 * Production safety: set NODE_ENV=production requires `--force` flag:
 *   node src/clearDatabase.js --force
 *
 * Optional env:
 *   SUPERADMIN_EMAIL     (default: superadmin@elketa.com)
 *   SUPERADMIN_PASSWORD  (default: SuperAdmin123!)
 *   SUPERADMIN_NAME      (default: Super Admin)
 */
import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { connectDb } from "./config/db.js";
import { Employee } from "./models/Employee.js";
import { Department } from "./models/Department.js";

const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL || "admin@hr.local";
const SUPERADMIN_PASSWORD = process.env.SUPERADMIN_PASSWORD || "admin123";
const SUPERADMIN_NAME = process.env.SUPERADMIN_NAME || "Super Admin";

async function run() {
  const force = process.argv.includes("--force");
  if (process.env.NODE_ENV === "production" && !force) {
    console.error(
      "Refusing to drop database in production. Run with: node src/clearDatabase.js --force",
    );
    process.exit(1);
  }

  await connectDb();
  const dbName = mongoose.connection.name;
  const db = mongoose.connection.db;

  console.log(`⚠️  Dropping entire database "${dbName}" (all collections)...`);
  await db.dropDatabase();
  console.log("✅ Database dropped.");

  console.log("🛠️  Creating minimal HR department + superadmin (ADMIN role)...");

  const hrDept = await Department.create({
    name: "HR",
    code: "HR",
    type: "PERMANENT",
    status: "ACTIVE",
    headTitle: "Administrator",
  });

  const passwordHash = await bcrypt.hash(SUPERADMIN_PASSWORD, 10);

  await Employee.create({
    email: SUPERADMIN_EMAIL,
    passwordHash,
    role: "ADMIN",
    fullName: SUPERADMIN_NAME,
    position: "System Administrator",
    department: "HR",
    departmentId: hrDept._id,
    employeeCode: "#HR-001",
    isActive: true,
    status: "ACTIVE",
    employmentType: "FULL_TIME",
    requirePasswordChange: false,
  });

  console.log("");
  console.log("✅ Superadmin ready:");
  console.log(`   Email:    ${SUPERADMIN_EMAIL}`);
  console.log(`   Password: ${SUPERADMIN_PASSWORD}  (override with SUPERADMIN_PASSWORD in .env)`);
  console.log(`   Role:     ADMIN (full access)`);
  console.log("");

  await mongoose.disconnect();
  console.log("👋 Done.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
