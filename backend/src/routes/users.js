/**
 * @file `/api/users` — login accounts (not employee HR records). Access: `requireAdminOrHrHead`;
 * HR Head sees users whose emails match HR department employees only and cannot change roles.
 */
import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  requireAdminOrHrHead,
  isHrDepartmentHead,
} from "../middleware/rbac.js";
import { User } from "../models/User.js";
import { Employee } from "../models/Employee.js";
import bcrypt from "bcryptjs";

const router = Router();

const HR_DEPARTMENT_NAME = process.env.HR_DEPARTMENT_NAME || "HR";

const VALID_USER_ROLES = [
  1, 2, 3,
  "EMPLOYEE", "MANAGER", "HR_STAFF", "ADMIN", "TEAM_LEADER",
];

// List users (admin or Head of HR — HR sees HR accounts only)
router.get("/", requireAuth, requireAdminOrHrHead, async (_req, res) => {
  const hrHead = await isHrDepartmentHead(_req.user.email);

  if (hrHead) {
    const hrEmployeeEmails = await Employee.find({
      department: HR_DEPARTMENT_NAME,
    }).distinct("email");
    const users = await User.find({ email: { $in: hrEmployeeEmails } })
      .select("_id email role")
      .sort({ email: 1 });
    return res.json(
      users.map((u) => ({
        id: u._id.toString(),
        email: u.email,
        role: u.role,
      })),
    );
  }

  const employeeEmails = await Employee.find().distinct("email");
  const users = await User.find({ email: { $in: employeeEmails } })
    .select("_id email role")
    .sort({ email: 1 });
  return res.json(
    users.map((u) => ({
      id: u._id.toString(),
      email: u.email,
      role: u.role,
    })),
  );
});

// Update role (admin only — HR Head cannot change roles)
router.put("/:id/role", requireAuth, requireAdminOrHrHead, async (req, res) => {
  const hrHead = await isHrDepartmentHead(req.user.email);
  if (hrHead) {
    return res.status(403).json({ error: "HR Head cannot change system roles" });
  }

  const { role } = req.body ?? {};
  if (!VALID_USER_ROLES.includes(role)) {
    return res.status(400).json({ error: "Invalid role" });
  }

  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });

  user.role = role;
  await user.save();

  return res.json({
    success: true,
    user: { id: user._id.toString(), email: user.email, role: user.role },
  });
});

// Create login account (admin or HR Head — HR only for HR employees)
router.post("/", requireAuth, requireAdminOrHrHead, async (req, res) => {
  const actorEmail = req.user.email;
  const hrHead = await isHrDepartmentHead(actorEmail);

  const { email, password, role } = req.body ?? {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const employee = await Employee.findOne({ email }).select("department");
  if (!employee) {
    return res.status(400).json({ error: "Employee record not found for email" });
  }

  if (hrHead && employee.department !== HR_DEPARTMENT_NAME) {
    return res
      .status(403)
      .json({ error: "HR Head can only create accounts for HR employees" });
  }

  const existing = await User.findOne({ email });
  if (existing) {
    return res.status(409).json({ error: "User already exists" });
  }

  const chosenRole = hrHead
    ? "EMPLOYEE"
    : VALID_USER_ROLES.includes(role)
      ? role
      : "EMPLOYEE";

  const passwordHash = await bcrypt.hash(String(password), 10);
  const user = await User.create({ email, passwordHash, role: chosenRole });

  return res.status(201).json({
    user: { id: user._id.toString(), email: user.email, role: user.role },
  });
});

export default router;
