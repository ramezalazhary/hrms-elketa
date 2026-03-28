/**
 * @file `/api/employments` — assign/unassign employees to department/team/position; restricted to Admin + HR_STAFF.
 */
import { Router } from "express";
import { Employee } from "../models/Employee.js";
import { Department } from "../models/Department.js";
import { Team } from "../models/Team.js";
import { Position } from "../models/Position.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { strictLimiter } from "../middleware/security.js";

const router = Router();

/**
 * @param {{ role: string|number }} user
 * @returns {boolean}
 */
function canManageEmployments(user) {
  return user.role === 3 || user.role === "ADMIN" || user.role === "HR_STAFF";
}

// POST /employments/assign - Assign employee to department/team/position
router.post("/assign", requireAuth, strictLimiter, async (req, res) => {
  try {
    if (!canManageEmployments(req.user)) {
      return res
        .status(403)
        .json({
          error: "Forbidden: Only Admin and HR_STAFF can assign employees",
        });
    }

    const { employeeId, departmentId, teamId, positionId, isPrimary } =
      req.body;

    // Validation
    if (!employeeId) {
      return res.status(400).json({ error: "Employee ID is required" });
    }

    if (!departmentId) {
      return res.status(400).json({ error: "Department ID is required" });
    }

    // Validate ObjectId formats
    if (!employeeId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: "Invalid employee ID format" });
    }

    if (!departmentId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: "Invalid department ID format" });
    }

    if (teamId && !teamId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: "Invalid team ID format" });
    }

    if (positionId && !positionId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: "Invalid position ID format" });
    }

    // Verify employee exists
    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }

    // Verify department exists and is ACTIVE
    const department = await Department.findById(departmentId);
    if (!department) {
      return res.status(404).json({ error: "Department not found" });
    }
    if (department.status !== "ACTIVE") {
      return res
        .status(400)
        .json({ error: "Cannot assign to inactive department" });
    }

    // Verify team (if provided) exists and belongs to department
    if (teamId) {
      const team = await Team.findById(teamId);
      if (!team) {
        return res.status(404).json({ error: "Team not found" });
      }
      if (team.departmentId?.toString() !== departmentId) {
        return res
          .status(400)
          .json({ error: "Team does not belong to specified department" });
      }
      if (team.status !== "ACTIVE") {
        return res
          .status(400)
          .json({ error: "Cannot assign to inactive team" });
      }
    }

    // Verify position (if provided) exists and belongs to department
    if (positionId) {
      const position = await Position.findById(positionId);
      if (!position) {
        return res.status(404).json({ error: "Position not found" });
      }
      if (position.departmentId.toString() !== departmentId) {
        return res
          .status(400)
          .json({ error: "Position does not belong to specified department" });
      }
      if (position.status !== "ACTIVE") {
        return res
          .status(400)
          .json({ error: "Cannot assign to inactive position" });
      }
    }

    const markAsPrimary = isPrimary !== false; // Default to true

    // If marking as primary and employee already has primary assignment
    if (markAsPrimary && employee.departmentId) {
      // Move current primary to additionalAssignments
      if (!employee.additionalAssignments) {
        employee.additionalAssignments = [];
      }

      employee.additionalAssignments.push({
        departmentId: employee.departmentId,
        teamId: employee.teamId || undefined,
        positionId: employee.positionId || undefined,
        isPrimary: true,
        startDate: employee.dateOfHire || new Date(),
      });
    }

    // Update primary assignment
    employee.departmentId = departmentId;
    employee.teamId = teamId || null;
    employee.positionId = positionId || null;

    // Also update string fields for backward compatibility
    employee.department = department.name;
    employee.team = teamId ? (await Team.findById(teamId)).name : null;
    employee.position = positionId
      ? (await Position.findById(positionId)).title
      : null;

    await employee.save();

    // Populate for response
    await employee.populate([
      { path: "departmentId", select: "name", strictPopulate: false },
      { path: "teamId", select: "name", strictPopulate: false },
      { path: "positionId", select: "title level", strictPopulate: false },
    ]);

    res.json({
      message: "Employee assigned successfully",
      employee: employee.toJSON(),
    });
  } catch (error) {
    console.error("Employment assignment error:", error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /employments/unassign - Remove employee from assignment
router.delete("/unassign", requireAuth, strictLimiter, async (req, res) => {
  try {
    if (!canManageEmployments(req.user)) {
      return res
        .status(403)
        .json({
          error: "Forbidden: Only Admin and HR_STAFF can unassign employees",
        });
    }

    const { employeeId, departmentId } = req.body;

    // Validation
    if (!employeeId) {
      return res.status(400).json({ error: "Employee ID is required" });
    }

    if (!departmentId) {
      return res.status(400).json({ error: "Department ID is required" });
    }

    if (!employeeId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: "Invalid employee ID format" });
    }

    if (!departmentId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: "Invalid department ID format" });
    }

    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }

    let unassignedCount = 0;

    // If this is the primary assignment
    if (employee.departmentId?.toString() === departmentId) {
      employee.departmentId = null;
      employee.teamId = null;
      employee.positionId = null;
      employee.department = null;
      employee.team = null;
      employee.position = null;
      unassignedCount = 1;
    } else {
      // Find and remove from additionalAssignments
      const originalLength = employee.additionalAssignments?.length || 0;
      employee.additionalAssignments = (
        employee.additionalAssignments || []
      ).filter((a) => a.departmentId?.toString() !== departmentId);
      unassignedCount =
        originalLength - (employee.additionalAssignments?.length || 0);
    }

    if (unassignedCount === 0) {
      return res
        .status(404)
        .json({ error: "Employee not assigned to specified department" });
    }

    await employee.save();
    await employee.populate([
      { path: "departmentId", select: "name", strictPopulate: false },
      { path: "teamId", select: "name", strictPopulate: false },
      { path: "positionId", select: "title level", strictPopulate: false },
    ]);

    res.json({
      message: "Employee unassigned successfully",
      employee: employee.toJSON(),
      unassignedCount,
    });
  } catch (error) {
    console.error("Employment unassignment error:", error);
    res.status(500).json({ error: "Failed to unassign employee" });
  }
});

// GET /employments/employee/:employeeId - Get all assignments for employee
router.get("/employee/:employeeId", requireAuth, async (req, res) => {
  try {
    if (!req.params.employeeId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: "Invalid employee ID format" });
    }

    const employee = await Employee.findById(req.params.employeeId).populate([
      { path: "departmentId", select: "name status" },
      { path: "teamId", select: "name status" },
      { path: "positionId", select: "title level status" },
      { path: "additionalAssignments.departmentId", select: "name status" },
      { path: "additionalAssignments.teamId", select: "name status" },
      {
        path: "additionalAssignments.positionId",
        select: "title level status",
      },
    ]);

    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }

    // Build response with all assignments
    const assignments = [];

    if (employee.departmentId) {
      assignments.push({
        isPrimary: true,
        departmentId: employee.departmentId?._id,
        department: employee.departmentId?.name,
        teamId: employee.teamId?._id || null,
        team: employee.teamId?.name || null,
        positionId: employee.positionId?._id || null,
        position: employee.positionId?.title || null,
        startDate: employee.dateOfHire,
      });
    }

    if (
      employee.additionalAssignments &&
      employee.additionalAssignments.length > 0
    ) {
      assignments.push(
        ...employee.additionalAssignments.map((a) => ({
          isPrimary: a.isPrimary || false,
          departmentId: a.departmentId?._id,
          department: a.departmentId?.name,
          teamId: a.teamId?._id || null,
          team: a.teamId?.name || null,
          positionId: a.positionId?._id || null,
          position: a.positionId?.title || null,
          startDate: a.startDate,
          endDate: a.endDate,
        })),
      );
    }

    res.json({
      employeeId: employee._id,
      employeeName: employee.fullName,
      assignments,
      totalAssignments: assignments.length,
    });
  } catch (error) {
    console.error("Error fetching employee assignments:", error);
    res.status(500).json({ error: "Failed to fetch employee assignments" });
  }
});

export default router;
