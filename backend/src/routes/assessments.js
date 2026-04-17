import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { enforcePolicy } from "../middleware/enforcePolicy.js";
import {
  createAssessment,
  getEmployeeAssessments,
  getAssessmentEligibility,
  getPendingAssessments,
  getAssessmentReminders,
  getBonusApprovals,
  approveBonus,
  rejectBonus,
  updateAssessment,
  deleteAssessment,
} from "../controllers/assessmentController.js";

const router = Router();

router.use(requireAuth);

router.get(
  "/eligibility/:employeeId",
  enforcePolicy("read", "assessments"),
  getAssessmentEligibility
);

router.get(
  "/pending",
  enforcePolicy("assess", "assessments"),
  getPendingAssessments
);

router.get(
  "/reminders",
  enforcePolicy("assess", "assessments"),
  getAssessmentReminders
);

router.get(
  "/bonus-approvals",
  enforcePolicy("manage", "assessments"),
  getBonusApprovals
);

router.post(
  "/:employeeId/assessment/:assessmentId/approve-bonus",
  enforcePolicy("manage", "assessments"),
  approveBonus
);

router.post(
  "/:employeeId/assessment/:assessmentId/reject-bonus",
  enforcePolicy("manage", "assessments"),
  rejectBonus
);

router.post(
  "/",
  enforcePolicy("assess", "assessments"),
  createAssessment
);

router.get(
  "/employee/:id",
  enforcePolicy("read", "assessments"),
  getEmployeeAssessments
);

// HR / Admin — edit or delete an assessment
router.put(
  "/:id",
  enforcePolicy("manage", "assessments"),
  updateAssessment
);

router.delete(
  "/:id",
  enforcePolicy("manage", "assessments"),
  deleteAssessment
);

export default router;
