import { Employee } from "../models/Employee.js";
import { Department } from "../models/Department.js";
import { hashPassword } from "../middleware/auth.js";
import { syncEmployeeOrgCaches } from "./employeeOrgCaches.js";
import {
  ensureEmployeeCodeAvailableForOwner,
  generateDepartmentScopedCode,
  recordEmployeeCodeOwnership,
} from "./employeeLifecycleService.js";

/** Empty strings from JSON must not be cast to Date (Mongoose CastError). */
function optionalDate(value) {
  if (value == null || value === "") return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : value;
}

/**
 * Logic to create a new employee, including code generation and password hashing.
 * Reused by both standard /api/employees and the onboarding approval system.
 */
export async function createEmployee(data) {
  const {
    fullName,
    email,
    department,
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
    educationDegree,
    workPlaceDetails,
    role: requestedRole
  } = data;

  if (!fullName || !email || !department) {
    throw new Error("Required fields (fullName, email, department) are missing");
  }

  const existing = await Employee.findOne({ email });
  if (existing) {
    const err = new Error("Employee already exists");
    err.code = 11000;
    throw err;
  }

  // 2. Resolve Department Code & Generate Employee ID
  const deptDoc = await Department.findOne({ name: department });
  if (!deptDoc) {
    throw new Error("Department not found while generating code");
  }

  let finalEmployeeCode = employeeCode;
  if (!finalEmployeeCode) {
    finalEmployeeCode = await generateDepartmentScopedCode({
      departmentDoc: deptDoc,
    });
  } else {
    await ensureEmployeeCodeAvailableForOwner({
      code: finalEmployeeCode,
      ownerEmployeeId: null,
    });
  }

  let finalRole = requestedRole || (department === "HR" ? "HR_STAFF" : "EMPLOYEE");

  const newEmployee = new Employee({
    ...data,
    employeeCode: finalEmployeeCode,
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
    education: education || (educationDegree ? [{ degree: educationDegree }] : []),
    workLocation: workLocation || (workPlaceDetails?.city ? `${workPlaceDetails.city} - ${workPlaceDetails.branch || "General"}` : ""),
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
  recordEmployeeCodeOwnership(newEmployee, {
    code: finalEmployeeCode,
    departmentDoc: deptDoc,
    at: new Date(),
  });
  await newEmployee.save();
  await syncEmployeeOrgCaches(newEmployee);
  if (newEmployee.isModified()) await newEmployee.save();
  return newEmployee;
}
