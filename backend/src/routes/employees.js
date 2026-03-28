import { Router } from "express";
import { Employee } from "../models/Employee.js";
import { Department } from "../models/Department.js";
import { requireAuth } from "../middleware/auth.js";
import { UserPermission } from "../models/Permission.js";
import { User } from "../models/User.js";
import { hashPassword } from "../middleware/auth.js";

const router = Router();

async function resolveEmployeeAccess(user) {
  // 1. Admin gets EVERYTHING
  if (user.role === "ADMIN" || user.role === 3) {
    return { scope: "all", actions: ["view", "create", "edit", "delete", "export"] };
  }

  // 2. Head of HR gets EVERYTHING
  const hrDept = await Department.findOne({ name: "HR" });
  const isHrHead = hrDept && hrDept.head === user.email;
  if (isHrHead) {
    return { scope: "all", actions: ["view", "create", "edit", "delete", "export"] };
  }

  // 3. Department Head (MANAGER) sees all but can only create (No Edit/Delete)
  const isDeptHead = await Department.findOne({ head: user.email });
  if (isDeptHead || user.role === "MANAGER" || user.role === 2) {
    return { scope: "department", actions: ["view", "create"] };
  }

  // 4. Team Leader see his team only
  // Check if they are listed as a manager in any team within any department
  const deptsWithTeams = await Department.find({ "teams.manager": user.email });
  if (deptsWithTeams.length > 0 || user.role === "TEAM_LEADER") {
    const managedTeamNames = [];
    deptsWithTeams.forEach(d => {
       d.teams.forEach(t => {
         if (t.manager === user.email) managedTeamNames.push(t.name);
       });
    });
    return { scope: "team", actions: ["view"], teams: managedTeamNames };
  }

  // 5. Fallback for generic Employee
  return { scope: "self", actions: ["view"] };
}

// Ensure the user's scope allows access to the target department
async function checkScopeDepartment(userEmail, targetDepartment) {
  const employeeRecord = await Employee.findOne({ email: userEmail });
  let deptNames = await Department.find({ head: userEmail }).distinct("name");
  if (employeeRecord) deptNames.push(employeeRecord.department);
  return deptNames.includes(targetDepartment);
}

router.get("/", requireAuth, async (req, res) => {
  const access = await resolveEmployeeAccess(req.user);
  if (!access.actions.includes("view")) return res.status(403).json({ error: "Forbidden" });

  if (access.scope === "all") {
    return res.json(await Employee.find());
  }

  if (access.scope === "department") {
    const employeeRecord = await Employee.findOne({ email: req.user.email });
    let deptNames = await Department.find({ head: req.user.email }).distinct("name");
    if (employeeRecord) deptNames.push(employeeRecord.department);
    return res.json(await Employee.find({ department: { $in: deptNames } }));
  }

  if (access.scope === "team") {
    return res.json(await Employee.find({ 
      $or: [
        { team: { $in: access.teams } },
        { email: req.user.email }
      ]
    }));
  }

  if (access.scope === "self") {
    return res.json(await Employee.find({ email: req.user.email }));
  }

  return res.json([]);
});

router.get("/:id", requireAuth, async (req, res) => {
  const access = await resolveEmployeeAccess(req.user);
  if (!access.actions.includes("view")) return res.status(403).json({ error: "Forbidden" });

  const employee = await Employee.findById(req.params.id);
  if (!employee) return res.status(404).json({ error: "Employee not found" });

  if (access.scope === "all") return res.json(employee);

  if (access.scope === "department") {
    const isAllowedDept = await checkScopeDepartment(req.user.email, employee.department);
    if (isAllowedDept) return res.json(employee);
    return res.status(403).json({ error: "Forbidden: Not in your scope" });
  }

  if (access.scope === "team") {
     if (employee.email === req.user.email || access.teams.includes(employee.team)) {
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
  if (!access.actions.includes("create")) return res.status(403).json({ error: "Forbidden" });

  const { 
    fullName, email, department, team, position, status, employmentType, managerId,
    employeeCode, gender, maritalStatus, age,
    dateOfBirth, nationality, idNumber, profilePicture,
    workEmail, phoneNumber, address, additionalContact,
    dateOfHire, workLocation, onlineStorageLink,
    education, trainingCourses, skills, languages,
    financial
  } = req.body;
  if (!fullName || !email || !department || !position) {
    return res.status(400).json({ error: "Required fields are missing" });
  }

  if (access.scope === "department") {
    const isAllowedDept = await checkScopeDepartment(req.user.email, department);
    if (!isAllowedDept) {
      return res.status(403).json({ error: "Cannot create employee outside your department scope" });
    }
  } else if (access.scope === "self") {
    return res.status(403).json({ error: "Scope 'self' cannot create employees" });
  }

  const existing = await Employee.findOne({ email });
  if (existing) return res.status(409).json({ error: "Employee already exists" });

  const newEmployee = new Employee({ 
    fullName, 
    email, 
    department, 
    team: team || null,
    position,
    status: status || "ACTIVE",
    employmentType: employmentType || "FULL_TIME",
    managerId: managerId || null,
    employeeCode: employeeCode || `EMP-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
    gender: gender || "MALE",
    maritalStatus: maritalStatus || "SINGLE",
    age: age || null,
    dateOfBirth, nationality, idNumber, profilePicture,
    workEmail, phoneNumber, address, additionalContact,
    dateOfHire, workLocation, onlineStorageLink,
    education, trainingCourses, skills, languages,
    financial
  });
  await newEmployee.save();

  // ----- Auto Provision User Account -----
  const existingUser = await User.findOne({ email });
  let provisionalRole = "EMPLOYEE";
  let userProvisioned = false;
  
  // Super simple role inference for HR Staff vs Manager (In an advanced system, this would be explicitly managed via permissions)
  if (department === "HR") provisionalRole = "HR_STAFF";
  
  if (!existingUser) {
    const passwordHash = await hashPassword("Welcome123!");
    const newUser = new User({
      email: email,
      passwordHash,
      role: provisionalRole,
      employeeId: newEmployee._id,
      requirePasswordChange: true,
    });
    await newUser.save();
    userProvisioned = true;
  } else if (!existingUser.employeeId) {
    existingUser.employeeId = newEmployee._id;
    await existingUser.save();
  }

  return res.status(201).json({
    message: "Employee created successfully",
    employee: newEmployee,
    userProvisioned,
    defaultPassword: userProvisioned ? "Welcome123!" : null,
  });
});

router.put("/:id", requireAuth, async (req, res) => {
  const access = await resolveEmployeeAccess(req.user);
  if (!access.actions.includes("edit")) return res.status(403).json({ error: "Forbidden" });

  const { 
    fullName, email, department, team, position, status, employmentType, managerId,
    employeeCode, gender, maritalStatus, age,
    dateOfBirth, nationality, idNumber, profilePicture,
    workEmail, phoneNumber, address, additionalContact,
    dateOfHire, workLocation, onlineStorageLink,
    education, trainingCourses, skills, languages,
    financial 
  } = req.body;
  const employee = await Employee.findById(req.params.id);

  if (!employee) return res.status(404).json({ error: "Employee not found" });

  if (access.scope === "department") {
    const isAllowedDept = await checkScopeDepartment(req.user.email, employee.department);
    if (!isAllowedDept) return res.status(403).json({ error: "Not authorized to edit this record" });
    
    // Check if trying to move the employee to a restricted department
    if (department && department !== employee.department) {
       const isTargetAllowedDept = await checkScopeDepartment(req.user.email, department);
       if (!isTargetAllowedDept) return res.status(403).json({ error: "Cannot move employee to a restricted department" });
    }
  } else if (access.scope === "self") {
    if (employee.email !== req.user.email) return res.status(403).json({ error: "Forbidden: Can only edit self" });
    if (department && department !== employee.department) return res.status(403).json({ error: "Cannot change own department" });
  }

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

  if (dateOfBirth !== undefined) employee.dateOfBirth = dateOfBirth;
  if (nationality !== undefined) employee.nationality = nationality;
  if (idNumber !== undefined) employee.idNumber = idNumber;
  if (profilePicture !== undefined) employee.profilePicture = profilePicture;
  if (workEmail !== undefined) employee.workEmail = workEmail;
  if (phoneNumber !== undefined) employee.phoneNumber = phoneNumber;
  if (address !== undefined) employee.address = address;
  if (additionalContact !== undefined) employee.additionalContact = additionalContact;
  if (dateOfHire !== undefined) employee.dateOfHire = dateOfHire;
  if (workLocation !== undefined) employee.workLocation = workLocation;
  if (onlineStorageLink !== undefined) employee.onlineStorageLink = onlineStorageLink;
  if (education !== undefined) employee.education = education;
  if (trainingCourses !== undefined) employee.trainingCourses = trainingCourses;
  if (skills !== undefined) employee.skills = skills;
  if (languages !== undefined) employee.languages = languages;
  if (financial !== undefined) employee.financial = financial;
  if (insurance !== undefined) employee.insurance = insurance;

  await employee.save();

  // Cascade Termination to User Account
  if (employee.status === "TERMINATED" || employee.status === "RESIGNED") {
    await User.updateOne({ employeeId: employee._id }, { $set: { isActive: false } });
  } else if (employee.status === "ACTIVE") {
    await User.updateOne({ employeeId: employee._id }, { $set: { isActive: true } });
  }

  return res.json(employee);
});

router.delete("/:id", requireAuth, async (req, res) => {
  const access = await resolveEmployeeAccess(req.user);
  if (!access.actions.includes("delete")) return res.status(403).json({ error: "Forbidden" });

  // Explicit policy: Only Managers and Admins can delete data.
  if (req.user.role === "EMPLOYEE" || req.user.role === 1) {
    return res.status(403).json({ error: "Policy Restriction: Only Managers and Admins can delete data." });
  }

  const employee = await Employee.findById(req.params.id);
  if (!employee) return res.status(404).json({ error: "Employee not found" });

  if (access.scope === "department") {
    // Only Managers can delete FROM their managed departments explicitly, not just from the dept they belong to!
    const deptNames = await Department.find({ head: req.user.email }).distinct("name");
    if (!deptNames.includes(employee.department)) {
      return res.status(403).json({ error: "Managers can only delete employees from departments they explicitly manage." });
    }
  } else if (access.scope === "self") {
    return res.status(403).json({ error: "Scope 'self' cannot delete records." });
  }

  await Employee.findByIdAndDelete(req.params.id);
  
  // Cascade Deletion to User Authentication (Disable login fully)
  await User.updateOne({ employeeId: req.params.id }, { $set: { isActive: false } });

  return res.json({ success: true });
});

export default router;
