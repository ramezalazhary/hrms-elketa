/** @file Mongoose model: pending admin-handled password reset requests. */
import mongoose from 'mongoose';

const passwordResetRequestSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'RESOLVED'],
      default: 'PENDING',
    },
  },
  { timestamps: true }
);

export const PasswordResetRequest = mongoose.model('PasswordResetRequest', passwordResetRequestSchema);
