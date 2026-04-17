import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
const requireHrRole = requireRole(["HR", "HR_MANAGER", "ADMIN"]);
import * as ctrl from "../controllers/assessmentTemplatesController.js";

const router = Router();

// Templates can be read by any authenticated user for rendering assessments
router.get("/", requireAuth, ctrl.getTemplates);
router.get("/:id", requireAuth, ctrl.getTemplateById);

// HR only for managing templates
router.post("/", requireAuth, requireHrRole, ctrl.createTemplate);
router.put("/:id", requireAuth, requireHrRole, ctrl.updateTemplate);
router.delete("/:id", requireAuth, requireHrRole, ctrl.deleteTemplate);

export default router;
