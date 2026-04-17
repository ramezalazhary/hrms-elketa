/**
 * One-time migration: Assessment.assessment[] → PerformanceReview
 * Run: node src/scripts/migrateAssessments.js
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
import { Assessment } from "../models/Assessment.js";
import { PerformanceReview } from "../models/PerformanceReview.js";

// Load env vars if running standalone
dotenv.config();

async function migrate() {
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/hrms";
  console.log(`Connecting to MongoDB at: ${uri}`);
  await mongoose.connect(uri);
  
  const docs = await Assessment.find({}).lean();
  let migrated = 0, skipped = 0, errors = 0;
  
  console.log(`Found ${docs.length} legacy Assessment documents.`);

  for (const doc of docs) {
    if (!doc.assessment || !Array.isArray(doc.assessment)) continue;

    for (const a of doc.assessment) {
      if (!a.period || !a.period.year || !a.period.month) {
        console.warn(`Skipping assessment for employee ${doc.employeeId} - missing period`);
        skipped++;
        continue;
      }

      // Check for duplicates
      const exists = await PerformanceReview.exists({
        employeeId: doc.employeeId,
        "period.year": a.period.year,
        "period.month": a.period.month,
        evaluatorId: a.evaluatorId,
      });
      
      if (exists) { 
        skipped++; 
        continue; 
      }
      
      try {
        await PerformanceReview.create({
          employeeId: doc.employeeId,
          evaluatorId: a.evaluatorId,
          date: a.date || new Date().toISOString().split("T")[0], // Default date
          period: a.period,
          scores: [], // Cannot easily map legacy string fields to arbitrary scores without template
          overall: a.overall || a.rating || 0,
          feedback: a.feedback,
          notesPrevious: a.notesPrevious || "",
          getThebounes: a.getThebounes || false,
          daysBonus: a.daysBonus || 0,
          overtime: a.overtime || 0,
          deduction: a.deduction || 0,
          deductionType: "AMOUNT",  // legacy records: assume AMOUNT (EGP)
          bonusStatus: a.bonusStatus || "NONE",
          bonusApprovedBy: a.bonusApprovedBy,
          bonusApprovedAt: a.bonusApprovedAt,
          createdAt: a.createdAt,
        });
        migrated++;
      } catch (err) {
        console.error(`Error migrating assessment ${a._id}:`, err.message);
        errors++;
      }
    }
  }
  
  console.log(`Migration complete: ${migrated} migrated, ${skipped} skipped (duplicates/invalid), ${errors} errors`);
  await mongoose.disconnect();
}

migrate();
