#!/usr/bin/env node

/**
 * Create a simple Excel template for attendance import
 * Usage: node createSimpleExcelTemplate.js
 */

import * as XLSX from "xlsx";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Simple sample data - easy to copy/modify
const sampleData = [
  {
    "Employee Code": "EMP001",
    Date: "2026-03-25",
    "Check In": "08:30",
    "Check Out": "17:00",
  },
  {
    "Employee Code": "EMP002",
    Date: "2026-03-25",
    "Check In": "09:00",
    "Check Out": "17:30",
  },
  {
    "Employee Code": "EMP003",
    Date: "2026-03-25",
    "Check In": "08:45",
    "Check Out": "17:15",
  },
  {
    "Employee Code": "EMP004",
    Date: "2026-03-25",
    "Check In": "09:20",
    "Check Out": "18:00",
  },
  {
    "Employee Code": "EMP005",
    Date: "2026-03-25",
    "Check In": "08:55",
    "Check Out": "17:00",
  },
];

// Create worksheet
const ws = XLSX.utils.json_to_sheet(sampleData);

// Set column widths for readability
ws["!cols"] = [
  { wch: 18 }, // Employee Code
  { wch: 14 }, // Date
  { wch: 12 }, // Check In
  { wch: 12 }, // Check Out
];

// Create workbook
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Attendance");

// Save file
const filePath = path.join(__dirname, "AttendanceTemplate.xlsx");
XLSX.writeFile(wb, filePath);

console.log("\n✅ Excel template created successfully!\n");
console.log(`📁 File: ${filePath}\n`);
console.log("📋 Template includes:");
console.log("   - 5 sample employee records");
console.log("   - Proper column format");
console.log("   - Ready to copy/modify\n");
console.log("🚀 To use:");
console.log("   1. Open: AttendanceTemplate.xlsx");
console.log("   2. Edit employee codes and times as needed");
console.log("   3. Upload via frontend Attendance → Import Excel\n");
console.log("📝 Column formats (do NOT change):");
console.log("   - Employee Code: Text (e.g., EMP001)");
console.log("   - Date: YYYY-MM-DD (e.g., 2026-03-25)");
console.log("   - Check In: HH:MM (e.g., 08:30)");
console.log("   - Check Out: HH:MM (e.g., 17:00)\n");
