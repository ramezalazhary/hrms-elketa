/**
 * @file `/api/employees` — CRUD on `Employee` with **scope** derived from org role (Admin, HR head,
 * department head, team leader, self). Mutations check `resolveEmployeeAccess` actions + department rules.
 */
import { Router } from "express";
import { Employee } from "../models/Employee.js";
import { Department } from "../models/Department.js";
import { Team } from "../models/Team.js";
import { Branch } from "../models/Branch.js";
import { Position } from "../models/Position.js";
import { UserPermission } from "../models/Permission.js";
import { Attendance } from "../models/Attendance.js";
import { Alert } from "../models/Alert.js";
import { ManagementRequest } from "../models/ManagementRequest.js";
import { LeaveRequest } from "../models/LeaveRequest.js";
import { OrganizationPolicy } from "../models/OrganizationPolicy.js";
import { requireAuth } from "../middleware/auth.js";
import { hashPassword } from "../middleware/auth.js";
import { resolveEmployeeAccess } from "../services/accessService.js";
import { isEmployeeRole, isHrOrAdmin } from "../utils/roles.js";
import { createAuditLog, detectChanges } from "../services/auditService.js";
import { syncEmployeeLeadershipAfterSave } from "../services/employeeOrgSync.js";
import {
  enrichEmployeesForResponse,
  enrichEmployeeForResponse,
} from "../services/orgResolutionService.js";
import {
  sanitizeEnrichedEmployeeList,
  sanitizeEmployeeApiPayload,
  stripEmployeeSecrets,
} from "../utils/employeePrivacySanitizer.js";

const router = Router();

async function respondWithEnrichedEmployees(
  res,
  employees,
  isPaginated,
  pagination,
  viewer,
  access,
) {
  const enriched = await enrichEmployeesForResponse(employees);
  const sanitized = sanitizeEnrichedEmployeeList(enriched, viewer, access);
  if (isPaginated) {
    return res.json({
      employees: sanitized,
      pagination,
    });
  }
  return res.json(sanitized);
}

/** Empty strings from JSON must not be cast to Date (Mongoose CastError). */
function optionalDate(val) {
  if (!val) return undefined;
  const d = new Date(val);
  return isNaN(d.getTime()) ? undefined : d;
}

/** One calendar year after anchor (hire date, transfer date, or salary effective date). */
function addOneYear(anchorDate) {
  const d =
    anchorDate instanceof Date
      ? new Date(anchorDate.getTime())
      : optionalDate(anchorDate);
  if (!d || isNaN(d.getTime())) return undefined;
  const out = new Date(d);
  out.setFullYear(out.getFullYear() + 1);
  return out;
}

async function checkScopeDepartment(userEmail, targetDepartment) {
  const actor = await Employee.findOne({ email: userEmail })
    .select("_id department departmentId")
    .lean();
  const namesFromHead = await Department.find({ head: userEmail }).distinct("name");
  const allowed = new Set((namesFromHead || []).filter(Boolean));
  if (actor?._id) {
    const fromHeadId = await Department.find({ headId: actor._id }).distinct("name");
    for (const n of fromHeadId || []) if (n) allowed.add(n);
  }
  if (actor?.department) allowed.add(actor.department);
  if (actor?.departmentId && targetDepartment) {
    const targetDoc = await Department.findOne({ name: targetDepartment }).select("_id").lean();
    if (targetDoc && String(targetDoc._id) === String(actor.departmentId)) {
      return true;
    }
  }
  return allowed.has(targetDepartment);
}

/** ANDs an existing `query.department` (string or `{ $in }`) with allowed scope names. */
function intersectDepartmentFilter(query, allowedDeptNames) {
  const allow = new Set(
    (allowedDeptNames || []).filter((n) => n != null && n !== ""),
  );
  const d = query.department;
  let names;
  if (d && typeof d === "object" && Array.isArray(d.$in)) {
    names = d.$in.filter((n) => allow.has(n));
  } else if (typeof d === "string") {
    names = allow.has(d) ? [d] : [];
  } else {
    names = [...allow];
  }
  return { ...query, department: { $in: names } };
}

/**
 * GET /api/employees
 * Query params for filtering:
 *   ?salaryIncreaseFrom=YYYY-MM-DD&salaryIncreaseTo=YYYY-MM-DD (filters nextReviewDate)
 *   ?hireDateFrom=YYYY-MM-DD&hireDateTo=YYYY-MM-DD
 *   ?idExpiringSoon=true (within 60 days)
 *   ?recentTransfers=true (last 30 days)
 *   ?department=dept
 *   ?status=ACTIVE
 *   ?salaryMin=1000&salaryMax=5000
 *   ?manager=email@example.com — department head (`Department.head`); returns employees in those departments’ names
 *   ?location=Cairo HQ
 */
router.get("/", requireAuth, async (req, res) => {
  const access = await resolveEmployeeAccess(req.user);
  if (!access.actions.includes("view"))
    return res.status(403).json({ error: "Forbidden" });

  const {
    salaryIncreaseFrom,
    salaryIncreaseTo,
    idExpiringSoon,
    idExpired,
    recentTransfers,
    hireDateFrom,
    hireDateTo,
    department,
    status,
    salaryMin,
    salaryMax,
    manager,
    location,
    search,
    page = 1,
    limit = 20,
  } = req.query;

  const isPaginated =
    req.query.page !== undefined || req.query.limit !== undefined;
  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10) || 20;
  const skip = (pageNum - 1) * limitNum;

  let query = {};

  if (manager) {
    const headEmail = String(manager).trim();
    const managedDeptNames = await Department.find({
      head: headEmail,
    }).distinct("name");
    let inDepts = managedDeptNames;
    if (department) {
      inDepts = managedDeptNames.filter((n) => n === department);
    }
    if (inDepts.length === 0) {
      return isPaginated
        ? respondWithEnrichedEmployees(
            res,
            [],
            true,
            {
              currentPage: pageNum,
              totalPages: 0,
              totalCount: 0,
              limit: limitNum,
            },
            req.user,
            access,
          )
        : respondWithEnrichedEmployees(res, [], false, undefined, req.user, access);
    }
    query.department = { $in: inDepts };
  } else if (department) {
    query.department = department;
  }

  if (status) query.status = status;
  if (location) query.workLocation = location;

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
    query.nextReviewDate = {};
    if (salaryIncreaseFrom)
      query.nextReviewDate.$gte = new Date(salaryIncreaseFrom);
    if (salaryIncreaseTo)
      query.nextReviewDate.$lte = new Date(salaryIncreaseTo);
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
      { employeeCode: { $regex: search, $options: "i" } },
    ];
  }

  // Get total count for pagination (only if paginated)
  const totalCount = isPaginated ? await Employee.countDocuments(query) : 0;

  if (access.scope === "all") {
    const employees = await Employee.find(query)
      .populate("managerId teamLeaderId branchId")
      .sort({ fullName: 1 })
      .skip(skip)
      .limit(limitNum);

    return respondWithEnrichedEmployees(
      res,
      employees,
      isPaginated,
      isPaginated
        ? {
            currentPage: pageNum,
            totalPages: Math.ceil(totalCount / limitNum),
            totalCount,
            limit: limitNum,
          }
        : undefined,
      req.user,
      access,
    );
  }

  if (access.scope === "department") {
    const employeeRecord = await Employee.findOne({ email: req.user.email });
    let deptNames = await Department.find({ head: req.user.email }).distinct(
      "name",
    );
    if (employeeRecord) deptNames.push(employeeRecord.department);

    const deptQuery = intersectDepartmentFilter(query, deptNames);
    const deptCount = isPaginated
      ? await Employee.countDocuments(deptQuery)
      : 0;

    const employees = await Employee.find(deptQuery)
      .populate("managerId teamLeaderId branchId")
      .sort({ fullName: 1 })
      .skip(skip)
      .limit(limitNum);

    return respondWithEnrichedEmployees(
      res,
      employees,
      isPaginated,
      isPaginated
        ? {
            currentPage: pageNum,
            totalPages: Math.ceil(deptCount / limitNum),
            totalCount: deptCount,
            limit: limitNum,
          }
        : undefined,
      req.user,
      access,
    );
  }

  if (access.scope === "team") {
    let finalQuery = { ...query };
    const teamScopeOr = [
      { team: { $in: access.teams } },
      { email: req.user.email },
    ];
    if (finalQuery.$or) {
      finalQuery.$and = [{ $or: finalQuery.$or }, { $or: teamScopeOr }];
      delete finalQuery.$or;
    } else {
      finalQuery.$or = teamScopeOr;
    }

    const teamCount = isPaginated
      ? await Employee.countDocuments(finalQuery)
      : 0;
    const employees = await Employee.find(finalQuery)
      .populate("managerId teamLeaderId branchId")
      .sort({ fullName: 1 })
      .skip(skip)
      .limit(limitNum);

    return respondWithEnrichedEmployees(
      res,
      employees,
      isPaginated,
      isPaginated
        ? {
            currentPage: pageNum,
            totalPages: Math.ceil(teamCount / limitNum),
            totalCount: teamCount,
            limit: limitNum,
          }
        : undefined,
      req.user,
      access,
    );
  }

  if (access.scope === "self") {
    const selfQuery = { ...query, email: req.user.email };
    const selfCount = isPaginated
      ? await Employee.countDocuments(selfQuery)
      : 0;
    const employees = await Employee.find(selfQuery)
      .populate("managerId teamLeaderId")
      .sort({ fullName: 1 })
      .skip(skip)
      .limit(limitNum);

    return respondWithEnrichedEmployees(
      res,
      employees,
      isPaginated,
      isPaginated
        ? {
            currentPage: pageNum,
            totalPages: Math.ceil(selfCount / limitNum),
            totalCount: selfCount,
            limit: limitNum,
          }
        : undefined,
      req.user,
      access,
    );
  }

  return respondWithEnrichedEmployees(res, [], false, undefined, req.user, access);
});

router.get("/:id", requireAuth, async (req, res) => {
  const access = await resolveEmployeeAccess(req.user);
  if (!access.actions.includes("view"))
    return res.status(403).json({ error: "Forbidden" });

  const employee = await Employee.findById(req.params.id).populate(
    "managerId teamLeaderId",
  );
  if (!employee) return res.status(404).json({ error: "Employee not found" });

  const send = async () => {
    const enriched = await enrichEmployeeForResponse(employee);
    const sanitized = sanitizeEmployeeApiPayload(enriched, {
      viewer: req.user,
      access,
    });
    return res.json(sanitized);
  };

  if (access.scope === "all") return send();

  if (access.scope === "department") {
    const isAllowedDept = await checkScopeDepartment(
      req.user.email,
      employee.department,
    );
    if (isAllowedDept) return send();
    return res.status(403).json({ error: "Forbidden: Not in your scope" });
  }

  if (access.scope === "team") {
    if (
      employee.email === req.user.email ||
      access.teams.includes(employee.team)
    ) {
      return send();
    }
    return res.status(403).json({ error: "Forbidden: Not in your team scope" });
  }

  if (access.scope === "self") {
    if (employee.email === req.user.email) return send();
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
    teamLeaderId,
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
    fullNameArabic,
    nationalIdExpiryDate,
    governorate,
    city,
    emergencyPhone,
    subLocation,
    insurances,
    medicalCondition,
    socialInsurance,
    useDefaultReporting,
    branchId,
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
  } else if (access.scope === "team") {
    return res.status(403).json({
      error: "Team leaders cannot create employees via this API",
    });
  }

  const existing = await Employee.findOne({ email });
  if (existing)
    return res.status(409).json({ error: "Employee already exists" });

  try {
    const deptDoc = await Department.findOne({ name: department });
    if (!deptDoc)
      return res
        .status(404)
        .json({ error: "Department not found while generating code" });

    if (!employeeCode) {
      const deptCount = await Employee.countDocuments({ department });
      const serial = (deptCount + 1).toString().padStart(3, "0");
      req.body.employeeCode = `#${deptDoc.code}-${serial}`;
    }

    const { role: requestedRole } = req.body;
    let finalRole = "EMPLOYEE";
    if (requestedRole) {
      if (access.scope === "all") {
        finalRole = requestedRole;
      } else if (access.scope === "department") {
        const allowed = ["EMPLOYEE", "TEAM_LEADER", "MANAGER"];
        finalRole = allowed.includes(requestedRole)
          ? requestedRole
          : "EMPLOYEE";
      }
    } else {
      finalRole = department === "HR" ? "HR_STAFF" : "EMPLOYEE";
    }

    const hire = optionalDate(dateOfHire);
    const nextReviewDate = addOneYear(hire);

    const newEmployee = new Employee({
      ...req.body,
      employeeCode: req.body.employeeCode,
      departmentId: deptDoc._id, // Set normalized reference
      teamId: team
        ? (await Team.findOne({ name: team, departmentId: deptDoc._id }))?._id
        : null, // Set normalized reference if team exists
      positionId: position
        ? (
            await Position.findOne({
              title: position,
              departmentId: deptDoc._id,
            })
          )?._id
        : null, // Set normalized reference if position exists
      gender: gender || "MALE",
      maritalStatus: maritalStatus || "SINGLE",
      age: age || null,
      dateOfBirth: optionalDate(dateOfBirth),
      nationality,
      idNumber,
      nationalIdExpiryDate: optionalDate(nationalIdExpiryDate),
      profilePicture,
      workEmail,
      phoneNumber,
      emergencyPhone,
      address,
      governorate,
      city,
      additionalContact,
      dateOfHire: hire,
      nextReviewDate,
      branchId: branchId && /^[a-f\d]{24}$/i.test(branchId) ? branchId : undefined,
      workLocation: branchId && /^[a-f\d]{24}$/i.test(branchId)
        ? (await Branch.findById(branchId))?.name || workLocation
        : workLocation || branchId || undefined,
      subLocation,
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
      insurances: insurances || [],
      fullNameArabic,
      medicalCondition,
      socialInsurance,
      passwordHash: await hashPassword("Welcome123!"),
      role: finalRole,
      requirePasswordChange: true,
      isActive: true,
      useDefaultReporting:
        typeof useDefaultReporting === "boolean" ? useDefaultReporting : true,
    });
    await newEmployee.save();

    // Create audit log for employee creation
    await createAuditLog({
      entityType: "Employee",
      entityId: newEmployee._id,
      operation: "CREATE",
      newValues: newEmployee.toObject(),
      performedBy: req.user.email,
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    });

    const [createdEnriched] = await enrichEmployeesForResponse([newEmployee]);
    return res.status(201).json({
      message: "Employee created successfully",
      employee: createdEnriched,
      userProvisioned: true,
      defaultPassword: "Welcome123!",
    });
  } catch (err) {
    if (err?.name === "ValidationError")
      return res.status(400).json({ error: err.message });
    if (err?.code === 11000)
      return res.status(409).json({ error: "Employee already exists" });
    console.error("POST /employees:", err);
    return res
      .status(500)
      .json({ error: err.message || "Failed to create employee" });
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
    teamLeaderId,
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
    vacationRecords,
    fullNameArabic,
    nationalIdExpiryDate,
    governorate,
    city,
    branchId,
    emergencyPhone,
    subLocation,
    insurances,
    medicalCondition,
    socialInsurance,
    terminationDate,
    terminationReason,
    role,
    nextReviewDate,
    useDefaultReporting,
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
    if (role !== undefined && role !== employee.role)
      return res.status(403).json({ error: "Cannot change own role" });
  } else if (access.scope === "team") {
    const teams = access.teams || [];
    const inTeam = employee.team && teams.includes(employee.team);
    const isSelf = employee.email === req.user.email;
    if (!isSelf && !inTeam) {
      return res
        .status(403)
        .json({ error: "Forbidden: Not in your team scope" });
    }
    if (isSelf) {
      if (department && department !== employee.department)
        return res.status(403).json({ error: "Cannot change own department" });
      if (role !== undefined && role !== employee.role)
        return res.status(403).json({ error: "Cannot change own role" });
    } else {
      if (department && department !== employee.department) {
        return res.status(403).json({
          error: "Team leaders cannot move employees to another department",
        });
      }
      if (role !== undefined && role !== employee.role) {
        return res
          .status(403)
          .json({ error: "Cannot change role in team scope" });
      }
    }
  }

  const originalEmployee = employee.toObject();

  employee.fullName = fullName ?? employee.fullName;
  const oldEmail = employee.email;
  employee.email = email ?? employee.email;

  // Handle department changes with dual storage consistency
  if (department !== undefined) {
    const deptChanged = department !== employee.department;
    employee.department = department;
    if (deptChanged) {
      const newDeptDoc = await Department.findOne({ name: department });
      if (newDeptDoc) {
        employee.departmentId = newDeptDoc._id;
      }
    }
  }

  // Handle team changes with dual storage consistency
  if (team !== undefined) {
    const teamChanged = team !== employee.team;
    employee.team = team;
    if (teamChanged) {
      if (team && employee.departmentId) {
        const newTeamDoc = await Team.findOne({
          name: team,
          departmentId: employee.departmentId,
        });
        employee.teamId = newTeamDoc?._id || null;
      } else {
        employee.teamId = null;
      }
    }
  }

  // Handle position changes with dual storage consistency
  if (position !== undefined) {
    const posChanged = position !== employee.position;
    employee.position = position;
    if (posChanged) {
      if (position && employee.departmentId) {
        const newPosDoc = await Position.findOne({
          title: position,
          departmentId: employee.departmentId,
        });
        employee.positionId = newPosDoc?._id || null;
      } else {
        employee.positionId = null;
      }
    }
  }

  if (status !== undefined) employee.status = status;
  if (employmentType !== undefined) employee.employmentType = employmentType;

  if (role !== undefined) {
    const allowedRoles = [
      "EMPLOYEE",
      "TEAM_LEADER",
      "MANAGER",
      "HR_STAFF",
      "HR_MANAGER",
      "ADMIN",
    ];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }
    const privileged = ["HR_STAFF", "HR_MANAGER", "ADMIN"];
    if (privileged.includes(role) && access.scope !== "all") {
      return res
        .status(403)
        .json({ error: "Only administrators can assign HR or Admin roles" });
    }
    employee.role = role;
  }

  // Defensive: if frontend sends populated objects, extract the ID
  if (managerId !== undefined) {
    employee.managerId =
      managerId && typeof managerId === "object"
        ? managerId.id || managerId._id
        : managerId || null;
  }
  if (teamLeaderId !== undefined) {
    employee.teamLeaderId =
      teamLeaderId && typeof teamLeaderId === "object"
        ? teamLeaderId.id || teamLeaderId._id
        : teamLeaderId || null;
  }
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
  if (dateOfHire !== undefined) {
    employee.dateOfHire = optionalDate(dateOfHire);
    if (employee.dateOfHire) {
      employee.nextReviewDate = addOneYear(employee.dateOfHire);
    }
  }
  if (nextReviewDate !== undefined && access.scope === "all") {
    employee.nextReviewDate =
      nextReviewDate === null ? null : optionalDate(nextReviewDate);
  }
  if (branchId !== undefined) {
    if (branchId === null || branchId === "") {
        employee.branchId = null;
    } else if (/^[a-f\d]{24}$/i.test(branchId)) {
        employee.branchId = branchId;
    }
  }
  if (workLocation !== undefined) employee.workLocation = workLocation;
  if (onlineStorageLink !== undefined)
    employee.onlineStorageLink = onlineStorageLink;
  if (education !== undefined) employee.education = education;
  if (trainingCourses !== undefined) employee.trainingCourses = trainingCourses;
  if (skills !== undefined) employee.skills = skills;
  if (languages !== undefined) employee.languages = languages;
  if (financial !== undefined) employee.financial = financial;
  if (insurance !== undefined) employee.insurance = insurance;
  if (documentChecklist !== undefined)
    employee.documentChecklist = documentChecklist;

  if (vacationRecords !== undefined) {
    const allowedVacationTypes = new Set([
      "ANNUAL",
      "SICK",
      "UNPAID",
      "MATERNITY",
      "PATERNITY",
      "OTHER",
    ]);
    employee.vacationRecords = Array.isArray(vacationRecords)
      ? vacationRecords
          .map((r) => {
            const startDate = optionalDate(r.startDate);
            const endDate = optionalDate(r.endDate);
            if (!startDate || !endDate) return null;
            const type =
              r.type && allowedVacationTypes.has(r.type) ? r.type : "ANNUAL";
            const src =
              r.source === "LEGACY" ? "LEGACY" : "MANUAL";
            return {
              startDate,
              endDate,
              type,
              notes: r.notes ? String(r.notes).slice(0, 2000) : undefined,
              recordedBy:
                r.recordedBy != null && String(r.recordedBy).trim()
                  ? String(r.recordedBy).trim()
                  : req.user.email,
              source: src,
            };
          })
          .filter(Boolean)
      : [];
  }

  // New fields
  if (fullNameArabic !== undefined) employee.fullNameArabic = fullNameArabic;
  if (nationalIdExpiryDate !== undefined)
    employee.nationalIdExpiryDate = optionalDate(nationalIdExpiryDate);
  if (governorate !== undefined) employee.governorate = governorate;
  if (city !== undefined) employee.city = city;
  if (emergencyPhone !== undefined) employee.emergencyPhone = emergencyPhone;
  if (subLocation !== undefined) employee.subLocation = subLocation;
  if (insurances !== undefined) employee.insurances = insurances;
  if (medicalCondition !== undefined)
    employee.medicalCondition = medicalCondition;
  if (socialInsurance !== undefined) employee.socialInsurance = socialInsurance;
  if (terminationDate !== undefined) {
    employee.terminationDate =
      terminationDate === null ? null : optionalDate(terminationDate);
  }
  if (terminationReason !== undefined) {
    employee.terminationReason =
      terminationReason === null ? null : terminationReason;
  }

  if (useDefaultReporting !== undefined) {
    employee.useDefaultReporting = Boolean(useDefaultReporting);
  }

  if (employee.status === "TERMINATED" || employee.status === "RESIGNED") {
    employee.isActive = false;

    // Auto-clear from Management Positions (Dept Head or Team Leader)
    const email = employee.email;
    if (email) {
      // 1. Clear from Department head
      await Department.updateMany(
        { head: email },
        { $set: { head: "", headTitle: "Vacant" } },
      );

      // 2. Clear from Team leaders (nested array update)
      await Department.updateMany(
        { "teams.leaderEmail": email },
        {
          $set: {
            "teams.$[elem].leaderEmail": "",
            "teams.$[elem].leaderTitle": "Vacant",
          },
        },
        { arrayFilters: [{ "elem.leaderEmail": email }] },
      );

      await Team.updateMany(
        { leaderEmail: email },
        { $set: { leaderEmail: null } },
      );
    }
  } else if (employee.status === "ACTIVE") {
    employee.isActive = true;
  }

  await employee.save();

  try {
    await syncEmployeeLeadershipAfterSave(employee);
  } catch (syncErr) {
    console.error("Employee leadership sync:", syncErr);
  }

  if (oldEmail && employee.email && oldEmail !== employee.email) {
    try {
      // Cascade email change to all org structure references
      await Department.updateMany(
        { head: oldEmail },
        { $set: { head: employee.email } },
      );
      await Department.updateMany(
        { "teams.leaderEmail": oldEmail },
        {
          $set: { "teams.$[t].leaderEmail": employee.email },
        },
        { arrayFilters: [{ "t.leaderEmail": oldEmail }] },
      );
      await Department.updateMany(
        { "teams.members": oldEmail },
        {
          $set: { "teams.$[t].members.$[m]": employee.email },
        },
        {
          arrayFilters: [{ "t.members": oldEmail }, { m: oldEmail }],
        },
      );
      await Team.updateMany(
        { leaderEmail: oldEmail },
        { $set: { leaderEmail: employee.email } },
      );
      const teamIdsWithOldMember = await Team.find({
        members: oldEmail,
      }).distinct("_id");
      if (teamIdsWithOldMember.length > 0) {
        await Team.updateMany(
          { _id: { $in: teamIdsWithOldMember } },
          { $pull: { members: oldEmail } },
        );
        await Team.updateMany(
          { _id: { $in: teamIdsWithOldMember } },
          { $addToSet: { members: employee.email } },
        );
      }
      // Cascade to operational entities
      await LeaveRequest.updateMany(
        { employeeEmail: oldEmail },
        { $set: { employeeEmail: employee.email } },
      );
      await ManagementRequest.updateMany(
        { senderEmail: oldEmail },
        { $set: { senderEmail: employee.email } },
      );
    } catch (err) {
      console.error("Employee email cascade to org structure:", err);
    }
  }

  // Create audit log
  const { changes, previousValues, newValues } = detectChanges(
    originalEmployee,
    employee.toObject(),
  );
  if (Object.keys(changes).length > 0) {
    await createAuditLog({
      entityType: "Employee",
      entityId: employee._id,
      operation: "UPDATE",
      changes,
      previousValues,
      newValues,
      performedBy: req.user.email,
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    });
  }

  await employee.populate("managerId teamLeaderId");
  const [updatedEnriched] = await enrichEmployeesForResponse([employee]);
  return res.json(stripEmployeeSecrets(updatedEnriched));
});

/**
 * POST /api/employees/:id/transfer
 * Transfer an employee to another department.
 * Body: { toDepartment, newPosition, newSalary, resetNextReviewDate, notes } (resetYearlyIncreaseDate accepted as alias)
 */
router.post("/:id/transfer", requireAuth, async (req, res) => {
  const access = await resolveEmployeeAccess(req.user);
  if (!access.actions.includes("edit"))
    return res.status(403).json({ error: "Forbidden" });

  const employee = await Employee.findById(req.params.id);
  if (!employee) return res.status(404).json({ error: "Employee not found" });

  const {
    toDepartment,
    newPosition,
    newSalary,
    newEmployeeCode,
    resetNextReviewDate,
    resetYearlyIncreaseDate,
    notes,
  } = req.body;
  const resetReview =
    resetNextReviewDate === true ||
    resetNextReviewDate === "true" ||
    resetYearlyIncreaseDate === true ||
    resetYearlyIncreaseDate === "true";
  if (!toDepartment)
    return res.status(400).json({ error: "Target department is required" });

  const toDeptDoc = await Department.findOne({ name: toDepartment });
  if (!toDeptDoc)
    return res.status(404).json({ error: "Target department not found" });

  if (access.scope === "department") {
    const allowedSource = await checkScopeDepartment(
      req.user.email,
      employee.department,
    );
    const allowedTarget = await checkScopeDepartment(
      req.user.email,
      toDepartment,
    );
    if (!allowedSource)
      return res
        .status(403)
        .json({ error: "Not authorized to transfer this employee" });
    if (!allowedTarget)
      return res.status(403).json({
        error: "Cannot transfer an employee into a department outside your scope",
      });
  } else if (access.scope === "team" || access.scope === "self") {
    return res
      .status(403)
      .json({ error: "Insufficient scope to transfer employees" });
  }

  const fromDepartmentName = employee.department;
  const previousPosition = employee.position;
  const previousBaseSalary = employee.financial?.baseSalary ?? 0;

  const fromDeptDoc = await Department.findOne({ name: fromDepartmentName });
  const transferDate = new Date();
  const nextReviewAfterTransfer = resetReview
    ? addOneYear(transferDate)
    : undefined;

  const transferRecord = {
    fromDepartment: fromDeptDoc?._id,
    fromDepartmentName: employee.department,
    toDepartment: toDeptDoc._id,
    toDepartmentName: toDepartment,
    transferDate,
    newPosition: newPosition || employee.position,
    newSalary: newSalary || employee.financial?.baseSalary,
    nextReviewDateReset: resetReview,
    nextReviewDateAfterTransfer: nextReviewAfterTransfer,
    notes,
    previousEmployeeCode: newEmployeeCode ? employee.employeeCode : undefined,
    newEmployeeCode: newEmployeeCode || undefined,
    processedBy: req.user.email,
  };

  if (!employee.transferHistory) employee.transferHistory = [];
  employee.transferHistory.push(transferRecord);

  // Clear old team/position refs — employee is new to this department
  const oldTeamId = employee.teamId;
  employee.department = toDepartment;
  employee.departmentId = toDeptDoc._id;
  employee.team = null;
  employee.teamId = null;
  employee.positionId = null;
  employee.managerId = null;
  employee.teamLeaderId = null;
  if (newPosition) employee.position = newPosition;
  else employee.position = null;

  // Remove employee from old team roster
  if (oldTeamId) {
    await Team.updateOne(
      { _id: oldTeamId },
      { $pull: { members: employee.email } },
    );
  }
  if (newSalary !== undefined && newSalary !== employee.financial?.baseSalary) {
    const previousSalary = previousBaseSalary;

    // Log into salary history
    if (!employee.salaryHistory) employee.salaryHistory = [];
    employee.salaryHistory.push({
      previousSalary,
      newSalary,
      increaseAmount: newSalary - previousSalary,
      increasePercentage:
        previousSalary > 0
          ? Number(
              (((newSalary - previousSalary) / previousSalary) * 100).toFixed(
                2,
              ),
            )
          : 100,
      effectiveDate: transferDate,
      reason: `Salary adjusted during transfer to ${toDepartment}`,
      processedBy: req.user.email,
    });

    if (!employee.financial) employee.financial = {};
    employee.financial.baseSalary = newSalary;
  }
  if (resetReview && nextReviewAfterTransfer) {
    employee.nextReviewDate = nextReviewAfterTransfer;
  }
  if (newEmployeeCode) {
    employee.employeeCode = newEmployeeCode;
  }

  await employee.save();

  // Create audit log for employee transfer
  await createAuditLog({
    entityType: "Employee",
    entityId: employee._id,
    operation: "TRANSFER",
    changes: {
      department: {
        from: fromDeptDoc?.name || fromDepartmentName,
        to: toDepartment,
      },
      position: newPosition
        ? { from: previousPosition, to: newPosition }
        : undefined,
      salary:
        newSalary !== undefined
          ? { from: previousBaseSalary, to: newSalary }
          : undefined,
      employeeCode: newEmployeeCode
        ? { from: transferRecord.previousEmployeeCode, to: newEmployeeCode }
        : undefined,
    },
    reason: notes || "Employee transfer",
    performedBy: req.user.email,
    ipAddress: req.ip,
    userAgent: req.get("User-Agent"),
  });

  await employee.populate("managerId teamLeaderId");
  const [transferEnriched] = await enrichEmployeesForResponse([employee]);
  return res.json({
    message: "Employee transferred successfully",
    employee: transferEnriched,
    transferRecord,
  });
});

router.delete("/:id", requireAuth, async (req, res) => {
  const access = await resolveEmployeeAccess(req.user);
  if (!access.actions.includes("delete"))
    return res.status(403).json({ error: "Forbidden" });

  if (isEmployeeRole(req.user.role)) {
    return res.status(403).json({
      error: "Policy Restriction: Only Managers and Admins can delete data.",
    });
  }

  const employee = await Employee.findById(req.params.id);
  if (!employee) return res.status(404).json({ error: "Employee not found" });

  if (access.scope === "department") {
    const allowed = await checkScopeDepartment(
      req.user.email,
      employee.department,
    );
    if (!allowed) {
      return res.status(403).json({
        error:
          "You can only delete employees in departments you head or belong to.",
      });
    }
  } else if (access.scope === "self") {
    return res
      .status(403)
      .json({ error: "Scope 'self' cannot delete records." });
  }

  const employee_id = employee._id.toString();

  // Check for dependencies before deletion
  const openManagementRequests = await ManagementRequest.countDocuments({
    senderEmail: employee.email,
    $or: [{ status: "PENDING" }, { status: "APPROVED_MANAGER" }],
  });

  if (openManagementRequests > 0) {
    return res.status(409).json({
      error: `Cannot delete employee: ${openManagementRequests} open management request(s) exist`,
      suggestion: "Close or reassign management requests first",
    });
  }

  // Clear embedded metadata if employee is a department head or team leader
  if (employee.email) {
    // Clear from Department head
    await Department.updateMany(
      { head: employee.email },
      { $set: { head: "", headTitle: "Vacant" } },
    );

    // Clear from Team leaders (nested array update)
    await Department.updateMany(
      { "teams.leaderEmail": employee.email },
      {
        $set: {
          "teams.$[elem].leaderEmail": "",
          "teams.$[elem].leaderTitle": "Vacant",
        },
      },
      { arrayFilters: [{ "elem.leaderEmail": employee.email }] },
    );

    // Clear from standalone Team collection
    await Team.updateMany(
      { leaderEmail: employee.email },
      { $set: { leaderEmail: "", leaderTitle: "Vacant" } },
    );
  }

  // Store employee data for audit log before deletion
  const deletedEmployeeData = employee.toObject();

  // Delete all dependent records
  await Employee.findByIdAndDelete(req.params.id);
  await UserPermission.deleteMany({ userId: employee_id });
  await Attendance.deleteMany({ employeeId: employee._id });
  await Alert.deleteMany({ employeeId: employee._id });
  await LeaveRequest.deleteMany({ employeeId: employee._id });
  await ManagementRequest.deleteMany({ senderEmail: employee.email });

  // Clear manager references from other employees
  await Employee.updateMany(
    { managerId: employee_id },
    { $set: { managerId: null } },
  );

  // Clear team leader references from other employees
  await Employee.updateMany(
    { teamLeaderId: employee_id },
    { $set: { teamLeaderId: null } },
  );

  // Create audit log for employee deletion
  await createAuditLog({
    entityType: "Employee",
    entityId: employee_id,
    operation: "DELETE",
    previousValues: deletedEmployeeData,
    performedBy: req.user.email,
    ipAddress: req.ip,
    userAgent: req.get("User-Agent"),
  });

  return res.json({ success: true });
});

/**
 * Process Annual Salary Increase
 * @route POST /api/employees/:id/process-increase
 */
router.post("/:id/process-increase", requireAuth, async (req, res) => {
  const { role, email } = req.user;
  // HR roles may process increases for any employee company-wide (no department/team scope).
  if (!isHrOrAdmin(req.user)) {
    return res
      .status(403)
      .json({ error: "Unauthorized to process salary increases" });
  }

  // Use org policy as default increase %, allow manual override per request
  const policy = await OrganizationPolicy.findOne({ name: "default" });

  let { increasePercentage, increaseAmount, reason, effectiveDate } =
    req.body;
  const employee = await Employee.findById(req.params.id);

  if (!employee) {
    return res.status(404).json({ error: "Employee not found" });
  }

  if (employee.status === "TERMINATED" || employee.status === "RESIGNED") {
    return res.status(400).json({
      error:
        "Cannot process salary increase for a terminated or resigned employee",
    });
  }

  const hasManualPercent =
    increasePercentage !== undefined &&
    increasePercentage !== null &&
    increasePercentage !== "";
  const hasManualAmount =
    increaseAmount !== undefined &&
    increaseAmount !== null &&
    increaseAmount !== "";

  if (!hasManualPercent && !hasManualAmount) {
    const rules = policy?.salaryIncreaseRules;
    if (Array.isArray(rules) && rules.length > 0) {
      const idStr = employee._id?.toString();
      const code = employee.employeeCode;
      const dept = employee.department;
      const byEmployee = rules.find(
        (r) =>
          r.type === "EMPLOYEE" &&
          (r.target === idStr || r.target === code),
      );
      const byDepartment = rules.find(
        (r) => r.type === "DEPARTMENT" && r.target === dept,
      );
      const defaultRule = rules.find((r) => r.type === "DEFAULT");
      const resolved =
        byEmployee?.percentage ??
        byDepartment?.percentage ??
        defaultRule?.percentage;
      if (resolved !== undefined && resolved !== null) {
        increasePercentage = resolved;
      }
    }
  }

  const usePercent =
    increasePercentage !== undefined &&
    increasePercentage !== null &&
    increasePercentage !== "";
  const useAmount =
    increaseAmount !== undefined &&
    increaseAmount !== null &&
    increaseAmount !== "";

  const currentSalary = employee.financial?.baseSalary || 0;
  let computedNewSalary = currentSalary;
  let computedAmount = 0;
  let computedPercent = 0;

  if (usePercent) {
    computedPercent = Number(increasePercentage);
    computedAmount = (currentSalary * computedPercent) / 100;
    computedNewSalary = currentSalary + computedAmount;
  } else if (useAmount) {
    computedAmount = Number(increaseAmount);
    computedNewSalary = currentSalary + computedAmount;
    computedPercent =
      currentSalary > 0 ? (computedAmount / currentSalary) * 100 : 0;
  } else {
    return res
      .status(400)
      .json({ error: "Must provide increasePercentage or increaseAmount" });
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
  employee.nextReviewDate = nextDate;

  // Track the change in transfer/salary logs if needed, but salaryHistory is enough.
  await employee.save();

  await employee.populate("managerId teamLeaderId");
  const [salaryEnriched] = await enrichEmployeesForResponse([employee]);
  return res.json({
    message: "Salary increase processed successfully",
    employee: salaryEnriched,
    nextIncreaseDate: nextDate,
    nextReviewDate: nextDate,
  });
});

export default router;
