import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure directory exists
const dirPath = path.join(__dirname, 'employee data');
if (!fs.existsSync(dirPath)){
    fs.mkdirSync(dirPath, { recursive: true });
}

// Data structure: The current seeding script expects data starting at index 5 (Row 6)
const data = [];

// Create 5 empty/header rows to match the old format's layout
for (let i = 0; i < 5; i++) {
  data.push([]);
}

// --- Row 6 (Index 5) : Employee 1 (Standard Case) ---
const row1 = [];
row1[1] = "#IT001";                           // [1] Code
row1[2] = "أحمد محمد";                        // [2] Arabic Name
row1[3] = "Ahmed Mohamed";                    // [3] English Name
row1[4] = "29001011234567";                   // [4] ID Number
row1[5] = new Date("1990-01-01");             // [5] DOB
row1[6] = new Date("2028-01-01");             // [6] ID Expiry
row1[7] = "123 Main St";                      // [7] Address
row1[8] = "Nasr City";                        // [8] City
row1[9] = "Cairo";                            // [9] Governorate
row1[10] = "أعزب";                            // [10] Marital status (Single)
row1[13] = "BSc Computer Science";            // [13] Degree
row1[14] = "2012";                            // [14] Grad Year
row1[15] = "01000000001";                     // [15] Phone
row1[16] = "01000000002";                     // [16] Emergency Phone
row1[17] = "ahmed@elketa.com";                // [17] Email
row1[18] = "IT";                              // [18] Department
row1[19] = "Senior Developer";                // [19] Position
row1[20] = "HQ Branch";                       // [20] Work Location
row1[21] = new Date("2020-05-01");            // [21] Date of Hire
row1[23] = "دوام كامل";                       // [23] Employment Type (Full Time)
row1[26] = "25000";                           // [26] Base Salary
row1[27] = "تحويل بنكي (فــيزا)";             // [27] Payment Method (Bank Transfer)
row1[28] = "112233445566";                    // [28] Bank Account
row1[30] = "مؤمن عليه";                       // [30] Insurance Status (Insured)
row1[40] = "99887766";                        // [40] Insurance Number
row1[41] = "None";                            // [41] Medical Condition
row1[47] = "ahmed.work@elketa.internal";      // [47] Work Email

// --- Row 7 (Index 6) : Employee 2 (Expiring ID, Cash Payment) ---
const row2 = [];
row2[1] = "#HR002"; 
row2[2] = "سارة حسن"; 
row2[3] = "Sarah Hassan"; 
row2[4] = "29202021234567"; 
row2[5] = new Date("1992-02-02");
// ID Expiring exactly 15 days from now to test "Expiring Soon" analytics
row2[6] = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000); 
row2[7] = "456 Side St"; 
row2[8] = "Maadi"; 
row2[9] = "Cairo"; 
row2[10] = "متزوج";
row2[13] = "BA Business";
row2[14] = "2014";
row2[15] = "01200000001";
row2[16] = "01200000002";
row2[17] = "sarah@elketa.com";
row2[18] = "HR";
row2[19] = "HR Manager";
row2[20] = "HQ Branch";
row2[21] = new Date("2021-08-15");
row2[23] = "دوام كامل";
row2[26] = "30000";
row2[27] = "كاش";
row2[28] = "";
row2[30] = "غير مؤمن";
row2[40] = "";
row2[41] = "";
row2[47] = "sarah.hr@elketa.internal";

data.push(row1, row2);

const ws = XLSX.utils.aoa_to_sheet(data);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

const outPath = path.join(dirPath, 'demo_data.xlsx');
XLSX.writeFile(wb, outPath);
console.log("Created demo_data.xlsx successfully at:", outPath);
