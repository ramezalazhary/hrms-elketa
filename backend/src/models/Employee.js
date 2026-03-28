/** @file Mongoose model: HR employee profile and org fields (department, team, etc.). */
import { Schema, model } from "mongoose";

const EmployeeSchema = new Schema(
  {
    // Authentication / Account (merged from `User` model)
    passwordHash: { type: String },
    role: {
      type: String,
      enum: ["EMPLOYEE", "TEAM_LEADER", "MANAGER", "HR_STAFF", "ADMIN"],
      default: "EMPLOYEE",
    },
    requirePasswordChange: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },

    // Personal Information
    fullName: { type: String, required: true },
    dateOfBirth: { type: Date },
    gender: {
      type: String,
      enum: ["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"],
      default: "MALE",
    },
    maritalStatus: {
      type: String,
      enum: ["SINGLE", "MARRIED", "DIVORCED", "WIDOWED"],
      default: "SINGLE",
    },
    nationality: { type: String },
    idNumber: { type: String },
    profilePicture: { type: String }, // URL or Base64

    // Contact Information
    email: { type: String, required: true, unique: true }, // Personal Email
    workEmail: { type: String },
    phoneNumber: { type: String },
    address: { type: String },
    additionalContact: {
      whatsapp: { type: String },
      skype: { type: String },
    },

    // Job & Administrative
    employeeCode: { type: String, unique: true },
    position: { type: String, required: true },
    department: { type: String, required: true },
    departmentId: { type: Schema.Types.ObjectId, ref: "Department" },
    team: { type: String }, // Sub-unit within department
    teamId: { type: Schema.Types.ObjectId, ref: "Team" },
    managerId: { type: String }, // Direct Manager
    dateOfHire: { type: Date },
    employmentType: {
      type: String,
      enum: ["FULL_TIME", "PART_TIME", "CONTRACTOR", "TEMPORARY"],
      default: "FULL_TIME",
    },
    workLocation: { type: String }, // Branch/Office
    status: {
      type: String,
      enum: ["ACTIVE", "ON_LEAVE", "TERMINATED", "RESIGNED"],
      default: "ACTIVE",
    },
    onlineStorageLink: { type: String }, // Link to digital archives (Drive, Dropbox, etc.)

    // Education & Skills
    education: [
      {
        degree: { type: String },
        institution: { type: String },
        year: { type: String },
      },
    ],
    trainingCourses: [String],
    skills: {
      technical: [String],
      soft: [String],
    },
    languages: [
      {
        language: { type: String },
        proficiency: {
          type: String,
          enum: ["BASIC", "INTERMEDIATE", "ADVANCED", "NATIVE"],
        },
      },
    ],

    // Insurance Information
    insurance: {
      provider: { type: String },
      policyNumber: { type: String },
      coverageType: {
        type: String,
        enum: ["HEALTH", "LIFE", "DENTAL", "VISION", "COMPREHENSIVE"],
        default: "HEALTH",
      },
      validUntil: { type: Date },
    },

    // Financial Information (Expansion-ready)
    financial: {
      bankAccount: { type: String },
      baseSalary: { type: Number },
      currency: { type: String, default: "USD" },
      allowances: { type: Number },
      socialSecurity: { type: String },
      lastSalaryIncrease: { type: Date },
    },

    // Legacy / Hidden from UI initially
    age: { type: Number }, // Derived from DOB? Keeping for compatibility if needed.

    // NEW: ObjectId References (for normalized schema)
    // These work alongside existing string fields for backward compatibility
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: "Department",
      optional: true,
      index: true,
    },
    teamId: {
      type: Schema.Types.ObjectId,
      ref: "Team",
      optional: true,
      index: true,
    },
    positionId: {
      type: Schema.Types.ObjectId,
      ref: "Position",
      optional: true,
      index: true,
    },

    // Multi-assignment support
    additionalAssignments: [
      {
        departmentId: { type: Schema.Types.ObjectId, ref: "Department" },
        teamId: { type: Schema.Types.ObjectId, ref: "Team", optional: true },
        positionId: {
          type: Schema.Types.ObjectId,
          ref: "Position",
          optional: true,
        },
        isPrimary: { type: Boolean, default: false },
        startDate: { type: Date },
        endDate: { type: Date, optional: true },
      },
    ],
  },
  {
    timestamps: true,
    // Ensure frontend can reliably use `id` (instead of Mongo `_id`)
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

export const Employee = model("Employee", EmployeeSchema);
