import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/auth.js";
import {
  createAssessment,
  getEmployeeAssessments,
  getAssessmentEligibility,
} from "../controllers/assessmentController.js";

const router = Router();

router.use(requireAuth);

router.get(
  "/eligibility/:employeeId",
  requireRole(["EMPLOYEE", "MANAGER", "TEAM_LEADER", "HR_STAFF", "HR_MANAGER", "ADMIN"]),
  getAssessmentEligibility,
);

// Accessible by authorized managers and HR/Admins
router.post(
  "/",
  requireRole(["MANAGER", "TEAM_LEADER", "HR_STAFF", "HR_MANAGER", "ADMIN"]),
  createAssessment
);

// Accessible by the employee themselves, or authorized managers/HR/Admins
router.get(
  "/employee/:id",
  requireRole(["EMPLOYEE", "MANAGER", "TEAM_LEADER", "HR_STAFF", "HR_MANAGER", "ADMIN"]),
  getEmployeeAssessments
);

export default router;
