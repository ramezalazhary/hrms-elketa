import fs from 'fs';
import path from 'path';

const content = `import { Assessment } from "../models/Assessment.js";
import { Employee } from "../models/Employee.js";
import { PerformanceReview } from "../models/PerformanceReview.js";
import { AssessmentTemplate } from "../models/AssessmentTemplate.js";
// import { createAssessmentSchema } from "../validators/assessmentValidators.js";
import { canAssessEmployee } from "../services/assessmentAccessService.js";

const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

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

    const autoReviewPeriod = \`\${MONTH_NAMES[period.month]} \${period.year}\`;
    const hasBonusOrDeduction = (daysBonus && daysBonus > 0) || (overtime && overtime > 0) || (deduction && deduction > 0);

    // Check for duplicates
    const existing = await PerformanceReview.findOne({
      employeeId,
      "period.year": period.year,
      "period.month": period.month,
      evaluatorId: evaluator.id
    });
    
    if (existing) {
      return res.status(409).json({ error: \`You have already submitted an assessment for \${autoReviewPeriod}\` });
    }

    // Process legacy format transparently if submitted from old UI temporarily
    let finalScores = scores || [];
    let overallScore = req.body.overall || 0;
    
    // Calculate overall using weighted average if scores provided
    if (finalScores.length > 0) {
      let totalWeight = 0;
      let weightedSum = 0;
      for (const s of finalScores) {
        totalWeight += s.weight;
        weightedSum += (s.score * s.weight);
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
             criterionId: "000000000000000000000000",
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
      templateId,
      scores: finalScores,
      overall: overallScore,
      feedback,
      notesPrevious: notesPrevious || "",
      goalsForNextPeriod: goalsForNextPeriod || [],
      getThebounes,
      daysBonus: daysBonus || 0,
      overtime: overtime || 0,
      deduction: deduction || 0,
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
       if (review.bonusStatus !== "PENDING_HR") return res.status(400).json({ error: \`Cannot approve, status is \${review.bonusStatus}\` });
       review.bonusStatus = "APPROVED"; review.bonusApprovedBy = req.user.email; review.bonusApprovedAt = new Date();
       await review.save();
       return res.json({ message: "Bonus approved", data: review });
    }

    // Try legacy
    const doc = await Assessment.findOne({ employeeId });
    if (!doc) return res.status(404).json({ error: "Assessment document not found" });
    const sub = doc.assessment.id(assessmentId);
    if (!sub) return res.status(404).json({ error: "Assessment entry not found" });
    if (sub.bonusStatus !== "PENDING_HR") return res.status(400).json({ error: \`Cannot approve, status is \${sub.bonusStatus}\` });
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
       if (review.bonusStatus !== "PENDING_HR") return res.status(400).json({ error: \`Cannot reject, status is \${review.bonusStatus}\` });
       review.bonusStatus = "REJECTED"; review.bonusRejectionReason = reason; review.bonusApprovedBy = req.user.email; review.bonusApprovedAt = new Date();
       await review.save();
       return res.json({ message: "Bonus rejected", data: review });
    }

    // Try legacy
    const doc = await Assessment.findOne({ employeeId });
    if (!doc) return res.status(404).json({ error: "Assessment document not found" });
    const sub = doc.assessment.id(assessmentId);
    if (!sub) return res.status(404).json({ error: "Assessment entry not found" });
    if (sub.bonusStatus !== "PENDING_HR") return res.status(400).json({ error: \`Cannot reject, status is \${sub.bonusStatus}\` });
    sub.bonusStatus = "REJECTED"; sub.bonusRejectionReason = reason; sub.bonusApprovedBy = req.user.email; sub.bonusApprovedAt = new Date();
    await doc.save();
    res.json({ message: "Bonus rejected", data: sub });
  } catch (err) { res.status(500).json({ error: "Server error" }); }
};
`;

fs.writeFileSync(path.join(process.cwd(), 'backend', 'src', 'controllers', 'assessmentController.js'), content);
console.log('assessmentController replaced');
