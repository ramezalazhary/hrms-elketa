/** @file Mongoose model: `UserPermission` — module + actions + scope per userId. */
import { Schema, model } from "mongoose";

const UserPermissionSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    module: { type: String, required: true },
    actions: { type: [String], required: true, default: [] },
    scope: { type: String, required: true, default: "self" },
  },
  { timestamps: true },
);

UserPermissionSchema.index({ userId: 1, module: 1 }, { unique: true });

export const UserPermission = model("UserPermission", UserPermissionSchema);
