import { Schema, model } from "mongoose";

const UserSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    role: { 
      type: String, 
      required: true, 
      enum: ["EMPLOYEE", "TEAM_LEADER", "MANAGER", "HR_STAFF", "ADMIN"],
      default: "EMPLOYEE"
    },
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
    },
    requirePasswordChange: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

export const User = model("User", UserSchema);
