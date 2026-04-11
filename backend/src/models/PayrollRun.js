import { Schema, model } from "mongoose";

const PayrollRunSchema = new Schema(
  {
    period: {
      year: { type: Number, required: true },
      month: { type: Number, required: true, min: 1, max: 12 },
    },
    departmentId: { type: Schema.Types.ObjectId, ref: "Department", default: null },
    status: {
      type: String,
      enum: ["DRAFT", "COMPUTED", "FINALIZED"],
      default: "DRAFT",
    },
    computedAt: { type: Date },
    finalizedAt: { type: Date },
    createdBy: { type: String, required: true },
    finalizedBy: { type: String },
    totals: {
      totalGross: { type: Number, default: 0 },
      totalAdditions: { type: Number, default: 0 },
      totalDeductions: { type: Number, default: 0 },
      totalNet: { type: Number, default: 0 },
      totalEmployeeInsurance: { type: Number, default: 0 },
      totalCompanyInsurance: { type: Number, default: 0 },
      totalTax: { type: Number, default: 0 },
      totalMartyrsFund: { type: Number, default: 0 },
      employeeCount: { type: Number, default: 0 },
      insuredCount: { type: Number, default: 0 },
      uninsuredCount: { type: Number, default: 0 },
      cashCount: { type: Number, default: 0 },
      visaCount: { type: Number, default: 0 },
      cashTotal: { type: Number, default: 0 },
      visaTotal: { type: Number, default: 0 },
    },
    configSnapshot: { type: Schema.Types.Mixed },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        ret.id = ret._id?.toString();
        delete ret._id;
        return ret;
      },
    },
    toObject: {
      transform: (_doc, ret) => {
        ret.id = ret._id?.toString();
        delete ret._id;
        return ret;
      },
    },
  }
);

PayrollRunSchema.index({ "period.year": 1, "period.month": 1, departmentId: 1 });
PayrollRunSchema.index({ status: 1 });

export const PayrollRun = model("PayrollRun", PayrollRunSchema);
