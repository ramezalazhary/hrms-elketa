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

  /* --- ISSUE B: date divergence (> 30 days) — yearly is authoritative --- */
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const candidates = await Employee.find({
    annualAnniversaryDate: { $exists: true, $ne: null },
    yearlySalaryIncreaseDate: { $exists: true, $ne: null },
  }).lean();

  for (const e of candidates) {
    const a = new Date(e.annualAnniversaryDate).getTime();
    const y = new Date(e.yearlySalaryIncreaseDate).getTime();
    if (Number.isNaN(a) || Number.isNaN(y)) continue;
    if (Math.abs(a - y) <= THIRTY_DAYS_MS) continue;

    const oldA = e.annualAnniversaryDate;
    const target = e.yearlySalaryIncreaseDate;
    const label = e.fullName || e.email || String(e._id);
    console.log(
      `[DRY RUN] Employee "${label}" (${e._id}) annualAnniversaryDate: ${oldA} → ${target}`,
    );
    employeeDateOps++;
    if (APPLY) {
      await Employee.updateOne(
        { _id: e._id },
        { $set: { annualAnniversaryDate: target } },
      );
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
