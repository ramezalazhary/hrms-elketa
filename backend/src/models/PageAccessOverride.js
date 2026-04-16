import { Schema, model } from "mongoose";

const PageAccessOverrideSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },
    pageId: { type: String, required: true, index: true },
    level: {
      type: String,
      enum: ["NONE", "VIEW", "EDIT", "ADMIN"],
      required: true,
      default: "NONE",
    },
    source: {
      type: String,
      enum: ["manual_override"],
      default: "manual_override",
    },
    updatedBy: { type: String, default: "" },
  },
  { timestamps: true },
);

PageAccessOverrideSchema.index({ userId: 1, pageId: 1 }, { unique: true });

export const PageAccessOverride = model(
  "PageAccessOverride",
  PageAccessOverrideSchema,
);

