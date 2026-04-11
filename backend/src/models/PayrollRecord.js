import { Schema, model } from "mongoose";

const PayrollRecordSchema = new Schema(
  {
    runId: { type: Schema.Types.ObjectId, ref: "PayrollRun", required: true, index: true },
    employeeId: { type: Schema.Types.ObjectId, ref: "Employee", required: true },
    employeeCode: { type: String },
    fullName: { type: String },
    fullNameArabic: { type: String },
    department: { type: String },
    nationalId: { type: String },
    insuranceNumber: { type: String },
    paymentMethod: { type: String },
    bankAccount: { type: String },
    isInsured: { type: Boolean, default: false },

    baseSalary: { type: Number, default: 0 },
    allowances: { type: Number, default: 0 },
    grossSalary: { type: Number, default: 0 },
    effectiveGross: { type: Number, default: 0 },
    isPartialPeriod: { type: Boolean, default: false },
    employeeCalendarDays: { type: Number, default: 0 },
    calendarDaysInPeriod: { type: Number, default: 0 },

    salaryPerDay: { type: Number, default: 0 },
    salaryPerHour: { type: Number, default: 0 },

    workingDays: { type: Number, default: 0 },
    daysPresent: { type: Number, default: 0 },
    daysAbsent: { type: Number, default: 0 },
    lateDays: { type: Number, default: 0 },
    excusedDays: { type: Number, default: 0 },
    onLeaveDays: { type: Number, default: 0 },
    paidLeaveDays: { type: Number, default: 0 },
    unpaidLeaveDays: { type: Number, default: 0 },
    earlyDepartureDays: { type: Number, default: 0 },
    incompleteDays: { type: Number, default: 0 },
    holidayDays: { type: Number, default: 0 },

    overtimeHours: { type: Number, default: 0 },
    extraDaysWorked: { type: Number, default: 0 },

    // Attendance deduction day breakdown (penalty days from attendance rules)
    lateDeductionDays: { type: Number, default: 0 },
    earlyDepartureDeductionDays: { type: Number, default: 0 },
    incompleteDeductionDays: { type: Number, default: 0 },
    unpaidLeaveDeductionDays: { type: Number, default: 0 },
    excessExcuseDeductionDays: { type: Number, default: 0 },

    overtimePay: { type: Number, default: 0 },
    extraDaysPay: { type: Number, default: 0 },
    fixedBonus: { type: Number, default: 0 },
    assessmentBonus: { type: Number, default: 0 },

    // Assessment breakdown (raw inputs + computed EGP per component)
    assessmentBonusDays: { type: Number, default: 0 },
    assessmentBonusAmount: { type: Number, default: 0 },
    assessmentOvertimeUnits: { type: Number, default: 0 },
    assessmentOvertimeAmount: { type: Number, default: 0 },
    assessmentDeductionEgp: { type: Number, default: 0 },
    assessmentDeductionAmount: { type: Number, default: 0 },
    assessmentCount: { type: Number, default: 0 },

    totalAdditions: { type: Number, default: 0 },

    absentDeduction: { type: Number, default: 0 },
    attendanceDeduction: { type: Number, default: 0 },
    fixedDeduction: { type: Number, default: 0 },
    advanceAmount: { type: Number, default: 0 },
    /** Gross advance demand before capping to available pre-tax pool (ONE_TIME / installments). */
    advanceRequested: { type: Number, default: 0 },
    advanceBreakdown: [
      {
        advanceId: { type: Schema.Types.ObjectId, ref: "EmployeeAdvance" },
        reason: { type: String },
        paymentType: { type: String },
        totalAmount: { type: Number, default: 0 },
        remainingBefore: { type: Number, default: 0 },
        deductedThisMonth: { type: Number, default: 0 },
      },
    ],
    totalDeductions: { type: Number, default: 0 },

    dueBeforeInsurance: { type: Number, default: 0 },

    insuredWage: { type: Number, default: 0 },
    employeeInsurance: { type: Number, default: 0 },
    companyInsurance: { type: Number, default: 0 },

    taxableMonthly: { type: Number, default: 0 },
    taxableAnnual: { type: Number, default: 0 },
    annualTax: { type: Number, default: 0 },
    monthlyTax: { type: Number, default: 0 },

    martyrsFundDeduction: { type: Number, default: 0 },

    netSalary: { type: Number, default: 0 },
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

PayrollRecordSchema.index({ runId: 1, employeeId: 1 }, { unique: true });

export const PayrollRecord = model("PayrollRecord", PayrollRecordSchema);
