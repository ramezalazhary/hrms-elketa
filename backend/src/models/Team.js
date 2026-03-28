/** @file Mongoose model: team belonging to a department (`departmentId` ref). */
import mongoose, { Schema, model } from "mongoose";

const TeamSchema = new Schema(
  {
    name: { type: String, required: true },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: "Department",
      required: true,
      index: true,
    },
    managerEmail: { type: String }, // Email of team manager
    description: { type: String },
    positions: [
      {
        title: { type: String },
        level: { type: String },
      },
    ],
    status: {
      type: String,
      enum: ["ACTIVE", "ARCHIVED"],
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
TeamSchema.index({ departmentId: 1, status: 1 });

export const Team = mongoose.models.Team || model("Team", TeamSchema);
