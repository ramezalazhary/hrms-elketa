/**
 * @file Dev utility: wipes core Collections and inserts a single ADMIN employee for recovery.
 * Run: `node src/clearDatabase.js` from `backend/`.
 */
import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { connectDb } from "./config/db.js";
import { Employee } from "./models/Employee.js";
import { Department } from "./models/Department.js";
import { Team } from "./models/Team.js";
import { Position } from "./models/Position.js";
import { PasswordResetRequest } from "./models/PasswordResetRequest.js";
import { UserPermission } from "./models/Permission.js";
import { TokenBlacklist } from "./models/TokenBlacklist.js";

/**
 * Connects to MongoDB, `deleteMany` on each model in order, inserts `admin@hr.local` as Employee, disconnects.
 * @returns {Promise<void>}
 */
async function run() {
  await connectDb();
  console.log("🧹 Wiping database collections...");

  const collections = [
    Department,
    Team,
    Position,
    Employee,
    PasswordResetRequest,
    UserPermission,
    TokenBlacklist,
  ];

  for (const model of collections) {
    if (model && model.deleteMany) {
      const info = await model.deleteMany({});
      console.log(
        `🗑️  Cleared: ${model.modelName} ${info.deletedCount} items.`,
      );
    }
  }

  console.log("🛠️  Re-seeding Admin employee...");
  const passwordHash = await bcrypt.hash("admin123", 10);
  await Employee.create({
    email: "admin@hr.local",
    passwordHash,
    role: "ADMIN",
    fullName: "System Admin",
    position: "Administrator",
    department: "HR",
    isActive: true,
    status: "ACTIVE",
    employmentType: "FULL_TIME",
  });
  console.log("✅ Admin employee created (admin@hr.local / admin123)");

  await mongoose.disconnect();
  console.log("👋 Done.");
}

run().catch(console.error);
