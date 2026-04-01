import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function verifyImport() {
  const adminEmail = 'superadmin@elketa.com';
  const adminPassword = 'emp123';
  const baseUrl = 'http://localhost:5000/api';
  const filePath = path.join(__dirname, 'testing attendance with real data.xlsx');

  console.log('--- Final Verification: Real Data Attendance Import ---');

  // 1. Login
  console.log('1. Logging in...');
  const loginRes = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: adminEmail, password: adminPassword })
  });
  if (!loginRes.ok) throw new Error('Login failed');
  const { accessToken } = await loginRes.json();

  // 2. Upload
  console.log('2. Uploading real data file...');
  const fileBuffer = fs.readFileSync(filePath);
  const formData = new FormData();
  const blob = new Blob([fileBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  formData.append('file', blob, 'testing attendance with real data.xlsx');
  formData.append('overwrite', 'true');

  const importRes = await fetch(`${baseUrl}/attendance/import`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${accessToken}` },
    body: formData
  });

  const result = await importRes.json();
  if (!importRes.ok) {
    console.error('   ✗ Import failed:', JSON.stringify(result, null, 2));
    process.exit(1);
  }

  console.log('   ✓ Import Summary:', JSON.stringify(result.summary, null, 2));
  
  if (result.errors && result.errors.length > 0) {
    console.log('   First few errors:', JSON.stringify(result.errors.slice(0, 5), null, 2));
  }

  console.log('--- Verification Complete ---');
}

verifyImport().catch(err => {
    console.error(err);
    process.exit(1);
});
