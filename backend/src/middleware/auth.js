import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { User } from "../models/User.js";
import { TokenBlacklist } from "../models/TokenBlacklist.js";

// Development fallback to avoid a hard failure before you create `.env`.
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || "dev-refresh-secret";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "2h";
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || "7d";

function unauthorized(res, message = "Unauthorized") {
  return res.status(401).json({ error: message });
}

function forbidden(res, message = "Forbidden") {
  return res.status(403).json({ error: message });
}

const ROLE_MAP = {
  1: "EMPLOYEE",
  2: "MANAGER",
  3: "ADMIN"
};

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return unauthorized(res);

  const token = header.slice("Bearer ".length);

  try {
    // Check if token is blacklisted
    const blacklisted = await TokenBlacklist.findOne({ token });
    if (blacklisted) {
      return unauthorized(res, "Token has been revoked");
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Abstract the role mapping dynamically
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


// Generate access token
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

// Generate refresh token
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

// Verify refresh token
export async function verifyRefreshToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET);

    if (decoded.type !== "refresh") {
      return null;
    }

    // Check if user still exists
    const user = await User.findById(decoded.sub);
    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
    };
  } catch (error) {
    return null;
  }
}

// Logout - blacklist the token
export async function logout(token) {
  try {
    // Decode token to get expiry
    const decoded = jwt.decode(token);
    const expiresAt = decoded?.exp
      ? new Date(decoded.exp * 1000)
      : new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours default

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

// Password utilities
export async function hashPassword(password) {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

// Role-based middleware
export function requireRole(allowedRoles) {
  return (req, res, next) => {
    const user = req.user;
    if (!user) return unauthorized(res);

    if (typeof allowedRoles === "number") {
      // Legacy backwards-compatibility
      const roleWeight = {
        "EMPLOYEE": 1,
        "MANAGER": 2,
        "ADMIN": 3
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
