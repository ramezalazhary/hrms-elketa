/**
 * @file Authentication & account-maintenance HTTP routes under `/api/auth`.
 * Rate-limited via `authLimiter`. Most handlers read JSON bodies; several decode
 * Bearer JWT from `Authorization` (some use `jwt.decode` for role checks — consider aligning with `requireAuth`).
 * Now uses Employee model (merged from User).
 */
import { Router } from "express";
import jwt from "jsonwebtoken";
import { Employee } from "../models/Employee.js";
import { UserPermission } from "../models/Permission.js";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  logout,
  hashPassword,
  verifyPassword,
} from "../middleware/auth.js";
import { authLimiter } from "../middleware/security.js";
import { requireAuth } from "../middleware/auth.js";
import { requireAdminOrHrHead } from "../middleware/rbac.js";
import {
  validateLogin,
  validateUserCreation,
  validateWithJoi,
  userCreationSchema,
} from "../middleware/validation.js";
import { PasswordResetRequest } from "../models/PasswordResetRequest.js";
import { Department } from "../models/Department.js";
import { Team } from "../models/Team.js";

const router = Router();

router.use(authLimiter);

/**
 * POST /login — Body: `{ email, password }` (validated).
 * @flow Body → `Employee.findOne` → bcrypt verify → issue access + refresh JWTs → JSON `{ accessToken, refreshToken, user }`.
 */
router.post("/login", validateLogin, async (req, res) => {
  try {
    const { email, password } = req.body;
    const employee = await Employee.findOne({ email });
    if (!employee) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (!employee.isActive) {
      return res
        .status(403)
        .json({ error: "Account Disabled. Contact Administrator." });
    }

    if (!employee.passwordHash) {
      return res
        .status(401)
        .json({ error: "Account exists but has no password set. Contact Administrator." });
    }

    const isValidPassword = await verifyPassword(
      password,
      employee.passwordHash,
    );
    if (!isValidPassword) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const permissions = await UserPermission.find({ userId: employee._id });

    const authUser = {
      id: employee._id.toString(),
      email: employee.email,
      role: employee.role,
      requirePasswordChange: employee.requirePasswordChange,
      permissions: permissions.map(p => ({ module: p.module, actions: p.actions, scope: p.scope })),
    };

    const accessToken = generateAccessToken(authUser);
    const refreshToken = generateRefreshToken(authUser);

    return res.json({
      accessToken,
      refreshToken,
      user: authUser,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

/**
 * POST /refresh — Body: `{ refreshToken }`.
 * @flow Verify refresh token → load user → emit new access + refresh pair.
 */
router.post("/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: "Refresh token is required" });
    }

    const user = await verifyRefreshToken(refreshToken);
    if (!user) {
      return res
        .status(401)
        .json({ error: "Invalid or expired refresh token" });
    }

    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    return res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    console.error("Token refresh error:", error);
    res.status(500).json({ error: "Token refresh failed" });
  }
});

/**
 * POST /logout — Header: `Authorization: Bearer <access_token>`.
 * @flow Blacklist token in `TokenBlacklist` until expiry.
 */
router.post("/logout", async (req, res) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      return res
        .status(400)
        .json({ error: "Access token required for logout" });
    }

    const token = header.slice("Bearer ".length);
    const success = await logout(token);

    if (success) {
      res.json({ message: "Logged out successfully" });
    } else {
      res.status(500).json({ error: "Logout failed" });
    }
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ error: "Logout failed" });
  }
});

/**
 * POST /register — Public registration with Joi-validated body (`email`, `password`, `role`).
 * @flow Duplicate check → hash password → `Employee.create` with auth fields → 201 + slim employee JSON.
 */
router.post(
  "/register",
  validateWithJoi(userCreationSchema),
  async (req, res) => {
    try {
      const { email, password } = req.body;

      // Check if employee already exists
      const existingEmployee = await Employee.findOne({ email });
      if (existingEmployee) {
        return res.status(409).json({ error: "Employee already exists" });
      }

      // Hash password
      const passwordHash = await hashPassword(password);

      // Create employee with auth fields — role is always EMPLOYEE for public registration
      const newEmployee = new Employee({
        email,
        passwordHash,
        role: "EMPLOYEE",
        fullName: email.split("@")[0], // Placeholder
        position: "Unknown", // Placeholder
        department: "Unknown", // Placeholder
        isActive: true,
      });

      await newEmployee.save();

      const authUser = {
        id: newEmployee._id.toString(),
        email: newEmployee.email,
        role: newEmployee.role,
        permissions: [],
      };

      res.status(201).json({
        user: authUser,
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ error: "Employee registration failed" });
    }
  },
);

/**
 * POST /change-password — Bearer access token + `{ currentPassword, newPassword }`.
 * @flow Verify JWT → load user → verify old hash → validate new password → save → blacklist old token.
 */
router.post("/change-password", async (req, res) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const token = header.slice("Bearer ".length);
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ error: "Current and new password are required" });
    }

    // Verify token to get user ID securely
    let decoded;
    try {
      // Use the internal auth-secret fallback if env is missing
      const secret = process.env.JWT_SECRET || "dev-secret";
      decoded = jwt.verify(token, secret);
    } catch (err) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    if (!decoded?.sub) {
      return res.status(401).json({ error: "Invalid token payload" });
    }

    const user = await Employee.findById(decoded.sub);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Verify current password
    const isValidPassword = await verifyPassword(
      currentPassword,
      user.passwordHash,
    );
    if (!isValidPassword) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    // Validate new password strength
    if (
      newPassword.length < 8 ||
      !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)
    ) {
      return res.status(400).json({
        error:
          "New password must be at least 8 characters and contain uppercase, lowercase, and number",
      });
    }

    // Hash and update password
    user.passwordHash = await hashPassword(newPassword);
    user.requirePasswordChange = false;
    await user.save();

    // Blacklist current token to force re-login
    await logout(token);

    res.json({ message: "Password changed successfully. Please login again." });
  } catch (error) {
    console.error("Password change error:", error);
    res.status(500).json({ error: "Password change failed" });
  }
});

/**
 * POST /forgot-password — `{ email }`; creates `PasswordResetRequest` if user exists (response always generic).
 */
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });

    // Validate if the user even exists before accepting the request
    const user = await Employee.findOne({ email });
    if (!user) {
      // Standard security practice: do not reveal if email exists, just return generic success
      return res.json({
        message:
          "If an account exists, a reset request has been sent to the Administrator.",
      });
    }

    // Check if there is an existing pending request
    const existing = await PasswordResetRequest.findOne({
      email,
      status: "PENDING",
    });
    if (!existing) {
      await PasswordResetRequest.create({ email });
    }

    res.json({
      message:
        "If an account exists, a reset request has been sent to the Administrator.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ error: "Failed to submit request" });
  }
});

/**
 * GET /password-requests — Verified JWT; Admin or Head of HR only.
 * @returns JSON list of pending `PasswordResetRequest` documents.
 */
router.get(
  "/password-requests",
  requireAuth,
  requireAdminOrHrHead,
  async (_req, res) => {
    try {
      const requests = await PasswordResetRequest.find({
        status: "PENDING",
      }).sort({
        createdAt: -1,
      });
      res.json(requests);
    } catch (error) {
      console.error("Password requests extraction error:", error);
      res.status(500).json({ error: "Failed to load requests" });
    }
  },
);

/**
 * POST /reset-password — Admin or Head of HR. Body: `targetUserId` or `targetEmail`, `newPassword`.
 * @flow Resolve target user → validate password strength → update hash → mark pending reset requests resolved.
 */
router.post(
  "/reset-password",
  requireAuth,
  requireAdminOrHrHead,
  async (req, res) => {
    try {
      const { targetUserId, targetEmail, newPassword } = req.body;
      if (!newPassword) {
        return res.status(400).json({ error: "newPassword is required" });
      }

      // Find target user
      let targetUser;
      if (targetUserId) {
        targetUser = await Employee.findById(targetUserId);
      } else if (targetEmail) {
        targetUser = await Employee.findOne({ email: targetEmail });
      }

      if (!targetUser) {
        return res.status(404).json({ error: "Target user not found" });
      }

      // Validate new password strength
      if (
        newPassword.length < 8 ||
        !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)
      ) {
        return res.status(400).json({
          error:
            "New password must be at least 8 characters and contain uppercase, lowercase, and number",
        });
      }

      // Hash and update password
      targetUser.passwordHash = await hashPassword(newPassword);

      // An admin forcing a password may want the user to change it again
      targetUser.requirePasswordChange = true;

      await targetUser.save();

      // Automatically resolve any 'PENDING' reset requests for this email
      await PasswordResetRequest.updateMany(
        { email: targetUser.email, status: "PENDING" },
        { $set: { status: "RESOLVED" } },
      );

      res.json({
        message:
          "Password reset successfully. The user will be required to change it upon their next login.",
      });
    } catch (error) {
      console.error("Admin password reset error:", error);
      res.status(500).json({ error: "Failed to reset password" });
    }
  },
);

/**
 * PUT /:id/status — Admin-only. Body: `{ isActive: boolean }`.
 * @flow Find user by `req.params.id` → set `isActive` → save → JSON confirmation.
 */
router.put("/:id/status", async (req, res) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const token = header.slice("Bearer ".length);
    let decoded;
    try {
      const secret = process.env.JWT_SECRET || "dev-secret";
      decoded = jwt.verify(token, secret);
    } catch {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    if (!decoded || decoded.role !== "ADMIN") {
      return res
        .status(403)
        .json({ error: "Only admins can change user status" });
    }

    const { isActive } = req.body;
    if (typeof isActive !== "boolean") {
      return res.status(400).json({ error: "isActive boolean is required" });
    }

    const targetUser = await Employee.findById(req.params.id);

    if (!targetUser) {
      return res.status(404).json({ error: "Target user not found" });
    }

    targetUser.isActive = isActive;
    await targetUser.save();

    if (isActive === false) {
      // Clear org leadership slots when account is deactivated
      // mirrors the cleanup done on TERMINATED / RESIGNED in employees.js
      await Department.updateMany(
        { head: targetUser.email },
        { $set: { head: null } },
      );
      await Department.updateMany(
        { "teams.leaderEmail": targetUser.email },
        { $set: { "teams.$[t].leaderEmail": null } },
        { arrayFilters: [{ "t.leaderEmail": targetUser.email }] },
      );
      await Team.updateMany(
        { leaderEmail: targetUser.email },
        { $set: { leaderEmail: null } },
      );
    }

    res.json({
      message: `User status successfully updated to ${isActive ? "ACTIVE" : "BLOCKED"}.`,
      isActive: targetUser.isActive,
    });
  } catch (error) {
    console.error("Admin status update error:", error);
    res.status(500).json({ error: "Failed to update user status" });
  }
});

export default router;
