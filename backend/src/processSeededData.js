/**
 * processSeededData.js
 * Runs the attendance engine on all seeded events for March 2026.
 */
import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { connectDb } from "./config/db.js";
import { processBulk, generateMonthlyMetrics } from "./services/attendanceEngine.js";

async function run() {
  await connectDb();
  console.log("⚙️  Processing attendance for all employees (March 2026)...");

  try {
    const bulkResult = await processBulk({
      startDate: new Date("2026-03-01T00:00:00Z"),
      endDate: new Date("2026-03-31T00:00:00Z")
    });
    console.log(`✅ Bulk Processed: ${bulkResult.processed} daily records.`);
    if (bulkResult.errors.length > 0) {
      console.warn(`⚠️  Errors: ${bulkResult.errors.length}`);
    }

    console.log("📊 Generating monthly metrics for March 2026...");
    const metricsResult = await generateMonthlyMetrics(2026, 3);
    console.log(`✅ Generated ${metricsResult.generated} monthly metrics.`);

  } catch (err) {
    console.error("❌ Process failed:", err);
  } finally {
    await mongoose.disconnect();
    console.log("👋 Disconnected.");
  }
}

run();
