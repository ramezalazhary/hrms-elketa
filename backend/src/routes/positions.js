/**
 * @file `/api/positions` — CRUD-ish on job positions; writes allowed for Admin + `HR_STAFF` via `canManagePositions`.
 */
import { Router } from "express";
import { Position } from "../models/Position.js";
import { Department } from "../models/Department.js";
import { Team } from "../models/Team.js";
import { Employee } from "../models/Employee.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { strictLimiter } from "../middleware/security.js";
import { canManagePositions } from "../utils/roles.js";

const router = Router();

// GET /positions - List all positions (with optional filtering)
router.get("/", requireAuth, async (req, res) => {
  try {
    const { departmentId, teamId, status } = req.query;
    let query = {};

    if (departmentId) {
      if (!departmentId.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({ error: "Invalid department ID format" });
      }
      query.departmentId = departmentId;
    }

    if (teamId) {
      if (!teamId.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({ error: "Invalid team ID format" });
      }
      query.teamId = teamId;
    }

    if (status) {
      if (!["ACTIVE", "INACTIVE"].includes(status)) {
        return res.status(400).json({ error: "Invalid status value" });
      }
      query.status = status;
    }

    const positions = await Position.find(query)
      .populate("departmentId", "name")
      .populate("teamId", "name")
      .sort({ title: 1, level: 1 });

    res.json(positions);
  } catch (error) {
    console.error("Error fetching positions:", error);
    res.status(500).json({ error: "Failed to fetch positions" });
  }
});

// GET /positions/:id - Get single position with employee count
router.get("/:id", requireAuth, async (req, res) => {
  try {
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: "Invalid position ID format" });
    }

    const position = await Position.findById(req.params.id)
      .populate("departmentId", "name")
      .populate("teamId", "name");

    if (!position) {
      return res.status(404).json({ error: "Position not found" });
    }

    // Count employees with this position
    const employeeCount = await Employee.countDocuments({
      positionId: position._id,
    });

    res.json({
      ...position.toJSON(),
      employeeCount,
    });
  } catch (error) {
    console.error("Error fetching position:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /positions - Create new position (Admin + HR_STAFF)
router.post("/", requireAuth, strictLimiter, async (req, res) => {
  try {
    if (!canManagePositions(req.user)) {
      return res.status(403).json({
        error: "Forbidden: Only Admin and HR_STAFF can create positions",
      });
    }

    const { title, level, departmentId, teamId, description, status } =
      req.body;

    // Validation
    if (!title || !title.trim()) {
      return res.status(400).json({ error: "Position title is required" });
    }

    if (!departmentId) {
      return res.status(400).json({ error: "Department ID is required" });
    }

    // Validate ObjectId formats
    if (!departmentId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: "Invalid department ID format" });
    }

    if (teamId && !teamId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: "Invalid team ID format" });
    }

    // Verify department exists
    const department = await Department.findById(departmentId);
    if (!department) {
      return res.status(404).json({ error: "Department not found" });
    }

    // If teamId provided, verify team exists and belongs to department
    if (teamId) {
      const team = await Team.findById(teamId);
      if (!team) {
        return res.status(404).json({ error: "Team not found" });
      }
      if (team.departmentId.toString() !== departmentId) {
        return res
          .status(400)
          .json({ error: "Team does not belong to specified department" });
      }
    }

    const newPosition = new Position({
      title: title.trim(),
      level: level || "Mid",
      departmentId,
      teamId: teamId || null,
      description: description || "",
      status: status || "ACTIVE",
    });

    await newPosition.save();
    await Position.populate(newPosition, [
      { path: "departmentId", select: "name" },
      { path: "teamId", select: "name" },
    ]);

    res.status(201).json({
      message: "Position created successfully",
      position: newPosition.toJSON(),
    });
  } catch (error) {
    console.error("Position creation error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /positions/:id - Update position (Admin + HR_STAFF)
router.put("/:id", requireAuth, strictLimiter, async (req, res) => {
  try {
    if (!canManagePositions(req.user)) {
      return res.status(403).json({
        error: "Forbidden: Only Admin and HR_STAFF can update positions",
      });
    }

    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: "Invalid position ID format" });
    }

    const position = await Position.findById(req.params.id);
    if (!position) {
      return res.status(404).json({ error: "Position not found" });
    }

    const { title, level, teamId, description, status } = req.body;

    // Update fields
    if (title !== undefined) {
      if (!title.trim()) {
        return res
          .status(400)
          .json({ error: "Position title cannot be empty" });
      }
      position.title = title.trim();
    }

    if (level !== undefined) {
      const validLevels = ["Junior", "Mid", "Senior", "Lead", "Executive"];
      if (level && !validLevels.includes(level)) {
        return res.status(400).json({ error: "Invalid level value" });
      }
      position.level = level;
    }

    if (teamId !== undefined) {
      if (teamId) {
        if (!teamId.match(/^[0-9a-fA-F]{24}$/)) {
          return res.status(400).json({ error: "Invalid team ID format" });
        }
        const team = await Team.findById(teamId);
        if (!team) {
          return res.status(404).json({ error: "Team not found" });
        }
        if (team.departmentId.toString() !== position.departmentId.toString()) {
          return res.status(400).json({
            error: "Team does not belong to this position's department",
          });
        }
      }
      position.teamId = teamId || null;
    }

    if (description !== undefined) position.description = description;

    if (status !== undefined) {
      if (!["ACTIVE", "INACTIVE"].includes(status)) {
        return res.status(400).json({ error: "Invalid status value" });
      }
      position.status = status;
    }

    await position.save();
    await position.populate("departmentId", "name");
    if (position.teamId) {
      await position.populate("teamId", "name");
    }

    res.json({
      message: "Position updated successfully",
      position: position.toJSON(),
    });
  } catch (error) {
    console.error("Position update error:", error);
    res.status(500).json({ error: "Failed to update position" });
  }
});

// DELETE /positions/:id - Delete position (Admin only)
router.delete(
  "/:id",
  requireAuth,
  requireRole(3), // Admin only
  strictLimiter,
  async (req, res) => {
    try {
      if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({ error: "Invalid position ID format" });
      }

      const position = await Position.findById(req.params.id);
      if (!position) {
        return res.status(404).json({ error: "Position not found" });
      }

      // Check if employees are assigned to this position
      const employeeCount = await Employee.countDocuments({
        positionId: position._id,
      });

      if (employeeCount > 0) {
        const force = req.query.force === "true";

        if (!force) {
          return res.status(409).json({
            error: `Cannot delete position: ${employeeCount} employee(s) assigned`,
            employeeCount,
            suggestion:
              "Use ?force=true to proceed (will set position to null for affected employees)",
          });
        }

        // Force delete: unassign employees
        await Employee.updateMany(
          { positionId: position._id },
          { $set: { positionId: null, position: null } },
        );

        console.log(
          `Force deleted position ${position._id}: unassigned ${employeeCount} employees`,
        );
      }

      await Position.findByIdAndDelete(position._id);

      res.json({
        message: "Position deleted successfully",
        deletedPositionId: position._id,
        employeesUnassigned: employeeCount,
      });
    } catch (error) {
      console.error("Position deletion error:", error);
      res.status(500).json({ error: "Failed to delete position" });
    }
  },
);

export default router;
