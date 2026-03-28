import { Schema, model } from "mongoose";

const AttendanceEventSchema = new Schema(
  {
    // ─── Identity ─────────────────────────────────────
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },
    employeeCode: { type: String, index: true },

    // ─── Event Data ───────────────────────────────────
    timestamp: { type: Date, required: true, index: true },
    eventType: {
      type: String,
      enum: [
        "CHECK_IN",
        "CHECK_OUT",
        "BREAK_START",
        "BREAK_END",
        "MISSION_START",
        "MISSION_END",
      ],
      required: true,
    },

    // ─── Source ───────────────────────────────────────
    source: {
      type: String,
      enum: ["BIOMETRIC", "EXCEL", "MANUAL", "SYSTEM", "WFH"],
      required: true,
    },
    deviceId: { type: String },
    ipAddress: { type: String },
    location: {
      lat: { type: Number },
      lng: { type: Number },
    },

    // ─── Metadata ─────────────────────────────────────
    rawPayload: { type: Schema.Types.Mixed },
    importBatchId: { type: String, index: true },
    notes: { type: String },
    addedBy: { type: Schema.Types.ObjectId, ref: "User" },
    isVoided: { type: Boolean, default: false },
    voidReason: { type: String },
  },
  {
    timestamps: true,
    collection: "attendance_events",
    toJSON: {
      transform: (_doc, ret) => {
        ret.id = ret._id?.toString();
        delete ret._id;
        return ret;
      },
    },
  },
);

// Compound indexes for fast queries
AttendanceEventSchema.index({ employeeId: 1, timestamp: 1 });
AttendanceEventSchema.index({ importBatchId: 1 });
AttendanceEventSchema.index({ employeeId: 1, timestamp: 1, eventType: 1 });

export const AttendanceEvent = model("AttendanceEvent", AttendanceEventSchema);
