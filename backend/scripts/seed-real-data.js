/**
 * Standalone real-data seed script (not part of the app).
 * Dry run (default): prints the plan and simulated records only.
 * Apply: `node scripts/seed-real-data.js --apply` — wipes listed collections then seeds.
 *
 * Run from backend/: node scripts/seed-real-data.js
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { connectDb } from "../src/config/db.js";
import { hashPassword } from "../src/middleware/auth.js";
import { Employee } from "../src/models/Employee.js";
import { Department } from "../src/models/Department.js";
import { Team } from "../src/models/Team.js";
import { Position } from "../src/models/Position.js";
import { OrganizationPolicy } from "../src/models/OrganizationPolicy.js";
import { Attendance } from "../src/models/Attendance.js";
import { UserPermission } from "../src/models/Permission.js";
import { Alert } from "../src/models/Alert.js";
import { AuditLog } from "../src/models/AuditLog.js";
import { ManagementRequest } from "../src/models/ManagementRequest.js";
import { OnboardingRequest } from "../src/models/OnboardingRequest.js";
import { OnboardingSubmission } from "../src/models/OnboardingSubmission.js";
import { PasswordResetRequest } from "../src/models/PasswordResetRequest.js";
import { TokenBlacklist } from "../src/models/TokenBlacklist.js";
import { PayrollRecord } from "../src/models/PayrollRecord.js";
import { PayrollRun } from "../src/models/PayrollRun.js";
import { EmployeeAdvance } from "../src/models/EmployeeAdvance.js";
import { Assessment } from "../src/models/Assessment.js";
import { LeaveRequest } from "../src/models/LeaveRequest.js";
import { buildPolicySnapshot } from "../src/services/leavePolicyService.js";
import { computePayrollRun } from "../src/services/payrollComputationService.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env") });

const APPLY = process.argv.includes("--apply");

const WIPE_MODELS = [
  ["PayrollRecord", PayrollRecord],
  ["PayrollRun", PayrollRun],
  ["EmployeeAdvance", EmployeeAdvance],
  ["Assessment", Assessment],
  ["LeaveRequest", LeaveRequest],
  ["Employee", Employee],
  ["Department", Department],
  ["Team", Team],
  ["Position", Position],
  ["OrganizationPolicy", OrganizationPolicy],
  ["Attendance", Attendance],
  ["UserPermission", UserPermission],
  ["Alert", Alert],
  ["AuditLog", AuditLog],
  ["ManagementRequest", ManagementRequest],
  ["OnboardingRequest", OnboardingRequest],
  ["OnboardingSubmission", OnboardingSubmission],
  ["PasswordResetRequest", PasswordResetRequest],
  ["TokenBlacklist", TokenBlacklist],
];

// --- Attendance status helper (mirrors backend/src/routes/attendance.js) ---
function parseTime(timeStr) {
  if (timeStr === undefined || timeStr === null || timeStr === "") return null;
  if (timeStr instanceof Date) {
    return {
      h: timeStr.getHours(),
      m: timeStr.getMinutes(),
      s: timeStr.getSeconds(),
    };
  }
  const str = timeStr.toString().trim().toUpperCase();
  const match = str.match(/(\d+):(\d+)(?::(\d+))?\s*(AM|PM)?/i);
  if (!match) return null;
  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const s = match[3] ? parseInt(match[3], 10) : 0;
  const ampm = match[4];
  if (ampm === "PM" && h < 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  return { h, m, s };
}

function calculateStatus(
  checkIn,
  checkOut,
  policy = { standardStartTime: "09:00", gracePeriod: 15 },
) {
  const t1 = parseTime(checkIn);
  const t2 = parseTime(checkOut);
  const shiftStart = parseTime(policy.standardStartTime || "09:00");
  const graceMinutes = policy.gracePeriod ?? 15;

  const totalHours =
    t1 && t2
      ? parseFloat(
          (
            t2.h +
            t2.m / 60 +
            t2.s / 3600 -
            (t1.h + t1.m / 60 + t1.s / 3600)
          ).toFixed(2),
        )
      : 0;

  let status = "PRESENT";
  if (t1 && shiftStart) {
    const checkInMinutes = t1.h * 60 + t1.m;
    const limitMinutes = shiftStart.h * 60 + shiftStart.m + graceMinutes;
    if (checkInMinutes > limitMinutes) {
      status = "LATE";
    }
  }

  return { totalHours, status };
}

function pad2(n) {
  return n.toString().padStart(2, "0");
}

function pad3(n) {
  return n.toString().padStart(3, "0");
}

/** Add hours to HH:mm string → HH:mm (wraps same calendar day for seed). */
function addHoursHHmm(hhmm, hoursToAdd) {
  const t = parseTime(hhmm);
  if (!t) return hhmm;
  let mins = t.h * 60 + t.m + Math.round(hoursToAdd * 60);
  mins = ((mins % 1440) + 1440) % 1440;
  return `${pad2(Math.floor(mins / 60))}:${pad2(mins % 60)}`;
}

function randInt(a, b) {
  return Math.floor(a + Math.random() * (b - a + 1));
}

function randomHireDate() {
  const now = Date.now();
  const max = now - Math.round(6 * 30.4 * 24 * 60 * 60 * 1000);
  const min = now - Math.round(3 * 365.25 * 24 * 60 * 60 * 1000);
  return new Date(min + Math.random() * (max - min));
}

function addYears(d, n) {
  const x = new Date(d);
  x.setFullYear(x.getFullYear() + n);
  return x;
}

function addMonths(d, n) {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** UTC midnight for the same calendar date (avoids local-TZ → UTC shift that breaks attendance analysis). */
function startOfDayUTC(d) {
  const x = new Date(d);
  return new Date(Date.UTC(x.getFullYear(), x.getMonth(), x.getDate()));
}

function isWeekend(date) {
  const wd = date.getUTCDay();
  return wd === 5 || wd === 6;
}

/** Last 30 UTC calendar days (today inclusive). */
function last30Days() {
  const out = [];
  const today = startOfDayUTC(new Date());
  for (let i = 0; i < 30; i++) {
    out.push(new Date(today.getTime() - i * 86400000));
  }
  return out;
}

/** All weekdays in the current calendar month (UTC midnight). */
function weekdaysInCurrentMonth() {
  const out = [];
  const now = new Date();
  const y = now.getFullYear();
  const mo = now.getMonth();
  const lastDom = new Date(y, mo + 1, 0).getDate();
  for (let dom = 1; dom <= lastDom; dom += 1) {
    const d = new Date(Date.UTC(y, mo, dom));
    if (!isWeekend(d)) out.push(d);
  }
  return out;
}

/** Union of last 30 days + current-month weekdays (deduped, sorted). */
function datesForAttendanceSeed() {
  const byTime = new Map();
  for (const d of [...last30Days(), ...weekdaysInCurrentMonth()]) {
    byTime.set(d.getTime(), d);
  }
  return Array.from(byTime.values()).sort((a, b) => a - b);
}

const FIRST_NAMES = [
  "Youssef",
  "Omar",
  "Karim",
  "Amr",
  "Mahmoud",
  "Hassan",
  "Ali",
  "Khaled",
  "Ahmed",
  "Mohamed",
  "Nour",
  "Laila",
  "Salma",
  "Mariam",
  "Farida",
  "Yasmin",
  "Dina",
  "Hana",
  "Reem",
  "Nada",
];

const LAST_NAMES = [
  "El-Masry",
  "Hassan",
  "Ibrahim",
  "Farouk",
  "Soliman",
  "Naguib",
  "Youssef",
  "Abdelrahman",
  "Mansour",
  "Salem",
  "El-Sayed",
  "Mahmoud",
  "Fouad",
  "Gabr",
  "Khalil",
  "Othman",
  "Rizk",
  "Shawky",
  "Tawfik",
  "Zaki",
];

function buildEmail(first, last, used) {
  const base = `${first}.${last}`
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z.]/g, "");
  let e = `${base}@company.com`;
  let i = 0;
  while (used.has(e)) {
    i += 1;
    e = `${base}${i}@company.com`;
  }
  used.add(e);
  return e;
}

const DEPT_SPECS = [
  {
    name: "Engineering",
    code: "ENG",
    standardStartTime: "09:00",
    gracePeriod: 15,
    count: 8,
    teamName: "Dev Team",
    salaries: [15000, 35000],
    positionsNonMgr: ["Software Engineer", "Senior Engineer"],
    mgrPosition: "Tech Lead",
  },
  {
    name: "Sales",
    code: "SAL",
    standardStartTime: "09:00",
    gracePeriod: 15,
    count: 7,
    teamName: "Sales Team",
    salaries: [10000, 25000],
    positionsNonMgr: ["Sales Rep"],
    mgrPosition: "Sales Manager",
  },
  {
    name: "HR",
    code: "HR",
    standardStartTime: "08:30",
    gracePeriod: 10,
    count: 5,
    teamName: "HR Team",
    salaries: [8000, 18000],
    positionsNonMgr: ["HR Specialist"],
    mgrPosition: "HR Manager",
  },
  {
    name: "Finance",
    code: "FIN",
    standardStartTime: "08:30",
    gracePeriod: 10,
    count: 5,
    teamName: "Finance Team",
    salaries: [10000, 22000],
    positionsNonMgr: ["Accountant"],
    mgrPosition: "Finance Manager",
  },
  {
    name: "Operations",
    code: "OPS",
    standardStartTime: "08:00",
    gracePeriod: 5,
    count: 5,
    teamName: "Ops Team",
    salaries: [7000, 15000],
    positionsNonMgr: ["Operations Coordinator"],
    mgrPosition: "Operations Coordinator",
  },
];

async function wipeCollections() {
  let totalDeleted = 0;
  for (const [label, Model] of WIPE_MODELS) {
    try {
      const n = await Model.countDocuments({});
      console.log(`  [WIPE] ${label}: ${n} document(s) — deleting…`);
      await Model.deleteMany({});
      totalDeleted += n;
    } catch (err) {
      console.error(`  [WIPE ERROR] ${label}:`, err.message);
    }
  }
  return totalDeleted;
}

async function main() {
  console.log(
    APPLY
      ? "\n[MODE] APPLY — database will be wiped then seeded.\n"
      : "\n[MODE] DRY RUN — no writes; showing plan only.\n",
  );

  await connectDb();

  let totalWiped = 0;
  if (APPLY) {
    totalWiped = await wipeCollections();
  } else {
    console.log("[DRY RUN] Skipping wipe (use --apply to delete & seed).\n");
    for (const [label, Model] of WIPE_MODELS) {
      try {
        const n = await Model.countDocuments({});
        console.log(`  [CURRENT] ${label}: ${n} document(s)`);
      } catch (err) {
        console.error(`  [COUNT ERROR] ${label}:`, err.message);
      }
    }
    console.log("");
  }

  const usedEmails = new Set();
  const adminPwPlain = "admin123";
  const empPwPlain = "emp123";

  let adminHash = "[dry-run: would bcrypt hash admin123]";
  let empHash = "[dry-run: would bcrypt hash emp123]";
  if (APPLY) {
    try {
      adminHash = await hashPassword(adminPwPlain);
      empHash = await hashPassword(empPwPlain);
    } catch (e) {
      console.error("[ERROR] Password hashing failed:", e.message);
    }
  }

  const twoYearsAgo = addYears(new Date(), -2);
  const oneMonthAgo = addMonths(new Date(), -1);
  const twoMonthsAgo = addMonths(new Date(), -2);
  const threeMonthsAgo = addMonths(new Date(), -3);
  const idExpiryPast = addMonths(new Date(), -1);
  const idExpirySoon = addDays(new Date(), 14);

  const superAdminPlan = {
    fullName: "Super Admin",
    email: "admin@hr.local",
    passwordHash: adminHash,
    role: "ADMIN",
    isActive: true,
    status: "ACTIVE",
    employeeCode: "ADM-001",
    position: "Administrator",
    department: "Head Office",
    departmentId: null,
    dateOfHire: twoYearsAgo,
    nextReviewDate: addYears(twoYearsAgo, 1),
    nationality: "Egyptian",
    financial: { baseSalary: 50000, currency: "EGP" },
  };

  const policyPlan = {
    name: "default",
    salaryIncreaseRules: [
      { type: "DEFAULT", percentage: 10 },
      { type: "DEPARTMENT", target: "Engineering", percentage: 15 },
      { type: "DEPARTMENT", target: "Sales", percentage: 12 },
      { type: "DEPARTMENT", target: "HR", percentage: 10 },
      { type: "DEPARTMENT", target: "Finance", percentage: 10 },
      { type: "DEPARTMENT", target: "Operations", percentage: 10 },
    ],
    workLocations: [
      { governorate: "Cairo", city: "Cairo", branches: ["Cairo HQ"] },
      { governorate: "Alexandria", city: "Alexandria", branches: ["Alexandria Branch"] },
      { governorate: "Remote", city: "Remote", branches: ["Remote"] },
    ],
    documentRequirements: [
      { name: "National ID", isMandatory: true },
      { name: "Contract", isMandatory: true },
      { name: "Tax Card", isMandatory: true },
      { name: "Social Insurance Form", isMandatory: true },
    ],
    companyTimezone: "Africa/Cairo",
    companyMonthStartDay: 1,
    leavePolicies: [
      {
        version: 1,
        vacationRules: {
          annualDays: 21,
          accrualModel: "YEARLY",
          maxConsecutiveDays: 365,
          minDaysAfterHire: 0,
        },
        excuseRules: {
          maxHoursPerExcuse: 8,
          maxMinutesPerMonth: 40 * 60,
          maxExcusesPerPeriod: 0,
        },
      },
    ],
    assessmentPayrollRules: {
      bonusDaysEnabled: true,
      bonusDayMultiplier: 1,
      overtimeEnabled: true,
      overtimeDayMultiplier: 1.5,
      deductionEnabled: true,
      deductionDayMultiplier: 1,
    },
    payrollConfig: {
      workingDaysPerMonth: 22,
      hoursPerDay: 8,
      overtimeMultiplier: 1.5,
      personalExemptionAnnual: 20000,
      martyrsFundRate: 0.0005,
    },
    attendanceRules: {
      standardStartTime: "09:00",
      standardEndTime: "17:00",
      gracePeriodMinutes: 15,
      workingDaysPerMonth: 22,
      lateDeductionTiers: [
        { fromMinutes: 1, toMinutes: 30, deductionDays: 0.25 },
        { fromMinutes: 30, toMinutes: 120, deductionDays: 0.5 },
        { fromMinutes: 120, toMinutes: 10000, deductionDays: 1 },
      ],
      absenceDeductionDays: 1,
      earlyDepartureDeductionDays: 0,
      incompleteRecordDeductionDays: 0,
    },
  };

  console.log("── Super Admin (planned) ──");
  console.log(JSON.stringify({ ...superAdminPlan, passwordHash: "[redacted]" }, null, 2));
  console.log("── OrganizationPolicy (planned) ──");
  console.log(JSON.stringify(policyPlan, null, 2));

  /** @type {Record<string, any>} */
  const caseTags = {};

  /** Build 30 employee plans + dept structure */
  const departmentPlans = DEPT_SPECS.map((d) => ({
    name: d.name,
    code: d.code,
    standardStartTime: d.standardStartTime,
    gracePeriod: d.gracePeriod,
    status: "ACTIVE",
    teamName: d.teamName,
    employees: [],
  }));

  let globalIdx = 0;
  for (let di = 0; di < DEPT_SPECS.length; di++) {
    const spec = DEPT_SPECS[di];
    const dplan = departmentPlans[di];
    for (let i = 0; i < spec.count; i++) {
      globalIdx += 1;
      const first = FIRST_NAMES[(globalIdx + di + i) % FIRST_NAMES.length];
      const last = LAST_NAMES[(globalIdx * 3 + i) % LAST_NAMES.length];
      const email = buildEmail(first, last, usedEmails);
      const code = `${spec.code}-${pad3(i + 1)}`;
      const hire = randomHireDate();
      const isMgr = i === 0;
      const isTerminated = spec.name === "Operations" && i === spec.count - 1;

      let position = isMgr ? spec.mgrPosition : spec.positionsNonMgr[i % spec.positionsNonMgr.length];
      if (spec.name === "Engineering" && !isMgr) {
        position =
          i % 2 === 1 ? "Senior Engineer" : "Software Engineer";
      }

      const salary = randInt(spec.salaries[0], spec.salaries[1]);

      /** @type {Record<string, any>} */
      const emp = {
        _tag: `${spec.name}[${i}]`,
        fullName: `${first} ${last}`,
        email,
        passwordHash: empHash,
        role: isMgr ? "MANAGER" : "EMPLOYEE",
        isActive: !isTerminated,
        status: isTerminated ? "TERMINATED" : "ACTIVE",
        employeeCode: code,
        position,
        department: spec.name,
        dateOfHire: hire,
        nextReviewDate: addYears(hire, 1),
        nationality: "Egyptian",
        idNumber: `${randInt(10000000000000, 29999999999999)}`,
        phoneNumber: `01${randInt(100000000, 199999999)}`,
        governorate: "Cairo",
        financial: { baseSalary: salary, currency: "EGP" },
        transferHistory: [],
      };

      if (isTerminated) {
        emp.terminationDate = twoMonthsAgo;
        emp.terminationReason = "End of probation — seeded test user";
        caseTags.D = { name: emp.fullName, email: emp.email };
      }

      if (spec.name === "Engineering" && i === 2) {
        emp.nextReviewDate = new Date(threeMonthsAgo);
        caseTags.A = { name: emp.fullName, email: emp.email };
      }

      if (spec.name === "Finance" && i === 2) {
        emp.nationalIdExpiryDate = new Date(idExpiryPast);
        caseTags.B = { name: emp.fullName, email: emp.email };
      }

      if (spec.name === "HR" && i === 2) {
        emp.nationalIdExpiryDate = new Date(idExpirySoon);
        caseTags.E = { name: emp.fullName, email: emp.email };
      }

      dplan.employees.push(emp);
    }
  }

  const salesDeptSpec = departmentPlans.find((x) => x.name === "Sales");
  if (salesDeptSpec) {
    const salesEmp = salesDeptSpec.employees[2];
    if (salesEmp) {
      const nextY = new Date(oneMonthAgo);
      nextY.setFullYear(nextY.getFullYear() + 1);
      salesEmp.transferHistory = [
        {
          fromDepartmentName: "HR",
          toDepartmentName: "Sales",
          transferDate: new Date(oneMonthAgo),
          newPosition: salesEmp.position,
          newSalary: salesEmp.financial.baseSalary,
          nextReviewDateReset: true,
          nextReviewDateAfterTransfer: nextY,
          notes: "Seeded transfer (CASE C)",
          processedBy: "admin@company.com",
        },
      ];
      salesEmp.nextReviewDate = nextY;
      caseTags.C = { name: salesEmp.fullName, email: salesEmp.email };
    }
  }

  console.log("── Departments & employee roster (planned) ──");
  for (const d of departmentPlans) {
    console.log(`\n${d.name} (${d.code}) — ${d.employees.length} employees`);
    for (const e of d.employees) {
      console.log(
        `  • ${e.fullName} <${e.email}> ${e.employeeCode} ${e.role} ${e.status} ${e.position}`,
      );
    }
  }

  if (!APPLY) {
    console.log("\n── Attendance (sample logic) ──");
    console.log(
      "  For each ACTIVE employee, last 30 days ∪ current-month weekdays (deduped), skip Fri/Sat: ~80% PRESENT, ~10% LATE, ~10% ABSENT (no row).",
    );
    console.log("  checkOut = checkIn + 8h; status from dept standardStartTime + gracePeriod.\n");

    console.log("── Alerts (planned) ──");
    console.log("  1. SALARY_INCREASE — CASE A");
    console.log("  2. ID_EXPIRY — CASE B");
    console.log("  3. ID_EXPIRY — CASE E\n");

    console.log("── UserPermission (planned) ──");
    console.log("  Super Admin: module * / actions [*] / ALL");
    console.log("  Each MANAGER: employees, attendance, reports (per spec)\n");

    console.log("── Extended seed (with --apply) ──");
    console.log("  OrganizationPolicy: leavePolicies, payrollConfig, attendanceRules, assessmentPayrollRules");
    console.log("  Roles: HR_MANAGER + HR_STAFF (HR dept); TEAM_LEADER (Engineering #2)");
    console.log("  Financial: mixed INSURED / NOT_INSURED, allowances, bank accounts, some CASH");
    console.log("  LeaveRequest: 2 vacation + 1 excuse (mixed APPROVED / PENDING)");
    console.log("  Assessment: up to 10 employees, current month (bonus APPROVED / PENDING_HR)");
    console.log("  EmployeeAdvance: 2 ACTIVE rows");
    console.log("  PayrollRun: current calendar month → computePayrollRun (COMPUTED + PayrollRecords)\n");

    console.log("══════════════════════════════════════════════════");
    console.log("Final summary (dry run — no writes)");
    console.log(`  Collections wiped:     ${totalWiped} (no wipe in dry run)`);
    console.log("  Super Admin:           admin@company.com / Admin@123456");
    console.log("  Departments:           5 | Positions: 10 | Teams: 5 | Employees: 30");
    console.log("  Attendance:            ~(active emps × weekdays × ~0.9)");
    console.log("  Alerts:                3 | Permissions: 16");
    console.log("\n  Test cases (planned):");
    for (const key of ["A", "B", "C", "D", "E"]) {
      const c = caseTags[key];
      console.log(
        `    CASE ${key}: ${c ? `${c.name} <${c.email}>` : "(unset)"}`,
      );
    }
    console.log("\n  Credentials (same after --apply):");
    console.log("    Super Admin: admin@company.com / Admin@123456");
    console.log("    Employees:   passwords Employee@123456 (see roster emails)");
    await mongoose.disconnect();
    return;
  }

  // ========== APPLY: writes ==========
  let departments = [];
  let teams = [];
  let positions = [];
  let superAdminDoc = null;
  let employees = [];
  let attendanceCreated = 0;
  let alertsCreated = 0;
  let permissionsCreated = 0;
  let leaveCreated = 0;
  let assessmentCreated = 0;
  let advancesCreated = 0;
  let payrollSeedNote = "—";

  try {
    superAdminDoc = await Employee.create(superAdminPlan);
  } catch (e) {
    console.error("[ERROR] Super Admin create:", e.message);
  }

  try {
    await OrganizationPolicy.create(policyPlan);
  } catch (e) {
    console.error("[ERROR] OrganizationPolicy create:", e.message);
  }

  try {
    if (superAdminDoc) {
      await OrganizationPolicy.updateOne(
        { name: "default" },
        { $set: { chiefExecutiveEmployeeId: superAdminDoc._id } },
      );
    }
  } catch (e) {
    console.error("[ERROR] OrganizationPolicy chiefExecutive patch:", e.message);
  }

  try {
    for (const d of departmentPlans) {
      const dep = await Department.create({
        name: d.name,
        code: d.code,
        standardStartTime: d.standardStartTime,
        gracePeriod: d.gracePeriod,
        status: "ACTIVE",
        teams: [
          {
            name: d.teamName,
            leaderEmail: "",
            leaderTitle: "Team Leader",
            members: [],
            status: "ACTIVE",
          },
        ],
      });
      departments.push(dep);
    }
  } catch (e) {
    console.error("[ERROR] Departments create:", e.message);
  }

  const deptByName = Object.fromEntries(departments.map((x) => [x.name, x]));

  const positionTitles = [
    { dept: "Engineering", titles: ["Software Engineer", "Senior Engineer", "Tech Lead"] },
    { dept: "Sales", titles: ["Sales Rep", "Sales Manager"] },
    { dept: "HR", titles: ["HR Specialist", "HR Manager"] },
    { dept: "Finance", titles: ["Accountant", "Finance Manager"] },
    { dept: "Operations", titles: ["Operations Coordinator"] },
  ];

  try {
    for (const block of positionTitles) {
      const dep = deptByName[block.dept];
      if (!dep) continue;
      for (const title of block.titles) {
        const p = await Position.create({
          title,
          departmentId: dep._id,
          status: "ACTIVE",
        });
        positions.push(p);
      }
    }
  } catch (e) {
    console.error("[ERROR] Positions create:", e.message);
  }

  try {
    for (const dep of departments) {
      const dplan = departmentPlans.find((x) => x.name === dep.name);
      const t = await Team.create({
        name: dplan.teamName,
        departmentId: dep._id,
        members: [],
        leaderEmail: null,
        status: "ACTIVE",
      });
      teams.push(t);
    }
  } catch (e) {
    console.error("[ERROR] Teams create:", e.message);
  }

  const teamByDeptId = Object.fromEntries(
    teams.map((t) => [t.departmentId.toString(), t]),
  );

  const posIdByKey = {};
  for (const p of positions) {
    const dep = departments.find((d) => d._id.equals(p.departmentId));
    if (dep) {
      posIdByKey[`${dep.name}|${p.title}`] = p._id;
    }
  }

  try {
    for (const d of departmentPlans) {
      const dep = deptByName[d.name];
      const team = teamByDeptId[dep._id.toString()];
      const hrDep = deptByName["HR"];
      const salesDep = deptByName["Sales"];

      for (const empPlan of d.employees) {
        const payload = { ...empPlan };
        delete payload._tag;
        payload.passwordHash = empHash;
        payload.departmentId = dep._id;
        payload.team = d.teamName;
        payload.teamId = team._id;
        const pId = posIdByKey[`${d.name}|${empPlan.position}`];
        if (pId) payload.positionId = pId;

        if (
          empPlan.transferHistory &&
          empPlan.transferHistory.length &&
          hrDep &&
          salesDep
        ) {
          payload.transferHistory = empPlan.transferHistory.map((th) => ({
            ...th,
            fromDepartment: hrDep._id,
            toDepartment: salesDep._id,
          }));
        }

        const doc = await Employee.create(payload);
        employees.push(doc);
      }
    }
  } catch (e) {
    console.error("[ERROR] Employees create:", e.message);
  }

  try {
    for (const dep of departments) {
      const inDept = await Employee.find({ departmentId: dep._id }).sort({
        employeeCode: 1,
      });
      const manager = inDept.find((e) => e.role === "MANAGER" && e.isActive);
      if (!manager) continue;

      const activeMembers = inDept.filter((e) => e.isActive !== false && e.status !== "TERMINATED");
      const memberEmails = [
        manager.email,
        ...activeMembers.filter((e) => e._id.toString() !== manager._id.toString()).map((e) => e.email),
      ];

      dep.head = manager.email;
      dep.headId = manager._id;
      const t0 = dep.teams[0];
      if (t0) {
        t0.leaderEmail = manager.email;
        t0.members = memberEmails;
      }
      await dep.save();

      const standalone = teams.find((t) => t.departmentId.equals(dep._id));
      if (standalone) {
        standalone.leaderEmail = manager.email;
        standalone.members = memberEmails;
        await standalone.save();
      }

      for (const e of inDept) {
        if (e.role !== "MANAGER") {
          e.managerId = manager._id;
          e.teamLeaderId = manager._id;
          await e.save();
        }
      }
    }
  } catch (e) {
    console.error("[ERROR] Department heads / teams update:", e.message);
  }

  try {
    const hrDep = deptByName["HR"];
    if (hrDep) {
      const hrSorted = await Employee.find({ departmentId: hrDep._id }).sort({
        employeeCode: 1,
      });
      if (hrSorted[0]) {
        await Employee.updateOne(
          { _id: hrSorted[0]._id },
          { $set: { role: "HR_MANAGER" } },
        );
        const m0 = employees.find((x) => x._id.equals(hrSorted[0]._id));
        if (m0) m0.role = "HR_MANAGER";
      }
      if (hrSorted[1]) {
        await Employee.updateOne(
          { _id: hrSorted[1]._id },
          { $set: { role: "HR_STAFF" } },
        );
        const m1 = employees.find((x) => x._id.equals(hrSorted[1]._id));
        if (m1) m1.role = "HR_STAFF";
      }
    }

    const engDep = deptByName["Engineering"];
    if (engDep) {
      const engSorted = await Employee.find({ departmentId: engDep._id }).sort({
        employeeCode: 1,
      });
      const mgr = engSorted.find((e) => e.role === "MANAGER");
      const tl = engSorted[1];
      if (mgr && tl && !tl._id.equals(mgr._id)) {
        await Employee.updateOne(
          { _id: tl._id },
          { $set: { role: "TEAM_LEADER" } },
        );
        const memTl = employees.find((x) => x._id.equals(tl._id));
        if (memTl) memTl.role = "TEAM_LEADER";
        for (const e of engSorted) {
          if (e._id.equals(mgr._id) || e._id.equals(tl._id)) continue;
          await Employee.updateOne(
            { _id: e._id },
            { $set: { teamLeaderId: tl._id } },
          );
          const mem = employees.find((x) => x._id.equals(e._id));
          if (mem) mem.teamLeaderId = tl._id;
        }
      }
    }
  } catch (e) {
    console.error("[ERROR] HR / Engineering role patch:", e.message);
  }

  try {
    const staff = await Employee.find({
      email: { $ne: "admin@company.com" },
      status: "ACTIVE",
      isActive: true,
    });
    let fi = 0;
    for (const e of staff) {
      fi += 1;
      const base = Number(e.financial?.baseSalary) || 0;
      const fin =
        e.financial && typeof e.financial.toObject === "function"
          ? e.financial.toObject()
          : { ...(e.financial || {}) };
      fin.currency = fin.currency || "EGP";
      if (fi % 2 === 0) {
        fin.allowances = randInt(500, 2500);
        fin.fixedBonus =
          fi % 4 === 0 ? randInt(200, 1200) : Number(fin.fixedBonus) || 0;
        fin.fixedDeduction =
          fi % 5 === 0 ? randInt(50, 400) : Number(fin.fixedDeduction) || 0;
        fin.paymentMethod = fi % 7 === 0 ? "CASH" : "BANK_TRANSFER";
        if (fin.paymentMethod === "BANK_TRANSFER") {
          fin.bankAccount =
            fin.bankAccount ||
            `EG${randInt(1000000000000000, 9999999999999999)}`;
        }
        const subW = Math.min(Math.max(base, 2700), 16700);
        e.financial = fin;
        e.socialInsurance = {
          status: "INSURED",
          subscriptionWage: subW,
          basicWage: Math.min(subW, 10000),
          insuranceNumber: String(randInt(1000000000, 9999999999)),
          insuranceDate: addMonths(new Date(), -14),
        };
      } else {
        fin.paymentMethod = fin.paymentMethod || "BANK_TRANSFER";
        if (fin.paymentMethod === "BANK_TRANSFER" && !fin.bankAccount) {
          fin.bankAccount = `EG${randInt(1000000000000000, 9999999999999999)}`;
        }
        e.financial = fin;
        e.socialInsurance = e.socialInsurance || {};
        if (!e.socialInsurance.status) {
          e.socialInsurance.status = "NOT_INSURED";
        }
      }
      await e.save();
    }
  } catch (e) {
    console.error("[ERROR] Financial / insurance seed:", e.message);
  }

  const mgrs = employees.filter((e) => e.role === "MANAGER" && e.isActive);

  try {
    if (superAdminDoc) {
      await UserPermission.create({
        userId: superAdminDoc._id.toString(),
        module: "*",
        actions: ["*"],
        scope: "ALL",
      });
      permissionsCreated += 1;
    }
  } catch (e) {
    console.error("[ERROR] Super Admin permissions:", e.message);
  }

  try {
    for (const m of mgrs) {
      const uid = m._id.toString();
      const rows = [
        {
          userId: uid,
          module: "employees",
          actions: ["read", "update"],
          scope: "DEPARTMENT",
        },
        {
          userId: uid,
          module: "attendance",
          actions: ["read", "create", "update"],
          scope: "DEPARTMENT",
        },
        {
          userId: uid,
          module: "reports",
          actions: ["read"],
          scope: "DEPARTMENT",
        },
      ];
      for (const r of rows) {
        await UserPermission.create(r);
        permissionsCreated += 1;
      }
    }
  } catch (e) {
    console.error("[ERROR] Manager permissions:", e.message);
  }

  const resolveCaseEmp = (tag) => {
    const c = caseTags[tag];
    if (!c) return null;
    return (
      employees.find((e) => e.email === c.email) ||
      (superAdminDoc && superAdminDoc.email === c.email ? superAdminDoc : null)
    );
  };

  try {
    const empA = resolveCaseEmp("A");
    const empB = resolveCaseEmp("B");
    const empE = resolveCaseEmp("E");
    const alertDocs = [];
    if (empA) {
      alertDocs.push({
        type: "SALARY_INCREASE",
        employeeId: empA._id,
        message: `Salary increase overdue for ${empA.fullName}.`,
        severity: "high",
        resolved: false,
      });
    }
    if (empB) {
      alertDocs.push({
        type: "ID_EXPIRY",
        employeeId: empB._id,
        message: `National ID expired for ${empB.fullName}.`,
        severity: "critical",
        resolved: false,
      });
    }
    if (empE) {
      alertDocs.push({
        type: "ID_EXPIRY",
        employeeId: empE._id,
        message: `National ID expiring soon for ${empE.fullName}.`,
        severity: "medium",
        resolved: false,
      });
    }
    if (alertDocs.length) {
      await Alert.insertMany(alertDocs);
      alertsCreated = alertDocs.length;
    }
  } catch (e) {
    console.error("[ERROR] Alerts create:", e.message);
  }

  // Department model does not persist standardStartTime / gracePeriod; use planned specs.
  const deptPolicyByName = Object.fromEntries(
    departmentPlans.map((d) => [
      d.name,
      { standardStartTime: d.standardStartTime, gracePeriod: d.gracePeriod },
    ]),
  );

  try {
    const days = datesForAttendanceSeed();
    const activeStaff = await Employee.find({
      isActive: true,
      status: "ACTIVE",
    });

    for (const emp of activeStaff) {
      const pol =
        deptPolicyByName[emp.department] || {
          standardStartTime: "09:00",
          gracePeriod: 15,
        };
      const shift = parseTime(pol.standardStartTime);
      if (!shift) continue;
      const shiftStartMin = shift.h * 60 + shift.m;
      const limitMin = shiftStartMin + (pol.gracePeriod ?? 15);

      for (const day of days) {
        if (isWeekend(day)) continue;
        const r = Math.random();
        if (r >= 0.9) continue;

        let checkInMin;
        if (r < 0.8) {
          const span = Math.max(0, limitMin - shiftStartMin);
          checkInMin =
            shiftStartMin + (span === 0 ? 0 : randInt(0, span));
        } else {
          checkInMin = limitMin + randInt(20, 45);
        }

        const checkInH = Math.floor(checkInMin / 60) % 24;
        const checkInM = checkInMin % 60;
        const checkIn = `${pad2(checkInH)}:${pad2(checkInM)}`;
        const checkOut = addHoursHHmm(checkIn, 8);
        const calc = calculateStatus(checkIn, checkOut, pol);

        try {
          await Attendance.create({
            employeeId: emp._id,
            employeeCode: emp.employeeCode,
            date: day,
            checkIn,
            checkOut,
            status: calc.status,
            totalHours: calc.totalHours,
            remarks: "Seeded",
          });
          attendanceCreated += 1;
        } catch (err) {
          if (err?.code !== 11000) {
            console.error(
              `[ERROR] Attendance ${emp.employeeCode} ${day.toISOString()}:`,
              err.message,
            );
          }
        }
      }
    }
  } catch (e) {
    console.error("[ERROR] Attendance seed:", e.message);
  }

  const seedYear = new Date().getFullYear();
  const seedMonth = new Date().getMonth() + 1;

  try {
    const policyDoc = await OrganizationPolicy.findOne({ name: "default" });
    if (!policyDoc) throw new Error("default policy missing");

    const activeForSeed = await Employee.find({
      isActive: true,
      status: "ACTIVE",
      email: { $ne: "admin@company.com" },
    }).sort({ employeeCode: 1 });

    const [e1, e2, e3, e4, e5] = activeForSeed;
    if (e1) {
      const vs = addDays(new Date(), -50);
      const ve = addDays(vs, 2);
      await LeaveRequest.create({
        employeeId: e1._id,
        employeeEmail: e1.email,
        kind: "VACATION",
        leaveType: "ANNUAL",
        startDate: vs,
        endDate: ve,
        status: "APPROVED",
        policySnapshot: buildPolicySnapshot(policyDoc, "VACATION"),
        computed: { days: 3 },
        approvals: [
          {
            role: "TEAM_LEADER",
            status: "APPROVED",
            processedBy: "admin@company.com",
            processedAt: new Date(),
          },
          {
            role: "HR",
            status: "APPROVED",
            processedBy: "admin@company.com",
            processedAt: new Date(),
          },
        ],
      });
      leaveCreated += 1;
    }
    if (e2) {
      const vs = addDays(new Date(), 20);
      const ve = addDays(vs, 4);
      await LeaveRequest.create({
        employeeId: e2._id,
        employeeEmail: e2.email,
        kind: "VACATION",
        leaveType: "ANNUAL",
        startDate: vs,
        endDate: ve,
        status: "PENDING",
        policySnapshot: buildPolicySnapshot(policyDoc, "VACATION"),
        computed: { days: 5 },
        approvals: [
          { role: "TEAM_LEADER", status: "PENDING" },
          { role: "HR", status: "PENDING" },
        ],
      });
      leaveCreated += 1;
    }
    if (e3) {
      const ed = addDays(new Date(), -8);
      await LeaveRequest.create({
        employeeId: e3._id,
        employeeEmail: e3.email,
        kind: "EXCUSE",
        excuseDate: ed,
        startTime: "10:00",
        endTime: "12:30",
        status: "APPROVED",
        policySnapshot: buildPolicySnapshot(policyDoc, "EXCUSE"),
        computed: { minutes: 150 },
        approvals: [
          {
            role: "MANAGER",
            status: "APPROVED",
            processedBy: "admin@company.com",
            processedAt: new Date(),
          },
          {
            role: "HR",
            status: "APPROVED",
            processedBy: "admin@company.com",
            processedAt: new Date(),
          },
        ],
      });
      leaveCreated += 1;
    }

    if (superAdminDoc) {
      const evalId = superAdminDoc._id;
      const pool = activeForSeed.slice(0, 10);
      for (let i = 0; i < pool.length; i += 1) {
        const emp = pool[i];
        const sub = {
          date: `${seedYear}-${String(seedMonth).padStart(2, "0")}-15`,
          period: { year: seedYear, month: seedMonth },
          feedback: "Seeded quarterly review — collaboration and delivery on track.",
          reviewPeriod: `${seedYear}-Q${Math.ceil(seedMonth / 3)}`,
          evaluatorId: evalId,
          overall: 3 + (i % 3),
          commitment: 4,
          attitude: 4,
          quality: 4,
          getThebounes: i < 4,
          daysBonus: i < 3 ? 2 : 0,
          overtime: i === 2 ? 6 : 0,
          deduction: i === 5 ? 4 : 0,
          bonusStatus:
            i < 2 ? "APPROVED" : i === 2 ? "PENDING_HR" : "NONE",
        };
        await Assessment.create({ employeeId: emp._id, assessment: [sub] });
        assessmentCreated += 1;
      }
    }

    if (e4) {
      await EmployeeAdvance.create({
        employeeId: e4._id,
        amount: 2500,
        reason: "Salary advance (seed)",
        status: "ACTIVE",
        recordedBy: "admin@company.com",
      });
      advancesCreated += 1;
    }
    if (e5) {
      await EmployeeAdvance.create({
        employeeId: e5._id,
        amount: 1200,
        reason: "Emergency advance (seed)",
        status: "ACTIVE",
        recordedBy: "admin@company.com",
      });
      advancesCreated += 1;
    }

    const run = await PayrollRun.create({
      period: { year: seedYear, month: seedMonth },
      createdBy: "admin@company.com",
    });
    const computeResult = await computePayrollRun(
      run._id.toString(),
      "admin@company.com",
    );
    payrollSeedNote = `run ${run._id} — ${computeResult.recordCount} record(s), status COMPUTED`;
  } catch (e) {
    console.error("[ERROR] Leave / assessment / advance / payroll seed:", e.message);
  }

  const empA = resolveCaseEmp("A");
  const empB = resolveCaseEmp("B");
  const empC = resolveCaseEmp("C");
  const empD = resolveCaseEmp("D");
  const empE = resolveCaseEmp("E");

  console.log("\n══════════════════════════════════════════════════");
  console.log("Final summary (APPLY)");
  console.log(`  ✓ Collections wiped:     ${totalWiped} document(s) removed`);
  console.log("  ✓ Super Admin created:   admin@company.com / Admin@123456");
  console.log("  ✓ Departments created:   5");
  console.log("  ✓ Positions created:     10");
  console.log("  ✓ Teams created:         5");
  console.log("  ✓ Employees created:     30");
  console.log(`  ✓ Attendance records:    ${attendanceCreated}`);
  console.log(`  ✓ Alerts created:        ${alertsCreated}`);
  console.log(`  ✓ Permissions created:   ${permissionsCreated}`);
  console.log(`  ✓ Leave requests:      ${leaveCreated}`);
  console.log(`  ✓ Assessment docs:       ${assessmentCreated}`);
  console.log(`  ✓ Salary advances:       ${advancesCreated}`);
  console.log(`  ✓ Payroll (computed):    ${payrollSeedNote}`);
  console.log("\n  Test cases seeded:");
  console.log(
    `    → CASE A (overdue increase):  ${empA ? `${empA.fullName} <${empA.email}>` : "—"}`,
  );
  console.log(
    `    → CASE B (expired ID):        ${empB ? `${empB.fullName} <${empB.email}>` : "—"}`,
  );
  console.log(
    `    → CASE C (recent transfer):   ${empC ? `${empC.fullName} <${empC.email}>` : "—"}`,
  );
  console.log(
    `    → CASE D (terminated):        ${empD ? `${empD.fullName} <${empD.email}>` : "—"}`,
  );
  console.log(
    `    → CASE E (upcoming ID expiry):${empE ? `${empE.fullName} <${empE.email}>` : "—"}`,
  );
  console.log(
    "\n  Super Admin login: admin@company.com / Admin@123456",
  );
  console.log(
    "  Employee login (all others):   <email> / Employee@123456",
  );
  console.log("══════════════════════════════════════════════════\n");

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
