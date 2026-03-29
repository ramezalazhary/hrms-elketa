/**
 * @file `/api/employees` — CRUD on `Employee` with **scope** derived from org role (Admin, HR head,
 * department head, team leader, self). Mutations check `resolveEmployeeAccess` actions + department rules.
 */
import { Router } from "express";
import { Employee } from "../models/Employee.js";
import { Department } from "../models/Department.js";
import { requireAuth } from "../middleware/auth.js";
import { UserPermission } from "../models/Permission.js";
import { hashPassword } from "../middleware/auth.js";

const router = Router();

/** Empty strings from JSON must not be cast to Date (Mongoose CastError). */
function optionalDate(value) {
  if (value == null || value === "") return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : value;
}

/**
 * Computes `{ scope, actions[, teams] }` for listing/mutating employees.
 * @param {{ id: string, email: string, role: string }} user From `req.user` after `requireAuth`.
 * @returns {Promise<{ scope: 'all'|'department'|'team'|'self', actions: string[], teams?: string[] }>}
 *
 * Data flow: Admin → full actions + `all`; HR dept head → same; dept head / MANAGER → department + view/create;
 * team manager → team names + view; else self + view only.
 */
async function resolveEmployeeAccess(user) {
  // 1. Admin gets EVERYTHING
  if (user.role === "ADMIN" || user.role === 3) {
    return {
      scope: "all",
      actions: ["view", "create", "edit", "delete", "export"],
    };
  }

  // 2. Head of HR gets EVERYTHING
  const hrDept = await Department.findOne({ code: "HR" });
  const isHrHead = hrDept && hrDept.head === user.email;
  if (isHrHead) {
    return {
      scope: "all",
      actions: ["view", "create", "edit", "delete", "export"],
    };
  }

  // 3. Department Head (MANAGER) sees all but is Read-Only
  const isDeptHead = await Department.findOne({ head: user.email });
  if (isDeptHead || user.role === "MANAGER" || user.role === 2) {
    return { scope: "department", actions: ["view"] };
  }

  // 4. Team Leader see his team only
  // Check if they are listed as a leader in any team within any department
  const deptsWithTeams = await Department.find({ "teams.leaderEmail": user.email });
  const managedTeamNames = [];
  deptsWithTeams.forEach((d) => {
    d.teams.forEach((t) => {
      if (t.leaderEmail === user.email) managedTeamNames.push(t.name);
    });
  });

  if (user.role === "TEAM_LEADER" || managedTeamNames.length > 0) {
    return { scope: "team", actions: ["view"], teams: managedTeamNames };
  }

  // 5. Fallback for generic Employee
  return { scope: "self", actions: ["view"] };
}

/**
 * Whether `userEmail` may act inside `targetDepartment` (owns dept as head or works there).
 * @param {string} userEmail
 * @param {string} targetDepartment Department name string on Employee / Department.
 * @returns {Promise<boolean>}
 */
async function checkScopeDepartment(userEmail, targetDepartment) {
  const employeeRecord = await Employee.findOne({ email: userEmail });
  let deptNames = await Department.find({ head: userEmail }).distinct("name");
  if (employeeRecord) deptNames.push(employeeRecord.department);
  return deptNames.includes(targetDepartment);
}

router.get("/", requireAuth, async (req, res) => {
  const access = await resolveEmployeeAccess(req.user);
  if (!access.actions.includes("view"))
    return res.status(403).json({ error: "Forbidden" });

  if (access.scope === "all") {
    return res.json(await Employee.find());
  }

  if (access.scope === "department") {
    const employeeRecord = await Employee.findOne({ email: req.user.email });
    let deptNames = await Department.find({ head: req.user.email }).distinct(
      "name",
    );
    if (employeeRecord) deptNames.push(employeeRecord.department);
    return res.json(await Employee.find({ department: { $in: deptNames } }));
  }

  if (access.scope === "team") {
    return res.json(
      await Employee.find({
        $or: [{ team: { $in: access.teams } }, { email: req.user.email }],
      }),
    );
  }

  if (access.scope === "self") {
    return res.json(await Employee.find({ email: req.user.email }));
  }

  return res.json([]);
});

router.get("/:id", requireAuth, async (req, res) => {
  const access = await resolveEmployeeAccess(req.user);
  if (!access.actions.includes("view"))
    return res.status(403).json({ error: "Forbidden" });

  const employee = await Employee.findById(req.params.id);
  if (!employee) return res.status(404).json({ error: "Employee not found" });

  if (access.scope === "all") return res.json(employee);

  if (access.scope === "department") {
    const isAllowedDept = await checkScopeDepartment(
      req.user.email,
      employee.department,
    );
    if (isAllowedDept) return res.json(employee);
    return res.status(403).json({ error: "Forbidden: Not in your scope" });
  }

  if (access.scope === "team") {
    if (
      employee.email === req.user.email ||
      access.teams.includes(employee.team)
    ) {
      return res.json(employee);
    }
    return res.status(403).json({ error: "Forbidden: Not in your team scope" });
  }

  if (access.scope === "self") {
    if (employee.email === req.user.email) return res.json(employee);
    return res.status(403).json({ error: "Forbidden: Can only view self" });
  }

  return res.status(403).json({ error: "Forbidden" });
});

router.post("/", requireAuth, async (req, res) => {
  const access = await resolveEmployeeAccess(req.user);
  if (!access.actions.includes("create"))
    return res.status(403).json({ error: "Forbidden" });

  const {
    fullName,
    email,
    department,
    team,
    position,
    status,
    employmentType,
    managerId,
    employeeCode,
    gender,
    maritalStatus,
    age,
    dateOfBirth,
    nationality,
    idNumber,
    profilePicture,
    workEmail,
    phoneNumber,
    address,
    additionalContact,
    dateOfHire,
    workLocation,
    onlineStorageLink,
    education,
    trainingCourses,
    skills,
    languages,
    financial,
    insurance,
  } = req.body;
  if (!fullName || !email || !department || !position) {
    return res.status(400).json({ error: "Required fields are missing" });
  }

  if (access.scope === "department") {
    const isAllowedDept = await checkScopeDepartment(
      req.user.email,
      department,
    );
    if (!isAllowedDept) {
      return res.status(403).json({
        error: "Cannot create employee outside your department scope",
      });
    }
  } else if (access.scope === "self") {
    return res
      .status(403)
      .json({ error: "Scope 'self' cannot create employees" });
  }

  const existing = await Employee.findOne({ email });
  if (existing)
    return res.status(409).json({ error: "Employee already exists" });

  try {
    // 2. Resolve Department Code & Generate Employee ID
    const deptDoc = await Department.findOne({ name: department });
    if (!deptDoc) return res.status(404).json({ error: "Department not found while generating code" });

    if (!employeeCode) {
      const deptCount = await Employee.countDocuments({ department });
      const serial = (deptCount + 1).toString().padStart(3, '0');
      req.body.employeeCode = `#${deptDoc.code}-${serial}`;
    }

    const { role: requestedRole } = req.body;
    let finalRole = "EMPLOYEE";

    if (requestedRole) {
      if (access.scope === "all") {
        finalRole = requestedRole;
      } else if (access.scope === "department") {
         // Managers can assign EMPLOYEE, TEAM_LEADER, or MANAGER
         const allowed = ["EMPLOYEE", "TEAM_LEADER", "MANAGER"];
         finalRole = allowed.includes(requestedRole) ? requestedRole : "EMPLOYEE";
      }
    } else {
      // Default logic if no role provided
      finalRole = department === "HR" ? "HR_STAFF" : "EMPLOYEE";
    }

    const newEmployee = new Employee({
      ...req.body,
      employeeCode: req.body.employeeCode,
      gender: gender || "MALE",
      maritalStatus: maritalStatus || "SINGLE",
      age: age || null,
      dateOfBirth: optionalDate(dateOfBirth),
      nationality,
      idNumber,
      profilePicture,
      workEmail,
      phoneNumber,
      address,
      additionalContact,
      dateOfHire: optionalDate(dateOfHire),
      workLocation,
      onlineStorageLink,
      education,
      trainingCourses,
      skills,
      languages,
      financial,
      insurance:
        insurance && typeof insurance === "object"
          ? {
              provider: insurance.provider || undefined,
              policyNumber: insurance.policyNumber || undefined,
              coverageType: insurance.coverageType || "HEALTH",
              validUntil: optionalDate(insurance.validUntil),
            }
          : undefined,
      // Auth fields - merged from User model
      passwordHash: await hashPassword("Welcome123!"),
      role: finalRole,
      requirePasswordChange: true,
      isActive: true,
    });
    await newEmployee.save();

    return res.status(201).json({
      message: "Employee created successfully",
      employee: newEmployee,
      userProvisioned: true,
      defaultPassword: "Welcome123!",
    });
  } catch (err) {
    if (err?.name === "ValidationError") {
      return res.status(400).json({ error: err.message });
    }
    if (err?.code === 11000) {
      return res.status(409).json({ error: "Employee already exists" });
    }
    console.error("POST /employees:", err);
    return res.status(500).json({ error: "Failed to create employee" });
  }
});

router.put("/:id", requireAuth, async (req, res) => {
  const access = await resolveEmployeeAccess(req.user);
  if (!access.actions.includes("edit"))
    return res.status(403).json({ error: "Forbidden" });

  const {
    fullName,
    email,
    department,
    team,
    position,
    status,
    employmentType,
    managerId,
    employeeCode,
    gender,
    maritalStatus,
    age,
    dateOfBirth,
    nationality,
    idNumber,
    profilePicture,
    workEmail,
    phoneNumber,
    address,
    additionalContact,
    dateOfHire,
    workLocation,
    onlineStorageLink,
    education,
    trainingCourses,
    skills,
    languages,
    financial,
    insurance,
    documentChecklist,
  } = req.body;
  const employee = await Employee.findById(req.params.id);

  if (!employee) return res.status(404).json({ error: "Employee not found" });

  if (access.scope === "department") {
    const isAllowedDept = await checkScopeDepartment(
      req.user.email,
      employee.department,
    );
    if (!isAllowedDept)
      return res
        .status(403)
        .json({ error: "Not authorized to edit this record" });

    // Check if trying to move the employee to a restricted department
    if (department && department !== employee.department) {
      const isTargetAllowedDept = await checkScopeDepartment(
        req.user.email,
        department,
      );
      if (!isTargetAllowedDept)
        return res
          .status(403)
          .json({ error: "Cannot move employee to a restricted department" });
    }
  } else if (access.scope === "self") {
    if (employee.email !== req.user.email)
      return res.status(403).json({ error: "Forbidden: Can only edit self" });
    if (department && department !== employee.department)
      return res.status(403).json({ error: "Cannot change own department" });
  }

  const oldEmail = employee.email;

  employee.fullName = fullName ?? employee.fullName;
  employee.email = email ?? employee.email;
  employee.department = department ?? employee.department;
  employee.team = team ?? employee.team;
  employee.position = position ?? employee.position;

  if (status !== undefined) employee.status = status;
  if (employmentType !== undefined) employee.employmentType = employmentType;
  if (managerId !== undefined) employee.managerId = managerId;
  if (employeeCode !== undefined) employee.employeeCode = employeeCode;
  if (gender !== undefined) employee.gender = gender;
  if (maritalStatus !== undefined) employee.maritalStatus = maritalStatus;
  if (age !== undefined) employee.age = age;

  if (dateOfBirth !== undefined)
    employee.dateOfBirth = optionalDate(dateOfBirth);
  if (nationality !== undefined) employee.nationality = nationality;
  if (idNumber !== undefined) employee.idNumber = idNumber;
  if (profilePicture !== undefined) employee.profilePicture = profilePicture;
  if (workEmail !== undefined) employee.workEmail = workEmail;
  if (phoneNumber !== undefined) employee.phoneNumber = phoneNumber;
  if (address !== undefined) employee.address = address;
  if (additionalContact !== undefined)
    employee.additionalContact = additionalContact;
  if (dateOfHire !== undefined) employee.dateOfHire = optionalDate(dateOfHire);
  if (workLocation !== undefined) employee.workLocation = workLocation;
  if (onlineStorageLink !== undefined)
    employee.onlineStorageLink = onlineStorageLink;
  if (education !== undefined) employee.education = education;
  if (trainingCourses !== undefined) employee.trainingCourses = trainingCourses;
  if (skills !== undefined) employee.skills = skills;
  if (languages !== undefined) employee.languages = languages;
  if (financial !== undefined) employee.financial = financial;
  if (insurance !== undefined) employee.insurance = insurance;
  if (documentChecklist !== undefined) employee.documentChecklist = documentChecklist;

  // Store new email for sync check
  const newEmail = employee.email;

  await employee.save();

  // Update isActive based on employment status
  if (employee.status === "TERMINATED" || employee.status === "RESIGNED") {
    employee.isActive = false;
    await employee.save();
  } else if (employee.status === "ACTIVE") {
    employee.isActive = true;
    await employee.save();
  }

  return res.json(employee);
});

router.delete("/:id", requireAuth, async (req, res) => {
  const access = await resolveEmployeeAccess(req.user);
  if (!access.actions.includes("delete"))
    return res.status(403).json({ error: "Forbidden" });

  // Explicit policy: Only Managers and Admins can delete data.
  if (req.user.role === "EMPLOYEE" || req.user.role === 1) {
    return res.status(403).json({
      error: "Policy Restriction: Only Managers and Admins can delete data.",
    });
  }

  const employee = await Employee.findById(req.params.id);
  if (!employee) return res.status(404).json({ error: "Employee not found" });

  if (access.scope === "department") {
    // Only Managers can delete FROM their managed departments explicitly, not just from the dept they belong to!
    const deptNames = await Department.find({ head: req.user.email }).distinct(
      "name",
    );
    if (!deptNames.includes(employee.department)) {
      return res.status(403).json({
        error:
          "Managers can only delete employees from departments they explicitly manage.",
      });
    }
  } else if (access.scope === "self") {
    return res
      .status(403)
      .json({ error: "Scope 'self' cannot delete records." });
  }

  const employee_id = employee._id.toString();

  await Employee.findByIdAndDelete(req.params.id);

  // Clean up associated permissions
  await UserPermission.deleteMany({ userId: employee_id });

  return res.json({ success: true });
});

export default router;
