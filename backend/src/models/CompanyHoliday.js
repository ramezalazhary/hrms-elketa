import mongoose from "mongoose";

/**
 * A declared company holiday: a date range during which affected employees
 * are treated as if they are on a paid day off — no deduction, no absence,
 * no leave balance consumed. Scope can be company-wide, per department, or
 * per individual employee.
 */
const CompanyHolidaySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    scope: {
      type: String,
      enum: ["COMPANY", "DEPARTMENT", "EMPLOYEE"],
      default: "COMPANY",
      required: true,
    },
    targetDepartmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      default: null,
    },
    targetEmployeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true },
);

// Index for fast overlap queries from attendanceAnalysisService
CompanyHolidaySchema.index({ startDate: 1, endDate: 1 });
CompanyHolidaySchema.index({ scope: 1, startDate: 1, endDate: 1 });

export const CompanyHoliday = mongoose.model("CompanyHoliday", CompanyHolidaySchema);
