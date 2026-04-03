/**
 * One-off DB integrity repair (not part of the app).
 * Dry run by default; pass --apply to write.
 *
 * Usage (from backend/):
 *   node scripts/fix-db-integrity.js
 *   node scripts/fix-db-integrity.js --apply
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

import { Employee } from "../src/models/Employee.js";
import { Department } from "../src/models/Department.js";
import { Team } from "../src/models/Team.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env") });

const APPLY = process.argv.includes("--apply");
const uri = process.env.MONGO_URI || "mongodb://localhost:27017/hrms";

/** @param {import("mongoose").Document | null} emp */
function isValidLeaderEmail(email, emp) {
  if (!email || String(email).trim() === "") return false;
  if (!emp) return false;
  if (emp.isActive === false) return false;
  return true;
}

async function main() {
  await mongoose.connect(uri);
  console.log(
    APPLY ? "[MODE] APPLY — writing changes\n" : "[MODE] DRY RUN — no writes\n",
  );

  let deptOps = 0;
  let teamOps = 0;
  let employeeDateOps = 0;

  /* --- ISSUE A: inactive / missing leaders --- */
  const departments = await Department.find({}).lean();
  for (const d of departments) {
    const name = d.name || String(d._id);

    if (d.head) {
      const emp = await Employee.findOne({ email: d.head }).lean();
      if (!isValidLeaderEmail(d.head, emp)) {
        const reason = !emp ? "missing employee" : "isActive false";
        console.log(
          `[DRY RUN] Department "${name}" head: "${d.head}" → null (reason: ${reason})`,
        );
        deptOps++;
        if (APPLY) {
          await Department.updateOne({ _id: d._id }, { $set: { head: null } });
        }
      }
    }

    const teams = d.teams || [];
    for (const t of teams) {
      const le = t.leaderEmail;
      if (!le || String(le).trim() === "") continue;
      const emp = await Employee.findOne({ email: le }).lean();
      if (!isValidLeaderEmail(le, emp)) {
        const reason = !emp ? "missing employee" : "isActive false";
        console.log(
          `[DRY RUN] Department "${name}" teams[].leaderEmail: "${le}" → null (reason: ${reason})`,
        );
        deptOps++;
        if (APPLY) {
          await Department.updateMany(
            { _id: d._id, "teams.leaderEmail": le },
            { $set: { "teams.$[x].leaderEmail": null } },
            { arrayFilters: [{ "x.leaderEmail": le }] },
          );
        }
      }
    }
  }

  const standTeams = await Team.find({
    leaderEmail: { $exists: true, $nin: [null, ""] },
  }).lean();

  for (const t of standTeams) {
    const le = t.leaderEmail;
    const emp = await Employee.findOne({ email: le }).lean();
    if (!isValidLeaderEmail(le, emp)) {
      const reason = !emp ? "missing employee" : "isActive false";
      console.log(
        `[DRY RUN] Team "${t._id}" leaderEmail: "${le}" → null (reason: ${reason})`,
      );
      teamOps++;
      if (APPLY) {
        await Team.updateOne({ _id: t._id }, { $set: { leaderEmail: null } });
      }
    }
  }

  /* --- ISSUE B: legacy annual/yearly fields → nextReviewDate; transferHistory keys --- */
  function addOneYearFrom(d) {
    if (!d) return null;
    const x = new Date(d);
    if (Number.isNaN(x.getTime())) return null;
    x.setFullYear(x.getFullYear() + 1);
    return x;
  }

  const allEmps = await Employee.find({});

  for (const doc of allEmps) {
    const e = doc.toObject();
    const label = e.fullName || e.email || String(e._id);
    const $set = {};
    const $unset = {};

    let nextReview =
      e.nextReviewDate ||
      e.yearlySalaryIncreaseDate ||
      e.annualAnniversaryDate ||
      addOneYearFrom(e.dateOfHire);
    if (nextReview && !e.nextReviewDate) {
      $set.nextReviewDate = new Date(nextReview);
    }

    if (
      e.yearlySalaryIncreaseDate != null ||
      e.annualAnniversaryDate != null
    ) {
      $unset.yearlySalaryIncreaseDate = "";
      $unset.annualAnniversaryDate = "";
    }

    let th = [...(e.transferHistory || [])];
    let thDirty = false;
    th = th.map((r) => {
      const row =
        r && typeof r.toObject === "function" ? r.toObject() : { ...r };
      if (
        Object.prototype.hasOwnProperty.call(row, "yearlyIncreaseDateChanged") ||
        Object.prototype.hasOwnProperty.call(row, "newYearlyIncreaseDate")
      ) {
        row.nextReviewDateReset = !!row.yearlyIncreaseDateChanged;
        if (row.newYearlyIncreaseDate != null) {
          row.nextReviewDateAfterTransfer = row.newYearlyIncreaseDate;
        }
        delete row.yearlyIncreaseDateChanged;
        delete row.newYearlyIncreaseDate;
        thDirty = true;
      }
      return row;
    });
    if (thDirty) {
      $set.transferHistory = th;
    }

    const hasSet = Object.keys($set).length > 0;
    const hasUnset = Object.keys($unset).length > 0;
    if (!hasSet && !hasUnset) continue;

    console.log(
      `[DRY RUN] Employee "${label}" (${e._id}) — nextReviewDate / transferHistory migration`,
    );
    employeeDateOps++;
    if (APPLY) {
      /** @type {Record<string, unknown>} */
      const payload = {};
      if (hasSet) payload.$set = $set;
      if (hasUnset) payload.$unset = $unset;
      await Employee.updateOne({ _id: e._id }, payload);
    }
  }

  const total = deptOps + teamOps + employeeDateOps;
  console.log("\n--- Summary ---");
  console.log(`Department leadership fixes (head + nested slots): ${deptOps}`);
  console.log(`Teams (standalone collection) leaderEmail fixes: ${teamOps}`);
  console.log(`Employees (date divergence) fixes: ${employeeDateOps}`);
  console.log(`Total changes: ${total}`);
  if (!APPLY) console.log("Run with --apply to execute.");

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
