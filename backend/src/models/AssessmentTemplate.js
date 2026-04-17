import { Schema, model } from "mongoose";

const CriterionSchema = new Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    weight: { type: Number, default: 1, min: 0 },
    type: { type: String, enum: ["RATING_5"], default: "RATING_5" },
  },
  { _id: true }
);

const AssessmentTemplateSchema = new Schema(
  {
    name: { type: String, required: true, unique: true },
    description: { type: String },
    criteria: [CriterionSchema],
    isDefault: { type: Boolean, default: false },
    status: { type: String, enum: ["ACTIVE", "ARCHIVED"], default: "ACTIVE" },
  },
  { timestamps: true }
);

// Ensure only one template can be default
AssessmentTemplateSchema.pre("save", async function (next) {
  if (this.isDefault) {
    await this.constructor.updateMany({ _id: { $ne: this._id } }, { isDefault: false });
  }
  next();
});

AssessmentTemplateSchema.set("toJSON", {
  transform: (_doc, ret) => {
    ret.id = ret._id?.toString();
    delete ret._id;
    return ret;
  },
});
AssessmentTemplateSchema.set("toObject", {
  transform: (_doc, ret) => {
    ret.id = ret._id?.toString();
    delete ret._id;
    return ret;
  },
});

export const AssessmentTemplate = model("AssessmentTemplate", AssessmentTemplateSchema);
