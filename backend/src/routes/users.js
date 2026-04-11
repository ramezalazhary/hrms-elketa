/**
 * @file `/api/users` — login accounts. Since User and Employee are merged,
 * this now manages auth fields on the Employee model.
 * Access: `requireAdminOrHrHead`; HR Head sees HR department employees only.
 */
import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { isHrDepartmentHead } from "../middleware/rbac.js";
import { enforcePolicy } from "../middleware/enforcePolicy.js";
import { Employee } from "../models/Employee.js";
import bcrypt from "bcryptjs";
import { parseRoleInput } from "../utils/roles.js";

const router = Router();

const HR_DEPARTMENT_NAME = process.env.HR_DEPARTMENT_NAME || "HR";

const VALID_USER_ROLES = [
  "EMPLOYEE",
  "TEAM_LEADER",
  "MANAGER",
  "HR_STAFF",
  "HR_MANAGER",
  "ADMIN",
];

// List users (admin or Head of HR — HR sees HR accounts only)
router.get("/", requireAuth, enforcePolicy("manage", "users"), async (_req, res) => {
  const hrHead = await isHrDepartmentHead(_req.user.email);

  if (hrHead) {
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
  const hrHead = await isHrDepartmentHead(req.user.email);
  if (hrHead) {
    return res
      .status(403)
      .json({ error: "HR Head cannot change system roles" });
  }

  const role = parseRoleInput(req.body?.role);
  if (!VALID_USER_ROLES.includes(role)) {
    return res.status(400).json({ error: "Invalid role" });
  }

  const employee = await Employee.findById(req.params.id);
  if (!employee) return res.status(404).json({ error: "User not found" });

  employee.role = role;
  await employee.save();

  return res.json({
    success: true,
    user: {
      id: employee._id.toString(),
      email: employee.email,
      role: employee.role,
    },
  });
});

// Create login account (admin or HR Head — HR only for HR employees)
router.post("/", requireAuth, enforcePolicy("manage", "users"), async (req, res) => {
  const actorEmail = req.user.email;
  const hrHead = await isHrDepartmentHead(actorEmail);

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

  if (hrHead && employee.department !== HR_DEPARTMENT_NAME) {
    return res
      .status(403)
      .json({ error: "HR Head can only create accounts for HR employees" });
  }

  // Check if employee already has password set
  if (employee.passwordHash) {
    return res.status(409).json({ error: "User already has an account" });
  }

  if (role !== undefined && parseRoleInput(role) === null) {
    return res.status(400).json({ error: "Invalid role" });
  }
  const parsedRequestedRole = parseRoleInput(role);
  const chosenRole = hrHead
    ? "EMPLOYEE"
    : VALID_USER_ROLES.includes(parsedRequestedRole)
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
