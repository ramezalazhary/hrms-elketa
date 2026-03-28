import { Schema, model } from "mongoose";

const AttendanceMetricSchema = new Schema(
  {
    // ─── Scope ────────────────────────────────────────
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      index: true,
    },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: "Department",
    },
    scope: {
      type: String,
      enum: ["EMPLOYEE", "DEPARTMENT", "COMPANY"],
      required: true,
    },

    // ─── Period ───────────────────────────────────────
    periodType: {
      type: String,
      enum: ["WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"],
      required: true,
    },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    periodLabel: { type: String }, // "2026-W13", "2026-03", "2026-Q1"

    // ─── Aggregated Counts ────────────────────────────
    totalWorkDays: { type: Number, default: 0 },
    presentDays: { type: Number, default: 0 },
    absentDays: { type: Number, default: 0 },
    lateDays: { type: Number, default: 0 },
    halfDays: { type: Number, default: 0 },
    leaveDays: { type: Number, default: 0 },
    wfhDays: { type: Number, default: 0 },
    holidayDays: { type: Number, default: 0 },

    // ─── Aggregated Hours / Minutes ───────────────────
    totalWorkHours: { type: Number, default: 0 },
    totalOvertimeHours: { type: Number, default: 0 },
    totalLateMinutes: { type: Number, default: 0 },
    totalEarlyLeaveMin: { type: Number, default: 0 },
    totalBreakMinutes: { type: Number, default: 0 },
    avgDailyHours: { type: Number, default: 0 },

    // ─── Payroll-Ready Summaries ──────────────────────
    deductionTriggerCount: { type: Number, default: 0 },
    totalLateDeductionDays: { type: Number, default: 0 },
    totalAbsentDeductionDays: { type: Number, default: 0 },
    approvedOvertimeHours: { type: Number, default: 0 },
    attendanceScore: { type: Number, default: 100 }, // 0–100

    // ─── Audit ────────────────────────────────────────
    generatedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    collection: "attendance_metrics",
    toJSON: {
      transform: (_doc, ret) => {
        ret.id = ret._id?.toString();
        delete ret._id;
        return ret;
      },
    },
  },
);

// Unique per employee-period combination
AttendanceMetricSchema.index(
  { employeeId: 1, periodType: 1, periodStart: 1 },
  { unique: true, partialFilterExpression: { scope: "EMPLOYEE" } },
);
AttendanceMetricSchema.index({ scope: 1, periodType: 1, periodStart: 1 });

export const AttendanceMetric = model("AttendanceMetric", AttendanceMetricSchema);
