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
  },
  { timestamps: true }
);

export const OrganizationPolicy = model("OrganizationPolicy", OrganizationPolicySchema);
