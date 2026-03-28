#!/usr/bin/env node

/**
 * Connection Test Script - Tests Frontend-Backend Communication
 *
 * Usage:
 *   node connectionTest.js
 *
 * This script will:
 * 1. Check if backend is running on port 5000
 * 2. Test MongoDB connection
 * 3. Show configuration being used
 * 4. Verify seed data exists
 */

import fetch from "node-fetch";
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load backend .env
dotenv.config({ path: path.join(__dirname, "backend", ".env") });

const config = {
  mongoUri: process.env.MONGO_URI || "mongodb://localhost:27017/hrms",
  backendPort: process.env.PORT || 5000,
  backendUrl: `http://localhost:${process.env.PORT || 5000}`,
  jwtSecret: process.env.JWT_SECRET ? "[SET]" : "[NOT SET]",
};

console.log(
  "\n═══════════════════════════════════════════════════════════════",
);
console.log("  HRMS Frontend-Backend Connection Test");
console.log(
  "═══════════════════════════════════════════════════════════════\n",
);

// 1. Check Configuration
console.log("📋 CONFIGURATION:");
console.log(`   Backend URL: ${config.backendUrl}`);
console.log(`   MongoDB URI: ${config.mongoUri}`);
console.log(`   JWT Secret: ${config.jwtSecret}\n`);

// 2. Test Backend Connectivity
console.log("🔗 TESTING BACKEND CONNECTION...");
try {
  const response = await fetch(`${config.backendUrl}/api/auth/login`, {
    method: "OPTIONS",
  });
  console.log(`   ✓ Backend is running on ${config.backendUrl}`);
  console.log(`   ✓ CORS preflight: ${response.status}\n`);
} catch (err) {
  console.error(`   ✗ Backend not accessible: ${err.message}`);
  console.error(
    "   → Make sure backend is running: npm run dev (in backend folder)\n",
  );
}

// 3. Test MongoDB Connection
console.log("🗄️  TESTING MONGODB CONNECTION...");
try {
  await mongoose.connect(config.mongoUri, {
    serverSelectionTimeoutMS: 5000,
  });
  console.log(`   ✓ MongoDB connected: ${config.mongoUri}`);

  // Check employee count
  const Employee = mongoose.model(
    "Employee",
    new mongoose.Schema({}, { strict: false }),
    "employees",
  );
  const count = await Employee.countDocuments();
  console.log(`   ✓ Found ${count} employees in database\n`);

  if (count === 0) {
    console.log("   ⚠️  No employees found - need to run seed!");
    console.log("   Run: npm run seed (in backend folder)\n");
  }
} catch (err) {
  console.error(`   ✗ MongoDB not accessible: ${err.message}`);
  console.error("   → Make sure MongoDB is running on port 27017\n");
} finally {
  await mongoose.disconnect();
}

// 4. Test Login Endpoint
console.log("🔐 TESTING LOGIN ENDPOINT...");
try {
  const response = await fetch(`${config.backendUrl}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: "superadmin@elketa.com",
      password: "emp123",
    }),
  });

  const data = await response.json();

  if (response.status === 200) {
    console.log(`   ✓ Login endpoint working: ${response.status}`);
    console.log(
      `   ✓ Returned accessToken: ${data.accessToken ? "[SET]" : "[NOT SET]"}`,
    );
    console.log(`   ✓ Returned user: ${data.user?.email}\n`);
  } else if (response.status === 401) {
    console.log(`   ⚠️  Authentication failed: ${data.error}`);
    console.log("   → Credentials may be wrong or user not seeded\n");
  } else {
    console.log(`   ✗ Unexpected response: ${response.status}`);
    console.log(`   Server response: ${JSON.stringify(data)}\n`);
  }
} catch (err) {
  console.error(`   ✗ Failed to test login: ${err.message}\n`);
}

// 5. Summary
console.log("═══════════════════════════════════════════════════════════════");
console.log("  NEXT STEPS:");
console.log(
  "═══════════════════════════════════════════════════════════════\n",
);

console.log("1️⃣  Start Backend (if not running):");
console.log("    cd backend && npm run dev\n");

console.log("2️⃣  Seed Database (if no employees):");
console.log("    cd backend && npm run seed\n");

console.log("3️⃣  Start Frontend:");
console.log("    cd frontend && npm run dev\n");

console.log("4️⃣  Open Browser:");
console.log("    http://localhost:5173/login\n");

console.log("5️⃣  Login with:");
console.log("    Email: superadmin@elketa.com");
console.log("    Password: emp123\n");

console.log(
  "═══════════════════════════════════════════════════════════════\n",
);
