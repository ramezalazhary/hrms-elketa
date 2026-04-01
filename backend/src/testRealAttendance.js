import mongoose from 'mongoose';
import XLSX from 'xlsx';
import { Attendance } from './models/Attendance.js';
import { Employee } from './models/Employee.js';
import { Department } from './models/Department.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_URI = 'mongodb://localhost:27017/hrms';
const EXCEL_PATH = path.join(__dirname, 'testing attendance with real data.xlsx');

async function testRealImport() {
  console.log('--- Phase 9: Real Data Attendance Test ---');
  await mongoose.connect(DB_URI);
  console.log('Connected to DB.');

  const workbook = XLSX.readFile(EXCEL_PATH, { cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet);

  console.log(`Processing ${data.length} rows from Excel...`);

  // Target 3 rows for verification
  const sampleRows = data.slice(1, 4); // First row after headers (if headers are in row 0)
  
  for (const row of sampleRows) {
    let nameValue = row['__EMPTY']; // Name column
    let dateValue = row['Data'];  // Date column
    let inValue = row['__EMPTY_1']; // Min of time
    let outValue = row['__EMPTY_2']; // Max of time2
    
    // Extract code
    let code = '';
    const match = nameValue?.toString().match(/^(#[A-Z0-9]+)/i);
    if (match) code = match[1];

    console.log(`- Testing Row: ${nameValue} -> Extracted Code: ${code}`);

    const employee = await Employee.findOne({ employeeCode: code });
    if (!employee) {
      console.log(`  ⚠ Employee ${code} not found in DB. Skipping verification.`);
      continue;
    }

    console.log(`  ✓ Employee ${employee.fullName} found.`);

    // Mock the logic from the route
    const policy = { standardStartTime: '09:00', gracePeriod: 15 };
    
    // Helper to format fraction time
    const formatTime = (fraction) => {
       const totalSeconds = Math.round(fraction * 86400);
       const h = Math.floor(totalSeconds / 3600);
       const m = Math.floor((totalSeconds % 3600) / 60);
       const s = totalSeconds % 60;
       return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const checkInStr = formatTime(inValue);
    const checkOutStr = formatTime(outValue);
    
    console.log(`  ✓ Calculated: In=${checkInStr}, Out=${checkOutStr}`);
  }

  console.log('--- Test script run complete ---');
  await mongoose.disconnect();
}

testRealImport().catch(err => {
    console.error(err);
    process.exit(1);
});
