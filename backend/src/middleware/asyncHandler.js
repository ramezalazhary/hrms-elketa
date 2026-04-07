/**
 * Wraps async Express route handlers to automatically catch errors
 * and pass them to the next() error handler middleware.
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
