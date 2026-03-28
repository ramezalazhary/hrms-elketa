import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { User } from "../models/User.js";
import { Department } from "../models/Department.js";
import { Employee } from "../models/Employee.js";
import bcrypt from "bcryptjs";

const router = Router();

function requireAdmin(req, res, next) {
  if (!req.user || (req.user.role !== "ADMIN" && req.user.role !== 3)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  return next();
}

const HR_DEPARTMENT_NAME = process.env.HR_DEPARTMENT_NAME || "HR";

async function isHrHead(email) {
  const dep = await Department.findOne({ name: HR_DEPARTMENT_NAME, head: email }).select("_id");
  return Boolean(dep);
}

// List users (admin-only)
router.get("/", requireAuth, requireAdmin, async (_req, res) => {
  const hrHead = await isHrHead(_req.user.email);

  // HR Head only sees HR employees in Users list (for permissions assignment).
  if (hrHead) {
    const hrEmployeeEmails = await Employee.find({ department: HR_DEPARTMENT_NAME }).distinct("email");
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

  const users = await User.find().select("_id email role").sort({ email: 1 });
  return res.json(
    users.map((u) => ({
      id: u._id.toString(),
      email: u.email,
      role: u.role,
    })),
  );
});

// Update role (admin-only)
router.put("/:id/role", requireAuth, requireAdmin, async (req, res) => {
  const hrHead = await isHrHead(req.user.email);
  if (hrHead) {
    return res.status(403).json({ error: "HR Head cannot change system roles" });
  }

  const { role } = req.body ?? {};
  const validRoles = [1, 2, 3, "EMPLOYEE", "MANAGER", "HR_STAFF", "ADMIN"];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: "Invalid role" });
  }

  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });

  user.role = role;
  await user.save();

  return res.json({ success: true, user: { id: user._id.toString(), email: user.email, role: user.role } });
});

// Create login account for an employee (admin-only)
// - Directors: can create for anyone, choose role
// - HR Head: can create only for HR employees, role forced to 1
router.post("/", requireAuth, requireAdmin, async (req, res) => {
  const actorEmail = req.user.email;
  const hrHead = await isHrHead(actorEmail);

  const { email, password, role } = req.body ?? {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  // Must correspond to an employee record (keeps mapping consistent)
  const employee = await Employee.findOne({ email }).select("department");
  if (!employee) {
    return res.status(400).json({ error: "Employee record not found for email" });
  }

  if (hrHead && employee.department !== HR_DEPARTMENT_NAME) {
    return res.status(403).json({ error: "HR Head can only create accounts for HR employees" });
  }

  const existing = await User.findOne({ email });
  if (existing) {
    return res.status(409).json({ error: "User already exists" });
  }

  const chosenRole =
    hrHead ? "EMPLOYEE" : (validRoles.includes(role) ? role : "EMPLOYEE");

  const passwordHash = await bcrypt.hash(String(password), 10);
  const user = await User.create({ email, passwordHash, role: chosenRole });

  return res.status(201).json({
    user: { id: user._id.toString(), email: user.email, role: user.role },
  });
});

export default router;
