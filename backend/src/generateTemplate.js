import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dirPath = path.join(__dirname, 'employee data');
if (!fs.existsSync(dirPath)){
    fs.mkdirSync(dirPath, { recursive: true });
}

// Full Header Mapping for the Seeding Script (Starts at Row 6 / Index 5)
const rows = [];

// Header Rows (Rows 1-4 for info/branding)
rows.push(["HRMS ELKETA - DATA IMPORT TEMPLATE"]);
rows.push(["Instructions: Fill data starting from row 6. Do not delete or move columns."]);
rows.push([""]);
rows.push([""]);

// Row 5: Column Labels (Index 4)
const labels = [
    "S/N",              // 0
    "Employee Code*",   // 1 (Format: #IT001)
    "Name (Arabic)",    // 2
    "Name (English)*",  // 3
    "National ID",      // 4
    "Date of Birth",    // 5
    "ID Expiry Date",   // 6
    "Address",          // 7
    "City",             // 8
    "Governorate",      // 9
    "Marital Status",   // 10
    "",                 // 11
    "",                 // 12
    "Degree",           // 13
    "Grad Year",        // 14
    "Phone",            // 15
    "Emergency Phone",  // 16
    "Personal Email*",  // 17
    "Department*",      // 18
    "Position*",        // 19
    "Work Location",    // 20
    "Hire Date",        // 21
    "",                 // 22
    "Employment Type",  // 23
    "",                 // 24
    "",                 // 25
    "Base Salary",      // 26
    "Payment Method",   // 27
    "Bank Account",     // 28
    "",                 // 29
    "Social Insurance", // 30
    "", "", "", "", "", "", "", "", "", 
    "Insurance Number", // 40
    "Medical Condition",// 41
    "", "", "", "", "",
    "Work Email"        // 47
];
rows.push(labels);

// Row 6+: Example Data
const example1 = [];
example1[1] = "#IT001";
example1[2] = "أحمد محمود";
example1[3] = "Ahmed Mahmoud";
example1[4] = "29001011234567";
example1[5] = "1990-05-15";
example1[6] = "2029-01-01";
example1[7] = "Mansoura St";
example1[8] = "Mansoura";
example1[9] = "Dakahlia";
example1[10] = "متزوج";
example1[13] = "Engineering";
example1[14] = "2012";
example1[15] = "01001234567";
example1[16] = "01007654321";
example1[17] = "ahmed.m@gmail.com";
example1[18] = "Software Development";
example1[19] = "Senior Engineer";
example1[20] = "Main Office";
example1[21] = "2023-01-10";
example1[23] = "دوام كامل";
example1[26] = 15000;
example1[27] = "تحويل بنكي (فــيزا)";
example1[28] = "1234567890123456";
example1[30] = "مؤمن عليه";
example1[40] = "9988776655";
example1[41] = "None";
example1[47] = "ahmed@elketa.com";

const example2 = [];
example2[1] = "#HR002";
example2[2] = "سارة علي";
example2[3] = "Sarah Ali";
example2[4] = "29502021234567";
example2[5] = "1995-10-20";
example2[6] = "2027-12-31";
example2[7] = "Maadi";
example2[8] = "Cairo";
example2[9] = "Cairo";
example2[10] = "آنسة";
example2[13] = "Business";
example2[14] = "2017";
example2[15] = "01234567890";
example2[16] = "01234567891";
example2[17] = "sarah.a@gmail.com";
example2[18] = "HR";
example2[19] = "HR Coordinator";
example2[20] = "HQ";
example2[21] = "2022-06-01";
example2[23] = "دوام كامل";
example2[26] = 8000;
example1[27] = "كاش";
example2[28] = "";
example2[30] = "غير مؤمن";
example2[40] = "";
example2[41] = "Asthma";
example2[47] = "sarah@elketa.com";

rows.push(example1, example2);

const ws = XLSX.utils.aoa_to_sheet(rows);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Employees");

const outPath = path.join(dirPath, 'HRMS_Import_Template.xlsx');
XLSX.writeFile(wb, outPath);

console.log("Success: Template created at " + outPath);
