import { Router } from "express";
import { Department } from "../models/Department.js";
import { Employee } from "../models/Employee.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { checkPermission } from "../middleware/permissions.js";
import {
  validateDepartmentCreation,
  validateDepartmentUpdate,
} from "../middleware/validation.js";
import { strictLimiter } from "../middleware/security.js";

const router = Router();

// GET /departments - View departments
router.get("/", requireAuth, async (req, res) => {
  const user = req.user;

  try {
    let departments;

    if (user.role === 1 || user.role === "EMPLOYEE") {
      // Employee: see only their department
      const employee = await Employee.findOne({ email: user.email });
      if (!employee) return res.json([]);
      departments = await Department.find({ name: employee.department });
    } else if (user.role === 2 || user.role === "MANAGER" || user.role === "HR_STAFF") {
      // Manager/HR: see departments they manage or all if HR
      if (user.role === "HR_STAFF") {
        departments = await Department.find();
      } else {
        departments = await Department.find({ head: user.email });
      }
    } else {
      // Admin: see all departments
      departments = await Department.find();
    }

    res.json(departments);
  } catch (error) {
    console.error("Error fetching departments:", error);
    res.status(500).json({ error: "Failed to fetch departments" });
  }
});

// GET /departments/:id - View specific department
router.get("/:id", requireAuth, async (req, res) => {
  const user = req.user;

  try {
    const department = await Department.findById(req.params.id);
    if (!department) {
      return res.status(404).json({ error: "Department not found" });
    }

    // Check access based on role
    if (user.role === 1 || user.role === "EMPLOYEE") {
      const employee = await Employee.findOne({ email: user.email });
      if (!employee || employee.department !== department.name) {
        return res.status(403).json({ error: "Access denied" });
      }
    } else if (user.role === 2 || user.role === "MANAGER") {
      if (department.head !== user.email) {
        return res.status(403).json({ error: "Access denied" });
      }
    }
    // Admin has access to all

    res.json(department);
  } catch (error) {
    console.error("Error fetching department:", error);
    res.status(500).json({ error: "Failed to fetch department" });
  }
});

// POST /departments - Create department (Admin only)
router.post(
  "/",
  requireAuth,
  requireRole(3), // Admin only
  strictLimiter, // Additional rate limiting for sensitive operations
  validateDepartmentCreation,
  async (req, res) => {
    try {
      const { name, head, positions, description, type, status, teams } = req.body;

      // Check if department already exists
      const existing = await Department.findOne({ name });
      if (existing) {
        return res.status(409).json({ error: "Department already exists" });
      }

      const newDepartment = new Department({
        name,
        head,
        description,
        type: type || "PERMANENT",
        status: status || "ACTIVE",
        positions: positions || [],
        teams: teams || [],
      });

      await newDepartment.save();
      res.status(201).json(newDepartment);
    } catch (error) {
      console.error("Error creating department:", error);
      res.status(500).json({ error: "Failed to create department" });
    }
  },
);

// PUT /departments/:id - Update department (Admin only)
router.put(
  "/:id",
  requireAuth,
  requireRole(3), // Admin only
  strictLimiter,
  validateDepartmentUpdate,
  async (req, res) => {
    try {
      const { name, head, positions, description, type, status, teams } = req.body;

      const department = await Department.findById(req.params.id);
      if (!department) {
        return res.status(404).json({ error: "Department not found" });
      }

      department.name = name ?? department.name;
      department.head = head ?? department.head;
      department.description = description ?? department.description;
      department.type = type ?? department.type;
      department.status = status ?? department.status;
      department.positions = Array.isArray(positions) ? positions : department.positions;
      department.teams = Array.isArray(teams) ? teams : department.teams;

      await department.save();
      res.json(department);
    } catch (error) {
      console.error("Error updating department:", error);
      res.status(500).json({ error: "Failed to update department" });
    }
  },
);

// DELETE /departments/:id - Delete department (Admin only)
router.delete(
  "/:id",
  requireAuth,
  requireRole(3), // Admin only
  strictLimiter,
  async (req, res) => {
    try {
      const department = await Department.findByIdAndDelete(req.params.id);
      if (!department) {
        return res.status(404).json({ error: "Department not found" });
      }

      res.json({ message: "Department deleted successfully" });
    } catch (error) {
      console.error("Error deleting department:", error);
      res.status(500).json({ error: "Failed to delete department" });
    }
  },
);

export default router;
