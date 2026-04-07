import Joi from "joi";

const score1to5 = (field) =>
  Joi.number().integer().min(1).max(5).required().messages({
    "number.base": `${field} must be a whole number`,
    "any.required": `${field} is required`,
  });

export const createAssessmentSchema = Joi.object({
  employeeId: Joi.string().required().messages({
    "any.required": "Employee ID is required",
  }),
  date: Joi.string().pattern(/^\d{2}:\d{2}:\d{4}$/).required().messages({
    "string.pattern.base": "Date must be in dd:mm:yyyy format",
    "any.required": "Date is required",
  }),
  daysBonus: Joi.number().min(0).default(0),
  overtime: Joi.number().min(0).default(0),
  deduction: Joi.number().min(0).default(0),
  commitment: score1to5("Commitment"),
  attitude: score1to5("Attitude"),
  quality: score1to5("Quality"),
  overall: score1to5("Overall"),
  notesPrevious: Joi.string().allow("").default(""),
  feedback: Joi.string().required().messages({
    "string.empty": "Feedback cannot be empty",
    "any.required": "Feedback is required",
  }),
  reviewPeriod: Joi.string().required().messages({
    "string.empty": "Review period cannot be empty",
    "any.required": "Review period is required",
  }),
  getThebounes: Joi.boolean().default(false),
});
