/**
 * Custom error class for operational API errors.
 * These are "expected" errors (bad input, not found, forbidden) as opposed to
 * programming bugs. The global error handler uses `isOperational` to decide
 * whether to expose the message to the client.
 */
export class ApiError extends Error {
  /**
   * @param {number} statusCode  HTTP status code (400, 401, 403, 404, 409, 422, 500…)
   * @param {string} message     Human-readable error message sent to the client.
   * @param {object} [details]   Optional structured details (validation errors, etc.)
   */
  constructor(statusCode, message, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;        // marks this as a "known" error
    Error.captureStackTrace(this, this.constructor);
  }
}

/* ── Convenience subclasses ── */

export class BadRequestError extends ApiError {
  constructor(message = "Bad request", details = null) {
    super(400, message, details);
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = "Unauthorized") {
    super(401, message);
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = "Forbidden") {
    super(403, message);
  }
}

export class NotFoundError extends ApiError {
  constructor(message = "Resource not found") {
    super(404, message);
  }
}

export class ConflictError extends ApiError {
  constructor(message = "Resource already exists") {
    super(409, message);
  }
}
