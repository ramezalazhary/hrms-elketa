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
    "Employee Code": "admin@hr.local",
    Date: "2026-03-25",
    "Check In": "08:30:00 AM",
    "Check Out": "05:00:00 PM",
  },
  {
    "Employee Code": "#HR-003",
    Date: "2026-03-25",
    "Check In": "09:00:00 AM",
    "Check Out": "05:30:00 PM",
  },
  {
    "Employee Code": "hr@company.com",
    Date: "2026-03-25",
    "Check In": "08:45:00 AM",
    "Check Out": "05:15:00 PM",
  },
  {
    "Employee Code": "HR_20020",
    Date: "2026-03-25",
    "Check In": "09:20:00 AM",
    "Check Out": "06:00:00 PM",
  },
  {
    "Employee Code": "demo.employee.17747781409559@example.com",
    Date: "2026-03-25",
    "Check In": "08:55:00 AM",
    "Check Out": "05:00:00 PM",
  },
];

// Create worksheet
const ws = XLSX.utils.json_to_sheet(sampleData);

// Set column widths for readability
ws["!cols"] = [
  { wch: 18 }, // Employee Code
  { wch: 14 }, // Date
  { wch: 15 }, // Check In
  { wch: 15 }, // Check Out
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
console.log("   - Employee Code: Text (e.g., admin@hr.local)");
console.log("   - Date: YYYY-MM-DD (e.g., 2026-03-25)");
console.log("   - Check In: HH:MM:SS AM/PM (e.g., 08:30:00 AM)");
console.log("   - Check Out: HH:MM:SS AM/PM (e.g., 05:00:00 PM)\n");
