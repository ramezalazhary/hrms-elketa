/** @file Mongoose model: department document (name, head, nested teams/positions in schema). */
import { Schema, model } from "mongoose";

const TeamSchema = new Schema(
  {
    name: { type: String, required: true },
    leaderEmail: { type: String }, // Email or ID of the leader
    leaderTitle: { type: String, default: "Team Leader" },
    leaderResponsibility: { type: String },
    description: { type: String },
    positions: [{ title: String, level: String, responsibility: String }],
    members: [{ type: String }], // Team roster (Emails)
    status: { type: String, enum: ["ACTIVE", "ARCHIVED"], default: "ACTIVE" },
  },
  { _id: true, timestamps: true },
);

const DepartmentSchema = new Schema(
  {
    name: { type: String, required: true, unique: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true }, // Dept code for ID generation (e.g., ENG, HR)
    head: { type: String }, // Leader Email
    headTitle: { type: String, default: "Department Leader" },
    headResponsibility: { type: String },
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
    positions: [{ title: String, level: String, responsibility: String, members: [String] }], // Dept-level positions
    teams: [TeamSchema], // Nested teams for direct conversion support

    // Attendance Policy
    standardStartTime: { type: String, default: "09:00" }, // Format "HH:mm"
    gracePeriod: { type: Number, default: 15 }, // Minutes

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
    toObject: {
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
