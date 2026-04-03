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
        branches: [String]
      }
    ],
    salaryIncreaseRules: [
      {
        type: { type: String, enum: ["DEFAULT", "DEPARTMENT", "EMPLOYEE"], required: true },
        target: { type: String }, // Dept name or Employee ID/Code
        percentage: { type: Number, required: true, min: 0 }
      }
    ],
    companyTimezone: { type: String, default: "Africa/Cairo" },
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
