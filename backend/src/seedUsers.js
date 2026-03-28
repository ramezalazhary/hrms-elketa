import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { connectDb } from "./config/db.js";
import { Department } from "./models/Department.js";
import { Employee } from "./models/Employee.js";
import { User } from "./models/User.js";
import { Team } from "./models/Team.js";
import { PasswordResetRequest } from "./models/PasswordResetRequest.js";
import { TokenBlacklist } from "./models/TokenBlacklist.js";

dotenv.config();

const SEED_DATA = {
  departments: [
    {
      name: "HR",
      head: "hrhead@hr.local",
      teams: [
         { name: "Recruitment", manager: "hrhead@hr.local", status: "ACTIVE" }
      ]
    },
    {
      name: "IT",
      head: "itmgr@hr.local",
      teams: [
        { name: "DevOps", manager: "devopsleader@hr.local", status: "ACTIVE" },
        { name: "Frontend", manager: "feleader@hr.local", status: "ACTIVE" }
      ]
    },
    {
      name: "Sales",
      head: "salesmgr@hr.local",
      teams: [
        { name: "Direct Sales", manager: "salesmgr@hr.local", status: "ACTIVE" }
      ]
    }
  ],
  users: [
    { email: "admin@hr.local", password: "admin123", role: "ADMIN" },
    { email: "hrhead@hr.local", password: "hr123", role: "HR_STAFF" },
    { email: "itmgr@hr.local", password: "it123", role: "MANAGER" },
    { email: "devopsleader@hr.local", password: "lead123", role: "TEAM_LEADER" },
    { email: "feleader@hr.local", password: "lead123", role: "TEAM_LEADER" },
    { email: "salesmgr@hr.local", password: "sales123", role: "MANAGER" },
    { email: "devops1@hr.local", password: "emp123", role: "EMPLOYEE" },
    { email: "devops2@hr.local", password: "emp123", role: "EMPLOYEE" },
    { email: "fe1@hr.local", password: "emp123", role: "EMPLOYEE" },
    { email: "sales1@hr.local", password: "emp123", role: "EMPLOYEE" },
  ],
  employees: [
    { fullName: "Super Admin", email: "admin@hr.local", department: "HR", position: "CTO" },
    { fullName: "Head Of HR", email: "hrhead@hr.local", department: "HR", position: "HR Director" },
    { fullName: "IT Dept Manager", email: "itmgr@hr.local", department: "IT", position: "IT Director" },
    { fullName: "DevOps Team Lead", email: "devopsleader@hr.local", department: "IT", team: "DevOps", position: "Lead DevOps" },
    { fullName: "Frontend Team Lead", email: "feleader@hr.local", department: "IT", team: "Frontend", position: "Lead Frontend" },
    { fullName: "Sales Manager", email: "salesmgr@hr.local", department: "Sales", position: "Sales Director" },
    { fullName: "DevOps Eng 1", email: "devops1@hr.local", department: "IT", team: "DevOps", position: "Junior DevOps" },
    { fullName: "DevOps Eng 2", email: "devops2@hr.local", department: "IT", team: "DevOps", position: "Senior DevOps" },
    { fullName: "React Dev 1", email: "fe1@hr.local", department: "IT", team: "Frontend", position: "Mid Dev" },
    { fullName: "Sales Executive 1", email: "sales1@hr.local", department: "Sales", position: "Executive" },
  ]
};

async function main() {
  await connectDb();

  // 1. CLEAR ALL DATA
  console.log("Wiping collections...");
  await User.deleteMany({});
  await Employee.deleteMany({});
  await Department.deleteMany({});
  await Team.deleteMany({});
  await PasswordResetRequest.deleteMany({});
  await TokenBlacklist.deleteMany({});
  console.log("Database cleaned.");

  // 2. SEED DEPARTMENTS & TEAMS
  for (const deptData of SEED_DATA.departments) {
    const { teams, ...deptFields } = deptData;
    const dept = await Department.create(deptFields);
    console.log(`Created Department: ${dept.name}`);

    // Create separate Team entries
    if (teams && teams.length > 0) {
      for (const t of teams) {
        await Team.create({
          name: t.name,
          departmentId: dept._id,
          managerEmail: t.manager,
          status: t.status
        });
        console.log(`  Added Team: ${t.name} to ${dept.name}`);
      }
    }
  }

  // 3. SEED EMPLOYEES
  const createdEmployees = [];
  for (const empData of SEED_DATA.employees) {
    const emp = await Employee.create({
      ...empData,
      status: "ACTIVE",
      employmentType: "FULL_TIME",
      employeeCode: `EMP-${Math.random().toString(36).substr(2, 4).toUpperCase()}`
    });
    createdEmployees.push(emp);
    console.log(`Created Employee: ${emp.fullName}`);
  }

  // 4. SEED USERS
  for (const userData of SEED_DATA.users) {
    const passwordHash = await bcrypt.hash(userData.password, 10);
    const empRecord = createdEmployees.find(e => e.email === userData.email);
    
    await User.create({
      email: userData.email,
      passwordHash,
      role: userData.role,
      employeeId: empRecord ? empRecord._id : null,
      requirePasswordChange: false
    });
    console.log(`Created User: ${userData.email} (Role: ${userData.role})`);
  }

  console.log("\n=== MASTER SEEDING COMPLETE ===");
  console.log("Summary:");
  console.log("- 3 Departments (HR, IT, Sales)");
  console.log("- 2 Specialist Teams (DevOps, Frontend) in IT");
  console.log("- 10 Personnel with full hierarchical role coverage");
  process.exit(0);
}

main().catch(err => {
  console.error("Master Seeding FAILED:", err);
  process.exit(1);
});
