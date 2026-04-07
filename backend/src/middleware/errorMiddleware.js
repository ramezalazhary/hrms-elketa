import { ApiError } from "../utils/ApiError.js";

/**
 * Global Express error-handling middleware.
 *
 * Normalises different error shapes (ApiError, Mongoose ValidationError,
 * Mongoose CastError, duplicate-key 11000, generic Error) into a single
 * consistent JSON response:
 *
 *   { error: "…", details?: […], stack?: "…" }
 *
 * In development the real message and stack are exposed; in production
 * only operational (ApiError) messages leak — everything else becomes
 * "Internal server error".
 */
export function errorMiddleware(err, req, res, _next) {
  // ── defaults ──
  let statusCode = err.statusCode || 500;
  let message    = err.message || "Internal server error";
  let details    = err.details || null;

  // ── Mongoose ValidationError ──
  if (err.name === "ValidationError" && err.errors) {
    statusCode = 400;
    message = "Validation failed";
    details = Object.entries(err.errors).map(([field, e]) => ({
      field,
      message: e.message,
    }));
  }

  // ── Mongoose CastError (usually an invalid ObjectId) ──
  if (err.name === "CastError") {
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  }

  // ── MongoDB duplicate key ──
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || "field";
    message = `Duplicate value for "${field}". Please use another value.`;
  }

  // ── JSON parse error (malformed body) ──
  if (err.type === "entity.parse.failed") {
    statusCode = 400;
    message = "Malformed JSON in request body";
  }

  // ── Logging ──
  const isDev = process.env.NODE_ENV !== "production";

  if (statusCode >= 500) {
    // Always log server errors
    console.error(`[ERROR ${statusCode}] ${req.method} ${req.originalUrl}:`, err);
  } else if (isDev) {
    // In dev log client errors too for convenience
    console.warn(`[WARN ${statusCode}] ${req.method} ${req.originalUrl}: ${message}`);
  }

  // ── Response ──
  const isOperational = err instanceof ApiError;

  const body = {
    error: isDev || isOperational ? message : "Internal server error",
    ...(details && { details }),
    ...(isDev && { stack: err.stack }),
  };

  res.status(statusCode).json(body);
}
