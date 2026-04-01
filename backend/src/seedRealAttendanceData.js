import mongoose from 'mongoose';
import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';
import { Employee } from './models/Employee.js';
import { Department } from './models/Department.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_URI = 'mongodb://localhost:27017/hrms';
const EXCEL_PATH = path.join(__dirname, 'testing attendance with real data.xlsx');

async function seedData() {
  console.log('--- Phase 10: Real Data Seeding ---');
  await mongoose.connect(DB_URI);
  console.log('Connected to DB.');

  const workbook = XLSX.readFile(EXCEL_PATH, { cellDates: true });
  const sheet = workbook.Sheets['Sheet1']; // The main data sheet
  const data = XLSX.utils.sheet_to_json(sheet);

  console.log(`Analyzing ${data.length} rows for unique employees...`);

  const uniqueEmployees = new Map();
  const prefixes = new Set();

  for (const row of data) {
    const nameStr = row['__EMPTY']; // e.g. "#CS0054-yasmine Mosaad"
    if (!nameStr || nameStr === 'Name' || !nameStr.includes('-')) continue;

    const [codePart, ...nameParts] = nameStr.split('-');
    const fullName = nameParts.join('-').trim();
    const code = codePart.trim();
    const prefixMatch = code.match(/^#([A-Z]+)/i);
    const prefix = prefixMatch ? prefixMatch[1].toUpperCase() : 'GEN';

    if (!uniqueEmployees.has(code)) {
      uniqueEmployees.set(code, { fullName, code, prefix });
      prefixes.add(prefix);
    }
  }

  console.log(`Found ${uniqueEmployees.size} unique employees with prefixes: ${Array.from(prefixes).join(', ')}`);

  // 1. Map and Create Departments
  const deptMap = {
    'ENG': { name: 'Engineering', code: 'ENG' },
    'CS': { name: 'Customer Success', code: 'CS' },
    'HR': { name: 'HR & People', code: 'HR' },
    'EC': { name: 'EC Department', code: 'EC' },
    'GEN': { name: 'General Operations', code: 'GEN' }
  };

  const departmentDocs = {};
  for (const prefix of prefixes) {
    const meta = deptMap[prefix] || { name: `${prefix} Department`, code: prefix };
    let dept = await Department.findOne({ code: meta.code });
    if (!dept) {
      console.log(`  + Creating Department: ${meta.name} (${meta.code})`);
      dept = await Department.create(meta);
    }
    departmentDocs[prefix] = dept;
  }

  // 2. Create Employees
  let createdCount = 0;
  let updatedCount = 0;

  for (const [code, info] of uniqueEmployees.entries()) {
    const dept = departmentDocs[info.prefix];
    
    const existing = await Employee.findOne({ employeeCode: code });
    if (!existing) {
      // Create with placeholder data
      await Employee.create({
        fullName: info.fullName,
        employeeCode: code,
        email: `${code.replace('#', '').toLowerCase()}@elketa.com`,
        department: dept.name,
        departmentId: dept._id,
        position: 'General Staff',
        status: 'ACTIVE',
        dateOfHire: new Date('2024-01-01'), // Default placeholder
        workLocation: 'Main Office'
      });
      createdCount++;
    } else {
      // Update just in case
      existing.fullName = info.fullName;
      existing.department = dept.name;
      existing.departmentId = dept._id;
      await existing.save();
      updatedCount++;
    }
  }

  console.log(`Seeding complete: ${createdCount} created, ${updatedCount} updated.`);
  await mongoose.disconnect();
}

seedData().catch(err => {
  console.error(err);
  process.exit(1);
});
