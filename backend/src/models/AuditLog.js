/** @file Mongoose model: audit trail for critical operations */
import { Schema, model } from "mongoose";

const AuditLogSchema = new Schema(
  {
    entityType: { type: String, required: true }, // 'Employee', 'Department', etc.
    entityId: { type: Schema.Types.ObjectId, required: true },
    operation: { type: String, required: true }, // 'CREATE', 'UPDATE', 'DELETE'
    changes: { type: Schema.Types.Mixed }, // What changed
    previousValues: { type: Schema.Types.Mixed }, // Before state (for updates)
    newValues: { type: Schema.Types.Mixed }, // After state
    reason: { type: String }, // Optional reason for change
    performedBy: { type: String, required: true }, // User email
    performedAt: { type: Date, default: Date.now },
    ipAddress: { type: String },
    userAgent: { type: String }
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
  }
);

// Indexes for efficient querying
AuditLogSchema.index({ entityType: 1, entityId: 1, performedAt: -1 });
AuditLogSchema.index({ performedBy: 1, performedAt: -1 });

export const AuditLog = model("AuditLog", AuditLogSchema);
