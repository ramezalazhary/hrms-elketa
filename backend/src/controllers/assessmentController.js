import { Assessment } from "../models/Assessment.js";
import { Employee } from "../models/Employee.js";
import { createAssessmentSchema } from "../validators/assessmentValidators.js";
import { canAssessEmployee } from "../services/assessmentAccessService.js";

const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

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
      period,
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
          "Forbidden: You cannot assess your direct manager or team leader, or anyone outside your assessment scope.",
      });
    }

    const existingDoc = await Assessment.findOne({ employeeId });
    if (existingDoc) {
      const dup = existingDoc.assessment.find(
        (a) =>
          a.period?.year === period.year &&
          a.period?.month === period.month &&
          String(a.evaluatorId) === String(evaluator.id)
      );
      if (dup) {
        return res.status(409).json({
          error: `You have already submitted an assessment for ${MONTH_NAMES[period.month]} ${period.year}`,
        });
      }
    }

    const autoReviewPeriod =
      reviewPeriod || `${MONTH_NAMES[period.month]} ${period.year}`;

    const hasBonusOrDeduction =
      (daysBonus && daysBonus > 0) ||
      (overtime && overtime > 0) ||
      (deduction && deduction > 0);

    const newAssessmentData = {
      date,
      period,
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
      reviewPeriod: autoReviewPeriod,
      evaluatorId: evaluator.id,
      getThebounes,
      bonusStatus: hasBonusOrDeduction ? "PENDING_HR" : "NONE",
    };

    let employeeAssessment = existingDoc;
    if (!employeeAssessment) {
      employeeAssessment = new Assessment({
        employeeId,
        assessment: [newAssessmentData],
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

/**
 * GET /api/assessments/pending
 * Returns employees who have NOT been assessed for the current month by the requesting TL/Manager.
 */
export const getPendingAssessments = async (req, res) => {
  try {
    const now = new Date();
    const year = Number(req.query.year) || now.getFullYear();
    const month = Number(req.query.month) || now.getMonth() + 1;
    const evaluator = req.user;

    const allEmployees = await Employee.find({ isActive: true })
      .select("fullName email employeeCode department team position managerId teamLeaderId")
      .lean();

    const assessed = await Assessment.find({
      "assessment.period.year": year,
      "assessment.period.month": month,
      "assessment.evaluatorId": evaluator.id,
    }).select("employeeId").lean();

    const assessedIds = new Set(assessed.map((d) => d.employeeId.toString()));

    const pending = [];
    for (const emp of allEmployees) {
      if (assessedIds.has(emp._id.toString())) continue;
      const allowed = await canAssessEmployee(evaluator, emp);
      if (allowed) {
        pending.push({
          _id: emp._id,
          fullName: emp.fullName,
          email: emp.email,
          employeeCode: emp.employeeCode,
          department: emp.department,
          team: emp.team,
          position: emp.position,
        });
      }
    }

    res.json({ year, month, pending, total: pending.length });
  } catch (err) {
    console.error("Error fetching pending assessments:", err);
    res.status(500).json({ error: "Server error" });
  }
};

/**
 * GET /api/assessments/reminders
 * Summary stats for TL/Manager dashboard widget: how many assessments are pending for the current month.
 */
export const getAssessmentReminders = async (req, res) => {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const evaluator = req.user;

    const allEmployees = await Employee.find({ isActive: true })
      .select("_id email managerId teamLeaderId team department")
      .lean();

    const assessed = await Assessment.find({
      "assessment.period.year": year,
      "assessment.period.month": month,
      "assessment.evaluatorId": evaluator.id,
    }).select("employeeId").lean();

    const assessedIds = new Set(assessed.map((d) => d.employeeId.toString()));

    let pendingCount = 0;
    let totalAssessable = 0;
    for (const emp of allEmployees) {
      const allowed = await canAssessEmployee(evaluator, emp);
      if (allowed) {
        totalAssessable++;
        if (!assessedIds.has(emp._id.toString())) pendingCount++;
      }
    }

    res.json({
      year,
      month,
      monthName: MONTH_NAMES[month],
      pendingCount,
      completedCount: totalAssessable - pendingCount,
      totalAssessable,
    });
  } catch (err) {
    console.error("Error fetching assessment reminders:", err);
    res.status(500).json({ error: "Server error" });
  }
};

/**
 * GET /api/assessments/bonus-approvals
 * HR/Admin: returns all assessment sub-docs with bonusStatus === PENDING_HR.
 */
export const getBonusApprovals = async (req, res) => {
  try {
    const docs = await Assessment.find({
      "assessment.bonusStatus": "PENDING_HR",
    })
      .populate("employeeId", "fullName email employeeCode department position")
      .populate("assessment.evaluatorId", "fullName email");

    const results = [];
    for (const doc of docs) {
      for (const a of doc.assessment) {
        if (a.bonusStatus !== "PENDING_HR") continue;
        results.push({
          employeeId: doc.employeeId?._id || doc.employeeId,
          employeeName: doc.employeeId?.fullName,
          employeeCode: doc.employeeId?.employeeCode,
          department: doc.employeeId?.department,
          assessmentId: a._id || a.id,
          period: a.period,
          reviewPeriod: a.reviewPeriod,
          overall: a.overall,
          daysBonus: a.daysBonus,
          overtime: a.overtime,
          deduction: a.deduction,
          feedback: a.feedback,
          evaluator: a.evaluatorId,
          createdAt: a.createdAt,
        });
      }
    }

    results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ approvals: results, total: results.length });
  } catch (err) {
    console.error("Error fetching bonus approvals:", err);
    res.status(500).json({ error: "Server error" });
  }
};

/**
 * POST /api/assessments/:employeeId/assessment/:assessmentId/approve-bonus
 */
export const approveBonus = async (req, res) => {
  try {
    const { employeeId, assessmentId } = req.params;
    const doc = await Assessment.findOne({ employeeId });
    if (!doc) return res.status(404).json({ error: "Assessment document not found" });

    const sub = doc.assessment.id(assessmentId);
    if (!sub) return res.status(404).json({ error: "Assessment entry not found" });
    if (sub.bonusStatus !== "PENDING_HR") {
      return res.status(400).json({ error: `Cannot approve — current status is ${sub.bonusStatus}` });
    }

    sub.bonusStatus = "APPROVED";
    sub.bonusApprovedBy = req.user.email;
    sub.bonusApprovedAt = new Date();
    await doc.save();

    res.json({ message: "Bonus approved", data: sub });
  } catch (err) {
    console.error("Error approving bonus:", err);
    res.status(500).json({ error: "Server error" });
  }
};

/**
 * POST /api/assessments/:employeeId/assessment/:assessmentId/reject-bonus
 */
export const rejectBonus = async (req, res) => {
  try {
    const { employeeId, assessmentId } = req.params;
    const reason = req.body.reason || "";
    const doc = await Assessment.findOne({ employeeId });
    if (!doc) return res.status(404).json({ error: "Assessment document not found" });

    const sub = doc.assessment.id(assessmentId);
    if (!sub) return res.status(404).json({ error: "Assessment entry not found" });
    if (sub.bonusStatus !== "PENDING_HR") {
      return res.status(400).json({ error: `Cannot reject — current status is ${sub.bonusStatus}` });
    }

    sub.bonusStatus = "REJECTED";
    sub.bonusRejectionReason = reason;
    sub.bonusApprovedBy = req.user.email;
    sub.bonusApprovedAt = new Date();
    await doc.save();

    res.json({ message: "Bonus rejected", data: sub });
  } catch (err) {
    console.error("Error rejecting bonus:", err);
    res.status(500).json({ error: "Server error" });
  }
};
