import { Schema, model } from "mongoose";

const TeamSchema = new Schema(
  {
    name: { type: String, required: true },
    manager: { type: String }, // Email or ID of the manager
    description: { type: String },
    positions: [{ title: String, level: String }],
    status: { type: String, enum: ["ACTIVE", "ARCHIVED"], default: "ACTIVE" },
  },
  { _id: true, timestamps: true },
);

const DepartmentSchema = new Schema(
  {
    name: { type: String, required: true, unique: true },
    head: { type: String }, // Manager Email
    description: { type: String },
    type: {
      type: String,
      enum: ["PERMANENT", "TEMPORARY", "PROJECT"],
      default: "PERMANENT",
    },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE", "ARCHIVED"],
      default: "ACTIVE",
    },

    // Core structural elements
    positions: [{ title: String, level: String }], // Dept-level positions
    teams: [TeamSchema], // Nested teams for direct conversion support

    // Metadata for scaling
    location: { type: String },
    budget: { type: Number },
    parentDepartmentId: { type: Schema.Types.ObjectId, ref: "Department" }, // For matrix/recursive structure

    // Migration flag for transition period
    hasMigratedTeams: { type: Boolean, default: false }, // Teams now in separate collection
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        ret.id = ret._id?.toString();
        delete ret._id;
        if (ret.teams) {
          ret.teams = ret.teams.map((t) => ({ ...t, id: t._id?.toString() }));
        }
        return ret;
      },
    },
  },
);

export const Department = model("Department", DepartmentSchema);
