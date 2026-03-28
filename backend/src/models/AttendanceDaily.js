import { Schema, model } from "mongoose";

const EventPairSchema = new Schema(
  {
    checkIn: { type: Date },
    checkOut: { type: Date },
    duration: { type: Number }, // Minutes
    type: {
      type: String,
      enum: ["WORK", "BREAK", "MISSION"],
      default: "WORK",
    },
    implied: { type: Boolean, default: false }, // True if check-out was auto-generated
  },
  { _id: false },
);

const AttendanceDailySchema = new Schema(
  {
    // ─── Identity ─────────────────────────────────────
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },
    date: { type: Date, required: true, index: true }, // Normalised to midnight UTC

    // ─── Paired Events ────────────────────────────────
    firstCheckIn: { type: Date },
    lastCheckOut: { type: Date },
    eventPairs: [EventPairSchema],

    // ─── Calculated Metrics (Payroll-Ready) ───────────
    status: {
      type: String,
      enum: [
        "PRESENT",
        "ABSENT",
        "LATE",
        "HALF_DAY",
        "ON_LEAVE",
        "HOLIDAY",
        "WEEKEND",
        "WFH",
        "MISSION",
      ],
      default: "ABSENT",
    },
    scheduledHours: { type: Number, default: 0 },
    workHours: { type: Number, default: 0 },
    breakMinutes: { type: Number, default: 0 },
    overtimeHours: { type: Number, default: 0 },
    lateMinutes: { type: Number, default: 0 },
    earlyLeaveMin: { type: Number, default: 0 },
    lateDeduction: { type: Number, default: 0 },
    lateDeductionUnit: { type: String, enum: ["DAYS", "HOURS", "MINUTES"], default: "HOURS" },
    isAbsent: { type: Boolean, default: true },

    // ─── Payroll Flags ────────────────────────────────
    deductionReadyFlag: { type: Boolean, default: false },
    overtimeApproved: { type: Boolean, default: false },
    payrollNotes: { type: String },

    // ─── Policy Reference ────────────────────────────
    policyId: { type: Schema.Types.ObjectId, ref: "AttendancePolicy" },
    shiftType: { type: String },

    // ─── Audit ────────────────────────────────────────
    processedAt: { type: Date },
    processedBy: { type: String, default: "ENGINE" }, // "ENGINE" | "MANUAL_OVERRIDE"
    overrideReason: { type: String },
    eventIds: [{ type: Schema.Types.ObjectId, ref: "AttendanceEvent" }],
  },
  {
    timestamps: true,
    collection: "attendance_daily",
    toJSON: {
      transform: (_doc, ret) => {
        ret.id = ret._id?.toString();
        delete ret._id;
        return ret;
      },
    },
  },
);

// One record per employee per day
AttendanceDailySchema.index({ employeeId: 1, date: 1 }, { unique: true });
AttendanceDailySchema.index({ date: 1, status: 1 });

export const AttendanceDaily = model("AttendanceDaily", AttendanceDailySchema);
