import { Schema, model } from "mongoose";

/**
 * @file Mongoose model for Onboarding Requests.
 * Stores temporary data for new employees before they are finalized.
 */
const OnboardingRequestSchema = new Schema(
  {
    token: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
    usageCount: { type: Number, default: 0 },
    // Optional pre-filled Job details for the ENTIRE link (if applied)
    metadata: {
      department: { type: String },
      position: { type: String },
    },
    createdBy: { type: String }, // Admin email who generated the link
  },
  { timestamps: true }
);

export const OnboardingRequest = model("OnboardingRequest", OnboardingRequestSchema);
