/**
 * @file `/api/reports` — aggregated dashboards; gated by `canViewReports` (Admin + HR_STAFF).
 */
import { Router } from "express";
import { Department } from "../models/Department.js";
import { Team } from "../models/Team.js";
import { Position } from "../models/Position.js";
import { Employee } from "../models/Employee.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

/**
 * @param {{ role: string|number }} user
 * @returns {boolean}
 */
function canViewReports(user) {
  return user.role === 3 || user.role === "ADMIN" || user.role === "HR_STAFF";
}

// GET /reports/summary - Get system summary with aggregation
router.get("/summary", requireAuth, async (req, res) => {
  try {
    if (!canViewReports(req.user)) {
      return res
        .status(403)
        .json({ error: "Forbidden: Only Admin and HR_STAFF can view reports" });
    }

    // Get departments summary
    const departmentStats = await Department.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: {
            $sum: { $cond: [{ $eq: ["$status", "ACTIVE"] }, 1, 0] },
          },
          inactive: {
            $sum: { $cond: [{ $eq: ["$status", "INACTIVE"] }, 1, 0] },
          },
          archived: {
            $sum: { $cond: [{ $eq: ["$status", "ARCHIVED"] }, 1, 0] },
          },
        },
      },
    ]);

    // Get teams summary
    const teamStats = await Team.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: {
            $sum: { $cond: [{ $eq: ["$status", "ACTIVE"] }, 1, 0] },
          },
          archived: {
            $sum: { $cond: [{ $eq: ["$status", "ARCHIVED"] }, 1, 0] },
          },
        },
      },
    ]);

    // Get positions summary
    const positionStats = await Position.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: {
            $sum: { $cond: [{ $eq: ["$status", "ACTIVE"] }, 1, 0] },
          },
          inactive: {
            $sum: { $cond: [{ $eq: ["$status", "INACTIVE"] }, 1, 0] },
          },
        },
      },
    ]);

    // Get employees summary by status
    const employeeStats = await Employee.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          byStatus: {
            $push: { status: "$status", count: 1 },
          },
          unassigned: {
            $sum: { $cond: [{ $eq: ["$departmentId", null] }, 1, 0] },
          },
        },
      },
    ]);

    // Get detailed status breakdown
    const employeeStatusBreakdown = await Employee.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    // Get employees with multiple assignments
    const multipleAssignments = await Employee.aggregate([
      {
        $match: {
          "additionalAssignments.0": { $exists: true },
        },
      },
      {
        $project: {
          id: { $toString: "$_id" },
          fullName: 1,
          email: 1,
          additionalAssignmentCount: { $size: "$additionalAssignments" },
        },
      },
    ]);

    // Get unassigned employees
    const unassignedEmployees = await Employee.find({
      departmentId: null,
    }).select("fullName email");

    // Get departments without managers
    const departmentsWithoutHead = await Department.find({ head: null }).select(
      "name type status",
    );

    // Get teams without managers
    const teamsWithoutManager = await Team.find({ managerEmail: null }).select(
      "name status departmentId",
    );

    // Build warnings
    const warnings = [];

    if (unassignedEmployees.length > 0) {
      warnings.push({
        type: "warning",
        severity: "high",
        message: `${unassignedEmployees.length} employee(s) have no department assigned`,
        count: unassignedEmployees.length,
        affectedItems: unassignedEmployees.map((e) => ({
          id: e._id,
          name: e.fullName,
          email: e.email,
        })),
      });
    }

    if (departmentsWithoutHead.length > 0) {
      warnings.push({
        type: "warning",
        severity: "medium",
        message: `${departmentsWithoutHead.length} department(s) have no manager assigned`,
        count: departmentsWithoutHead.length,
        affectedItems: departmentsWithoutHead.map((d) => ({
          id: d._id,
          name: d.name,
          status: d.status,
        })),
      });
    }

    if (teamsWithoutManager.length > 0) {
      warnings.push({
        type: "warning",
        severity: "medium",
        message: `${teamsWithoutManager.length} team(s) have no manager assigned`,
        count: teamsWithoutManager.length,
        affectedItems: teamsWithoutManager.map((t) => ({
          id: t._id,
          name: t.name,
          status: t.status,
        })),
      });
    }

    // Format response
    const deptData = departmentStats[0] || {
      total: 0,
      active: 0,
      inactive: 0,
      archived: 0,
    };
    const teamData = teamStats[0] || { total: 0, active: 0, archived: 0 };
    const posData = positionStats[0] || { total: 0, active: 0, inactive: 0 };
    const empData = employeeStats[0] || { total: 0, unassigned: 0 };

    // Create status breakdown object
    const statusBreakdown = {
      ACTIVE: 0,
      ON_LEAVE: 0,
      TERMINATED: 0,
      RESIGNED: 0,
    };

    employeeStatusBreakdown.forEach((item) => {
      if (statusBreakdown.hasOwnProperty(item._id)) {
        statusBreakdown[item._id] = item.count;
      }
    });

    res.json({
      summary: {
        timestamp: new Date(),
        departments: {
          total: deptData.total,
          active: deptData.active,
          inactive: deptData.inactive,
          archived: deptData.archived,
        },
        teams: {
          total: teamData.total,
          active: teamData.active,
          archived: teamData.archived,
        },
        positions: {
          total: posData.total,
          active: posData.active,
          inactive: posData.inactive,
        },
        employees: {
          total: empData.total,
          byStatus: statusBreakdown,
          unassigned: unassignedEmployees.length,
          multipleAssignments: multipleAssignments.length,
        },
      },
      warnings,
      topLevelInsights: {
        organizationReadiness:
          empData.total > 0
            ? (
                ((empData.total - unassignedEmployees.length) / empData.total) *
                100
              ).toFixed(2) + "%"
            : "0%",
        managers: deptData.total - departmentsWithoutHead.length,
        teamsNeedingAttention: teamsWithoutManager.length,
      },
    });
  } catch (error) {
    console.error("Error generating report summary:", error);
    res.status(500).json({ error: "Failed to generate report" });
  }
});

// GET /reports/organizations - Org chart data
router.get("/organizations", requireAuth, async (req, res) => {
  try {
    if (!canViewReports(req.user)) {
      return res
        .status(403)
        .json({ error: "Forbidden: Only Admin and HR_STAFF can view reports" });
    }

    // Get all departments with their teams and employee counts
    const departments = await Department.find({ status: "ACTIVE" }).lean();

    const orgChart = await Promise.all(
      departments.map(async (dept) => {
        const teams = await Team.find({
          departmentId: dept._id,
          status: "ACTIVE",
        }).lean();
        const employeeCount = await Employee.countDocuments({
          departmentId: dept._id,
        });

        const teamsWithCounts = await Promise.all(
          teams.map(async (team) => ({
            ...team,
            id: team._id.toString(),
            employeeCount: await Employee.countDocuments({ teamId: team._id }),
          })),
        );

        return {
          id: dept._id.toString(),
          name: dept.name,
          head: dept.head,
          employeeCount,
          teamsCount: teams.length,
          teams: teamsWithCounts,
        };
      }),
    );

    res.json({
      organizationChart: orgChart,
      totalDepartments: orgChart.length,
    });
  } catch (error) {
    console.error("Error fetching organization data:", error);
    res.status(500).json({ error: "Failed to fetch organization data" });
  }
});

export default router;
