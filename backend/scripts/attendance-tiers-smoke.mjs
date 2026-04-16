/**
 * Smoke tests for second-resolution late tier matching (no test runner required).
 * Run: node scripts/attendance-tiers-smoke.mjs
 */
import assert from "node:assert/strict";
import {
  deductionForLateTiersSeconds,
  deductionForLateWithMonthlyGraceExhaustion,
  lateSecondsAfterShiftStart,
  tierIntervalsSecondsFromPolicy,
  validateLateDeductionTiersForSave,
} from "../src/utils/attendanceTimingCore.js";

function ok(name, fn) {
  try {
    fn();
    console.log(`OK  ${name}`);
  } catch (e) {
    console.error(`FAIL ${name}`, e.message);
    process.exitCode = 1;
  }
}

// Contiguous tiers (seconds): ~1m01s–30m, then 30m01s–2h (aligned with seed pattern)
const contiguousTiers = [
  { fromMinutes: 1, toMinutes: 30, deductionDays: 0.25 },
  { fromMinutes: 30, toMinutes: 120, deductionDays: 0.5 },
];

ok("validateLateDeductionTiersForSave accepts contiguous tiers", () => {
  const v = validateLateDeductionTiersForSave(contiguousTiers);
  assert.equal(v.ok, true);
});

ok("reject overlapping tiers in seconds", () => {
  const v = validateLateDeductionTiersForSave([
    { fromMinutes: 0, toMinutes: 15, deductionDays: 0.1 },
    { fromMinutes: 10, toMinutes: 30, deductionDays: 0.2 },
  ]);
  assert.equal(v.ok, false);
});

ok("reject gap between tiers (not exactly +1 second)", () => {
  const v = validateLateDeductionTiersForSave([
    { fromMinutes: 0, toMinutes: 10, deductionDays: 0.1 },
    { fromMinutes: 11, toMinutes: 30, deductionDays: 0.2 },
  ]);
  assert.equal(v.ok, false);
});

ok("lateSecondsAfterShiftStart 09:10:30 vs 09:00", () => {
  assert.equal(lateSecondsAfterShiftStart("09:10:30", "09:00:00"), 630);
});

ok("first tier starts at floor(1*60)+1 = 61 seconds", () => {
  const iv = tierIntervalsSecondsFromPolicy(contiguousTiers);
  assert.equal(iv[0].lo, 61);
  assert.equal(iv[0].hi, 30 * 60);
  assert.equal(iv[1].lo, 30 * 60 + 1);
});

ok("60s late not in first band; 61s is", () => {
  assert.equal(deductionForLateTiersSeconds(60, contiguousTiers), 0);
  assert.equal(deductionForLateTiersSeconds(61, contiguousTiers), 0.25);
});

ok("overflow uses last tier", () => {
  assert.equal(deductionForLateTiersSeconds(999999, contiguousTiers), 0.5);
});

ok("monthly exhaustion uses first tier inside grace window (seconds)", () => {
  const ded = deductionForLateWithMonthlyGraceExhaustion(
    "09:05:00",
    "09:00:00",
    contiguousTiers,
    10,
    0,
  );
  assert.equal(ded, 0.25);
});

if (process.exitCode) {
  console.error("\nattendance-tiers-smoke: failures above");
} else {
  console.log("\nattendance-tiers-smoke: all passed");
}
