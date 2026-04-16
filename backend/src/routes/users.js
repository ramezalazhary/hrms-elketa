/**
 * @file `/api/users` — login accounts. Since User and Employee are merged,
 * this now manages auth fields on the Employee model.
 * Access: `requireAdminOrHrHead`; HR Head sees HR department employees only.
 */
import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { enforcePolicy } from "../middleware/enforcePolicy.js";
import { Employee } from "../models/Employee.js";
import bcrypt from "bcryptjs";
import { CANONICAL_ROLES, isAdminRole, parseRoleInput } from "../utils/roles.js";
import { bumpAuthzVersion } from "../services/authzVersionService.js";
import { isHrDepartmentMember } from "../services/authorizationPolicyService.js";

const router = Router();

const HR_DEPARTMENT_NAME = process.env.HR_DEPARTMENT_NAME || "HR";

// List users (admin gets all; HR department members get HR accounts only).
router.get("/", requireAuth, enforcePolicy("manage", "users"), async (_req, res) => {
  const actorIsAdmin = isAdminRole(_req.user?.role);
  const actorIsHrMember = actorIsAdmin ? false : await isHrDepartmentMember(_req.user);

  if (!actorIsAdmin && actorIsHrMember) {
    const hrEmployees = await Employee.find({
      department: HR_DEPARTMENT_NAME,
    }).select("_id email role");
    return res.json(
      hrEmployees.map((e) => ({
        id: e._id.toString(),
        email: e.email,
        role: e.role,
      })),
    );
  }

  if (!actorIsAdmin) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const employees = await Employee.find()
    .select("_id email role")
    .sort({ email: 1 });
  return res.json(
    employees.map((e) => ({
      id: e._id.toString(),
      email: e.email,
      role: e.role,
    })),
  );
});

// Update role (admin only — HR Head cannot change roles)
router.put("/:id/role", requireAuth, enforcePolicy("manage", "users"), async (req, res) => {
  const actorIsAdmin = isAdminRole(req.user?.role);
  if (!actorIsAdmin) {
    return res
      .status(403)
      .json({ error: "Only ADMIN can change system roles" });
  }

  const role = parseRoleInput(req.body?.role);
  if (!role) {
    return res.status(400).json({ error: "Invalid role" });
  }

  const employee = await Employee.findById(req.params.id);
  if (!employee) return res.status(404).json({ error: "User not found" });

  employee.role = role;
  await employee.save();
  await bumpAuthzVersion(employee._id);

  return res.json({
    success: true,
    user: {
      id: employee._id.toString(),
      email: employee.email,
      role: employee.role,
    },
  });
});

// Create login account (admin can create all; HR members can create HR employee logins only)
router.post("/", requireAuth, enforcePolicy("manage", "users"), async (req, res) => {
  const actorIsAdmin = isAdminRole(req.user?.role);
  const actorIsHrMember = actorIsAdmin ? false : await isHrDepartmentMember(req.user);

  const { email, password, role } = req.body ?? {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const employee = await Employee.findOne({ email }).select(
    "department passwordHash role isActive requirePasswordChange",
  );
  if (!employee) {
    return res
      .status(400)
      .json({ error: "Employee record not found for email" });
  }

  if (!actorIsAdmin && actorIsHrMember && employee.department !== HR_DEPARTMENT_NAME) {
    return res
      .status(403)
      .json({ error: "HR members can only create accounts for HR employees" });
  }

  // Check if employee already has password set
  if (employee.passwordHash) {
    return res.status(409).json({ error: "User already has an account" });
  }

  if (role !== undefined && parseRoleInput(role) === null) {
    return res.status(400).json({ error: "Invalid role" });
  }
  const parsedRequestedRole = parseRoleInput(role);
  const chosenRole = !actorIsAdmin
    ? "EMPLOYEE"
    : parsedRequestedRole && CANONICAL_ROLES.includes(parsedRequestedRole)
      ? parsedRequestedRole
      : "EMPLOYEE";

  const passwordHash = await bcrypt.hash(String(password), 10);
  employee.passwordHash = passwordHash;
  employee.role = chosenRole;
  employee.requirePasswordChange = false;
  employee.isActive = true;
  await employee.save();

  return res.status(201).json({
    user: {
      id: employee._id.toString(),
      email: employee.email,
      role: employee.role,
    },
  });
});

export default router;
