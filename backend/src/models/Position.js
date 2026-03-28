/** @file Mongoose model: job position tied to department/team. */
import mongoose, { Schema, model } from "mongoose";

const PositionSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
    },
    level: {
      type: String,
      enum: ["Junior", "Mid", "Senior", "Lead", "Executive", ""],
      default: "",
    },
    responsibility: { type: String },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: "Department",
      required: true,
      index: true,
    },
    teamId: {
      type: Schema.Types.ObjectId,
      ref: "Team",
      optional: true,
      index: true,
    },
    description: { type: String },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
    },
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
    toObject: {
      transform: (_doc, ret) => {
        ret.id = ret._id?.toString();
        delete ret._id;
        return ret;
      },
    },
  },
);

// Compound index: department + status for efficient filtering
PositionSchema.index({ departmentId: 1, status: 1 });
// Index for team positions
PositionSchema.index({ teamId: 1 });

export const Position = mongoose.models.Position || model("Position", PositionSchema);
