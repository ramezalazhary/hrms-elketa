import { Assessment } from "../models/Assessment.js";
import { Employee } from "../models/Employee.js";
import { PerformanceReview } from "../models/PerformanceReview.js";
import { AssessmentTemplate } from "../models/AssessmentTemplate.js";
// import { createAssessmentSchema } from "../validators/assessmentValidators.js";
import { canAssessEmployee } from "../services/assessmentAccessService.js";
import mongoose from "mongoose";

const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// ✅ All new assessments go to PerformanceReview only.
// Assessment (legacy) model is READ-ONLY — used only for historical data reads.
export const createAssessment = async (req, res, next) => {
  try {
    const {
      employeeId,
      date,
      period,
      feedback,
      getThebounes,
      daysBonus,
      overtime,
      deduction,
      deductionType,   // "DAYS" | "AMOUNT" — default: "AMOUNT"
      notesPrevious,
      templateId,
      scores,
      goalsForNextPeriod
    } = req.body;
    const evaluator = req.user;

    const targetEmp = await Employee.findById(employeeId);
    if (!targetEmp) return res.status(404).json({ error: "Target employee not found" });

    const allowed = await canAssessEmployee(evaluator, targetEmp);
    if (!allowed) {
      return res.status(403).json({ error: "Forbidden: You cannot assess this employee." });
    }

    const autoReviewPeriod = `${MONTH_NAMES[period.month]} ${period.year}`;
    const hasBonusOrDeduction = (daysBonus && daysBonus > 0) || (overtime && overtime > 0) || (deduction && deduction > 0);

    // Check for duplicates
    const existing = await PerformanceReview.findOne({
      employeeId,
      "period.year": period.year,
      "period.month": period.month,
      evaluatorId: evaluator.id
    });
    
    if (existing) {
      return res.status(409).json({ error: `You have already submitted an assessment for ${autoReviewPeriod}` });
    }

    // Process legacy format transparently if submitted from old UI temporarily
    let finalScores = (scores || []).map(s => ({
      ...s,
      // criterionId should be a valid ObjectId; if it's a plain id string from toJSON, keep it
      // If it's undefined/null, omit it (field is now optional)
      criterionId: s.criterionId || undefined,
    }));
    let overallScore = req.body.overall || 0;
    
    // Calculate overall using weighted average if scores provided
    if (finalScores.length > 0) {
      let totalWeight = 0;
      let weightedSum = 0;
      for (const s of finalScores) {
        totalWeight += (s.weight || 1);
        weightedSum += (s.score * (s.weight || 1));
      }
      if (totalWeight > 0) {
         overallScore = Number((weightedSum / totalWeight).toFixed(2));
      }
    } else if (req.body.overall) {
      // Create artificial scores from legacy fields
      const legacyFields = ["commitment", "attitude", "quality"];
      for (const f of legacyFields) {
        if (req.body[f]) {
           finalScores.push({
             title: f.charAt(0).toUpperCase() + f.slice(1),
             score: req.body[f],
             weight: 1
           });
        }
      }
      overallScore = req.body.overall;
    }

    const review = new PerformanceReview({
      employeeId,
      evaluatorId: evaluator.id,
      date,
      period,
      templateId: templateId || undefined,  // ignore empty string — Mongoose can't cast "" to ObjectId
      scores: finalScores,
      overall: overallScore,
      feedback,
      notesPrevious: notesPrevious || "",
      goalsForNextPeriod: goalsForNextPeriod || [],
      getThebounes,
      daysBonus: daysBonus || 0,
      overtime: overtime || 0,
      deduction: deduction || 0,
      deductionType: deductionType || "AMOUNT",  // default: EGP amount for backward compat
      bonusStatus: hasBonusOrDeduction ? "PENDING_HR" : "NONE",
    });

    await review.save();
    
    res.status(201).json({ message: "Assessment saved successfully", data: review });
  } catch (err) {
    console.error("Error creating assessment:", err);
    res.status(500).json({ error: "Server error creating assessment" });
  }
};

export const getEmployeeAssessments = async (req, res, next) => {
  try {
    const targetEmployeeId = req.params.id;
    const requester = req.user;
    const isSelf = requester.id === targetEmployeeId;

    if (!isSelf) {
      const targetEmp = await Employee.findById(targetEmployeeId);
      if (!targetEmp) return res.status(404).json({ error: "Employee not found" });
      const allowed = await canAssessEmployee(requester, targetEmp);
      if (!allowed) {
        return res.status(403).json({ error: "Forbidden: Cannot access this employee's assessments." });
      }
    }

    // 1. Fetch legacy nested records
    let unifiedRecords = [];
    const legacyDoc = await Assessment.findOne({ employeeId: targetEmployeeId })
      .populate("assessment.evaluatorId", "fullName email employeeCode position")
      .lean();
    if (legacyDoc && legacyDoc.assessment) {
      unifiedRecords = legacyDoc.assessment;
    }

    // 2. Fetch new PerformanceReview records
    const newReviews = await PerformanceReview.find({ employeeId: targetEmployeeId })
      .populate("evaluatorId", "fullName email employeeCode position")
      .lean();
    
    for (const rw of newReviews) {
      // Map to legacy layout for frontend compatibility
      unifiedRecords.push({
        _id: rw._id,
        id: rw._id.toString(),
        date: rw.date,
        period: rw.period,
        overall: rw.overall,
        rating: rw.overall,
        feedback: rw.feedback,
        notesPrevious: rw.notesPrevious,
        evaluatorId: rw.evaluatorId,
        daysBonus: rw.daysBonus,
        overtime: rw.overtime,
        deduction: rw.deduction,
        getThebounes: rw.getThebounes,
        bonusStatus: rw.bonusStatus,
        scores: rw.scores, // New
        goalsForNextPeriod: rw.goalsForNextPeriod, // New
        createdAt: rw.createdAt
      });
    }

    if (unifiedRecords.length === 0) {
      return res.json([{ employeeId: targetEmployeeId, assessment: [] }]);
    }
    
    // Sort combined records descending
    unifiedRecords.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json([{ employeeId: targetEmployeeId, assessment: unifiedRecords }]);
  } catch (err) {
    console.error("Error getting employee assessments:", err);
    res.status(500).json({ error: "Server error fetching assessments" });
  }
};

export const getAssessmentEligibility = async (req, res, next) => {
  try {
    const targetEmp = await Employee.findById(req.params.employeeId);
    if (!targetEmp) return res.status(404).json({ canAssess: false });
    const canAssess = await canAssessEmployee(req.user, targetEmp);
    res.json({ canAssess });
  } catch (err) {
    next(err);
  }
};

export const getPendingAssessments = async (req, res) => {
  try {
    const now = new Date();
    const year = Number(req.query.year) || now.getFullYear();
    const month = Number(req.query.month) || now.getMonth() + 1;
    const evaluator = req.user;

    const allEmployees = await Employee.find({ isActive: true })
      .select("fullName email employeeCode department team position managerId teamLeaderId")
      .lean();

    // Checked assessed using BOTH legacy and new
    const assessedLegacy = await Assessment.find({
      "assessment.period.year": year,
      "assessment.period.month": month,
      "assessment.evaluatorId": evaluator.id,
    }).select("employeeId").lean();

    const assessedNew = await PerformanceReview.find({
      "period.year": year,
      "period.month": month,
      evaluatorId: evaluator.id
    }).select("employeeId").lean();

    const assessedIds = new Set(
      [...assessedLegacy, ...assessedNew].map((d) => (d.employeeId?._id || d.employeeId).toString())
    );

    const pending = [];
    for (const emp of allEmployees) {
      if (assessedIds.has(emp._id.toString())) continue;
      const allowed = await canAssessEmployee(evaluator, emp);
      if (allowed) pending.push(emp);
    }
    res.json({ year, month, pending, total: pending.length });
  } catch (err) {
    console.error("Error pending assessments:", err);
    res.status(500).json({ error: "Server error" });
  }
};

export const getAssessmentReminders = async (req, res) => {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const evaluator = req.user;

    const allEmployees = await Employee.find({ isActive: true })
      .select("_id email managerId teamLeaderId team department")
      .lean();

    const assessedLegacy = await Assessment.find({
      "assessment.period.year": year,
      "assessment.period.month": month,
      "assessment.evaluatorId": evaluator.id,
    }).select("employeeId").lean();

    const assessedNew = await PerformanceReview.find({
      "period.year": year,
      "period.month": month,
      evaluatorId: evaluator.id
    }).select("employeeId").lean();

    const assessedIds = new Set(
      [...assessedLegacy, ...assessedNew].map((d) => (d.employeeId?._id || d.employeeId).toString())
    );

    let pendingCount = 0;
    let totalAssessable = 0;
    for (const emp of allEmployees) {
      const allowed = await canAssessEmployee(evaluator, emp);
      if (allowed) {
        totalAssessable++;
        if (!assessedIds.has(emp._id.toString())) pendingCount++;
      }
    }
    res.json({ monthName: MONTH_NAMES[month], pendingCount, completedCount: totalAssessable - pendingCount, totalAssessable });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
};

export const getBonusApprovals = async (req, res) => {
  try {
    // Legacy
    const docs = await Assessment.find({ "assessment.bonusStatus": "PENDING_HR" })
      .populate("employeeId", "fullName email employeeCode department position")
      .populate("assessment.evaluatorId", "fullName email");
    
    // New
    const reviews = await PerformanceReview.find({ bonusStatus: "PENDING_HR" })
      .populate("employeeId", "fullName email employeeCode department position")
      .populate("evaluatorId", "fullName email");

    const results = [];
    for (const doc of docs) {
      for (const a of doc.assessment) {
        if (a.bonusStatus !== "PENDING_HR") continue;
        results.push({
          isLegacy: true,
          employeeId: doc.employeeId?._id || doc.employeeId,
          employeeName: doc.employeeId?.fullName,
          employeeCode: doc.employeeId?.employeeCode,
          department: doc.employeeId?.department,
          assessmentId: a._id || a.id,
          period: a.period, overall: a.overall,
          daysBonus: a.daysBonus, overtime: a.overtime, deduction: a.deduction,
          feedback: a.feedback, evaluator: a.evaluatorId, createdAt: a.createdAt,
        });
      }
    }
    for (const rw of reviews) {
      results.push({
        isLegacy: false,
        employeeId: rw.employeeId?._id || rw.employeeId,
        employeeName: rw.employeeId?.fullName,
        employeeCode: rw.employeeId?.employeeCode,
        department: rw.employeeId?.department,
        assessmentId: rw._id || rw.id, // we treat the review id as assessmentId
        period: rw.period, overall: rw.overall,
        daysBonus: rw.daysBonus, overtime: rw.overtime, deduction: rw.deduction,
        feedback: rw.feedback, evaluator: rw.evaluatorId, createdAt: rw.createdAt,
      });
    }

    results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ approvals: results, total: results.length });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
};

export const approveBonus = async (req, res) => {
  try {
    const { employeeId, assessmentId } = req.params;
    
    // Try new first
    let review = await PerformanceReview.findById(assessmentId);
    if (review) {
       if (review.bonusStatus !== "PENDING_HR") return res.status(400).json({ error: `Cannot approve, status is ${review.bonusStatus}` });
       review.bonusStatus = "APPROVED"; review.bonusApprovedBy = req.user.email; review.bonusApprovedAt = new Date();
       await review.save();
       return res.json({ message: "Bonus approved", data: review });
    }

    // Try legacy
    const doc = await Assessment.findOne({ employeeId });
    if (!doc) return res.status(404).json({ error: "Assessment document not found" });
    const sub = doc.assessment.id(assessmentId);
    if (!sub) return res.status(404).json({ error: "Assessment entry not found" });
    if (sub.bonusStatus !== "PENDING_HR") return res.status(400).json({ error: `Cannot approve, status is ${sub.bonusStatus}` });
    sub.bonusStatus = "APPROVED"; sub.bonusApprovedBy = req.user.email; sub.bonusApprovedAt = new Date();
    await doc.save();
    res.json({ message: "Bonus approved", data: sub });
  } catch (err) { res.status(500).json({ error: "Server error" }); }
};

export const rejectBonus = async (req, res) => {
  try {
    const { employeeId, assessmentId } = req.params;
    const reason = req.body.reason || "";
    
    // Try new first
    let review = await PerformanceReview.findById(assessmentId);
    if (review) {
       if (review.bonusStatus !== "PENDING_HR") return res.status(400).json({ error: `Cannot reject, status is ${review.bonusStatus}` });
       review.bonusStatus = "REJECTED"; review.bonusRejectionReason = reason; review.bonusApprovedBy = req.user.email; review.bonusApprovedAt = new Date();
       await review.save();
       return res.json({ message: "Bonus rejected", data: review });
    }

    // Try legacy
    const doc = await Assessment.findOne({ employeeId });
    if (!doc) return res.status(404).json({ error: "Assessment document not found" });
    const sub = doc.assessment.id(assessmentId);
    if (!sub) return res.status(404).json({ error: "Assessment entry not found" });
    if (sub.bonusStatus !== "PENDING_HR") return res.status(400).json({ error: `Cannot reject, status is ${sub.bonusStatus}` });
    sub.bonusStatus = "REJECTED"; sub.bonusRejectionReason = reason; sub.bonusApprovedBy = req.user.email; sub.bonusApprovedAt = new Date();
    await doc.save();
    res.json({ message: "Bonus rejected", data: sub });
  } catch (err) { res.status(500).json({ error: "Server error" }); }
};

// ── Edit an existing assessment (HR/Admin only on new PerformanceReview) ──
export const updateAssessment = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      scores, overall, feedback, notesPrevious,
      daysBonus, overtime, deduction, deductionType, getThebounes,
      goalsForNextPeriod, bonusStatus,
    } = req.body;

    const review = await PerformanceReview.findById(id);
    if (!review) return res.status(404).json({ error: "Assessment not found" });

    // Recalculate overall if scores provided
    if (Array.isArray(scores) && scores.length > 0) {
      review.scores = scores.map(s => ({
        ...s,
        criterionId: s.criterionId || undefined,
      }));
      let totalWeight = 0, weightedSum = 0;
      for (const s of scores) {
        totalWeight += (s.weight || 1);
        weightedSum += (s.score * (s.weight || 1));
      }
      review.overall = totalWeight > 0 ? Number((weightedSum / totalWeight).toFixed(2)) : (overall || review.overall);
    } else if (overall != null) {
      review.overall = overall;
    }

    if (feedback !== undefined)       review.feedback = feedback;
    if (notesPrevious !== undefined)   review.notesPrevious = notesPrevious;
    if (daysBonus !== undefined)       review.daysBonus = Math.max(0, Number(daysBonus) || 0);
    if (overtime !== undefined)        review.overtime = Math.max(0, Number(overtime) || 0);
    if (deduction !== undefined)       review.deduction = Math.max(0, Number(deduction) || 0);
    if (deductionType !== undefined)   review.deductionType = deductionType;  // "DAYS" | "AMOUNT"
    if (getThebounes !== undefined)    review.getThebounes = Boolean(getThebounes);
    if (bonusStatus !== undefined)     review.bonusStatus = bonusStatus;
    if (Array.isArray(goalsForNextPeriod)) {
      review.goalsForNextPeriod = goalsForNextPeriod.filter(g => g.description?.trim());
    }

    // Recalculate bonus status
    const hasBonusOrDeduction = review.daysBonus > 0 || review.overtime > 0 || review.deduction > 0;
    if (!hasBonusOrDeduction && review.bonusStatus === "PENDING_HR") {
      review.bonusStatus = "NONE";
    }

    await review.save();
    res.json({ message: "Assessment updated successfully", data: review });
  } catch (err) {
    console.error("Error updating assessment:", err);
    res.status(500).json({ error: "Server error updating assessment" });
  }
};

// ── Delete an assessment (HR/Admin only on new PerformanceReview) ──
export const deleteAssessment = async (req, res) => {
  try {
    const { id } = req.params;

    const review = await PerformanceReview.findById(id);
    if (!review) return res.status(404).json({ error: "Assessment not found" });

    const usedInPayroll = await mongoose.model("PayrollRecord").exists({
      "assessmentSnapshotList.assessmentId": review._id,
    });
    if (usedInPayroll) {
      return res.status(409).json({
        error: "Cannot delete: This assessment is already included in a payroll computation. Contact HR Admin."
      });
    }

    await PerformanceReview.deleteOne({ _id: id });
    res.json({ message: "Assessment deleted successfully" });
  } catch (err) {
    console.error("Error deleting assessment:", err);
    res.status(500).json({ error: "Server error deleting assessment" });
  }
};
