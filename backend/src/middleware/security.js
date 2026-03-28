import helmet from "helmet";
import rateLimit from "express-rate-limit";

// Security headers middleware
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

// Rate limiting middleware
export const createRateLimit = (windowMs, max, message) => {
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

// General API rate limit (100 requests per 15 minutes)
export const apiLimiter = createRateLimit(15 * 60 * 1000, 100);

// Auth rate limit (increased for testing)
export const authLimiter = createRateLimit(
  60 * 60 * 1000,
  1000,
  "Too many login attempts, please try again in an hour.",
);

// Strict rate limit for sensitive operations (increased for testing)
export const strictLimiter = createRateLimit(
  60 * 60 * 1000,
  1000,
  "Too many sensitive operations, please try again in an hour.",
);
