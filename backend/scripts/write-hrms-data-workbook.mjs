/**
 * Builds HRMS_Template-shaped workbook (Branches, Departments, Teams, Positions, Employees)
 * with roster aligned to scripts/seed-real-data.js (codes, departments, roles).
 *
 * Usage (from backend/):
 *   node scripts/write-hrms-data-workbook.mjs
 *   node scripts/write-hrms-data-workbook.mjs "C:/path/to/data.xlsx"
 *
 * Default output: ../Downloads/data.xlsx next to project root is NOT portable — override with arg.
 * On Windows with default repo layout, pass your Downloads path explicitly or use env OUT.
 */
import * as XLSX from "xlsx";
import fs from "fs";
import path from "path";

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

const DEPT_SPECS = [
  {
    name: "Engineering",
    code: "ENG",
    count: 8,
    teamName: "Dev Team",
    positionsNonMgr: ["Software Engineer", "Senior Engineer"],
    mgrPosition: "Tech Lead",
    salaries: [15000, 35000],
  },
  {
    name: "Sales",
    code: "SAL",
    count: 7,
    teamName: "Sales Team",
    positionsNonMgr: ["Sales Rep"],
    mgrPosition: "Sales Manager",
    salaries: [10000, 25000],
  },
  {
    name: "HR",
    code: "HR",
    count: 5,
    teamName: "HR Team",
    positionsNonMgr: ["HR Specialist"],
    mgrPosition: "HR Manager",
    salaries: [8000, 18000],
  },
  {
    name: "Finance",
    code: "FIN",
    count: 5,
    teamName: "Finance Team",
    positionsNonMgr: ["Accountant"],
    mgrPosition: "Finance Manager",
    salaries: [10000, 22000],
  },
  {
    name: "Operations",
    code: "OPS",
    count: 5,
    teamName: "Ops Team",
    positionsNonMgr: ["Operations Coordinator"],
    mgrPosition: "Operations Coordinator",
    salaries: [7000, 15000],
  },
];

function pad3(n) {
  return String(n).padStart(3, "0");
}

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

function hireIso(di, i) {
  const y = 2022 + ((di * 3 + i) % 3);
  const m = 1 + ((di + i * 2) % 11);
  const d = 1 + ((i + di * 5) % 27);
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function idExpiryIso(globalIdx) {
  const y = 2028 + (globalIdx % 3);
  const m = 1 + (globalIdx % 11);
  const d = 1 + (globalIdx % 25);
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function buildEmployeeRows() {
  const usedEmails = new Set();
  const rows = [];
  let globalIdx = 0;

  for (let di = 0; di < DEPT_SPECS.length; di += 1) {
    const spec = DEPT_SPECS[di];
    for (let i = 0; i < spec.count; i += 1) {
      if (spec.name === "Operations" && i === spec.count - 1) {
        continue;
      }

      globalIdx += 1;
      const first = FIRST_NAMES[(globalIdx + di + i) % FIRST_NAMES.length];
      const last = LAST_NAMES[(globalIdx * 3 + i) % LAST_NAMES.length];
      const email = buildEmail(first, last, usedEmails);
      const code = `${spec.code}-${pad3(i + 1)}`;
      const isMgr = i === 0;

      let position = isMgr
        ? spec.mgrPosition
        : spec.positionsNonMgr[i % spec.positionsNonMgr.length];
      if (spec.name === "Engineering" && !isMgr) {
        position = i % 2 === 1 ? "Senior Engineer" : "Software Engineer";
      }

      let role = isMgr ? "MANAGER" : "EMPLOYEE";
      if (spec.name === "HR" && i === 0) role = "HR_MANAGER";
      if (spec.name === "HR" && i === 1) role = "HR_STAFF";
      if (spec.name === "Engineering" && i === 1) role = "TEAM_LEADER";

      const spread = spec.salaries[1] - spec.salaries[0];
      const baseSalary = isMgr
        ? spec.salaries[1] - (i * 800) % Math.max(1, Math.floor(spread / 2))
        : spec.salaries[0] + (globalIdx * 400) % Math.max(1, spread);

      rows.push([
        `${first} ${last}`,
        "",
        email,
        code,
        role,
        position,
        spec.name,
        spec.teamName,
        hireIso(di, i),
        baseSalary,
        String(29001010000000 + globalIdx * 100017),
        idExpiryIso(globalIdx),
      ]);
    }
  }

  rows.unshift([
    "Super Admin",
    "",
    "admin@company.com",
    "ADM-001",
    "ADMIN",
    "Administrator",
    "Head Office",
    "",
    "2022-01-15",
    50000,
    "29001019999999",
    "2030-12-31",
  ]);

  return rows;
}

function main() {
  const outArg =
    process.argv[2] ||
    process.env.OUT ||
    path.join(process.env.USERPROFILE || process.env.HOME || ".", "Downloads", "data.xlsx");

  const branches = [
    ["Governorate", "City", "Branch Name"],
    ["Cairo", "Cairo", "Cairo HQ"],
    ["Alexandria", "Alexandria", "Alexandria Branch"],
    ["Remote", "Remote", "Remote"],
  ];

  const departments = [
    ["Dept Name", "Dept Code", "Head Title"],
    ["Head Office", "HO", "Chief Administrator"],
    ["Engineering", "ENG", "Department Head"],
    ["Sales", "SAL", "Department Head"],
    ["HR", "HR", "Department Head"],
    ["Finance", "FIN", "Department Head"],
    ["Operations", "OPS", "Department Head"],
  ];

  const teams = [
    ["Department Name", "Team Name", "Description"],
    ["Engineering", "Dev Team", "Product engineering"],
    ["Sales", "Sales Team", "Revenue"],
    ["HR", "HR Team", "People operations"],
    ["Finance", "Finance Team", "Accounting"],
    ["Operations", "Ops Team", "Operations"],
  ];

  const positions = [
    ["Department Name", "Title", "Level", "Responsibility"],
    ["Engineering", "Software Engineer", "Mid", "Build features"],
    ["Engineering", "Senior Engineer", "Senior", "Lead delivery"],
    ["Engineering", "Tech Lead", "Lead", "Technical leadership"],
    ["Sales", "Sales Rep", "Mid", "Sell"],
    ["Sales", "Sales Manager", "Lead", "Sales leadership"],
    ["HR", "HR Specialist", "Mid", "HR operations"],
    ["HR", "HR Manager", "Lead", "HR leadership"],
    ["Finance", "Accountant", "Mid", "Books"],
    ["Finance", "Finance Manager", "Lead", "Finance leadership"],
    ["Operations", "Operations Coordinator", "Mid", "Ops"],
  ];

  const employeeHeader = [
    "Full Name",
    "Full Name Arabic",
    "Email",
    "Employee Code",
    "Role",
    "Position",
    "Department",
    "Team",
    "Date of Hire",
    "Base Salary",
    "National ID",
    "ID Expiry Date",
  ];

  const instructions = [
    ["Sheet Name", "Description", "Mandatory Fields"],
    ["Branches", "Define company locations", "Governorate, City, Branch Name"],
    ["Departments", "Top-level organizational units", "Dept Name, Dept Code"],
    ["Teams", "Sub-units within departments", "Department Name, Team Name"],
    ["Positions", "Job titles defined per department", "Department Name, Title"],
    ["Employees", "Main staff records", "Full Name, Email, Employee Code, Role, Position, Department"],
    ["", "", ""],
    ["Aligned with:", "backend/scripts/seed-real-data.js", "Same codes & dept names as npm run seed:real"],
    ["Roles:", "ADMIN, MANAGER, TEAM_LEADER, EMPLOYEE, HR_STAFF, HR_MANAGER", ""],
    ["Bulk upload:", "POST /api/bulk/upload with ALLOW_DESTRUCTIVE_BULK=true", ""],
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(instructions), "Instructions");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(branches), "Branches");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(departments), "Departments");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(teams), "Teams");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(positions), "Positions");
  const employeeData = buildEmployeeRows();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([employeeHeader, ...employeeData]),
    "Employees",
  );

  const dir = path.dirname(outArg);
  if (dir && !fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  XLSX.writeFile(wb, outArg);
  console.log(`Wrote ${outArg}`);
  console.log(`  Sheets: ${wb.SheetNames.join(", ")}`);
  console.log(`  Employee data rows: ${employeeData.length} (+ header row)`);
}

main();
