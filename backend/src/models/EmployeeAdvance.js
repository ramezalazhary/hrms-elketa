import { Schema, model } from "mongoose";

const EmployeeAdvanceSchema = new Schema(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: "Employee", required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    reason: { type: String, default: "" },
    
    // Installments Settings
    paymentType: {
      type: String,
      enum: ["ONE_TIME", "INSTALLMENTS"],
      default: "ONE_TIME"
    },
    monthlyDeduction: { type: Number, default: 0, min: 0 },
    remainingAmount: { type: Number, default: 0, min: 0 },
    startYear: { type: Number },
    startMonth: { type: Number, min: 1, max: 12 },

    status: {
        type: String,
        enum: ["PENDING", "APPROVED", "ACTIVE", "COMPLETED", "REJECTED", "CANCELLED"],
        default: "PENDING",
    },

    // Deduction tracking
    deductionHistory: [
      {
        runId: { type: Schema.Types.ObjectId, ref: "PayrollRun" },
        amountDeducted: { type: Number },
        date: { type: Date, default: Date.now }
      }
    ],

    // Legacy fallback support for older runs
    deductedInRunId: { type: Schema.Types.ObjectId, ref: "PayrollRun" },

    // Idempotency standard: Prevent double deduction for the same payroll period
    lastDeductedPeriod: {
      year: { type: Number },
      month: { type: Number },
    },

    recordedBy: { type: String, required: true },
    recordedAt: { type: Date, default: Date.now },
    approvedBy: { type: String },
    approvedAt: { type: Date }
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

EmployeeAdvanceSchema.pre("save", function (next) {
  if (this.isNew) {
    if (this.remainingAmount === undefined || this.remainingAmount === 0) {
      this.remainingAmount = this.amount;
    }
  }
  next();
});

EmployeeAdvanceSchema.index({ employeeId: 1, status: 1 });

export const EmployeeAdvance = model("EmployeeAdvance", EmployeeAdvanceSchema);
