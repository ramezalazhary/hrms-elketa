import { Schema, model } from "mongoose";

const GoalSchema = new Schema(
  {
    description: { type: String, required: true },
    targetDate: { type: Date },
    status: { type: String, enum: ["PENDING", "ACHIEVED", "PARTIAL", "MISSED"], default: "PENDING" },
  },
  { _id: true }
);

const ScoreSchema = new Schema(
  {
    criterionId: { type: Schema.Types.ObjectId },  // optional – not always present for legacy/no-template assessments
    title: { type: String, required: true }, // Snapshotted title
    score: { type: Number, required: true, min: 1, max: 5 },
    weight: { type: Number, default: 1 }, // Snapshotted weight
  },
  { _id: false }
);

const PerformanceReviewSchema = new Schema(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: "Employee", required: true, index: true },
    evaluatorId: { type: Schema.Types.ObjectId, ref: "Employee", required: true },
    date: { type: String, required: true }, // Format "DD:MM:YYYY"
    period: {
      year: { type: Number, required: true },
      month: { type: Number, required: true, min: 1, max: 12 },
    },
    templateId: { type: Schema.Types.ObjectId, ref: "AssessmentTemplate" }, // Reference to the template used
    scores: [ScoreSchema],
    overall: { type: Number, min: 1, max: 5 }, // Precomputed average based on weights
    
    feedback: { type: String },
    notesPrevious: { type: String, default: "" },
    
    // Goals for the coming month/period
    goalsForNextPeriod: [GoalSchema],

    // Payroll elements (kept for legacy/integration)
    getThebounes: { type: Boolean, default: false },
    daysBonus: { type: Number, default: 0, min: 0 },
    overtime: { type: Number, default: 0, min: 0 },
    deduction: { type: Number, default: 0, min: 0 },
    /**
     * Defines the unit for `deduction`:
     *  - "AMOUNT" (default): deduction is a fixed EGP amount subtracted directly.
     *  - "DAYS": deduction is a number of days multiplied by dailyRate in the payroll engine.
     * daysBonus and overtime are always in DAYS and converted in the engine.
     */
    deductionType: {
      type: String,
      enum: ["DAYS", "AMOUNT"],
      default: "AMOUNT",
    },
    
    // Bonus workflow statuses
    bonusStatus: {
      type: String,
      enum: ["NONE", "PENDING_HR", "APPROVED", "REJECTED"],
      default: "NONE",
    },
    bonusApprovedBy: { type: String },
    bonusApprovedAt: { type: Date },
    bonusRejectionReason: { type: String },
  },
  { timestamps: true }
);

PerformanceReviewSchema.index({ employeeId: 1, "period.year": 1, "period.month": 1, evaluatorId: 1 }, { unique: true });

PerformanceReviewSchema.set("toJSON", {
  transform: (_doc, ret) => {
    ret.id = ret._id?.toString();
    delete ret._id;
    return ret;
  },
});
PerformanceReviewSchema.set("toObject", {
  transform: (_doc, ret) => {
    ret.id = ret._id?.toString();
    delete ret._id;
    return ret;
  },
});

export const PerformanceReview = model("PerformanceReview", PerformanceReviewSchema);
