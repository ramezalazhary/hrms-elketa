/**
 * Normalize legacy employee role values to canonical values.
 *
 * Dry run:
 *   node scripts/normalize-legacy-roles.mjs
 *
 * Apply:
 *   node scripts/normalize-legacy-roles.mjs --apply
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { connectDb } from "../src/config/db.js";
import { normalizeLegacyEmployeeRoles } from "../src/services/roleDataMigrationService.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env") });

const APPLY = process.argv.includes("--apply");

async function main() {
  await connectDb();
  const result = await normalizeLegacyEmployeeRoles({ apply: APPLY });

  console.log(APPLY ? "[MODE] APPLY" : "[MODE] DRY RUN");
  console.log(`Scanned employees: ${result.scanned}`);
  console.log(`Legacy role candidates: ${result.candidates}`);
  if (APPLY) console.log(`Updated rows: ${result.modifiedCount}`);

  if (result.updates.length) {
    console.log("\nPlanned/Applied updates:");
    for (const item of result.updates) {
      console.log(`- ${item.email} (${item.id}): ${item.from} -> ${item.to}`);
    }
  } else {
    console.log("\nNo role updates needed.");
  }

  if (result.unknown.length) {
    console.log("\nUnknown role values (manual review):");
    for (const item of result.unknown) {
      console.log(`- ${item.email} (${item.id}): ${item.role}`);
    }
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
