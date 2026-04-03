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
      return res.json({
        documentRequirements: [],
        workLocations: [],
        salaryIncreaseRules: [],
        companyTimezone: "Africa/Cairo",
        leavePolicies: [],
      });
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
    const {
      documentRequirements,
      workLocations,
      salaryIncreaseRules,
      companyTimezone,
      leavePolicies,
    } = req.body;
    let policy = await OrganizationPolicy.findOne({ name: "default" });
    
    if (policy) {
      if (documentRequirements !== undefined) policy.documentRequirements = documentRequirements;
      if (workLocations !== undefined) policy.workLocations = workLocations;
      if (salaryIncreaseRules !== undefined) policy.salaryIncreaseRules = salaryIncreaseRules;
      if (companyTimezone !== undefined) policy.companyTimezone = companyTimezone;
      if (leavePolicies !== undefined) policy.leavePolicies = leavePolicies;
      await policy.save();
    } else {
      policy = new OrganizationPolicy({
        name: "default",
        documentRequirements: documentRequirements || [],
        workLocations: workLocations || [],
        salaryIncreaseRules: salaryIncreaseRules || [],
        companyTimezone: companyTimezone || "Africa/Cairo",
        leavePolicies: leavePolicies || [],
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
