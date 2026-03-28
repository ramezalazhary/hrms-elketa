import { body, param, query, validationResult } from "express-validator";
import Joi from "joi";

// Express-validator middleware
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

// User validation rules
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
    .isIn([1, 2, 3, "EMPLOYEE", "MANAGER", "HR_STAFF", "ADMIN"])
    .withMessage("Invalid role"),
  handleValidationErrors,
];

export const validateLogin = [
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email"),
  body("password").notEmpty().withMessage("Password is required"),
  handleValidationErrors,
];

// Department validation rules
export const validateDepartmentCreation = [
  body("name")
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Department name must be between 1 and 100 characters"),
  body("head").optional().isEmail().withMessage("Head must be a valid email"),
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
  handleValidationErrors,
];

export const validateDepartmentUpdate = [
  param("id").isMongoId().withMessage("Invalid department ID"),
  ...validateDepartmentCreation.slice(0, -1), // Remove handleValidationErrors, add it back
  handleValidationErrors,
];

// Employee validation rules
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

// Permission validation rules
export const validatePermissionCreation = [
  body("userId").isString().notEmpty().withMessage("User ID is required"),
  body("module")
    .isIn(["recruitment", "payroll", "attendance", "employees", "departments"])
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

// Joi schemas for more complex validation
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
    Joi.string().valid("EMPLOYEE", "MANAGER", "HR_STAFF", "ADMIN")
  ).required(),
});

export const departmentCreationSchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  head: Joi.string().email(),
  positions: Joi.array().items(
    Joi.object({
      title: Joi.string().min(1).max(100).required(),
      level: Joi.string().min(1).max(50).required(),
    }),
  ),
});

// Validation middleware using Joi
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
