import { Schema, model } from "mongoose";

const AssessmentSubSchema = new Schema(
  {
    date: { type: String, required: true },
    period: {
      year: { type: Number },
      month: { type: Number, min: 1, max: 12 },
    },
    /** @deprecated use `overall`; kept for older records */
    rating: { type: Number, min: 1, max: 5 },
    feedback: { type: String, required: true },
    reviewPeriod: { type: String, required: true },
    evaluatorId: { type: Schema.Types.ObjectId, ref: "Employee", required: true },
    getThebounes: { type: Boolean, default: false },
    daysBonus: { type: Number, default: 0, min: 0 },
    overtime: { type: Number, default: 0, min: 0 },
    deduction: { type: Number, default: 0, min: 0 },
    commitment: { type: Number, min: 1, max: 5 },
    attitude: { type: Number, min: 1, max: 5 },
    quality: { type: Number, min: 1, max: 5 },
    overall: { type: Number, min: 1, max: 5 },
    notesPrevious: { type: String, default: "" },
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

// Ensure frontend can reliably use `id`
AssessmentSubSchema.set("toJSON", {
  transform: (_doc, ret) => {
    ret.id = ret._id?.toString();
    delete ret._id;
    return ret;
  },
});
AssessmentSubSchema.set("toObject", {
  transform: (_doc, ret) => {
    ret.id = ret._id?.toString();
    delete ret._id;
    return ret;
  },
});

const EmployeeAssessmentSchema = new Schema(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: "Employee", required: true, unique: true },
    assessment: [AssessmentSubSchema],
  },
  { timestamps: true }
);

EmployeeAssessmentSchema.index(
  {
    employeeId: 1,
    "assessment.period.year": 1,
    "assessment.period.month": 1,
    "assessment.evaluatorId": 1,
  },
  { sparse: true }
);

EmployeeAssessmentSchema.set("toJSON", {
  transform: (_doc, ret) => {
    ret.id = ret._id?.toString();
    delete ret._id;
    return ret;
  },
});
EmployeeAssessmentSchema.set("toObject", {
  transform: (_doc, ret) => {
    ret.id = ret._id?.toString();
    delete ret._id;
    return ret;
  },
});

export const Assessment = model("Assessment", EmployeeAssessmentSchema);
