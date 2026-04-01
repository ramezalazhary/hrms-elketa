import { Router } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import { Employee } from "../models/Employee.js";
import { Department } from "../models/Department.js";
import { Team } from "../models/Team.js";
import { Position } from "../models/Position.js";
import { OrganizationPolicy } from "../models/OrganizationPolicy.js";
import { Attendance } from "../models/Attendance.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();
const upload = multer({ dest: "uploads/" });
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * GET /api/bulk/template
 * Downloads the standardized Excel template for data imports.
 */
router.get("/template", requireAuth, requireRole(3), (req, res) => {
  const templatePath = path.join(__dirname, "..", "..", "HRMS_Template.xlsx");
  if (!fs.existsSync(templatePath)) {
    return res.status(404).json({ error: "Template file not found on server." });
  }
  res.download(templatePath, "HRMS_Template.xlsx");
});

/**
 * POST /api/bulk/upload
 * Clears existing organizational data and imports new records from the uploaded Excel file.
 */
router.post("/upload", requireAuth, requireRole(3), upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file provided for upload." });

  try {
    const workbook = XLSX.readFile(req.file.path);
    const passwordHash = await bcrypt.hash("emp123", 10);

    // 1. Wipe current state
    await Promise.all([
      Employee.deleteMany({}),
      Department.deleteMany({}),
      Team.deleteMany({}),
      Position.deleteMany({}),
      OrganizationPolicy.deleteMany({}),
      Attendance.deleteMany({}),
    ]);

    // 2. Import Branches (Organization Policy)
    const branchData = XLSX.utils.sheet_to_json(workbook.Sheets["Branches"]);
    if (branchData.length > 0) {
      const locationsMap = new Map();
      branchData.forEach(row => {
        const key = `${row.Governorate}|${row.City}`;
        if (!locationsMap.has(key)) locationsMap.set(key, []);
        if (row['Branch Name']) locationsMap.get(key).push(row['Branch Name']);
      });

      const workLocations = Array.from(locationsMap.entries()).map(([key, branches]) => {
        const [governorate, city] = key.split('|');
        return { governorate, city, branches };
      });

      await OrganizationPolicy.create({ name: "default", workLocations });
    }

    // 3. Import Departments
    const deptRows = XLSX.utils.sheet_to_json(workbook.Sheets["Departments"]);
    const depts = await Department.insertMany(deptRows.map(r => ({
      name: r['Dept Name'],
      code: r['Dept Code'],
      headTitle: r['Head Title'] || "Department Head"
    })));

    // 4. Import Teams
    const teamRows = XLSX.utils.sheet_to_json(workbook.Sheets["Teams"]);
    const teams = [];
    for (const r of teamRows) {
      const dept = depts.find(d => d.name === r['Department Name']);
      if (dept) {
        teams.push(await Team.create({
          name: r['Team Name'],
          departmentId: dept._id,
          description: r['Description']
        }));
      }
    }

    // 5. Import Positions
    const posRows = XLSX.utils.sheet_to_json(workbook.Sheets["Positions"]);
    for (const r of posRows) {
      const dept = depts.find(d => d.name === r['Department Name']);
      if (dept) {
        await Position.create({
          title: r['Title'],
          level: r['Level'] || "Mid",
          departmentId: dept._id,
          responsibility: r['Responsibility']
        });
      }
    }

    // 6. Import Employees
    const empRows = XLSX.utils.sheet_to_json(workbook.Sheets["Employees"]);
    const employees = [];
    for (const r of empRows) {
      const dept = depts.find(d => d.name === r['Department']);
      const team = teams.find(t => t.name === r['Team']);
      
      const emp = await Employee.create({
        fullName: r['Full Name'],
        fullNameArabic: r['Full Name Arabic'],
        email: r['Email'],
        employeeCode: r['Employee Code'],
        role: r['Role'] || "EMPLOYEE",
        position: r['Position'],
        department: r['Department'],
        departmentId: dept?._id,
        teamId: team?._id,
        passwordHash,
        dateOfHire: r['Date of Hire'] ? new Date(r['Date of Hire']) : undefined,
        financial: { baseSalary: Number(r['Base Salary']) || 0 },
        idNumber: r['National ID'],
        nationalIdExpiryDate: r['ID Expiry Date'] ? new Date(r['ID Expiry Date']) : undefined,
        status: "ACTIVE"
      });
      employees.push(emp);
    }

    // Post-processing: Link managers/leads based on role
    // (In a real system, we might need manager emails in the sheet to link correctly, 
    // but for this template, we assume managers/leads are created and we link them by hierarchy level)
    for (const emp of employees) {
      if (emp.role === "EMPLOYEE") {
        const lead = employees.find(e => e.role === "TEAM_LEADER" && e.departmentId?.equals(emp.departmentId));
        const manager = employees.find(e => e.role === "MANAGER" && e.departmentId?.equals(emp.departmentId));
        if (lead) emp.teamLeaderId = lead._id;
        if (manager) emp.managerId = manager._id;
        await emp.save();
      }
    }

    res.json({ message: "Synchronization complete. Organizations and personnel have been updated." });
  } catch (error) {
    console.error("Bulk upload failed:", error);
    res.status(500).json({ error: "Excel parsing failed. Please check your templates and try again." });
  } finally {
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
  }
});

export default router;
