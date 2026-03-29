import { body, param, validationResult } from "express-validator";
import Joi from "joi";

/**
 * Express-validator: if any prior rule failed, respond 400 with details; else `next()`.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 * @returns {void}
 *
 * Data flow: `validationResult(req)` → non-empty → 400 JSON; else `next()`.
 */
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: "Validation failed",
      details: errors.array(),
    });
  }
  next();
};

/** Chain: email/password/role rules for registering a user via validation middleware. */
export const validateUserCreation = [
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email"),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage(
      "Password must contain at least one uppercase letter, one lowercase letter, and one number",
    ),
  body("role")
    .isIn([1, 2, 3, "EMPLOYEE", "MANAGER", "HR_STAFF", "HR_MANAGER", "ADMIN"])
    .withMessage("Invalid role"),
  handleValidationErrors,
];

/** Chain: login body (email + password). */
export const validateLogin = [
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email"),
  body("password").notEmpty().withMessage("Password is required"),
  handleValidationErrors,
];

/** Chain: POST /departments body fields. */
export const validateDepartmentCreation = [
  body("name")
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Department name must be between 1 and 100 characters"),
  body("code")
    .trim()
    .isLength({ min: 2, max: 10 })
    .withMessage("Department code must be between 2 and 10 characters")
    .matches(/^[a-zA-Z0-9]+$/)
    .withMessage("Department code must be alphanumeric"),
  // Empty string from HTML selects must skip email check (optional() alone only skips undefined/null).
  body("head")
    .optional({ values: "falsy" })
    .isEmail()
    .withMessage("Head must be a valid email"),
  body("positions")
    .optional()
    .isArray()
    .withMessage("Positions must be an array"),
  body("positions.*.title")
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Position title must be between 1 and 100 characters"),
  body("positions.*.level")
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage("Position level must be between 1 and 50 characters"),
  body("requiredDocuments")
    .optional()
    .isArray()
    .withMessage("Required documents must be an array"),
  body("requiredDocuments.*.name")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Document name is required"),
  handleValidationErrors,
];

/** Chain: PUT /departments/:id — includes MongoId on `id` param plus creation fields. */
export const validateDepartmentUpdate = [
  param("id").isMongoId().withMessage("Invalid department ID"),
  ...validateDepartmentCreation.slice(0, -1),
  handleValidationErrors,
];

/** Chain: minimal fields for creating an employee record. */
export const validateEmployeeCreation = [
  body("fullName")
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage("Full name must be between 1 and 200 characters"),
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email"),
  body("department")
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Department must be between 1 and 100 characters"),
  body("position")
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Position must be between 1 and 100 characters"),
  handleValidationErrors,
];

/** Chain: POST/upsert permission row body. */
export const validatePermissionCreation = [
  body("userId").isString().notEmpty().withMessage("User ID is required"),
  body("module")
    .isIn(["recruitment", "payroll", "employees", "departments", "attendance"])
    .withMessage("Invalid module"),
  body("actions")
    .isArray({ min: 1 })
    .withMessage("At least one action is required"),
  body("actions.*")
    .isIn(["view", "create", "edit", "delete", "approve", "export"])
    .withMessage("Invalid action"),
  body("scope")
    .isIn(["self", "department", "all"])
    .withMessage("Invalid scope"),
  handleValidationErrors,
];

/** Joi schema: auth register alternative path. */
export const userCreationSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .required()
    .messages({
      "string.pattern.base":
        "Password must contain at least one uppercase letter, one lowercase letter, and one number",
    }),
  role: Joi.alternatives().try(
    Joi.number().integer().min(1).max(3),
    Joi.string().valid("EMPLOYEE", "MANAGER", "HR_STAFF", "HR_MANAGER", "ADMIN"),
  ).required(),
});

/** Joi schema: department payload. */
export const departmentCreationSchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  code: Joi.string().alphanum().uppercase().min(2).max(10).required(),
  head: Joi.alternatives().try(Joi.string().email(), Joi.string().valid("")).optional(),
  positions: Joi.array().items(
    Joi.object({
      title: Joi.string().min(1).max(100).required(),
      level: Joi.string().min(1).max(50).required(),
    }),
  ),
});

/**
 * Factory: Joi-based body validation middleware.
 *
 * @param {import("joi").ObjectSchema} schema
 * @returns {import("express").RequestHandler}
 *
 * Data flow: `schema.validate(req.body)` → errors mapped to 400 JSON; else `next()`.
 */
export const validateWithJoi = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        error: "Validation failed",
        details: error.details.map((detail) => ({
          field: detail.path.join("."),
          message: detail.message,
        })),
      });
    }
    next();
  };
};
