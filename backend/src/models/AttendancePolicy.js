import { Schema, model } from "mongoose";

const AttendancePolicySchema = new Schema(
  {
    // ─── Identity ─────────────────────────────────────
    name: { type: String, required: true, unique: true },
    description: { type: String },
    isDefault: { type: Boolean, default: false },

    // ─── Shift Definition ─────────────────────────────
    shiftType: {
      type: String,
      enum: ["FIXED", "FLEXIBLE", "NIGHT", "SPLIT", "ROTATING"],
      default: "FIXED",
    },
    workStartTime: { type: String, default: "09:00" }, // HH:mm
    workEndTime: { type: String, default: "17:00" },
    scheduledHours: { type: Number, default: 8 },

    // Split shift (2nd block)
    splitStartTime: { type: String },
    splitEndTime: { type: String },

    // ─── Grace & Thresholds ───────────────────────────
    graceMinutes: { type: Number, default: 15 },
    halfDayThresholdHours: { type: Number, default: 4 },
    minHoursForPresent: { type: Number, default: 6 },
    overtimeThresholdMin: { type: Number, default: 30 },
    autoBreakDeductMin: { type: Number, default: 60 },

    // ─── Working Days ─────────────────────────────────
    workingDays: {
      type: [String],
      default: ["MON", "TUE", "WED", "THU", "FRI"],
    },

    // ─── Night Shift ──────────────────────────────────
    isNightShift: { type: Boolean, default: false },
    nightShiftCutoff: { type: String, default: "04:00" },

    // ─── Payroll Rules ────────────────────────────────
    overtimeRate: { type: Number, default: 1.5 },
    lateDeductionRules: [{
      fromMinutes: { type: Number },
      toMinutes: { type: Number },
      deductionValue: { type: Number }, // Amount to deduct
      deductionUnit: { type: String, enum: ["DAYS", "HOURS", "MINUTES"], default: "HOURS" }
    }],
    absentDeductionDays: { type: Number, default: 1 },

    // ─── Scope ────────────────────────────────────────
    appliesTo: {
      type: String,
      enum: ["ALL", "DEPARTMENT", "TEAM", "INDIVIDUAL"],
      default: "ALL",
    },
    departmentId: { type: Schema.Types.ObjectId, ref: "Department" },
    teamId: { type: Schema.Types.ObjectId, ref: "Team" },
    employeeIds: [{ type: Schema.Types.ObjectId, ref: "Employee" }],
  },
  {
    timestamps: true,
    collection: "attendance_policies",
    toJSON: {
      transform: (_doc, ret) => {
        ret.id = ret._id?.toString();
        delete ret._id;
        return ret;
      },
    },
  },
);

export const AttendancePolicy = model("AttendancePolicy", AttendancePolicySchema);
