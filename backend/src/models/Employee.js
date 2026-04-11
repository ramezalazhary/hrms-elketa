/** @file Mongoose model: HR employee profile and org fields (department, team, etc.). */
import { Schema, model } from "mongoose";


const EmployeeSchema = new Schema(
  {
    // Authentication / Account (merged from `User` model)
    passwordHash: { type: String },
    role: {
      type: String,
      enum: ["EMPLOYEE", "TEAM_LEADER", "MANAGER", "HR_STAFF", "HR_MANAGER", "ADMIN"],
      default: "EMPLOYEE",
    },
    requirePasswordChange: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },

    // ******************************************************* Personal Information *******************************************************
    fullName: { type: String, required: true },
    fullNameArabic: { type: String },
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
    nationalIdExpiryDate: { type: Date },
    profilePicture: { type: String }, // URL or Base64

    // ******************************************************* Contact Information *******************************************************
    email: { type: String, required: true, unique: true }, // Personal Email
    workEmail: { type: String },
    phoneNumber: { type: String },
    emergencyPhone: { type: String },
    address: { type: String },
    governorate: { type: String },
    city: { type: String },
    additionalContact: {
      whatsapp: { type: String },
      skype: { type: String },
    },

    // ******************************************************* Job & Administrative *******************************************************
    employeeCode: { type: String, unique: true },
    position: { type: String }, // ← Cache: auto-synced from positionId.title
    department: { type: String }, // ← Cache: auto-synced from departmentId.name
    team: { type: String }, // ← Cache: auto-synced from teamId.name
    managerId: { type: Schema.Types.ObjectId, ref: "Employee" }, // Direct Manager
    teamLeaderId: { type: Schema.Types.ObjectId, ref: "Employee" }, // Team Leader
    /** When true (default), use Department.head / team leader from org structure for reporting. */
    useDefaultReporting: { type: Boolean, default: true },
    dateOfHire: { type: Date },
    /** Next salary/review cycle date: hire+1y on create; +1y on processed increase; transfer+reset → transfer+1y. */
    nextReviewDate: { type: Date },
    employmentType: {
      type: String,
      enum: ["FULL_TIME", "PART_TIME", "CONTRACTOR", "TEMPORARY"],
      default: "FULL_TIME",
    },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch" }, // Reference to physical location
    workLocation: { type: String }, // Cache: auto-synced from branchId.name
    subLocation: { type: String },
    status: {
      type: String,
      enum: ["ACTIVE", "ON_LEAVE", "TERMINATED", "RESIGNED"],
      default: "ACTIVE",
    },
    terminationDate: { type: Date },
    terminationReason: { type: String },
    onlineStorageLink: { type: String }, // Link to digital archives (Drive, Dropbox, etc.)

    // ******************************************************* Education & Skills *******************************************************
    education: [
      {
        degree: { type: String },
        institution: { type: String },
        year: { type: String },
        graduationDate: { type: Date },
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

    // ******************************************************* Insurance Information (multiple records) *******************************************************
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
    insurances: [
      {
        providerName: { type: String },
        policyNumber: { type: String },
        coverageType: { type: String },
        startDate: { type: Date },
        expiryDate: { type: Date },
      },
    ],

    // ******************************************************* Financial Information *******************************************************
    financial: {
      bankAccount: { type: String }, // رقم الحساب
      baseSalary: { type: Number }, // الراتب الاساسي
      paymentMethod: { 
        type: String, 
        enum: ["BANK_TRANSFER", "CASH", "CHEQUE", "E_WALLET"], 
        default: "BANK_TRANSFER" 
      }, // طريقة الدفع
      currency: { type: String, default: "EGP" },
      allowances: { type: Number }, // الحوافز والبدلات
      fixedBonus: { type: Number, default: 0 }, // حافز إضافي ثابت
      fixedDeduction: { type: Number, default: 0 }, // خصم ثابت
      socialSecurity: { type: String },
      lastSalaryIncrease: { type: Date },
    },

    // ******************************************************* Social Insurance (Egyptian Social Security) - التأمينات *******************************************************
    socialInsurance: {
      status: { type: String, enum: ["INSURED", "NOT_INSURED"], default: "NOT_INSURED" }, // حالة التامين
      insuranceDate: { type: Date }, // تاريخ التامين
      subscriptionWage: { type: Number }, // أجر الأشتراك
      basicWage: { type: Number }, // أجر اساسي
      comprehensiveWage: { type: Number }, // الأجر الشامل
      jobType: { type: String }, // نوع العمل
      form6Date: { type: Date }, // تاريخ انتهاء التامين وتقديم استمارة 6
      insuranceNumber: { type: String }, // الرقم التاميني
    },

    medicalCondition: { type: String }, // نوع المرض

    // ******************************************************* Transfer History *******************************************************
    transferHistory: [
      {
        fromDepartment: { type: Schema.Types.ObjectId, ref: "Department" },
        fromDepartmentName: { type: String },
        toDepartment: { type: Schema.Types.ObjectId, ref: "Department" },
        toDepartmentName: { type: String },
        transferDate: { type: Date, required: true },
        newPosition: { type: String },
        newSalary: { type: Number },
        nextReviewDateReset: { type: Boolean, default: false },
        /** Set when nextReviewDateReset — value applied to employee.nextReviewDate (transfer + 1 year). */
        nextReviewDateAfterTransfer: { type: Date },
        notes: { type: String },
        previousEmployeeCode: { type: String },
        newEmployeeCode: { type: String },
        processedBy: { type: String }, // Admin email
      },
    ],

    // ******************************************************* Vacation / leave records (HR-managed from employee profile) *******************************************************
    vacationRecords: [
      {
        startDate: { type: Date, required: true },
        endDate: { type: Date, required: true },
        type: {
          type: String,
          enum: ["ANNUAL", "SICK", "UNPAID", "MATERNITY", "PATERNITY", "OTHER"],
          default: "ANNUAL",
        },
        notes: { type: String },
        recordedBy: { type: String },
        source: { type: String, enum: ["LEGACY", "MANUAL"], default: "LEGACY" },
      },
    ],

    /** HR-only credits added to policy annual vacation entitlement (see leave balance snapshot). */
    annualLeaveCredits: [
      {
        days: { type: Number, required: true, min: 1 },
        reason: { type: String, required: true },
        recordedBy: { type: String },
        recordedAt: { type: Date, default: Date.now },
      },
    ],

    // Legacy / Hidden from UI initially
    age: { type: Number }, // Derived from DOB? Keeping for compatibility if needed.

    // ObjectId References (for normalized schema)
    // These work alongside existing string fields for backward compatibility
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: "Department",
      index: true,
    },
    teamId: {
      type: Schema.Types.ObjectId,
      ref: "Team",
      index: true,
    },
    positionId: {
      type: Schema.Types.ObjectId,
      ref: "Position",
      index: true,
    },
    // ******************************************************* Salary History *******************************************************
    salaryHistory: [
      {
        previousSalary: { type: Number },
        newSalary: { type: Number },
        increaseAmount: { type: Number },
        increasePercentage: { type: Number },
        effectiveDate: { type: Date, default: Date.now },
        reason: { type: String, default: "Annual Increase" },
        processedBy: { type: String }, // User email
      }
    ],
    // ******************************************************* Documents Checklist *******************************************************
    documentChecklist: [
      {
        documentName: { type: String, required: true },
        status: { type: String, enum: ["RECEIVED", "MISSING"], default: "MISSING" },
        fileUrl: { type: String },
        submissionDate: { type: Date },
        notifiedDate: { type: Date }, // For tracking follow-ups
      }
    ],

    // ******************************************************* Multi-assignment support *******************************************************
    additionalAssignments: [
      {
        departmentId: { type: Schema.Types.ObjectId, ref: "Department" },
        teamId: { type: Schema.Types.ObjectId, ref: "Team" },
        positionId: {
          type: Schema.Types.ObjectId,
          ref: "Position",
        },
        isPrimary: { type: Boolean, default: false },
        startDate: { type: Date },
        endDate: { type: Date },
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
