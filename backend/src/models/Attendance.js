import mongoose from "mongoose";

const AttendanceSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    employeeCode: {
      type: String,
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    checkIn: {
      type: String, // Format: "HH:mm" or "HH:mm:ss"
    },
    checkOut: {
      type: String, // Format: "HH:mm" or "HH:mm:ss"
    },
    status: {
      type: String,
      enum: [
        "PRESENT",
        "ABSENT",
        "LATE",
        "EARLY_DEPARTURE",
        "ON_LEAVE",
        "OVERTIME",
        "EXCUSED",
        "PARTIAL_EXCUSED",
        "INCOMPLETE",
        "HOLIDAY",
      ],
      default: "PRESENT",
    },
    leaveRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LeaveRequest",
    },
    onApprovedLeave: { type: Boolean, default: false },
    originalStatus: { type: String },
    excuseLeaveRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LeaveRequest",
    },
    excuseCovered: { type: Boolean, default: false },
    /** True when ON_LEAVE but unpaid (no balance or not eligible). */
    unpaidLeave: { type: Boolean, default: false },
    /** True when excuse exceeds remaining quota — proportional salary deduction applies. */
    excessExcuse: { type: Boolean, default: false },
    /** Fraction of a working day for excess excuse deduction (e.g. 0.25 for 2h / 8h). */
    excessExcuseFraction: { type: Number, default: 0 },
    totalHours: {
      type: Number,
      default: 0,
    },
    /** Minutes credited from approved mid-day excuses (Phase 0c). */
    excusedMinutes: { type: Number, default: 0 },
    /** Minutes late beyond allowed excuse coverage when a row is partially excused. */
    excuseOverageMinutes: { type: Number, default: 0 },
    /** Whether HR must explicitly choose deduction source for this row. */
    requiresDeductionDecision: { type: Boolean, default: false },
    /** HR-selected deduction source for over-max excuse scenarios. */
    deductionSource: {
      type: String,
      enum: ["SALARY", "VACATION_BALANCE"],
      default: undefined,
    },
    /** HR-selected deduction unit for PARTIAL_EXCUSED routing. */
    deductionValueType: {
      type: String,
      enum: ["DAYS", "AMOUNT"],
      default: undefined,
    },
    /** HR-selected deduction numeric value (days or currency amount based on deductionValueType). */
    deductionValue: { type: Number, default: undefined },
    /** Audit trail for deduction source decision. */
    deductionDecisionBy: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
    deductionDecisionAt: { type: Date },
    /**
     * Weekly rest-day work approval (HR-controlled).
     * Payroll will only count "extra rest-day days worked" when this is true.
     */
    restDayWorkApproved: { type: Boolean, default: false },
    restDayWorkDecisionBy: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
    restDayWorkDecisionAt: { type: Date },
    /** Number of source rows merged during import (Phase 0b). 1 = normal, >1 = merged. */
    rawPunches: { type: Number, default: 1 },
    remarks: {
      type: String,
    },
    lastManagedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
    },
  },
  {
    timestamps: true,
  },
);


// Ensure an employee only has one attendance record per day
AttendanceSchema.index({ employeeId: 1, date: 1 }, { unique: true });

export const Attendance = mongoose.model("Attendance", AttendanceSchema);
