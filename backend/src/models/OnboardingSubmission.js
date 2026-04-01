import { Schema, model } from "mongoose";

/**
 * @file Mongoose model for individual Onboarding Submissions.
 * Stores the actual data submitted by an employee using a specific link.
 */
const OnboardingSubmissionSchema = new Schema(
  {
    linkId: { type: Schema.Types.ObjectId, ref: "OnboardingRequest", required: true },
    personalData: {
      fullNameEng: { type: String },
      fullNameAr: { type: String },
      email: { type: String },
      phoneNumber: { type: String },
      emergencyPhoneNumber: { type: String },
      address: { type: String },
      governorate: { type: String },
      city: { type: String },
      gender: { type: String },
      dateOfBirth: { type: Date },
      maritalStatus: { type: String },
      nationality: { type: String },
      idNumber: { type: String },
      department: { type: String },
      position: { type: String },
      educationDegree: { type: String },
      workPlaceDetails: {
        city: { type: String },
        branch: { type: String }
      },
    },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
    },
    adminNotes: { type: String },
    processedBy: { type: String }, // Admin email
    processedAt: { type: Date },
  },
  { timestamps: true }
);

export const OnboardingSubmission = model("OnboardingSubmission", OnboardingSubmissionSchema);

