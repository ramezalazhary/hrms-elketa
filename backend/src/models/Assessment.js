import { Schema, model } from "mongoose";

const AssessmentSubSchema = new Schema(
  {
    date: { type: String, required: true }, // Format: dd:mm:yyyy
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
