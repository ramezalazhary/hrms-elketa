import { Schema, model } from "mongoose";

/**
 * @file Mongoose model: `ManagementRequest` — Formal requests from Team Leaders (e.g. for analytics).
 */
const ManagementRequestSchema = new Schema(
  {
    senderEmail: { type: String, required: true },
    senderName: { type: String, required: true },
    senderRole: { type: String, required: true },
    departmentId: { type: Schema.Types.ObjectId, ref: "Department", required: true },
    departmentName: { type: String, required: true },
    type: { 
      type: String, 
      required: true, 
      enum: ["ANALYTICS", "PERMISSION", "HR_MODULES", "OTHER"],
      default: "ANALYTICS" 
    },
    message: { type: String, default: "" },
    status: { 
      type: String, 
      required: true, 
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING"
    },
    managerApproval: {
      status: { type: String, enum: ["PENDING", "APPROVED", "REJECTED"], default: "PENDING" },
      processedBy: { type: String },
      processedAt: { type: Date }
    },
    hrApproval: {
      status: { type: String, enum: ["PENDING", "APPROVED", "REJECTED"], default: "PENDING" },
      processedBy: { type: String },
      processedAt: { type: Date }
    },
    processedBy: { type: String }, // Email of the person who handled it
    processedAt: { type: Date }
  },
  { timestamps: true }
);

export const ManagementRequest = model("ManagementRequest", ManagementRequestSchema);

// Compound indexes for common filter patterns
ManagementRequestSchema.index({ status: 1, departmentId: 1 });
ManagementRequestSchema.index({ senderEmail: 1, status: 1 });
