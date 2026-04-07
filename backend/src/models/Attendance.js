import mongoose from "mongoose";

const AttendanceSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    employeeCode: {
      type: String, // Redundant but good for indexing search from Excel
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    checkIn: {
      type: String, // Format: "HH:mm"
    },
    checkOut: {
      type: String, // Format: "HH:mm"
    },
    status: {
      type: String,
      enum: [
        "PRESENT",
        "ABSENT",
        "LATE",
        "EARLY_DEPARTURE",
        "ON_LEAVE",
        "OVERTIME",
        "EXCUSED",
      ],
      default: "PRESENT",
    },
    excuseLeaveRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LeaveRequest",
    },
    excuseCovered: { type: Boolean, default: false },
    totalHours: {
      type: Number,
      default: 0,
    },
    remarks: {
      type: String,
    },
    lastManagedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee", // The Admin/Manager who manually added/edited it
    },
  },
  {
    timestamps: true,
  },
);

// Ensure an employee only has one attendance record per day
AttendanceSchema.index({ employeeId: 1, date: 1 }, { unique: true });

export const Attendance = mongoose.model("Attendance", AttendanceSchema);
