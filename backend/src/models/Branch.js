import { Schema, model } from "mongoose";

const BranchSchema = new Schema(
  {
    name: { type: String, required: true, unique: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    insuranceNumber: { type: String },
    location: { type: [String] },
    city: { type: String },
    country: { type: String, default: "Egypt" },
    managerId: { type: Schema.Types.ObjectId, ref: "Employee" }, 
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE", "CLOSED"],
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
  }
);

export const Branch = model("Branch", BranchSchema);
