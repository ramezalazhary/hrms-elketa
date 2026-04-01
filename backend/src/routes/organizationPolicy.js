import { Router } from "express";
import { OrganizationPolicy } from "../models/OrganizationPolicy.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { strictLimiter } from "../middleware/security.js";

const router = Router();

// GET /policy/documents
router.get("/documents", requireAuth, async (req, res) => {
  try {
    let policy = await OrganizationPolicy.findOne({ name: "default" });
    if (!policy) {
      // Return empty list if no policy created yet
      return res.json({ documentRequirements: [] });
    }
    res.json(policy);
  } catch (error) {
    console.error("Error fetching policy:", error);
    res.status(500).json({ error: "Failed to fetch policy" });
  }
});

// PUT /policy/documents (Admin only)
router.put("/documents", requireAuth, requireRole(3), strictLimiter, async (req, res) => {
  try {
    const { documentRequirements, workLocations, salaryIncreaseRules } = req.body;
    let policy = await OrganizationPolicy.findOne({ name: "default" });
    
    if (policy) {
      if (documentRequirements !== undefined) policy.documentRequirements = documentRequirements;
      if (workLocations !== undefined) policy.workLocations = workLocations;
      if (salaryIncreaseRules !== undefined) policy.salaryIncreaseRules = salaryIncreaseRules;
      await policy.save();
    } else {
      policy = new OrganizationPolicy({
        name: "default",
        documentRequirements: documentRequirements || [],
        workLocations: workLocations || [],
        salaryIncreaseRules: salaryIncreaseRules || []
      });
      await policy.save();
    }
    
    res.json(policy);
  } catch (error) {
    console.error("Error updating policy:", error);
    res.status(500).json({ error: "Failed to update policy" });
  }
});

export default router;
