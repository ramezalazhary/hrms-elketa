import { Assessment } from "../models/Assessment.js";
import { Employee } from "../models/Employee.js";
import { createAssessmentSchema } from "../validators/assessmentValidators.js";
import { canAssessEmployee } from "../services/assessmentAccessService.js";

/**
 * Creates or appends a new assessment into the employee's assessment array.
 */
export const createAssessment = async (req, res, next) => {
  try {
    const { error, value } = createAssessmentSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const {
      employeeId,
      date,
      feedback,
      reviewPeriod,
      getThebounes,
      daysBonus,
      overtime,
      deduction,
      commitment,
      attitude,
      quality,
      overall,
      notesPrevious,
    } = value;
    const evaluator = req.user;

    const targetEmp = await Employee.findById(employeeId);
    if (!targetEmp) {
      return res.status(404).json({ error: "Target employee not found" });
    }

    const allowed = await canAssessEmployee(evaluator, targetEmp);
    if (!allowed) {
      return res.status(403).json({
        error:
          "Forbidden: You can only assess employees on your teams, your direct reports, or (for HR/Admin) anyone.",
      });
    }

    // Prepare the sub-document (`rating` mirrors `overall` for legacy clients)
    const newAssessmentData = {
      date,
      rating: overall,
      overall,
      commitment,
      attitude,
      quality,
      daysBonus,
      overtime,
      deduction,
      notesPrevious: notesPrevious || "",
      feedback,
      reviewPeriod,
      evaluatorId: evaluator.id,
      getThebounes,
    };

    // Find existing parent document or create new one
    let employeeAssessment = await Assessment.findOne({ employeeId });
    if (!employeeAssessment) {
      employeeAssessment = new Assessment({
        employeeId,
        assessment: [newAssessmentData]
      });
    } else {
      employeeAssessment.assessment.push(newAssessmentData);
    }

    await employeeAssessment.save();

    res.status(201).json({
      message: "Assessment saved successfully",
      data: employeeAssessment,
    });
  } catch (err) {
    console.error("Error creating assessment:", err);
    res.status(500).json({ error: "Server error creating assessment" });
  }
};

/**
 * Fetches the unified Assessment array for a specific employee.
 */
export const getEmployeeAssessments = async (req, res, next) => {
  try {
    const targetEmployeeId = req.params.id;
    const requester = req.user;

    const isSelf = requester.id === targetEmployeeId;

    if (!isSelf) {
      const targetEmp = await Employee.findById(targetEmployeeId);
      if (!targetEmp) {
        return res.status(404).json({ error: "Employee not found" });
      }

      const allowed = await canAssessEmployee(requester, targetEmp);
      if (!allowed) {
        return res
          .status(403)
          .json({ error: "Forbidden: Cannot access this employee's assessments." });
      }
    }

    const doc = await Assessment.findOne({ employeeId: targetEmployeeId })
      .populate("assessment.evaluatorId", "fullName email employeeCode position");

    if (!doc) {
      // Return empty format if not generated yet
      return res.json([{
        employeeId: targetEmployeeId,
        assessment: []
      }]);
    }

    // Wrap in an array as per the requested JSON format
    res.json([doc]);
  } catch (err) {
    console.error("Error getting employee assessments:", err);
    res.status(500).json({ error: "Server error fetching assessments" });
  }
};

/**
 * Whether the current user may submit an assessment for this employee (UI gate; same rules as POST).
 */
export const getAssessmentEligibility = async (req, res, next) => {
  try {
    const targetEmp = await Employee.findById(req.params.employeeId);
    if (!targetEmp) {
      return res.status(404).json({ canAssess: false });
    }
    const canAssess = await canAssessEmployee(req.user, targetEmp);
    res.json({ canAssess });
  } catch (err) {
    console.error("Error checking assessment eligibility:", err);
    next(err);
  }
};
