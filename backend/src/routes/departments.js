/**
 * @file `/api/departments` — read filtered by role; create/update/delete require legacy `requireRole(3)` (Admin numeric gate).
 */
import { Router } from "express";
import { Department } from "../models/Department.js";
import { Employee } from "../models/Employee.js";
import { Team } from "../models/Team.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
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
    } else if (user.role === 2 || user.role === "MANAGER" || user.role === "HR_STAFF" || user.role === "TEAM_LEADER") {
      // Manager/HR/Leader: see departments they manage or all if HR
      if (user.role === "HR_STAFF") {
        departments = await Department.find();
      } else if (user.role === "TEAM_LEADER") {
        // Special: Team Leader sees departments where they lead a team
        departments = await Department.find({ "teams.leaderEmail": user.email });
      } else {
        departments = await Department.find({ head: user.email });
      }
    } else {
      // Admin: see all departments
      departments = await Department.find();
    }

    // After fetching departments, merge standalone teams if they've migrated
    const allTeams = await Team.find({ status: "ACTIVE" });
    const departmentsWithTeams = departments.map(dept => {
      const deptObj = dept.toObject();
      // If dept already has teams or hasMigratedTeams is false, we might still have standalone teams
      const standalone = allTeams.filter(t => t.departmentId.toString() === deptObj.id);
      if (standalone.length > 0) {
        deptObj.teams = [...(deptObj.teams || []), ...standalone];
      }
      return deptObj;
    });

    res.json(departmentsWithTeams);
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

    const standaloneTeams = await Team.find({ departmentId: department._id, status: "ACTIVE" });
    const deptObj = department.toObject();
    if (standaloneTeams.length > 0) {
      deptObj.teams = [...(deptObj.teams || []), ...standaloneTeams];
    }

    res.json(deptObj);
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
      const { name, code, head, headTitle, headResponsibility, positions, description, type, status, teams, requiredDocuments } = req.body;

      // Check if department or code already exists
      const existing = await Department.findOne({ $or: [{ name }, { code }] });
      if (existing) {
        return res.status(409).json({ error: "Department or code already exists" });
      }

      if (head) {
        const headEmp = await Employee.findOne({ email: head });
        if (!headEmp) {
          return res.status(400).json({ error: `Leader with email ${head} not found.` });
        }
        // For new departments, the employee might not have the department name set yet.
        // We'll check if they are explicitly assigned to ANOTHER existing department.
        if (headEmp.department && headEmp.department !== name) {
          // If the department name matches what we ARE creating, it's fine.
          // Otherwise, they are in a different department.
          return res.status(400).json({ error: `Leader ${head} belongs to ${headEmp.department}, not ${name}.` });
        }
      }

      const headEmail =
        head && typeof head === "string" && head.trim() ? head.trim() : undefined;

      const newDepartment = new Department({
        name,
        code,
        head: headEmail,
        headTitle: headTitle || "Department Leader",
        headResponsibility: headResponsibility || "",
        description,
        type: type || "PERMANENT",
        status: status || "ACTIVE",
        positions: positions || [],
        requiredDocuments: requiredDocuments || [],
        teams: (teams || []).map(t => ({
          ...t,
          leaderEmail: t.leaderEmail || t.manager || t.managerEmail,
          leaderTitle: t.leaderTitle || "Team Leader",
          leaderResponsibility: t.leaderResponsibility || ""
        })),
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
      const { name, code, head, headTitle, headResponsibility, positions, description, type, status, teams, requiredDocuments } = req.body;

      const department = await Department.findById(req.params.id);
      if (!department) {
        return res.status(404).json({ error: "Department not found" });
      }

      const currentName = name ?? department.name;

      // Check if new name or code is taken by another department
      const conflict = await Department.findOne({
        _id: { $ne: req.params.id },
        $or: [
          { name: currentName },
          { code: code !== undefined ? code : department.code }
        ].filter(Boolean)
      });

      if (conflict) {
        const field = conflict.name === currentName ? "name" : "code";
        return res.status(409).json({ error: `Department ${field} already exists` });
      }

      if (head !== undefined && head !== null && head !== "") {
        const headEmp = await Employee.findOne({ email: head });
        if (!headEmp) {
          return res.status(400).json({ error: `Leader with email ${head} not found.` });
        }
        // Support renaming: Allow if the employee is already assigned to this department (by ID or legacy name)
        if (headEmp.departmentId?.toString() !== req.params.id && headEmp.department !== department.name && name !== headEmp.department) {
          return res.status(400).json({ error: `Leader ${head} belongs to ${headEmp.department}, not ${currentName}.` });
        }
      }

      department.name = currentName;
      if (code !== undefined) department.code = code;
      if (head !== undefined) {
        department.head =
          head && typeof head === "string" && head.trim() ? head.trim() : null;
      }
      if (headTitle !== undefined) department.headTitle = headTitle;
      if (headResponsibility !== undefined) department.headResponsibility = headResponsibility;

      department.description = description ?? department.description;
      department.type = type ?? department.type;
      department.status = status ?? department.status;
      department.positions = Array.isArray(positions) ? positions : department.positions;
      department.requiredDocuments = Array.isArray(requiredDocuments) ? requiredDocuments : department.requiredDocuments;

      if (Array.isArray(teams)) {
        // Validate team leaders and members departmental integrity
        for (const t of teams) {
          const leaderEmail = t.leaderEmail || t.manager || t.managerEmail;
          if (leaderEmail) {
            const leader = await Employee.findOne({ email: leaderEmail });
            if (!leader || (leader.department !== currentName && leader.departmentId?.toString() !== req.params.id)) {
              return res.status(400).json({
                error: `Team leader ${leaderEmail} must belong to department ${currentName}`
              });
            }
          }

          if (Array.isArray(t.members)) {
            for (const memberEmail of t.members) {
              const member = await Employee.findOne({ email: memberEmail });
              if (!member || (member.department !== currentName && member.departmentId?.toString() !== req.params.id)) {
                return res.status(400).json({
                  error: `Team member ${memberEmail} must belong to department ${currentName}`
                });
              }
            }
          }
        }

        department.teams = teams.map(t => ({
          ...t,
          leaderEmail: t.leaderEmail || t.manager || t.managerEmail || "",
          leaderTitle: t.leaderTitle || "Team Leader",
          leaderResponsibility: t.leaderResponsibility || "",
          members: Array.isArray(t.members) ? t.members : []
        }));
      }

      const isRenaming = name && name !== department.name;
      await department.save();

      // If renaming, synchronize the department name for all assigned employees
      if (isRenaming) {
        await Employee.updateMany(
          { departmentId: department._id },
          { $set: { department: department.name } }
        );
        // Also update legacy-style assignments that might not have ID yet
        await Employee.updateMany(
          { department: department._id?.toString() }, // some legacy code uses ID in the name field
          { $set: { department: department.name, departmentId: department._id } }
        );
      }

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
      const departmentId = req.params.id;
      const department = await Department.findById(departmentId);

      if (!department) {
        return res.status(404).json({ error: "Department not found" });
      }

      const deptName = department.name;

      // 1. Update all employees to be "Unassigned / Unemployed"
      // We check both departmentId (new system) and department name (legacy compatibility)
      await Employee.updateMany(
        {
          $or: [
            { departmentId: departmentId },
            { department: deptName }
          ]
        },
        {
          $set: {
            departmentId: null,
            department: "Unassigned / Unemployed",
            teamId: null,
            team: null,
            managerId: null
          }
        }
      );

      // 2. Delete associated teams in the standalone Team collection
      await Team.deleteMany({ departmentId: departmentId });

      // 3. Finally delete the department
      await Department.findByIdAndDelete(departmentId);

      res.json({
        message: "Department deleted successfully. All assigned employees have been transitioned to 'Unassigned / Unemployed' status."
      });
    } catch (error) {
      console.error("Error deleting department:", error);
      res.status(500).json({ error: "Failed to delete department" });
    }
  },
);

export default router;
