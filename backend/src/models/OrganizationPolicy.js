import { Schema, model } from "mongoose";

const OrganizationPolicySchema = new Schema(
  {
    name: { type: String, default: "default", unique: true },
    documentRequirements: [
      {
        name: { type: String, required: true },
        isMandatory: { type: Boolean, default: true },
        description: { type: String }
      }
    ],
    workLocations: [
      {
        governorate: { type: String, required: true },
        city: { type: String, required: true },
        // Branch-shaped objects (see Branch model); Mixed allows legacy string rows until re-saved.
        branches: { type: [Schema.Types.Mixed], default: [] },
      },
    ],
    salaryIncreaseRules: [
      {
        type: { type: String, enum: ["DEFAULT", "DEPARTMENT", "EMPLOYEE"], required: true },
        target: { type: String }, // Dept name or Employee ID/Code
        percentage: { type: Number, required: true, min: 0 }
      }
    ],
    companyTimezone: { type: String, default: "Africa/Cairo" },
    /**
     * First calendar day of each company's "month" (1–31). Used for excuse limits per MONTH
     * and monthly excuse balance (UTC). 1 = standard calendar month.
     */
    companyMonthStartDay: { type: Number, default: 1, min: 1, max: 31 },
    /** Executive lead (CEO / managing director); informational + org charts. */
    chiefExecutiveEmployeeId: { type: Schema.Types.ObjectId, ref: "Employee" },
    chiefExecutiveTitle: {
      type: String,
      default: "Chief Executive Officer",
    },
    partners: [
      {
        name: { type: String, required: true, trim: true },
        title: { type: String, default: "Partner", trim: true },
        employeeId: { type: Schema.Types.ObjectId, ref: "Employee", default: null },
        ownershipPercent: { type: Number, min: 0, max: 100, default: null },
        notes: { type: String, default: "" },
      },
    ],
    leavePolicies: [
      {
        version: { type: Number, required: true },
        vacationRules: { type: Schema.Types.Mixed, default: {} },
        excuseRules: { type: Schema.Types.Mixed, default: {} },
      },
    ],

    assessmentPayrollRules: {
      bonusDaysEnabled: { type: Boolean, default: true },
      bonusDayMultiplier: { type: Number, default: 1.0, min: 0 },
      overtimeEnabled: { type: Boolean, default: false },
      overtimeDayMultiplier: { type: Number, default: 1.5, min: 0 },
      deductionEnabled: { type: Boolean, default: false },
      deductionDayMultiplier: { type: Number, default: 1.0, min: 0 },
    },

    payrollConfig: {
      /** HR-defined decimal places for all EGP amounts in payroll (0 = whole pounds, 2 = typical). Max 8. */
      decimalPlaces: { type: Number, default: 2, min: 0, max: 8 },
      workingDaysPerMonth: { type: Number, default: 22, min: 1 },
      hoursPerDay: { type: Number, default: 8, min: 1 },
      overtimeMultiplier: { type: Number, default: 1.5, min: 0 },
      personalExemptionAnnual: { type: Number, default: 20000, min: 0 },
      martyrsFundRate: { type: Number, default: 0.0005, min: 0 },
      insuranceRates: {
        employeeShare: { type: Number, default: 0.11 },
        companyShare: { type: Number, default: 0.1875 },
        maxInsurableWage: { type: Number, default: 16700 },
        minInsurableWage: { type: Number, default: 2700 },
      },
      taxBrackets: {
        type: [
          {
            from: { type: Number, required: true },
            to: { type: Number, default: null },
            rate: { type: Number, required: true },
          },
        ],
        default: [
          { from: 0, to: 40000, rate: 0 },
          { from: 40000, to: 55000, rate: 0.10 },
          { from: 55000, to: 70000, rate: 0.15 },
          { from: 70000, to: 200000, rate: 0.20 },
          { from: 200000, to: 400000, rate: 0.225 },
          { from: 400000, to: 1200000, rate: 0.25 },
          { from: 1200000, to: null, rate: 0.275 },
        ],
      },
    },

    attendanceRules: {
      standardStartTime: { type: String, default: "09:00" },
      standardEndTime: { type: String, default: "17:00" },
      gracePeriodMinutes: { type: Number, default: 15, min: 0 },
      /** When true, only the first N grace-band arrivals per fiscal month stay lenient; then LATE is from shift start. */
      monthlyGraceUsesEnabled: { type: Boolean, default: false },
      /** Max grace-band consumptions per fiscal month (0 = feature off even if enabled; UI should pair with enabled). */
      monthlyGraceUsesAllowed: { type: Number, default: 0, min: 0, max: 31 },
      workingDaysPerMonth: { type: Number, default: 22, min: 1, max: 31 },
      /** Bounds are minutes after shift start (fractional = sub-minute); UI stores as seconds ÷ 60. */
      lateDeductionTiers: [
        {
          fromMinutes: { type: Number, required: true, min: 0 },
          toMinutes: { type: Number, required: true },
          deductionDays: { type: Number, required: true, min: 0 },
        },
      ],
      absenceDeductionDays: { type: Number, default: 1, min: 0 },
      earlyDepartureDeductionDays: { type: Number, default: 0, min: 0 },
      incompleteRecordDeductionDays: { type: Number, default: 0, min: 0 },
      unpaidLeaveDeductionDays: { type: Number, default: 1, min: 0 },
      /** When true, excuses approved beyond quota trigger proportional salary deduction. */
      excessExcuseDeductionEnabled: { type: Boolean, default: true },
      /** 0=Sun … 6=Sat (UTC, matches getUTCDay). Default Fri+Sat. Empty = no weekly rest. */
      weeklyRestDays: {
        type: [Number],
        default: [5, 6],
        validate: {
          validator(arr) {
            return (
              !Array.isArray(arr) ||
              arr.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)
            );
          },
          message: "weeklyRestDays must be integers 0–6",
        },
      },
    },
  },
  { timestamps: true }
);

export const OrganizationPolicy = model("OrganizationPolicy", OrganizationPolicySchema);
