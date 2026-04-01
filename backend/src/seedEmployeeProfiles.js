import mongoose from 'mongoose';
import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import { Employee } from './models/Employee.js';
import { Department } from './models/Department.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EXCEL_PATH = path.join(__dirname, 'employee data', 'demo_data.xlsx');
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hrms';

async function seed() {
  console.log('--- Phase 12: Fresh Start - Clearing Database & Seeding ---');
  
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✓ Connected to MongoDB');

    // 1. Clear Data
    console.log('[RESET] Clearing collections...');
    await Employee.deleteMany({});
    await Department.deleteMany({});
    // Also clear attendance if model is available
    try {
        const Attendance = mongoose.model('Attendance');
        await Attendance.deleteMany({});
        console.log('✓ Attendance cleared');
    } catch (e) {
        // Attendance might not be registered yet if not imported
    }
    console.log('✓ Collections cleared');

    const defaultPasswordHash = await bcrypt.hash('emp123', 10);

    // 2. Create Admin User
    console.log('[ADMIN] Creating superadmin...');
    await Employee.create({
        fullName: 'Super Admin',
        email: 'superadmin@elketa.com',
        employeeCode: 'ADMIN001',
        position: 'System Administrator',
        department: 'IT',
        role: 'ADMIN',
        passwordHash: defaultPasswordHash,
        status: 'ACTIVE'
    });
    console.log('✓ Admin user created: superadmin@elketa.com / emp123');

    // 3. Read Excel
    const fileBuffer = fs.readFileSync(EXCEL_PATH);
    const wb = XLSX.read(fileBuffer, { type: 'buffer', cellDates: true });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, range: 0 });

    // The data starts at index 5 (Row 6)
    const records = rawData.slice(5).filter(r => r && r[1] && String(r[1]).trim());
    console.log(`[SEED] Found ${records.length} valid records.`);

    let successCount = 0;
    let updateCount = 0;
    let errorCount = 0;

    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      
      // Auto-find employee code column (usually starts with #)
      let codeIndex = -1;
      let employeeCode = null;
      let codeMatch = null;
      
      for (let c = 0; c < row.length; c++) {
          const val = String(row[c] || '').trim();
          const match = val.match(/#([a-zA-Z]+)([0-9]*)/);
          if (match) {
              codeIndex = c;
              employeeCode = match[1] + (match[2] || '');
              codeMatch = match;
              break;
          }
      }

      if (!employeeCode) {
        console.log(`[DEBUG] Skipping row ${i+1}: No valid employee code found (e.g. #IT001). Content:`, row.slice(0, 5));
        continue;
      }

      // Column mapping offset based on where we found the code
      const off = codeIndex - 1; // If code is at index 1, offset is 0. If code is at index 0, offset is -1.

      const deptName = String(row[off + 18] || 'Unassigned').trim();
      let departmentDoc = await Department.findOne({ name: { $regex: new RegExp(`^${deptName}$`, 'i') } });
      
      if (!departmentDoc && deptName !== 'Unassigned') {
        try {
            departmentDoc = await Department.create({ 
                name: deptName, 
                code: (codeMatch ? codeMatch[1].toUpperCase() : 'MISC') || deptName.substring(0, 3).toUpperCase() 
            });
        } catch (deptErr) {
            departmentDoc = await Department.create({ 
                name: deptName, 
                code: ((codeMatch ? codeMatch[1].toUpperCase() : 'MISC') + Math.floor(Math.random() * 100)).toUpperCase() 
            });
        }
      }

      const fullNameArabic = String(row[off + 2] || '').trim();
      const fullNameEnglish = String(row[off + 3] || '').trim();
      const email = String(row[off + 17] || row[off + 47] || `${employeeCode.toLowerCase()}@elketa.internal`).trim().toLowerCase();

      const employeeData = {
        fullName: fullNameEnglish || fullNameArabic || employeeCode,
        fullNameArabic,
        email,
        employeeCode,
        idNumber: String(row[off + 4] || '').trim(),
        dateOfBirth: row[off + 5] instanceof Date ? row[off + 5] : null,
        nationalIdExpiryDate: row[off + 6] instanceof Date ? row[off + 6] : null,
        address: String(row[off + 7] || '').trim(),
        city: String(row[off + 8] || '').trim(),
        governorate: String(row[off + 9] || '').trim(),
        maritalStatus: mapMaritalStatus(row[off + 10]),
        education: row[off + 13] ? [{ degree: String(row[off + 13]), year: String(row[off + 14] || '') }] : [],
        phoneNumber: String(row[off + 15] || '').trim(),
        emergencyPhone: String(row[off + 16] || '').trim(),
        department: deptName,
        departmentId: departmentDoc?._id,
        position: String(row[off + 19] || 'Staff').trim(),
        workLocation: String(row[off + 20] || '').trim(),
        dateOfHire: row[off + 21] instanceof Date ? row[off + 21] : null,
        employmentType: mapEmploymentType(row[off + 23]),
        status: 'ACTIVE',
        financial: {
            bankAccount: String(row[off + 28] || '').trim(),
            paymentMethod: row[off + 27]?.toString().includes('فــيزا') ? 'BANK_TRANSFER' : 'CASH',
            baseSalary: parseSalary(row[off + 26] || row[off + 35]),
        },
        socialInsurance: {
            status: row[off + 30]?.toString().includes('مؤمن') ? 'INSURED' : 'NOT_INSURED',
            insuranceNumber: String(row[off + 40] || '').trim(),
        },
        medicalCondition: String(row[off + 41] || '').trim(),
        workEmail: String(row[off + 47] || '').trim(),
      };

      let existing = await Employee.findOne({ employeeCode });
      if (!existing && email) existing = await Employee.findOne({ email });

      if (existing) {
        if (!existing.employeeCode && employeeCode) existing.employeeCode = employeeCode;
        Object.assign(existing, employeeData);
        await existing.save();
        updateCount++;
      } else {
        const passwordHash = defaultPasswordHash;
        const role = mapRole(deptName, employeeData.position);
        await Employee.create({ ...employeeData, passwordHash, role });
        successCount++;
      }
    }

    console.log(`\n[SUMMARY] Successfully Seeded:`);
    console.log(`- New Employees: ${successCount}`);
    console.log(`- Updated Employees: ${updateCount}`);
    console.log(`- Total Processed: ${successCount + updateCount}`);
    console.log(`- Password for all new: emp123`);

  } catch (err) {
    console.error('[ERROR]', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

function mapMaritalStatus(val) {
    if (!val) return 'SINGLE';
    const s = String(val).trim();
    if (s.includes('متزوج')) return 'MARRIED';
    if (s.includes('أعزب') || s.includes('انسه')) return 'SINGLE';
    if (s.includes('مطلق')) return 'DIVORCED';
    if (s.includes('أرمل')) return 'WIDOWED';
    return 'SINGLE';
}

function mapEmploymentType(val) {
    if (!val) return 'FULL_TIME';
    const s = String(val).toLowerCase();
    if (s.includes('دوام كامل')) return 'FULL_TIME';
    if (s.includes('دوام جزئي')) return 'PART_TIME';
    if (s.includes('عقد')) return 'CONTRACTOR';
    return 'FULL_TIME';
}

function mapRole(dept, pos) {
    const d = String(dept).toUpperCase();
    const p = String(pos).toUpperCase();
    if (d.includes('HR') || p.includes('HR')) return 'HR_STAFF';
    if (p.includes('MANAGER')) return 'MANAGER';
    if (p.includes('LEAD')) return 'TEAM_LEADER';
    return 'EMPLOYEE';
}

function parseSalary(val) {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    // Handle string like "£4,050.00"
    const cleaned = String(val).replace(/[^\d.]/g, '');
    return parseFloat(cleaned) || 0;
}

seed();
