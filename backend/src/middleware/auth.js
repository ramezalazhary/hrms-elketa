import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { Employee } from "../models/Employee.js";
import { TokenBlacklist } from "../models/TokenBlacklist.js";

// Development fallback to avoid a hard failure before you create `.env`.
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || "dev-refresh-secret";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "2h";
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || "7d";

/**
 * Sends a 401 JSON error.
 * @param {import("express").Response} res
 * @param {string} [message]
 * @returns {import("express").Response}
 */
function unauthorized(res, message = "Unauthorized") {
  return res.status(401).json({ error: message });
}

/**
 * Sends a 403 JSON error.
 * @param {import("express").Response} res
 * @param {string} [message]
 * @returns {import("express").Response}
 */
function forbidden(res, message = "Forbidden") {
  return res.status(403).json({ error: message });
}

/** Maps legacy numeric JWT roles to string roles used in the app. */
const ROLE_MAP = {
  1: "EMPLOYEE",
  2: "MANAGER",
  3: "ADMIN",
};

/**
 * Express middleware: validates `Authorization: Bearer <access_token>`, blacklist, and signature.
 *
 * @param {import("express").Request} req `req.user` set to `{ id, email, role }` on success.
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 * @returns {Promise<void>}
 *
 * Data flow: header → extract token → `TokenBlacklist` lookup → `jwt.verify` →
 * normalize numeric `role` via ROLE_MAP → assign `req.user` → `next()`;
 * any failure → 401 with a specific message when possible.
 */
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return unauthorized(res);

  const token = header.slice("Bearer ".length);

  try {
    const blacklisted = await TokenBlacklist.findOne({ token });
    if (blacklisted) {
      return unauthorized(res, "Token has been revoked");
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    let resolvedRole = decoded.role;
    if (typeof resolvedRole === "number") {
      resolvedRole = ROLE_MAP[resolvedRole] || "EMPLOYEE";
    }

    const user = decoded?.sub
      ? {
          id: String(decoded.sub),
          email: String(decoded.email ?? ""),
          role: resolvedRole,
        }
      : undefined;

    if (!user || !user.email) {
      return unauthorized(res);
    }

    req.user = user;
    return next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return unauthorized(res, "Token expired");
    }
    if (err instanceof jwt.JsonWebTokenError) {
      return unauthorized(res, "Invalid token");
    }
    return unauthorized(res);
  }
}

/**
 * Creates a short-lived access JWT.
 *
 * @param {{ id: string, email: string, role: string|number }} user Payload fields.
 * @returns {string} Signed JWT (`sub`, `email`, `role`, `type: "access"`).
 *
 * Data flow: payload + `JWT_SECRET` + expiry → compact token string.
 */
export function generateAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      type: "access",
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN },
  );
}

/**
 * Creates a long-lived refresh JWT.
 *
 * @param {{ id: string, email: string, role: string|number }} user
 * @returns {string} Signed JWT (`type: "refresh"`).
 */
export function generateRefreshToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      type: "refresh",
    },
    JWT_REFRESH_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRES_IN },
  );
}

/**
 * Validates a refresh token and loads the current employee from DB.
 *
 * @param {string} token Refresh JWT string.
 * @returns {Promise<{ id: string, email: string, role: string } | null>}
 *   Employee shape if valid and employee exists; `null` if invalid/expired/missing employee.
 *
 * Data flow: `jwt.verify` with refresh secret → check `type === "refresh"` →
 * `Employee.findById` → return slim object or null.
 */
export async function verifyRefreshToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET);

    if (decoded.type !== "refresh") {
      return null;
    }

    const employee = await Employee.findById(decoded.sub);
    if (!employee) {
      return null;
    }

    return {
      id: employee.id,
      email: employee.email,
      role: employee.role,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Invalidates an access token by storing it in `TokenBlacklist` until expiry.
 *
 * @param {string} token Raw JWT (access).
 * @returns {Promise<boolean>} `true` if stored; `false` on error (logged).
 *
 * Data flow: `jwt.decode` for `exp` → `TokenBlacklist.create({ token, expiresAt })`.
 */
export async function logout(token) {
  try {
    const decoded = jwt.decode(token);
    const expiresAt = decoded?.exp
      ? new Date(decoded.exp * 1000)
      : new Date(Date.now() + 2 * 60 * 60 * 1000);

    await TokenBlacklist.create({
      token,
      expiresAt,
    });

    return true;
  } catch (error) {
    console.error("Logout error:", error);
    return false;
  }
}

/**
 * @param {string} password Plain text.
 * @returns {Promise<string>} bcrypt hash (12 rounds).
 */
export async function hashPassword(password) {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
}

/**
 * @param {string} password Plain text.
 * @param {string} hash Stored hash.
 * @returns {Promise<boolean>} bcrypt compare result.
 */
export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/**
 * Role guard factory. Two modes:
 * - **Numeric** (legacy): minimum role weight (EMPLOYEE=1, MANAGER=2, ADMIN=3).
 * - **Array / string**: explicit allowed roles; `ADMIN` always passes.
 *
 * @param {number|string|string[]} allowedRoles
 * @returns {import("express").RequestHandler}
 *
 * Data flow: no `req.user` → 401; numeric path compares `roleWeight`; array path uses `includes`;
 * success → `next()`.
 */
export function requireRole(allowedRoles) {
  return (req, res, next) => {
    const user = req.user;
    if (!user) return unauthorized(res);

    if (typeof allowedRoles === "number") {
      const roleWeight = {
        EMPLOYEE: 1,
        TEAM_LEADER: 2,
        MANAGER: 2,
        HR_STAFF: 3,
        HR_MANAGER: 3,
        ADMIN: 3,
      };
      if ((roleWeight[user.role] || 1) < allowedRoles) {
        return forbidden(res, "Insufficient permissions (Legacy Numeric)");
      }
      return next();
    }

    if (!Array.isArray(allowedRoles)) {
      allowedRoles = [allowedRoles];
    }

    if (!allowedRoles.includes(user.role) && user.role !== "ADMIN") {
      return forbidden(res, "Insufficient permissions");
    }

    next();
  };
}
