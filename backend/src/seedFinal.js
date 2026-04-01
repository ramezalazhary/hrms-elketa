import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { Employee } from './models/Employee.js';
import { Department } from './models/Department.js';
import { Team } from './models/Team.js';
import { Position } from './models/Position.js';
import { OrganizationPolicy } from './models/OrganizationPolicy.js';
import { Attendance } from './models/Attendance.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hrms';

async function seed() {
  console.log('--- Phase 13: Final Comprehensive Seeding Start ---');
  
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✓ Connected to MongoDB');

    // 1. Clear Data
    console.log('[RESET] Cleaning all collections...');
    await Promise.all([
      Employee.deleteMany({}),
      Department.deleteMany({}),
      Team.deleteMany({}),
      Position.deleteMany({}),
      OrganizationPolicy.deleteMany({}),
      Attendance.deleteMany({}),
    ]);
    console.log('✓ Database cleared.');

    const passwordHash = await bcrypt.hash('emp123', 10);

    // 2. Organization Policy & Branches
    console.log('[ORG] Seeding Organization Policy...');
    await OrganizationPolicy.create({
      name: "default",
      workLocations: [
        { governorate: "Cairo", city: "Cairo", branches: ["Maadi HQ", "New Cairo Office", "Downtown Hub"] },
        { governorate: "Alexandria", city: "Alexandria", branches: ["Sidi Gaber Branch", "Sporting Branch"] },
        { governorate: "Giza", city: "Giza", branches: ["October Branch", "Maadi Hub"] }
      ],
      documentRequirements: [
        { name: "National ID Copy", isMandatory: true, description: "Color copy of national ID" },
        { name: "Graduation Certificate", isMandatory: true, description: "Original certificate" },
        { name: "Military Status", isMandatory: true, description: "Original or certified copy" }
      ]
    });

    // 3. Departments
    console.log('[DEPT] Seeding Departments...');
    const depts = [
      { name: "Information Technology", code: "IT", headTitle: "CTO", headResponsibility: "Strategic tech oversight" },
      { name: "Human Resources", code: "HR", headTitle: "HR Director", headResponsibility: "Culture and talent" },
      { name: "Operations", code: "OPS", headTitle: "Operations Director", headResponsibility: "Logistics and efficiency" },
      { name: "Finance", code: "FIN", headTitle: "CFO", headResponsibility: "Fiscal integrity" }
    ];

    const deptDocs = await Department.insertMany(depts);
    const itDept = deptDocs[0];
    const hrDept = deptDocs[1];
    const opsDept = deptDocs[2];
    const finDept = deptDocs[3];

    // 4. Positions
    console.log('[JOBS] Seeding Positions...');
    const posList = [
      { departmentId: itDept._id, title: "Senior Developer", level: "Senior", responsibility: "Lead systems development" },
      { departmentId: itDept._id, title: "Infrastructure Engineer", level: "Senior", responsibility: "Network/Security maintenance" },
      { departmentId: itDept._id, title: "Frontend Developer", level: "Junior", responsibility: "UI implementation" },
      { departmentId: hrDept._id, title: "HR Business Partner", level: "Senior", responsibility: "Departmental alignment" },
      { departmentId: hrDept._id, title: "Recruitement Lead", level: "Senior", responsibility: "Talent acquisition" },
      { departmentId: opsDept._id, title: "Operations Analyst", level: "Senior", responsibility: "Process optimization" },
      { departmentId: finDept._id, title: "Accountant", level: "Mid", responsibility: "General ledger management" }
    ];
    await Position.insertMany(posList);

    // 5. Teams
    console.log('[TEAMS] Seeding Teams...');
    const teams = [
      { departmentId: itDept._id, name: "FinTech Development", description: "Focused on finance modules" },
      { departmentId: itDept._id, name: "Core Infrastructure", description: "DevOps and Security" },
      { departmentId: hrDept._id, name: "Talent Team", description: "Hiring and Onboarding" }
    ];
    const teamDocs = await Team.insertMany(teams);
    const devTeam = teamDocs[0];
    const infraTeam = teamDocs[1];
    const talentTeam = teamDocs[2];

    // 6. Employees (Administrators & Managers)
    console.log('[STAFF] Seeding Management hierarchy...');
    
    // Create Admin
    const superAdmin = await Employee.create({
      fullName: "Super Admin",
      email: "superadmin@elketa.com",
      employeeCode: "ADM001",
      position: "Full Stack Admin",
      department: "Management",
      role: "ADMIN",
      passwordHash,
      status: "ACTIVE"
    });

    // Create IT Manager
    const itManager = await Employee.create({
      fullName: "Ahmed Mansour",
      fullNameArabic: "أحمد منصور",
      email: "ahmed.m@elketa.com",
      employeeCode: "IT001",
      position: "CTO",
      department: "Information Technology",
      departmentId: itDept._id,
      role: "MANAGER",
      passwordHash,
      dateOfHire: new Date("2023-01-15"),
      financial: { baseSalary: 75000 },
      status: "ACTIVE"
    });
    await Department.findByIdAndUpdate(itDept._id, { head: itManager.email });

    // Create HR Manager
    const hrManager = await Employee.create({
      fullName: "Yasmine Zayed",
      fullNameArabic: "ياسمين زايد",
      email: "yasmine.z@elketa.com",
      employeeCode: "HR001",
      position: "HR Director",
      department: "Human Resources",
      departmentId: hrDept._id,
      role: "MANAGER",
      passwordHash,
      dateOfHire: new Date("2023-02-01"),
      financial: { baseSalary: 65000 },
      status: "ACTIVE"
    });
    await Department.findByIdAndUpdate(hrDept._id, { head: hrManager.email });

    // Create Team Leads
    const devLead = await Employee.create({
      fullName: "Omar Khaled",
      fullNameArabic: "عمر خالد",
      email: "omar.k@elketa.com",
      employeeCode: "IT002",
      position: "Lead Developer",
      department: "Information Technology",
      departmentId: itDept._id,
      team: "FinTech Development",
      teamId: devTeam._id,
      managerId: itManager._id,
      role: "TEAM_LEADER",
      passwordHash,
      dateOfHire: new Date("2023-03-20"),
      status: "ACTIVE"
    });
    await Team.findByIdAndUpdate(devTeam._id, { leaderEmail: devLead.email });

    // 7. Regular Employees
    console.log('[STAFF] Seeding Employees...');
    const employeePool = [
      { name: "John Doe", email: "john.d@elketa.com", code: "IT003", dept: itDept, team: devTeam, lead: devLead, manager: itManager, pos: "Senior Developer", exp: 45 },
      { name: "Sara Amin", email: "sara.a@elketa.com", code: "IT004", dept: itDept, team: devTeam, lead: devLead, manager: itManager, pos: "Frontend Developer", exp: -5 },
      { name: "Mostafa Reda", email: "mostafa.r@elketa.com", code: "IT005", dept: itDept, team: infraTeam, lead: null, manager: itManager, pos: "Infrastructure Engineer", exp: 20 },
      { name: "Laila Sherif", email: "laila.s@elketa.com", code: "HR002", dept: hrDept, team: talentTeam, lead: null, manager: hrManager, pos: "Recruitement Lead", exp: 120 }
    ];

    const seededEmployees = [];
    for (const emp of employeePool) {
      const doc = await Employee.create({
        fullName: emp.name,
        email: emp.email,
        employeeCode: emp.code,
        position: emp.pos,
        department: emp.dept.name,
        departmentId: emp.dept._id,
        teamId: emp.team?._id,
        teamLeaderId: emp.lead?._id,
        managerId: emp.manager?._id,
        role: "EMPLOYEE",
        passwordHash,
        nationalIdExpiryDate: new Date(Date.now() + (emp.exp * 24 * 60 * 60 * 1000)),
        documentChecklist: [
          { documentName: "National ID Copy", status: "RECEIVED" },
          { documentName: "Graduation Certificate", status: emp.exp < 0 ? "MISSING" : "RECEIVED" }
        ],
        financial: { baseSalary: 25000 },
        dateOfHire: new Date("2024-01-01"),
        status: "ACTIVE"
      });
      seededEmployees.push(doc);
    }
    
    // Add managers and admin to pool for attendance
    seededEmployees.push(itManager, hrManager, devLead);

    // 8. Attendance Seeding (Last 30 Days)
    console.log('[SYSLOG] Generating 30-day Attendance logs...');
    let attendanceCount = 0;
    const now = new Date();
    
    for (let dayOffset = 30; dayOffset >= 0; dayOffset--) {
      const date = new Date(now);
      date.setDate(date.getDate() - dayOffset);
      date.setHours(0, 0, 0, 0);

      // Skip Weekends (Fri/Sat or Sat/Sun - assuming global standard Sat/Sun for demo)
      const dow = date.getDay(); 
      if (dow === 0 || dow === 6) continue;

      for (const emp of seededEmployees) {
        // Stochastic variance for attendance behavior
        const randomFactor = Math.random();
        if (randomFactor < 0.05) continue; // 5% chance of absence

        const isLate = randomFactor > 0.90; // 10% chance of being late
        const checkIn = isLate ? `09:${Math.floor(Math.random() * 20) + 15}:00` : `08:${Math.floor(Math.random() * 30) + 30}:00`;
        const checkOut = `17:${Math.floor(Math.random() * 30) + 10}:00`;

        await Attendance.create({
          employeeId: emp._id,
          employeeCode: emp.employeeCode,
          date,
          checkIn,
          checkOut,
          status: isLate ? "LATE" : "PRESENT",
          totalHours: isLate ? 7.5 + Math.random() : 8 + Math.random(),
          remarks: isLate ? "Heavy Traffic" : "Standard Cycle"
        });
        attendanceCount++;
      }
    }

    console.log(`\n[SUMMARY] Seeding Complete:`);
    console.log(`- Departments: ${deptDocs.length}`);
    console.log(`- Employees: ${seededEmployees.length + 1}`);
    console.log(`- Attendance: ${attendanceCount} logs`);
    console.log(`- Root Creds: superadmin@elketa.com / emp123`);
    console.log(`- IT Manager: ahmed.m@elketa.com / emp123`);
    console.log(`- Dev Lead: omar.k@elketa.com / emp123`);
    console.log(`- Standard Employee (ID Warning): sara.a@elketa.com / emp123`);

  } catch (err) {
    console.error('[CRITICAL FAILURE]', err);
  } finally {
    await mongoose.disconnect();
    console.log('✓ Disconnected.');
    process.exit(0);
  }
}

seed();
