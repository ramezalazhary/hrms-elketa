/**
 * Sets `useDefaultReporting: true` on Employee documents that predate the field.
 * Run: node backend/scripts/backfill-use-default-reporting.js
 */
import dotenv from "dotenv";
import { connectDb } from "../src/config/db.js";
import { Employee } from "../src/models/Employee.js";

dotenv.config();

async function main() {
  await connectDb();
  const res = await Employee.updateMany(
    { useDefaultReporting: { $exists: false } },
    { $set: { useDefaultReporting: true } },
  );
  console.log(
    `Updated ${res.modifiedCount} employees (matched ${res.matchedCount}).`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
