/**
 * @file Ultra-Deep 4-Department Seeding Script.
 * Implements professional sequential ID generation (#ENG-001, #CS-002).
 * Includes Customer Success (CS) for multi-dept isolation testing.
 */
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { connectDb } from "./config/db.js";
import { Department } from "./models/Department.js";
import { Employee } from "./models/Employee.js";
import { Team } from "./models/Team.js";
import { Position } from "./models/Position.js";
import { PasswordResetRequest } from "./models/PasswordResetRequest.js";
import { TokenBlacklist } from "./models/TokenBlacklist.js";

dotenv.config();

const SEED_EMAILS = {
  ADMIN: "superadmin@elketa.com",
  
  // ENG
  CTO: "ahmad_cto@elketa.com",
  ENG_LEAD: "omar_lead@elketa.com",
  DEV_JUNIOR: "zain_dev@elketa.com",
  OPS_LEAD: "sarah_ops@elketa.com",
  
  // HR
  HR_DIR: "hala_hr@elketa.com",
  REC_LEAD: "mona_rec@elketa.com",
  PAY_LEAD: "fatima_payroll@elketa.com",
  CUL_LEAD: "nour_culture@elketa.com",
  
  // FIN
  FIN_DIR: "sami_finance@elketa.com",
  
  // CS
  CS_DIR: "leila_cs@elketa.com",
  SUPP_LEAD: "khalid_support@elketa.com",
  SUPP_AGENT: "huda_support@elketa.com"
};

async function main() {
  await connectDb();

  console.log("Emptying all core collections for 4-dept seed...");
  await Employee.deleteMany({});
  await Department.deleteMany({});
  await Team.deleteMany({});
  await Position.deleteMany({});
  await PasswordResetRequest.deleteMany({});
  await TokenBlacklist.deleteMany({});

  const pw = await bcrypt.hash("emp123", 10);

  // 1. Departments
  console.log("\nStructuring Four Department ecosystem...");
  
  const engDept = await Department.create({
    name: "Engineering",
    code: "ENG",
    head: SEED_EMAILS.CTO,
    headTitle: "Chief Technology Officer",
    type: "PERMANENT",
    positions: [
        { title: "Staff Engineer", level: "L5", members: [SEED_EMAILS.ENG_LEAD] },
        { title: "Infrastructure Lead", level: "L5", members: [SEED_EMAILS.OPS_LEAD] }
    ]
  });

  const hrDept = await Department.create({
    name: "HR & People",
    code: "HR",
    head: SEED_EMAILS.HR_DIR,
    headTitle: "HR Director",
    type: "PERMANENT",
    positions: [
        { title: "Recruitment Manager", level: "L4", members: [SEED_EMAILS.REC_LEAD] },
        { title: "Payroll Manager", level: "L4", members: [SEED_EMAILS.PAY_LEAD] }
    ]
  });

  const finDept = await Department.create({
    name: "Finance",
    code: "FIN",
    head: SEED_EMAILS.FIN_DIR,
    headTitle: "Finance Director",
    type: "PERMANENT"
  });

  const csDept = await Department.create({
    name: "Customer Success",
    code: "CS",
    head: SEED_EMAILS.CS_DIR,
    headTitle: "VP of Customer Success",
    headResponsibility: "Maxing customer satisfaction and global support SLAs.",
    type: "PERMANENT",
    positions: [
        { title: "Global Support Lead", level: "L4", members: [SEED_EMAILS.SUPP_LEAD] }
    ]
  });

  // 2. Units (Teams)
  console.log("\nDeploying Teams...");
  
  // Teams in ENG
  await Team.create({ name: "Core Platform", departmentId: engDept._id, leaderEmail: SEED_EMAILS.ENG_LEAD, members: [SEED_EMAILS.DEV_JUNIOR] });
  await Team.create({ name: "DevOps", departmentId: engDept._id, leaderEmail: SEED_EMAILS.OPS_LEAD, members: [] });
  
  // Team in CS
  await Team.create({
    name: "Global Support",
    departmentId: csDept._id,
    leaderEmail: SEED_EMAILS.SUPP_LEAD,
    leaderTitle: "Support Architect",
    leaderResponsibility: "Leading 24/7 technical assistance and knowledge management.",
    members: [SEED_EMAILS.SUPP_AGENT]
  });

  // 3. Employee Generation
  console.log("\nPopulating 4-Dept Roster with sequential IDs...");
  
  const employeesToSeed = [
    { fullName: "Super Admin", email: SEED_EMAILS.ADMIN, role: "ADMIN", department: "Operations", position: "Director", code: "OPS" },
    
    // Engineering
    { fullName: "Ahmad CTO", email: SEED_EMAILS.CTO, role: "MANAGER", department: "Engineering", position: "CTO", code: "ENG" },
    { fullName: "Omar Lead", email: SEED_EMAILS.ENG_LEAD, role: "TEAM_LEADER", department: "Engineering", position: "Staff Engineer", code: "ENG" },
    { fullName: "Zain Dev", email: SEED_EMAILS.DEV_JUNIOR, role: "EMPLOYEE", department: "Engineering", position: "Junior Backend", code: "ENG" },
    { fullName: "Sarah Ops", email: SEED_EMAILS.OPS_LEAD, role: "TEAM_LEADER", department: "Engineering", position: "Infra Lead", code: "ENG" },
    
    // HR
    { fullName: "Hala HR Dir", email: SEED_EMAILS.HR_DIR, role: "MANAGER", department: "HR & People", position: "Director", code: "HR" },
    { fullName: "Mona TA Lead", email: SEED_EMAILS.REC_LEAD, role: "TEAM_LEADER", department: "HR & People", position: "TA Manager", code: "HR" },
    { fullName: "Fatima Pay Lead", email: SEED_EMAILS.PAY_LEAD, role: "TEAM_LEADER", department: "HR & People", position: "Payroll Manager", code: "HR" },
    
    // Finance
    { fullName: "Sami Finance", email: SEED_EMAILS.FIN_DIR, role: "MANAGER", department: "Finance", position: "Director", code: "FIN" },
    
    // CS
    { fullName: "Leila VP CS", email: SEED_EMAILS.CS_DIR, role: "MANAGER", department: "Customer Success", position: "VP", code: "CS" },
    { fullName: "Khalid Supp Lead", email: SEED_EMAILS.SUPP_LEAD, role: "TEAM_LEADER", department: "Customer Success", position: "Support Lead", code: "CS" },
    { fullName: "Huda Supp Agent", email: SEED_EMAILS.SUPP_AGENT, role: "EMPLOYEE", department: "Customer Success", position: "Support Agent", code: "CS" },
  ];

  const counters = {};
  for (const e of employeesToSeed) {
    const prefix = e.code;
    counters[prefix] = (counters[prefix] || 0) + 1;
    const serial = counters[prefix].toString().padStart(3, '0');
    
    const eData = { ...e };
    delete eData.code;

    await Employee.create({
      ...eData,
      passwordHash: pw,
      employeeCode: `#${prefix}-${serial}`,
      status: "ACTIVE",
      isActive: true,
      employmentType: "FULL_TIME",
    });
    console.log(` Hired: ${e.email} -> #${prefix}-${serial}`);
  }

  console.log("\n=== 4-DEPT SEEDING COMPLETE ===");
  console.log(`- Password for ALL: emp123`);
  console.log(`- Roles for testing Isolation:`);
  console.log(` [ADMIN]     -> ${SEED_EMAILS.ADMIN}`);
  console.log(` [MANAGER]   -> ${SEED_EMAILS.CTO} (Engineering All)`);
  console.log(` [LEADER]    -> ${SEED_EMAILS.SUPP_LEAD} (Global Support ONLY)`);
  console.log(` [EMPLOYEE]  -> ${SEED_EMAILS.SUPP_AGENT} (Self ONLY)`);
  process.exit(0);
}

main().catch(err => {
  console.error("Critical Seeding Error:", err);
  process.exit(1);
});
