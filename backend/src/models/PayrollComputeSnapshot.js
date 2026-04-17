import { Schema, model } from "mongoose";

const PayrollSnapshotRecordSchema = new Schema(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: "Employee", required: true },
    employeeCode: { type: String, default: "" },
    fullName: { type: String, default: "" },
    grossSalary: { type: Number, default: 0 },
    totalAdditions: { type: Number, default: 0 },
    totalDeductions: { type: Number, default: 0 },
    monthlyTax: { type: Number, default: 0 },
    employeeInsurance: { type: Number, default: 0 },
    netSalary: { type: Number, default: 0 },
    attendanceDeduction: { type: Number, default: 0 },
    advanceAmount: { type: Number, default: 0 },
    overtimePay: { type: Number, default: 0 },
    extraDaysPay: { type: Number, default: 0 },
    assessmentBonus: { type: Number, default: 0 },
  },
  { _id: false }
);

const PayrollComputeSnapshotSchema = new Schema(
  {
    runId: { type: Schema.Types.ObjectId, ref: "PayrollRun", required: true, index: true },
    computeVersion: { type: Number, required: true },
    createdBy: { type: String, required: true },
    totals: {
      type: Schema.Types.Mixed,
      default: {},
    },
    records: {
      type: [PayrollSnapshotRecordSchema],
      default: [],
    },
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

PayrollComputeSnapshotSchema.index({ runId: 1, computeVersion: -1 }, { unique: true });

export const PayrollComputeSnapshot = model("PayrollComputeSnapshot", PayrollComputeSnapshotSchema);
