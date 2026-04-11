import "dotenv/config";
import mongoose from "mongoose";
import { Department } from "../src/models/Department.js";
import { Team } from "../src/models/Team.js";
import { Employee } from "../src/models/Employee.js";
import { OrganizationPolicy } from "../src/models/OrganizationPolicy.js";

async function main() {
  const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/hrms";
  await mongoose.connect(mongoUri);

  const policy = await OrganizationPolicy.findOne({ name: "default" })
    .select("chiefExecutiveEmployeeId")
    .lean();
  const ceoId = policy?.chiefExecutiveEmployeeId
    ? String(policy.chiefExecutiveEmployeeId)
    : null;

  let violations = 0;

  const departments = await Department.find({})
    .select("_id name head")
    .lean();
  for (const dept of departments) {
    if (!dept.head) continue;
    const badTeams = await Team.countDocuments({
      departmentId: dept._id,
      $or: [{ leaderEmail: dept.head }, { members: dept.head }],
    });
    if (badTeams > 0) {
      violations += badTeams;
      console.error(
        `[VIOLATION] Department head appears in teams: department=${dept.name}, head=${dept.head}, count=${badTeams}`,
      );
    }
  }

  const managers = await Employee.find({ role: "MANAGER" })
    .select("_id fullName managerId")
    .lean();
  for (const mgr of managers) {
    const mgrManagerId = mgr.managerId ? String(mgr.managerId) : null;
    const expected = ceoId && ceoId !== String(mgr._id) ? ceoId : null;
    if (mgrManagerId !== expected) {
      violations += 1;
      console.error(
        `[VIOLATION] Manager reporting mismatch: employee=${mgr.fullName}, expectedManagerId=${expected}, actualManagerId=${mgrManagerId}`,
      );
    }
  }

  if (violations > 0) {
    console.error(`\nInvariant check failed with ${violations} violation(s).`);
    process.exitCode = 1;
  } else {
    console.log("All organization invariants passed.");
  }

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("Invariant smoke script failed:", err);
  process.exitCode = 1;
  try {
    await mongoose.disconnect();
  } catch {}
});

