import * as XLSX from "xlsx";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const data = [
  {
    "Employee Code": "EMP001",
    Date: "2026-03-25",
    "Check In": "08:30",
    "Check Out": "17:00",
  },
  {
    "Employee Code": "EMP002",
    Date: "2026-03-25",
    "Check In": "09:05",
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
  }, // LATE
  {
    "Employee Code": "EMP005",
    Date: "2026-03-25",
    "Check In": "08:55",
    "Check Out": "17:00",
  },
  {
    "Employee Code": "EMP006",
    Date: "2026-03-25",
    "Check In": "09:00",
    "Check Out": "17:00",
  },
  {
    "Employee Code": "EMP007",
    Date: "2026-03-25",
    "Check In": "10:00",
    "Check Out": "18:00",
  }, // VERY LATE
  {
    "Employee Code": "EMP008",
    Date: "2026-03-25",
    "Check In": "08:30",
    "Check Out": "16:30",
  },
  {
    "Employee Code": "EMP009",
    Date: "2026-03-25",
    "Check In": "09:10",
    "Check Out": "17:40",
  },
  {
    "Employee Code": "EMP010",
    Date: "2026-03-25",
    "Check In": "08:50",
    "Check Out": "17:20",
  },
];

const ws = XLSX.utils.json_to_sheet(data);

// Auto-size columns
ws["!cols"] = [
  { wch: 15 }, // Employee Code
  { wch: 12 }, // Date
  { wch: 12 }, // Check In
  { wch: 12 }, // Check Out
];

// Add header formatting (optional - basic)
const headerCells = ["A1", "B1", "C1", "D1"];
headerCells.forEach((cell) => {
  if (ws[cell]) {
    ws[cell].z = "General";
  }
});

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Attendance");

const filePath = path.join(__dirname, "SampleAttendance.xlsx");
XLSX.writeFile(wb, filePath);

console.log(`✓ Sample Excel file created at: ${filePath}`);
console.log(`  Use this template for bulk attendance import.`);
console.log(`  Columns: Employee Code | Date | Check In | Check Out`);
console.log(`  Date format: YYYY-MM-DD (e.g., 2026-03-25)`);
console.log(`  Time format: HH:MM (e.g., 08:30)`);
