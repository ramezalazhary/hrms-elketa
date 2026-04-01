import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, 'employee data', 'data.xlsx');

try {
  const fileBuffer = fs.readFileSync(filePath);
  const wb = XLSX.read(fileBuffer, { type: 'buffer' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  // Read first row to see headers
  const data = XLSX.utils.sheet_to_json(sheet, { range: 0 });
  
  console.log('--- Employee Data Summary ---');
  console.log('Total rows found:', data.length);
  
  if (data.length > 0) {
    console.log('\n--- Headers ---');
    console.log(Object.keys(data[0]));
    
    console.log('\n--- First Record (Transformed) ---');
    const first = data[0];
    console.log(JSON.stringify(first, null, 2));
  } else {
    console.log('Sheet is empty');
  }
} catch (err) {
  console.error('Error reading file:', err.message);
}
