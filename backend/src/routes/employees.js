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
import { resolveEmployeeAccess } from "../services/accessService.js";

const router = Router();

/** Empty strings from JSON must not be cast to Date (Mongoose CastError). */
function optionalDate(val) {
  if (!val) return undefined;
  const d = new Date(val);
  return isNaN(d.getTime()) ? undefined : d;
}

function calculateNextAnniversary(hireDate) {
  if (!hireDate) return undefined;
  const today = new Date();
  const anniversary = new Date(hireDate);
  if (isNaN(anniversary.getTime())) return undefined;

  // Find this year's anniversary
  anniversary.setFullYear(today.getFullYear());

  // If this year's anniversary was more than 30 days ago, 
  // it means we've passed the window for this year; suggest next year.
  const threshold = new Date(today);
  threshold.setDate(threshold.getDate() - 30);

  if (anniversary < threshold) {
    anniversary.setFullYear(today.getFullYear() + 1);
  }
  return anniversary;
}


async function checkScopeDepartment(userEmail, targetDepartment) {
  const employeeRecord = await Employee.findOne({ email: userEmail });
  let deptNames = await Department.find({ head: userEmail }).distinct("name");
  if (employeeRecord) deptNames.push(employeeRecord.department);
  return deptNames.includes(targetDepartment);
}

/**
 * GET /api/employees
 * Query params for filtering:
 *   ?salaryIncreaseFrom=YYYY-MM-DD&salaryIncreaseTo=YYYY-MM-DD
 *   ?hireDateFrom=YYYY-MM-DD&hireDateTo=YYYY-MM-DD
 *   ?idExpiringSoon=true (within 60 days)
 *   ?recentTransfers=true (last 30 days)
 *   ?department=dept
 *   ?status=ACTIVE
 *   ?salaryMin=1000&salaryMax=5000
 *   ?manager=email@example.com
 *   ?location=Cairo HQ
 */
router.get("/", requireAuth, async (req, res) => {
  const access = await resolveEmployeeAccess(req.user);
  if (!access.actions.includes("view"))
    return res.status(403).json({ error: "Forbidden" });

  let query = {};

  const { 
    salaryIncreaseFrom, salaryIncreaseTo, 
    idExpiringSoon, idExpired, recentTransfers,
    hireDateFrom, hireDateTo,
    department, status,
    salaryMin, salaryMax,
    manager, location, search
  } = req.query;

  if (department) query.department = department;
  if (status) query.status = status;
  if (location) query.workLocation = location;
  if (manager) query["team"] = { $exists: true }; // Simplified for now since 'manager' isn't explicitly tied strictly beyond department head/team lead. Can implement exact team match if managed properly.

  if (hireDateFrom || hireDateTo) {
    query.dateOfHire = {};
    if (hireDateFrom) query.dateOfHire.$gte = new Date(hireDateFrom);
    if (hireDateTo) query.dateOfHire.$lte = new Date(hireDateTo);
  }

  if (salaryMin || salaryMax) {
    query["financial.baseSalary"] = {};
    if (salaryMin) query["financial.baseSalary"].$gte = Number(salaryMin);
    if (salaryMax) query["financial.baseSalary"].$lte = Number(salaryMax);
  }

  if (salaryIncreaseFrom || salaryIncreaseTo) {
    query.yearlySalaryIncreaseDate = {};
    if (salaryIncreaseFrom) query.yearlySalaryIncreaseDate.$gte = new Date(salaryIncreaseFrom);
    if (salaryIncreaseTo) query.yearlySalaryIncreaseDate.$lte = new Date(salaryIncreaseTo);
  }

  if (idExpiringSoon === "true") {
    const now = new Date();
    const sixtyDays = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
    query.nationalIdExpiryDate = { $gte: now, $lte: sixtyDays };
  }

  if (idExpired === "true") {
    const now = new Date();
    query.nationalIdExpiryDate = { $lt: now };
  }

  if (recentTransfers === "true") {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    query["transferHistory.transferDate"] = { $gte: thirtyDaysAgo };
  }

  if (search) {
    query.$or = [
      { fullName: { $regex: search, $options: "i" } },
      { fullNameArabic: { $regex: search, $options: "i" } },
      { employeeCode: { $regex: search, $options: "i" } }
    ];
  }

  if (access.scope === "all") {
    return res.json(await Employee.find(query).populate("managerId teamLeaderId"));
  }

  if (access.scope === "department") {
    const employeeRecord = await Employee.findOne({ email: req.user.email });
    let deptNames = await Department.find({ head: req.user.email }).distinct("name");
    if (employeeRecord) deptNames.push(employeeRecord.department);
    return res.json(await Employee.find({ ...query, department: { $in: deptNames } }).populate("managerId teamLeaderId"));
  }

  if (access.scope === "team") {
    let finalQuery = { ...query };
    const teamScopeOr = [{ team: { $in: access.teams } }, { email: req.user.email }];
    if (finalQuery.$or) {
      finalQuery.$and = [ { $or: finalQuery.$or }, { $or: teamScopeOr } ];
      delete finalQuery.$or;
    } else {
      finalQuery.$or = teamScopeOr;
    }
    return res.json(await Employee.find(finalQuery).populate("managerId teamLeaderId"));
  }

  if (access.scope === "self") {
    return res.json(await Employee.find({ ...query, email: req.user.email }).populate("managerId teamLeaderId"));
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
  if (!access.actions.includes("create"))
    return res.status(403).json({ error: "Forbidden" });

  const {
    fullName, email, department, team, position, status, employmentType,
    managerId, teamLeaderId, employeeCode, gender, maritalStatus, age, dateOfBirth,
    nationality, idNumber, profilePicture, workEmail, phoneNumber, address,
    additionalContact, dateOfHire, workLocation, onlineStorageLink,
    education, trainingCourses, skills, languages, financial, insurance,
    fullNameArabic, nationalIdExpiryDate, governorate, city, emergencyPhone,
    subLocation, insurances, medicalCondition, socialInsurance,
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

  try {
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
        const allowed = ["EMPLOYEE", "TEAM_LEADER", "MANAGER"];
        finalRole = allowed.includes(requestedRole) ? requestedRole : "EMPLOYEE";
      }
    } else {
      finalRole = department === "HR" ? "HR_STAFF" : "EMPLOYEE";
    }

    // Auto-calculate anniversary date from hire date
    const computedAnniversaryDate = calculateNextAnniversary(dateOfHire);

    const newEmployee = new Employee({
      ...req.body,
      employeeCode: req.body.employeeCode,
      gender: gender || "MALE",
      maritalStatus: maritalStatus || "SINGLE",
      age: age || null,
      dateOfBirth: optionalDate(dateOfBirth),
      nationality, idNumber,
      nationalIdExpiryDate: optionalDate(nationalIdExpiryDate),
      profilePicture, workEmail, phoneNumber, emergencyPhone,
      address, governorate, city, additionalContact,
      dateOfHire: optionalDate(dateOfHire),
      annualAnniversaryDate: optionalDate(computedAnniversaryDate),
      workLocation, subLocation, onlineStorageLink,
      education, trainingCourses, skills, languages, financial,
      insurance: insurance && typeof insurance === "object"
        ? { provider: insurance.provider || undefined, policyNumber: insurance.policyNumber || undefined, coverageType: insurance.coverageType || "HEALTH", validUntil: optionalDate(insurance.validUntil) }
        : undefined,
      insurances: insurances || [],
      yearlySalaryIncreaseDate: computedAnniversaryDate,
      fullNameArabic,
      medicalCondition,
      socialInsurance,
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
    if (err?.name === "ValidationError") return res.status(400).json({ error: err.message });
    if (err?.code === 11000) return res.status(409).json({ error: "Employee already exists" });
    console.error("POST /employees:", err);
    return res.status(500).json({ error: err.message || "Failed to create employee" });
  }
});

router.put("/:id", requireAuth, async (req, res) => {
  const access = await resolveEmployeeAccess(req.user);
  if (!access.actions.includes("edit"))
    return res.status(403).json({ error: "Forbidden" });

  const {
    fullName, email, department, team, position, status, employmentType,
    managerId, teamLeaderId, employeeCode, gender, maritalStatus, age, dateOfBirth,
    nationality, idNumber, profilePicture, workEmail, phoneNumber, address,
    additionalContact, dateOfHire, workLocation, onlineStorageLink,
    education, trainingCourses, skills, languages, financial, insurance,
    documentChecklist,
    fullNameArabic, nationalIdExpiryDate, governorate, city, emergencyPhone,
    subLocation, insurances, medicalCondition, socialInsurance,
    terminationDate, terminationReason,
  } = req.body;

  const employee = await Employee.findById(req.params.id);
  if (!employee) return res.status(404).json({ error: "Employee not found" });

  if (access.scope === "department") {
    const isAllowedDept = await checkScopeDepartment(req.user.email, employee.department);
    if (!isAllowedDept) return res.status(403).json({ error: "Not authorized to edit this record" });
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

  // Defensive: if frontend sends populated objects, extract the ID
  if (managerId !== undefined) {
    employee.managerId = (managerId && typeof managerId === 'object') ? (managerId.id || managerId._id) : (managerId || null);
  }
  if (teamLeaderId !== undefined) {
    employee.teamLeaderId = (teamLeaderId && typeof teamLeaderId === 'object') ? (teamLeaderId.id || teamLeaderId._id) : (teamLeaderId || null);
  }
  if (employeeCode !== undefined) employee.employeeCode = employeeCode;
  if (gender !== undefined) employee.gender = gender;
  if (maritalStatus !== undefined) employee.maritalStatus = maritalStatus;
  if (age !== undefined) employee.age = age;
  if (dateOfBirth !== undefined) employee.dateOfBirth = optionalDate(dateOfBirth);
  if (nationality !== undefined) employee.nationality = nationality;
  if (idNumber !== undefined) employee.idNumber = idNumber;
  if (profilePicture !== undefined) employee.profilePicture = profilePicture;
  if (workEmail !== undefined) employee.workEmail = workEmail;
  if (phoneNumber !== undefined) employee.phoneNumber = phoneNumber;
  if (address !== undefined) employee.address = address;
  if (additionalContact !== undefined) employee.additionalContact = additionalContact;
  if (dateOfHire !== undefined) {
    employee.dateOfHire = optionalDate(dateOfHire);
    if (employee.dateOfHire) {
      const computedAnniversaryDate = calculateNextAnniversary(employee.dateOfHire);
      employee.annualAnniversaryDate = computedAnniversaryDate;
      employee.yearlySalaryIncreaseDate = computedAnniversaryDate;
    }
  }
  if (workLocation !== undefined) employee.workLocation = workLocation;
  if (onlineStorageLink !== undefined) employee.onlineStorageLink = onlineStorageLink;
  if (education !== undefined) employee.education = education;
  if (trainingCourses !== undefined) employee.trainingCourses = trainingCourses;
  if (skills !== undefined) employee.skills = skills;
  if (languages !== undefined) employee.languages = languages;
  if (financial !== undefined) employee.financial = financial;
  if (insurance !== undefined) employee.insurance = insurance;
  if (documentChecklist !== undefined) employee.documentChecklist = documentChecklist;

  // New fields
  if (fullNameArabic !== undefined) employee.fullNameArabic = fullNameArabic;
  if (nationalIdExpiryDate !== undefined) employee.nationalIdExpiryDate = optionalDate(nationalIdExpiryDate);
  if (governorate !== undefined) employee.governorate = governorate;
  if (city !== undefined) employee.city = city;
  if (emergencyPhone !== undefined) employee.emergencyPhone = emergencyPhone;
  if (subLocation !== undefined) employee.subLocation = subLocation;
  if (insurances !== undefined) employee.insurances = insurances;
  if (medicalCondition !== undefined) employee.medicalCondition = medicalCondition;
  if (socialInsurance !== undefined) employee.socialInsurance = socialInsurance;
  if (terminationDate !== undefined) {
    employee.terminationDate = terminationDate === null ? null : optionalDate(terminationDate);
  }
  if (terminationReason !== undefined) {
    employee.terminationReason = terminationReason === null ? null : terminationReason;
  }

  if (employee.status === "TERMINATED" || employee.status === "RESIGNED") {
    employee.isActive = false;

    // Auto-clear from Management Positions (Dept Head or Team Leader)
    const email = employee.email;
    if (email) {
      // 1. Clear from Department head
      await Department.updateMany({ head: email }, { $set: { head: "", headTitle: "Vacant" } });
      
      // 2. Clear from Team leaders (nested array update)
      await Department.updateMany(
        { "teams.leaderEmail": email },
        { 
          $set: { 
            "teams.$[elem].leaderEmail": "",
            "teams.$[elem].leaderTitle": "Vacant"
          } 
        },
        { arrayFilters: [{ "elem.leaderEmail": email }] }
      );
    }
  } else if (employee.status === "ACTIVE") {
    employee.isActive = true;
  }

  await employee.save();

  return res.json(employee);
});

/**
 * POST /api/employees/:id/transfer
 * Transfer an employee to another department.
 * Body: { toDepartment, newPosition, newSalary, resetYearlyIncreaseDate, notes }
 */
router.post("/:id/transfer", requireAuth, async (req, res) => {
  const access = await resolveEmployeeAccess(req.user);
  if (!access.actions.includes("edit"))
    return res.status(403).json({ error: "Forbidden" });

  const employee = await Employee.findById(req.params.id);
  if (!employee) return res.status(404).json({ error: "Employee not found" });

  const { toDepartment, newPosition, newSalary, newEmployeeCode, resetYearlyIncreaseDate, notes } = req.body;
  if (!toDepartment) return res.status(400).json({ error: "Target department is required" });

  const toDeptDoc = await Department.findOne({ name: toDepartment });
  if (!toDeptDoc) return res.status(404).json({ error: "Target department not found" });

  const fromDeptDoc = await Department.findOne({ name: employee.department });
  const transferDate = new Date();
  let newYearlyIncreaseDate = employee.yearlySalaryIncreaseDate;

  if (resetYearlyIncreaseDate) {
    newYearlyIncreaseDate = new Date(transferDate);
    newYearlyIncreaseDate.setFullYear(newYearlyIncreaseDate.getFullYear() + 1);
  }

  const transferRecord = {
    fromDepartment: fromDeptDoc?._id,
    fromDepartmentName: employee.department,
    toDepartment: toDeptDoc._id,
    toDepartmentName: toDepartment,
    transferDate,
    newPosition: newPosition || employee.position,
    newSalary: newSalary || employee.financial?.baseSalary,
    yearlyIncreaseDateChanged: !!resetYearlyIncreaseDate,
    newYearlyIncreaseDate: resetYearlyIncreaseDate ? newYearlyIncreaseDate : undefined,
    notes,
    previousEmployeeCode: newEmployeeCode ? employee.employeeCode : undefined,
    newEmployeeCode: newEmployeeCode || undefined,
    processedBy: req.user.email,
  };

  if (!employee.transferHistory) employee.transferHistory = [];
  employee.transferHistory.push(transferRecord);

  employee.department = toDepartment;
  employee.departmentId = toDeptDoc._id;
  if (newPosition) employee.position = newPosition;
  if (newSalary !== undefined && newSalary !== employee.financial?.baseSalary) {
    const previousSalary = employee.financial?.baseSalary || 0;
    const isIncrease = newSalary > previousSalary;
    
    // Log into salary history
    if (!employee.salaryHistory) employee.salaryHistory = [];
    employee.salaryHistory.push({
      previousSalary,
      newSalary,
      increaseAmount: newSalary - previousSalary,
      increasePercentage: previousSalary > 0 ? Number((((newSalary - previousSalary) / previousSalary) * 100).toFixed(2)) : 100,
      effectiveDate: transferDate,
      reason: `Salary adjusted during transfer to ${toDepartment}`,
      processedBy: req.user.email,
    });

    if (!employee.financial) employee.financial = {};
    employee.financial.baseSalary = newSalary;
  }
  if (resetYearlyIncreaseDate) {
    employee.yearlySalaryIncreaseDate = newYearlyIncreaseDate;
  }
  if (newEmployeeCode) {
    employee.employeeCode = newEmployeeCode;
  }

  await employee.save();

  return res.json({ message: "Employee transferred successfully", employee, transferRecord });
});

router.delete("/:id", requireAuth, async (req, res) => {
  const access = await resolveEmployeeAccess(req.user);
  if (!access.actions.includes("delete"))
    return res.status(403).json({ error: "Forbidden" });

  if (req.user.role === "EMPLOYEE" || req.user.role === 1) {
    return res.status(403).json({ error: "Policy Restriction: Only Managers and Admins can delete data." });
  }

  const employee = await Employee.findById(req.params.id);
  if (!employee) return res.status(404).json({ error: "Employee not found" });

  if (access.scope === "department") {
    const deptNames = await Department.find({ head: req.user.email }).distinct("name");
    if (!deptNames.includes(employee.department)) {
      return res.status(403).json({ error: "Managers can only delete employees from departments they explicitly manage." });
    }
  } else if (access.scope === "self") {
    return res.status(403).json({ error: "Scope 'self' cannot delete records." });
  }

  const employee_id = employee._id.toString();
  await Employee.findByIdAndDelete(req.params.id);
  await UserPermission.deleteMany({ userId: employee_id });

  return res.json({ success: true });
});

/**
 * Process Annual Salary Increase
 * @route POST /api/employees/:id/process-increase
 */
router.post("/:id/process-increase", requireAuth, async (req, res) => {
  const { role, email } = req.user;
  if (!["ADMIN", "HR_MANAGER", "HR_STAFF"].includes(role)) {
    return res.status(403).json({ error: "Unauthorized to process salary increases" });
  }

  const { increasePercentage, increaseAmount, reason, effectiveDate } = req.body;
  const employee = await Employee.findById(req.params.id);

  if (!employee) {
    return res.status(404).json({ error: "Employee not found" });
  }

  if (employee.status === "TERMINATED" || employee.status === "RESIGNED") {
    return res.status(400).json({ error: "Cannot process salary increase for a terminated or resigned employee" });
  }

  const currentSalary = employee.financial?.baseSalary || 0;
  let computedNewSalary = currentSalary;
  let computedAmount = 0;
  let computedPercent = 0;

  if (increasePercentage) {
    computedPercent = Number(increasePercentage);
    computedAmount = (currentSalary * computedPercent) / 100;
    computedNewSalary = currentSalary + computedAmount;
  } else if (increaseAmount) {
    computedAmount = Number(increaseAmount);
    computedNewSalary = currentSalary + computedAmount;
    computedPercent = currentSalary > 0 ? (computedAmount / currentSalary) * 100 : 0;
  } else {
    return res.status(400).json({ error: "Must provide increasePercentage or increaseAmount" });
  }

  // Record Transaction
  const transaction = {
    previousSalary: currentSalary,
    newSalary: Math.round(computedNewSalary),
    increaseAmount: Math.round(computedAmount),
    increasePercentage: Number(computedPercent.toFixed(2)),
    effectiveDate: effectiveDate || new Date(),
    reason: reason || "Annual Increase",
    processedBy: email,
  };

  if (!employee.salaryHistory) employee.salaryHistory = [];
  employee.salaryHistory.push(transaction);

  // Update Current Salary
  if (!employee.financial) employee.financial = {};
  employee.financial.baseSalary = Math.round(computedNewSalary);

  // Roll forward the Next Increase Date
  // Logic: Set to exactly 1 year from the processing date (or the effective date)
  const nextDate = new Date(transaction.effectiveDate);
  nextDate.setFullYear(nextDate.getFullYear() + 1);
  employee.yearlySalaryIncreaseDate = nextDate;

  // Track the change in transfer/salary logs if needed, but salaryHistory is enough.
  await employee.save();

  return res.json({
    message: "Salary increase processed successfully",
    employee,
    nextIncreaseDate: nextDate,
  });
});

export default router;
