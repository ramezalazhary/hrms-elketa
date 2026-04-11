/**
 * @file `/api/departments` — read filtered by role; create/update/delete require enforcePolicy (Admin gate).
 */
import { Router } from "express";
import mongoose from "mongoose";
import { Department } from "../models/Department.js";
import { Employee } from "../models/Employee.js";
import { Team } from "../models/Team.js";
import { Position } from "../models/Position.js";
import { ManagementRequest } from "../models/ManagementRequest.js";
import { OrganizationPolicy } from "../models/OrganizationPolicy.js";
import { requireAuth } from "../middleware/auth.js";
import { enforcePolicy } from "../middleware/enforcePolicy.js";
import {
  validateDepartmentCreation,
  validateDepartmentUpdate,
} from "../middleware/validation.js";
import { strictLimiter } from "../middleware/security.js";
import {
  syncDepartmentHeadRoles,
  syncTeamLeaderRolesFromDepartmentTeams,
} from "../services/employeeOrgSync.js";
import { syncEmployeesWithDepartment } from "../services/orgResolutionService.js";
import { normalizeRole, ROLE } from "../utils/roles.js";

const router = Router();

// GET /departments - View departments
router.get("/", requireAuth, async (req, res) => {
  const user = req.user;
  const role = normalizeRole(user.role);

  try {
    let departments;

    if (role === ROLE.EMPLOYEE) {
      const employee = await Employee.findOne({ email: user.email });
      if (!employee) return res.json([]);
      departments = await Department.find({ name: employee.department });
    } else if (role === ROLE.HR_STAFF || role === ROLE.HR_MANAGER) {
      departments = await Department.find();
    } else if (role === ROLE.TEAM_LEADER) {
      departments = await Department.find({ "teams.leaderEmail": user.email });
    } else if (role === ROLE.MANAGER) {
      departments = await Department.find({ head: user.email });
    } else {
      departments = await Department.find();
    }

    // After fetching departments, merge standalone teams if they've migrated
    const allTeams = await Team.find({ status: "ACTIVE" });
    const departmentsWithTeams = departments.map(dept => {
      const deptObj = dept.toObject();
      const standalone = allTeams.filter(t => t.departmentId.toString() === deptObj.id);
      if (standalone.length > 0) {
        // Deduplicate: remove embedded teams that exist as standalone (by _id match)
        const standaloneIds = new Set(standalone.map(t => t._id.toString()));
        const embeddedOnly = (deptObj.teams || []).filter(t => {
          const tid = t._id?.toString?.();
          return !tid || !standaloneIds.has(tid);
        });
        deptObj.teams = [...embeddedOnly, ...standalone];
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

    const role = normalizeRole(user.role);
    if (role === ROLE.EMPLOYEE) {
      const employee = await Employee.findOne({ email: user.email });
      if (!employee || employee.department !== department.name) {
        return res.status(403).json({ error: "Access denied" });
      }
    } else if (role === ROLE.MANAGER) {
      if (department.head !== user.email) {
        return res.status(403).json({ error: "Access denied" });
      }
    }

    const standaloneTeams = await Team.find({ departmentId: department._id, status: "ACTIVE" });
    const deptObj = department.toObject();
    if (standaloneTeams.length > 0) {
      // Deduplicate: remove embedded teams that exist as standalone (by _id match)
      const standaloneIds = new Set(standaloneTeams.map(t => t._id.toString()));
      const embeddedOnly = (deptObj.teams || []).filter(t => {
        const tid = t._id?.toString?.();
        return !tid || !standaloneIds.has(tid);
      });
      deptObj.teams = [...embeddedOnly, ...standaloneTeams];
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
  enforcePolicy("manage", "departments"),
  strictLimiter,
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

      const teamsList = teams || [];
      for (const t of teamsList) {
        const leaderEmail = t.leaderEmail || t.manager || t.managerEmail;
        if (leaderEmail) {
          const leader = await Employee.findOne({ email: leaderEmail });
          if (!leader || (leader.department !== name && leader.departmentId)) {
            return res.status(400).json({
              error: `Team leader ${leaderEmail} must belong to department ${name}`,
            });
          }
        }
        if (Array.isArray(t.members)) {
          for (const memberEmail of t.members) {
            const member = await Employee.findOne({ email: memberEmail });
            if (!member || (member.department !== name && member.departmentId)) {
              return res.status(400).json({
                error: `Team member ${memberEmail} must belong to department ${name}`,
              });
            }
          }
        }
      }

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

      const teamsForRoleSync = Array.isArray(teams) ? teams : [];
      await syncDepartmentHeadRoles(undefined, newDepartment.head);
      if (teamsForRoleSync.length > 0) {
        await syncTeamLeaderRolesFromDepartmentTeams(
          newDepartment._id,
          teamsForRoleSync,
          [],
        );
      }
      try {
        await syncEmployeesWithDepartment(newDepartment._id);
      } catch (syncErr) {
        console.error("syncEmployeesWithDepartment (create):", syncErr);
      }

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
  enforcePolicy("manage", "departments"),
  strictLimiter,
  validateDepartmentUpdate,
  async (req, res) => {
    const correlationId = `dept-head-sync-${Date.now().toString(36)}`;
    const session = await mongoose.startSession();
    try {
      const {
        name,
        code,
        head,
        headTitle,
        headResponsibility,
        positions,
        description,
        type,
        status,
        teams,
        requiredDocuments,
      } = req.body;

      let responsePayload = null;
      let roleSyncDepartmentId = null;
      let roleSyncTeams = null;
      let roleSyncPreviousTeams = null;
      let finalizedHeadEmail = null;
      let finalizedHeadEmployeeId = null;
      let previousHeadDemotedId = null;
      let consistencyMode = "atomic-transaction";
      let postCommitReconcileOk = true;
      const runDepartmentUpdate = async () => {
        const department = await Department.findById(req.params.id).session(session);
        if (!department) {
          throw new Error("NOT_FOUND_DEPARTMENT");
        }

        const teamsBeforeSync = Array.isArray(department.teams)
          ? department.teams.map((t) => ({
              leaderEmail: t.leaderEmail,
              manager: t.manager,
              managerEmail: t.managerEmail,
            }))
          : [];

        const oldName = department.name;
        const previousHeadEmail = department.head || null;
        const currentName = name ?? department.name;
        const normalizedHead =
          head !== undefined
            ? head && typeof head === "string" && head.trim()
              ? head.trim()
              : null
            : undefined;
        const effectiveHeadEmail =
          normalizedHead !== undefined ? normalizedHead : previousHeadEmail;

        const conflict = await Department.findOne({
          _id: { $ne: req.params.id },
          $or: [{ name: currentName }, { code: code !== undefined ? code : department.code }].filter(
            Boolean,
          ),
        }).session(session);

        if (conflict) {
          throw new Error(
            conflict.name === currentName
              ? "CONFLICT_DEPARTMENT_NAME"
              : "CONFLICT_DEPARTMENT_CODE",
          );
        }

        let nextHeadEmployee = null;
        if (normalizedHead) {
          nextHeadEmployee = await Employee.findOne({ email: normalizedHead }).session(
            session,
          );
          if (!nextHeadEmployee) {
            throw new Error(`INVALID_HEAD_EMAIL:${normalizedHead}`);
          }
          if (
            nextHeadEmployee.departmentId?.toString() !== req.params.id &&
            nextHeadEmployee.department !== department.name &&
            name !== nextHeadEmployee.department
          ) {
            throw new Error(`INVALID_HEAD_DEPARTMENT:${normalizedHead}`);
          }
        }

        department.name = currentName;
        if (code !== undefined) department.code = code;
        if (normalizedHead !== undefined) {
          department.head = normalizedHead;
          department.headId = nextHeadEmployee?._id || null;
        }
        if (headTitle !== undefined) department.headTitle = headTitle;
        if (headResponsibility !== undefined)
          department.headResponsibility = headResponsibility;
        department.description = description ?? department.description;
        department.type = type ?? department.type;
        department.status = status ?? department.status;
        department.positions = Array.isArray(positions)
          ? positions
          : department.positions;
        department.requiredDocuments = Array.isArray(requiredDocuments)
          ? requiredDocuments
          : department.requiredDocuments;

        let normalizedTeamsPayload = null;
        if (Array.isArray(teams)) {
          normalizedTeamsPayload = teams.map((t) => ({ ...t }));

          // Invariant: department head cannot be a team leader/member in this department.
          if (effectiveHeadEmail) {
            normalizedTeamsPayload = normalizedTeamsPayload.map((team) => {
              const teamLeaderEmail =
                team.leaderEmail || team.manager || team.managerEmail || "";
              const members = Array.isArray(team.members)
                ? team.members.filter((m) => m !== effectiveHeadEmail)
                : [];
              const isHeadAsLeader = teamLeaderEmail === effectiveHeadEmail;
              return {
                ...team,
                members,
                leaderEmail: isHeadAsLeader ? "" : teamLeaderEmail,
                manager: isHeadAsLeader ? "" : team.manager,
                managerEmail: isHeadAsLeader ? "" : team.managerEmail,
                leaderTitle: isHeadAsLeader ? "Vacant" : team.leaderTitle,
                leaderResponsibility: isHeadAsLeader
                  ? ""
                  : team.leaderResponsibility,
              };
            });
          }

          for (const t of normalizedTeamsPayload) {
            const leaderEmail = t.leaderEmail || t.manager || t.managerEmail;
            if (leaderEmail) {
              const leader = await Employee.findOne({ email: leaderEmail }).session(
                session,
              );
              if (
                !leader ||
                (leader.department !== currentName &&
                  leader.departmentId?.toString() !== req.params.id)
              ) {
                throw new Error(`INVALID_TEAM_LEADER:${leaderEmail}`);
              }
            }

            if (Array.isArray(t.members)) {
              for (const memberEmail of t.members) {
                const member = await Employee.findOne({ email: memberEmail }).session(
                  session,
                );
                if (
                  !member ||
                  (member.department !== currentName &&
                    member.departmentId?.toString() !== req.params.id)
                ) {
                  throw new Error(`INVALID_TEAM_MEMBER:${memberEmail}`);
                }
              }
            }
          }

          const incomingIds = normalizedTeamsPayload
            .map((t) => t.id || t._id)
            .filter(Boolean);
          await Team.deleteMany({
            departmentId: department._id,
            _id: { $nin: incomingIds },
          }).session(session);

          for (const t of normalizedTeamsPayload) {
            if (t.id || t._id) {
              await Team.findByIdAndUpdate(
                t.id || t._id,
                {
                  name: t.name,
                  leaderEmail: t.leaderEmail || t.manager || t.managerEmail || "",
                  leaderTitle: t.leaderTitle || "Team Leader",
                  leaderResponsibility: t.leaderResponsibility || "",
                  members: Array.isArray(t.members) ? t.members : [],
                },
                { session },
              );
            }
          }

          const standaloneIds = (
            await Team.find({ departmentId: department._id }).session(session)
          ).map((st) => st._id.toString());

          department.teams = normalizedTeamsPayload
            .filter((t) => !t.id || !standaloneIds.includes(t.id))
            .map((t) => ({
              ...t,
              leaderEmail: t.leaderEmail || t.manager || t.managerEmail || "",
              leaderTitle: t.leaderTitle || "Team Leader",
              leaderResponsibility: t.leaderResponsibility || "",
              members: Array.isArray(t.members) ? t.members : [],
            }));
        }

        const headChanged =
          normalizedHead !== undefined && normalizedHead !== previousHeadEmail;
        if (headChanged) {
          const previousHeadEmployee = previousHeadEmail
            ? await Employee.findOne({ email: previousHeadEmail }).session(session)
            : null;
          const wasTeamLeader = nextHeadEmployee?.role === "TEAM_LEADER";

          if (previousHeadEmployee && previousHeadEmployee.role !== "ADMIN") {
            previousHeadEmployee.role = "EMPLOYEE";
            previousHeadEmployee.position = null;
            previousHeadEmployee.positionId = null;
            await previousHeadEmployee.save({ session });
            previousHeadDemotedId = previousHeadEmployee._id;
          }

          if (
            nextHeadEmployee &&
            !["MANAGER", "ADMIN"].includes(nextHeadEmployee.role)
          ) {
            nextHeadEmployee.role = "MANAGER";
          }

          if (nextHeadEmployee) {
            // Department heads should not remain on any team roster/leadership.
            // They are elevated to department manager scope.
            nextHeadEmployee.teamId = null;
            nextHeadEmployee.team = null;
            nextHeadEmployee.teamLeaderId = null;
            nextHeadEmployee.position = `Head Manager of ${currentName}`;
            const policy = await OrganizationPolicy.findOne({ name: "default" })
              .select("chiefExecutiveEmployeeId")
              .session(session);
            const chiefExecutiveId = policy?.chiefExecutiveEmployeeId || null;
            nextHeadEmployee.managerId =
              chiefExecutiveId &&
              String(chiefExecutiveId) !== String(nextHeadEmployee._id)
                ? chiefExecutiveId
                : null;
            await nextHeadEmployee.save({ session });
            finalizedHeadEmail = nextHeadEmployee.email;
            finalizedHeadEmployeeId = nextHeadEmployee._id;

            // If UI payload still contains this person as team leader/member, sanitize it now.
            if (Array.isArray(normalizedTeamsPayload)) {
              normalizedTeamsPayload = normalizedTeamsPayload.map((team) => {
                const teamLeaderEmail =
                  team.leaderEmail || team.manager || team.managerEmail || "";
                const members = Array.isArray(team.members)
                  ? team.members.filter((m) => m !== nextHeadEmployee.email)
                  : [];
                const isHeadAsLeader = teamLeaderEmail === nextHeadEmployee.email;
                return {
                  ...team,
                  members,
                  leaderEmail: isHeadAsLeader ? "" : teamLeaderEmail,
                  manager: isHeadAsLeader ? "" : team.manager,
                  managerEmail: isHeadAsLeader ? "" : team.managerEmail,
                  leaderTitle: isHeadAsLeader ? "Vacant" : team.leaderTitle,
                  leaderResponsibility: isHeadAsLeader
                    ? ""
                    : team.leaderResponsibility,
                };
              });
            }
          }

          if (previousHeadEmployee?._id) {
            await Employee.updateMany(
              {
                $or: [
                  { departmentId: department._id },
                  { department: oldName },
                  { department: currentName },
                ],
                managerId: previousHeadEmployee._id,
              },
              { $set: { managerId: nextHeadEmployee?._id || null } },
              { session },
            );
          }

          if (nextHeadEmployee) {
            const affectedTeams = await Team.find({
              departmentId: department._id,
              $or: [
                { leaderId: nextHeadEmployee._id },
                { leaderEmail: nextHeadEmployee.email },
                { memberIds: nextHeadEmployee._id },
                { members: nextHeadEmployee.email },
              ],
            }).session(session);

            if (affectedTeams.length > 0) {
              const affectedTeamIds = affectedTeams.map((t) => t._id);
              const affectedTeamMemberEmails = affectedTeams.flatMap((t) =>
                Array.isArray(t.members) ? t.members : [],
              );

              await Team.updateMany(
                { _id: { $in: affectedTeamIds } },
                {
                  $set: {
                    leaderEmail: "",
                    leaderId: null,
                    leaderTitle: "Vacant",
                    leaderResponsibility: "",
                  },
                  $pull: {
                    members: nextHeadEmployee.email,
                    memberIds: nextHeadEmployee._id,
                  },
                },
                { session },
              );

              department.teams = (department.teams || []).map((team) => {
                const teamObj = team?.toObject?.() || team;
                const isLeader =
                  teamObj.leaderEmail === nextHeadEmployee.email ||
                  String(teamObj.leaderId || "") ===
                    String(nextHeadEmployee._id || "");
                const memberList = Array.isArray(teamObj.members)
                  ? teamObj.members.filter((m) => m !== nextHeadEmployee.email)
                  : [];
                return {
                  ...teamObj,
                  members: memberList,
                  leaderEmail: isLeader ? "" : teamObj.leaderEmail,
                  leaderId: isLeader ? null : teamObj.leaderId,
                  leaderTitle: isLeader ? "Vacant" : teamObj.leaderTitle,
                  leaderResponsibility: isLeader
                    ? ""
                    : teamObj.leaderResponsibility,
                };
              });

              if (wasTeamLeader) {
                await Employee.updateMany(
                  {
                    $or: [
                      { teamId: { $in: affectedTeamIds } },
                      { email: { $in: affectedTeamMemberEmails } },
                      { teamLeaderId: nextHeadEmployee._id },
                    ],
                  },
                  { $set: { teamLeaderId: null } },
                  { session },
                );
              }
            }
          }
        }

        const isRenaming = name && name !== oldName;
        await department.save({ session });

        roleSyncDepartmentId = department._id;
        roleSyncTeams = Array.isArray(normalizedTeamsPayload)
          ? normalizedTeamsPayload
          : null;
        roleSyncPreviousTeams = teamsBeforeSync;

        if (isRenaming) {
          await Employee.updateMany(
            {
              $or: [{ departmentId: department._id }, { department: oldName }],
            },
            { $set: { department: name } },
            { session },
          );

          await ManagementRequest.updateMany(
            { departmentId: department._id },
            { $set: { departmentName: name } },
            { session },
          );

          await OrganizationPolicy.updateMany(
            {
              "salaryIncreaseRules.type": "DEPARTMENT",
              "salaryIncreaseRules.target": oldName,
            },
            { $set: { "salaryIncreaseRules.$[rule].target": name } },
            {
              arrayFilters: [{ "rule.type": "DEPARTMENT", "rule.target": oldName }],
              session,
            },
          );
        }

        responsePayload = department;
      };

      let supportsTransactions = false;
      try {
        const hello = await mongoose.connection.db.admin().command({ hello: 1 });
        supportsTransactions = Boolean(hello?.setName || hello?.msg === "isdbgrid");
      } catch {
        supportsTransactions = false;
      }

      if (supportsTransactions) {
        await session.withTransaction(runDepartmentUpdate);
      } else {
        consistencyMode = "best-effort-fallback";
        console.warn(
          `[DepartmentUpdate][${correlationId}] Running fallback (non-transactional) mode: MongoDB does not support transactions in current topology.`,
        );
        await runDepartmentUpdate();
      }

      if (Array.isArray(roleSyncTeams) && roleSyncDepartmentId) {
        try {
          await syncTeamLeaderRolesFromDepartmentTeams(
            roleSyncDepartmentId,
            roleSyncTeams,
            roleSyncPreviousTeams,
          );
        } catch (syncErr) {
          postCommitReconcileOk = false;
          console.error(
            `[DepartmentUpdate][${correlationId}] Post-commit team-leader reconciliation failed:`,
            syncErr,
          );
        }
      }

      try {
        if (responsePayload?._id) {
          await syncEmployeesWithDepartment(responsePayload._id);
        }
      } catch (syncErr) {
        postCommitReconcileOk = false;
        console.error("syncEmployeesWithDepartment (update):", syncErr);
      }

      // Ensure final state after sync: department head is detached from teams.
      if (finalizedHeadEmail && finalizedHeadEmployeeId) {
        await Team.updateMany(
          { departmentId: responsePayload._id },
          {
            $pull: { members: finalizedHeadEmail, memberIds: finalizedHeadEmployeeId },
          },
        );
        await Team.updateMany(
          {
            departmentId: responsePayload._id,
            $or: [{ leaderEmail: finalizedHeadEmail }, { leaderId: finalizedHeadEmployeeId }],
          },
          {
            $set: {
              leaderEmail: "",
              leaderId: null,
              leaderTitle: "Vacant",
              leaderResponsibility: "",
            },
          },
        );
        await Employee.updateOne(
          { _id: finalizedHeadEmployeeId },
          { $set: { team: null, teamId: null, teamLeaderId: null } },
        );
      }

      if (previousHeadDemotedId) {
        await Employee.updateOne(
          { _id: previousHeadDemotedId, role: "EMPLOYEE" },
          { $set: { position: null, positionId: null } },
        );
      }

      res.set("X-Consistency-Mode", consistencyMode);
      res.set("X-Consistency-Correlation-Id", correlationId);
      res.set("X-Post-Commit-Reconcile", postCommitReconcileOk ? "ok" : "degraded");
      res.json(responsePayload);
    } catch (error) {
      if (error.message === "NOT_FOUND_DEPARTMENT") {
        return res.status(404).json({ error: "Department not found" });
      }
      if (
        error.message === "CONFLICT_DEPARTMENT_NAME" ||
        error.message === "CONFLICT_DEPARTMENT_CODE"
      ) {
        const field =
          error.message === "CONFLICT_DEPARTMENT_NAME" ? "name" : "code";
        return res.status(409).json({ error: `Department ${field} already exists` });
      }
      if (error.message.startsWith("INVALID_HEAD_EMAIL:")) {
        const email = error.message.split(":")[1];
        return res
          .status(400)
          .json({ error: `Leader with email ${email} not found.` });
      }
      if (error.message.startsWith("INVALID_HEAD_DEPARTMENT:")) {
        const email = error.message.split(":")[1];
        return res.status(400).json({ error: `Leader ${email} must belong to this department.` });
      }
      if (error.message.startsWith("INVALID_TEAM_LEADER:")) {
        const email = error.message.split(":")[1];
        return res
          .status(400)
          .json({ error: `Team leader ${email} must belong to this department.` });
      }
      if (error.message.startsWith("INVALID_TEAM_MEMBER:")) {
        const email = error.message.split(":")[1];
        return res
          .status(400)
          .json({ error: `Team member ${email} must belong to this department.` });
      }
      console.error("Error updating department:", correlationId, error);
      res.status(500).json({
        error: "Failed to update department",
        correlationId,
      });
    } finally {
      await session.endSession();
    }
  },
);

// DELETE /departments/:id - Delete department (Admin only)
router.delete(
  "/:id",
  requireAuth,
  enforcePolicy("manage", "departments"),
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

      // 3. Delete associated positions
      await Position.deleteMany({ departmentId: departmentId });

      // 4. Finally delete the department
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
