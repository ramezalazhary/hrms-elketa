import { AssessmentTemplate } from "../models/AssessmentTemplate.js";

export const getTemplates = async (req, res, next) => {
  try {
    const templates = await AssessmentTemplate.find({ status: "ACTIVE" }).sort({ createdAt: -1 });
    res.json(templates);
  } catch (err) {
    next(err);
  }
};

export const getTemplateById = async (req, res, next) => {
  try {
    const template = await AssessmentTemplate.findById(req.params.id);
    if (!template) return res.status(404).json({ error: "Template not found" });
    res.json(template);
  } catch (err) {
    next(err);
  }
};

export const createTemplate = async (req, res, next) => {
  try {
    const { name, description, criteria, isDefault } = req.body;
    
    if (!criteria || criteria.length === 0) {
      return res.status(400).json({ error: "Criteria array is required" });
    }

    const template = new AssessmentTemplate({
      name,
      description,
      criteria,
      isDefault: Boolean(isDefault)
    });

    await template.save();
    res.status(201).json(template);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: "Template name already exists" });
    next(err);
  }
};

export const updateTemplate = async (req, res, next) => {
  try {
    const { name, description, criteria, isDefault, status } = req.body;
    const template = await AssessmentTemplate.findById(req.params.id);
    if (!template) return res.status(404).json({ error: "Template not found" });

    if (name) template.name = name;
    if (description !== undefined) template.description = description;
    if (criteria && criteria.length > 0) template.criteria = criteria;
    if (isDefault !== undefined) template.isDefault = Boolean(isDefault);
    if (status) template.status = status;

    await template.save();
    res.json(template);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: "Template name already exists" });
    next(err);
  }
};

export const deleteTemplate = async (req, res, next) => {
  try {
    const template = await AssessmentTemplate.findById(req.params.id);
    if (!template) return res.status(404).json({ error: "Template not found" });
    
    // Instead of hard deleting, we archive it because older reviews might reference it
    template.status = "ARCHIVED";
    await template.save();
    res.json({ message: "Template archived successfully" });
  } catch (err) {
    next(err);
  }
};

