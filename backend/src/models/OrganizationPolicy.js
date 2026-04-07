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
    leavePolicies: [
      {
        version: { type: Number, required: true },
        vacationRules: { type: Schema.Types.Mixed, default: {} },
        excuseRules: { type: Schema.Types.Mixed, default: {} },
      },
    ],
  },
  { timestamps: true }
);

export const OrganizationPolicy = model("OrganizationPolicy", OrganizationPolicySchema);
