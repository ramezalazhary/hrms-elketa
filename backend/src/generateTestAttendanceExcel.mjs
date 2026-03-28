import * as XLSX from "xlsx";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const testData = [
  {
    "Employee Code": "#HR-001", // Hala HR Dir
    "Date": "2026-03-28",
    "Check In": "08:30",
    "Check Out": "17:00",
  },
  {
    "Employee Code": "#CS-003", // Huda Supp Agent
    "Date": "2026-03-28",
    "Check In": "09:30", // LATE
    "Check Out": "17:00",
  },
  {
    "Employee Code": "#FIN-001", // Sami Finance
    "Date": "2026-03-28",
    "Check In": "09:10", // PRESENT (within 15 min grace)
    "Check Out": "17:00",
  },
  {
    "Employee Code": "INVALID_CODE",
    "Date": "2026-03-28",
    "Check In": "09:00",
    "Check Out": "17:00",
  }
];

const ws = XLSX.utils.json_to_sheet(testData);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Attendance");

const filePath = path.join(__dirname, "test_attendance_import.xlsx");
XLSX.writeFile(wb, filePath);

console.log(`Generated test Excel at: ${filePath}`);
