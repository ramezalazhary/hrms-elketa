import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testImport() {
  const adminEmail = 'superadmin@elketa.com';
  const adminPassword = 'emp123';
  const baseUrl = 'http://localhost:5000/api';
  const filePath = path.join(__dirname, 'test_attendance_import.xlsx');

  console.log('--- Attendance Bulk Import Test ---');

  // 1. Login
  console.log('1. Logging in as Admin...');
  const loginRes = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: adminEmail, password: adminPassword })
  });
  const { accessToken } = await loginRes.json();
  console.log('   Logged in.');

  // 2. Prepare Form Data
  console.log('2. Preparing file upload...');
  const fileBuffer = fs.readFileSync(filePath);
  const formData = new FormData();
  // In Node 20 fetch, we can use Blob for the file
  const blob = new Blob([fileBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  formData.append('file', blob, 'test_attendance_import.xlsx');
  formData.append('overwrite', 'true');

  // 3. Import
  console.log('3. Uploading Excel to /api/attendance/import...');
  const importRes = await fetch(`${baseUrl}/attendance/import`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${accessToken}` },
    body: formData
  });

  if (!importRes.ok) {
    console.error('   ✗ Import failed:', await importRes.text());
    return;
  }

  const result = await importRes.json();
  console.log('   ✓ Import result:', JSON.stringify(result.summary, null, 2));
  
  if (result.errors && result.errors.length > 0) {
    console.log('   Expected Errors:', JSON.stringify(result.errors, null, 2));
  }

  // 4. Verify in DB
  console.log('4. Verifying imported records for #CS-003...');
  const date = '2026-03-28';
  const verifyRes = await fetch(`${baseUrl}/attendance?startDate=${date}&endDate=${date}`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  const logs = await verifyRes.json();
  const hudaLog = logs.find(l => l.employeeCode === '#CS-003');
  
  if (hudaLog) {
    console.log(`   ✓ Found record for Huda: Status=${hudaLog.status}, In=${hudaLog.checkIn}, Out=${hudaLog.checkOut}`);
    if (hudaLog.status === 'LATE') {
      console.log('   ✓ Status correctly calculated as LATE for 09:30 AM');
    }
  } else {
    console.error('   ✗ Could not find record for #CS-003 in database');
  }

  console.log('--- Import Test Completed ---');
}

testImport().catch(console.error);
