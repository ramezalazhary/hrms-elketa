import mongoose, { Schema } from 'mongoose';

const AlertSchema = new Schema(
  {
    type: { type: String, required: true, enum: ['ID_EXPIRY', 'SALARY_INCREASE', 'TRANSFER', 'CONTRACT_EXPIRY'] },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    message: { type: String, required: true },
    severity: { type: String, required: true, enum: ['low', 'medium', 'high', 'critical'] },
    resolved: { type: Boolean, default: false }
  },
  { timestamps: true }
);

export const Alert = mongoose.model('Alert', AlertSchema);
