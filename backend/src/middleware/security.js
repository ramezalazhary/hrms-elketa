import helmet from "helmet";
import rateLimit from "express-rate-limit";

/**
 * Helmet middleware: sets CSP, HSTS, and related security headers for all responses.
 *
 * @type {import("express").RequestHandler}
 * Data flow: outgoing response → helmet adds headers → next handler.
 */
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
});

/**
 * Factory: builds an express-rate-limit instance.
 * Disabled in development mode, enabled in production.
 *
 * @param {number} windowMs Time window in milliseconds.
 * @param {number} max Max requests per IP per window.
 * @param {string|object} [message] Optional error body when limit exceeded.
 * @returns {import("express").RequestHandler} Rate limiter middleware.
 *
 * Data flow: each request increments IP counter in window → over limit → 429 with `message`.
 */
export const createRateLimit = (windowMs, max, message) => {
  // Disable rate limiting in development
  if (process.env.NODE_ENV !== "production") {
    return (req, res, next) => next();
  }

  return rateLimit({
    windowMs,
    max,
    message: message || {
      error: "Too many requests from this IP, please try again later.",
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
};

/** Default limiter for all `/api/*` routes (after mount). Disabled in dev. */
export const apiLimiter = createRateLimit(15 * 60 * 1000, 100);

/** Looser limiter for `/api/auth/*` (login, etc.). Disabled in dev. */
export const authLimiter = createRateLimit(
  60 * 60 * 1000,
  1000,
  "Too many login attempts, please try again in an hour.",
);

/** Limiter for sensitive mutations (passwords, bulk imports, etc.). */
export const strictLimiter = createRateLimit(
  60 * 60 * 1000,
  1000,
  "Too many sensitive operations, please try again in an hour.",
);
