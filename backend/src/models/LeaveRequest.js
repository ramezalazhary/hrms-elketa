/** @file Leave / excuse request — single source of truth for time off workflow. */
import { Schema, model } from "mongoose";

const ApprovalStepSchema = new Schema(
  {
    role: {
      type: String,
      enum: ["TEAM_LEADER", "MANAGER", "HR", "MANAGEMENT"],
      required: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
    },
    processedBy: { type: String },
    processedAt: { type: Date },
    comment: { type: String },
  },
  { _id: false },
);

const LeaveRequestSchema = new Schema(
  {
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },
    employeeEmail: { type: String, required: true, index: true },
    kind: { type: String, enum: ["VACATION", "EXCUSE"], required: true },

    leaveType: {
      type: String,
      enum: ["ANNUAL", "SICK", "UNPAID", "MATERNITY", "PATERNITY", "OTHER"],
    },
    startDate: { type: Date },
    endDate: { type: Date },

    excuseDate: { type: Date },
    startTime: { type: String },
    endTime: { type: String },

    computed: {
      days: { type: Number },
      minutes: { type: Number },
    },

    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED", "CANCELLED"],
      default: "PENDING",
      index: true,
    },

    approvals: { type: [ApprovalStepSchema], default: [] },

    policySnapshot: { type: Schema.Types.Mixed, required: true },

    /** Computed at submit: policy hire rules + dates; HR sees this before deciding. */
    eligibility: { type: Schema.Types.Mixed },
    /**
     * True when submitted while not yet eligible by policy; approved requests with this flag
     * do not consume vacation/excuse balance.
     */
    preEligibility: { type: Boolean, default: false },

    balanceContext: {
      baseEntitlementDays: { type: Number },
      bonusDays: { type: Number },
      entitlementDays: { type: Number },
      entitlementMinutes: { type: Number },
      usedApprovedDays: { type: Number },
      usedApprovedMinutes: { type: Number },
      pendingReservedDays: { type: Number },
      pendingReservedMinutes: { type: Number },
    },

    submittedAt: { type: Date, default: Date.now },

    createdBy: { type: String },
    lastUpdatedAt: { type: Date },
    lastUpdatedBy: { type: String },
  },
  { timestamps: true },
);

LeaveRequestSchema.index({ employeeId: 1, status: 1, submittedAt: -1 });

export const LeaveRequest = model("LeaveRequest", LeaveRequestSchema);
