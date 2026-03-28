/**
 * clearDatabase.js
 * Wipes all data in the DB collections found in models/ and re-creates the default admin user.
 */
import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { connectDb } from "./config/db.js";
import { User } from "./models/User.js";
import { Employee } from "./models/Employee.js";
import { Department } from "./models/Department.js";
import { Team } from "./models/Team.js";
import { Position } from "./models/Position.js";
import { AttendanceEvent } from "./models/AttendanceEvent.js";
import { AttendanceDaily } from "./models/AttendanceDaily.js";
import { AttendancePolicy } from "./models/AttendancePolicy.js";
import { AttendanceMetric } from "./models/AttendanceMetric.js";
import { PasswordResetRequest } from "./models/PasswordResetRequest.js";
import { UserPermission } from "./models/Permission.js";
import { TokenBlacklist } from "./models/TokenBlacklist.js";

async function run() {
  await connectDb();
  console.log("🧹 Wiping database collections...");

  const collections = [
    AttendanceDaily, AttendanceEvent, AttendanceMetric, AttendancePolicy,
    Department, Team, Position, User, Employee,
    PasswordResetRequest, UserPermission, TokenBlacklist
  ];

  for (const model of collections) {
    if (model && model.deleteMany) {
      const info = await model.deleteMany({});
      console.log(`🗑️  Cleared: ${model.modelName} ${info.deletedCount} items.`);
    }
  }

  console.log("🛠️  Re-seeding Admin user...");
  const passwordHash = await bcrypt.hash("admin123", 10);
  await User.create({
    email: "admin@hr.local",
    passwordHash,
    role: "ADMIN",
    isActive: true,
  });
  console.log("✅ Admin user created (admin@hr.local / admin123)");

  await mongoose.disconnect();
  console.log("👋 Done.");
}

run().catch(console.error);
