/**
 * @file `/api/teams` — list/read for authenticated users; mutations gated by `isAdmin` / `requireRole(3)`.
 */
import { Router } from "express";
import { Team } from "../models/Team.js";
import { Department } from "../models/Department.js";
import { Employee } from "../models/Employee.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { strictLimiter } from "../middleware/security.js";

const router = Router();

/**
 * @param {{ role: string|number }} user `req.user`
 * @returns {boolean} True for numeric 3 or `"ADMIN"` string.
 */
function isAdmin(user) {
  return user.role === 3 || user.role === "ADMIN";
}

// GET /teams - List all teams (with optional filtering)
router.get("/", requireAuth, async (req, res) => {
  try {
    const { departmentId } = req.query;
    let query = {};

    if (departmentId) {
      // Validate ObjectId format
      if (!departmentId.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({ error: "Invalid department ID format" });
      }
      query.departmentId = departmentId;
    }

    const teams = await Team.find(query)
      .populate("departmentId", "name")
      .sort({ createdAt: -1 });

    res.json(teams);
  } catch (error) {
    console.error("Error fetching teams:", error);
    res.status(500).json({ error: "Failed to fetch teams" });
  }
});

// GET /teams/:id - Get single team with employee count
router.get("/:id", requireAuth, async (req, res) => {
  try {
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: "Invalid team ID format" });
    }

    const team = await Team.findById(req.params.id).populate(
      "departmentId",
      "name",
    );
    if (!team) {
      return res.status(404).json({ error: "Team not found" });
    }

    // Count employees in this team
    const employeeCount = await Employee.countDocuments({ teamId: team._id });

    res.json({
      ...team.toJSON(),
      employeeCount,
    });
  } catch (error) {
    console.error("Error fetching team:", error);
    res.status(500).json({ error: "Failed to fetch team" });
  }
});

// POST /teams - Create new team (Admin only)
router.post(
  "/",
  requireAuth,
  requireRole(3), // Admin only
  strictLimiter,
  async (req, res) => {
    try {
      const {
        name,
        departmentId,
        leaderEmail,
        leaderTitle,
        leaderResponsibility,
        members,
        description,
        positions,
        status,
      } = req.body;

      // Validation
      if (!name || !name.trim()) {
        return res.status(400).json({ error: "Team name is required" });
      }

      if (!departmentId) {
        return res.status(400).json({ error: "Department ID is required" });
      }

      // Validate department ID format
      if (!departmentId.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({ error: "Invalid department ID format" });
      }

      // Verify department exists
      const department = await Department.findById(departmentId);
      if (!department) {
        return res.status(404).json({ error: "Department not found" });
      }

      // Strict Departmental Validation
      const deptName = department.name;
      
      if (leaderEmail) {
        const leaderEmp = await Employee.findOne({ email: leaderEmail });
        if (!leaderEmp) {
          return res.status(400).json({ error: `Leader with email ${leaderEmail} not found.` });
        }
        if (leaderEmp.department !== deptName && leaderEmp.departmentId?.toString() !== departmentId) {
          return res.status(400).json({ error: `Leader ${leaderEmail} does not belong to the ${deptName} department.` });
        }
      }

      if (members && Array.isArray(members)) {
        for (const email of members) {
          const memberEmp = await Employee.findOne({ email });
          if (!memberEmp) {
            return res.status(400).json({ error: `Member with email ${email} not found.` });
          }
          if (memberEmp.department !== deptName && memberEmp.departmentId?.toString() !== departmentId) {
            return res.status(400).json({ error: `Member ${email} does not belong to the ${deptName} department.` });
          }
        }
      }

      // Check if team name already exists in this department
      const existingTeam = await Team.findOne({
        name: name.trim(),
        departmentId,
      });
      if (existingTeam) {
        return res
          .status(409)
          .json({ error: "Team name already exists in this department" });
      }

      const newTeam = new Team({
        name: name.trim(),
        departmentId,
        leaderEmail,
        leaderTitle: leaderTitle || "Team Leader",
        leaderResponsibility: leaderResponsibility || "",
        members: members || [],
        description,
        positions: positions || [],
        status: status || "ACTIVE",
      });

      await newTeam.save();
      await Team.populate(newTeam, { path: "departmentId", select: "name" });

      res.status(201).json({
        message: "Team created successfully",
        team: newTeam.toJSON(),
      });
    } catch (error) {
      console.error("Team creation error:", error);
      res.status(500).json({ error: "Failed to create team" });
    }
  },
);

// PUT /teams/:id - Update team (Admin only)
router.put(
  "/:id",
  requireAuth,
  requireRole(3), // Admin only
  strictLimiter,
  async (req, res) => {
    try {
      if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({ error: "Invalid team ID format" });
      }

      const team = await Team.findById(req.params.id);
      if (!team) {
        return res.status(404).json({ error: "Team not found" });
      }

      const { name, leaderEmail, leaderTitle, leaderResponsibility, members, description, positions, status } = req.body;

      // Validation for Leader/Members if they are being updated
      const department = await Department.findById(team.departmentId);
      const deptName = department.name;

      if (leaderEmail !== undefined && leaderEmail !== "") {
        const leaderEmp = await Employee.findOne({ email: leaderEmail });
        if (!leaderEmp) {
          return res.status(400).json({ error: `Leader with email ${leaderEmail} not found.` });
        }
        if (leaderEmp.department !== deptName && leaderEmp.departmentId?.toString() !== team.departmentId.toString()) {
          return res.status(400).json({ error: `Leader ${leaderEmail} does not belong to the ${deptName} department.` });
        }
      }

      if (members !== undefined && Array.isArray(members)) {
        for (const email of members) {
          const memberEmp = await Employee.findOne({ email });
          if (!memberEmp) {
            return res.status(400).json({ error: `Member with email ${email} not found.` });
          }
          if (memberEmp.department !== deptName && memberEmp.departmentId?.toString() !== team.departmentId.toString()) {
            return res.status(400).json({ error: `Member ${email} does not belong to the ${deptName} department.` });
          }
        }
      }

      // Update fields
      if (name !== undefined) {
        if (!name.trim()) {
          return res.status(400).json({ error: "Team name cannot be empty" });
        }

        // Check if new name conflicts with other teams in same department
        const conflictTeam = await Team.findOne({
          name: name.trim(),
          departmentId: team.departmentId,
          _id: { $ne: team._id },
        });
        if (conflictTeam) {
          return res
            .status(409)
            .json({ error: "Team name already exists in this department" });
        }

        team.name = name.trim();
      }

      if (leaderEmail !== undefined) team.leaderEmail = leaderEmail;
      if (leaderTitle !== undefined) team.leaderTitle = leaderTitle;
      if (leaderResponsibility !== undefined) team.leaderResponsibility = leaderResponsibility;
      if (members !== undefined) team.members = Array.isArray(members) ? members : [];
      if (description !== undefined) team.description = description;
      if (positions !== undefined) team.positions = Array.isArray(positions) ? positions : team.positions;
      
      if (status !== undefined) {
        if (!["ACTIVE", "ARCHIVED"].includes(status)) {
          return res.status(400).json({ error: "Invalid status value" });
        }
        team.status = status;
      }

      await team.save();
      await Team.populate(team, { path: "departmentId", select: "name" });

      res.json({
        message: "Team updated successfully",
        team: team.toJSON(),
      });
    } catch (error) {
      console.error("Team update error:", error);
      res.status(500).json({ error: "Failed to update team" });
    }
  },
);

// DELETE /teams/:id - Delete team (Admin only)
router.delete(
  "/:id",
  requireAuth,
  requireRole(3), // Admin only
  strictLimiter,
  async (req, res) => {
    try {
      if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({ error: "Invalid team ID format" });
      }

      const team = await Team.findById(req.params.id);
      if (!team) {
        return res.status(404).json({ error: "Team not found" });
      }

      // Check if employees are assigned to this team
      const employeeCount = await Employee.countDocuments({ teamId: team._id });

      if (employeeCount > 0) {
        const force = req.query.force === "true";

        if (!force) {
          return res.status(409).json({
            error: `Cannot delete team: ${employeeCount} employee(s) assigned`,
            employeeCount,
            suggestion:
              "Use ?force=true to proceed (will set team to null for affected employees)",
          });
        }

        // Force delete: unassign employees
        await Employee.updateMany(
          { teamId: team._id },
          { $set: { teamId: null, team: null } },
        );

        console.log(
          `Force deleted team ${team._id}: unassigned ${employeeCount} employees`,
        );
      }

      await Team.findByIdAndDelete(team._id);

      res.json({
        message: "Team deleted successfully",
        deletedTeamId: team._id,
        employeesUnassigned: employeeCount,
      });
    } catch (error) {
      console.error("Team deletion error:", error);
      res.status(500).json({ error: "Failed to delete team" });
    }
  },
);

export default router;
