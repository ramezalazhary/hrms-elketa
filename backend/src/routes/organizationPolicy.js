import { Router } from "express";
import { OrganizationPolicy } from "../models/OrganizationPolicy.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { strictLimiter } from "../middleware/security.js";
import {
  sanitizeWorkLocationsForSave,
  normalizeWorkLocationsForApiResponse,
} from "../utils/policyWorkLocations.js";

const router = Router();

// GET /policy/documents
router.get("/documents", requireAuth, async (req, res) => {
  try {
    let policy = await OrganizationPolicy.findOne({ name: "default" }).populate(
      "chiefExecutiveEmployeeId",
      "fullName email employeeCode department",
    );
    if (!policy) {
      return res.json({
        documentRequirements: [],
        workLocations: [],
        salaryIncreaseRules: [],
        companyTimezone: "Africa/Cairo",
        companyMonthStartDay: 1,
        chiefExecutiveEmployeeId: null,
        chiefExecutiveTitle: "Chief Executive Officer",
        leavePolicies: [],
      });
    }
    const plain = policy.toObject();
    plain.workLocations = normalizeWorkLocationsForApiResponse(plain.workLocations);
    res.json(plain);
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
      companyMonthStartDay,
      chiefExecutiveEmployeeId,
      chiefExecutiveTitle,
    } = req.body;
    let policy = await OrganizationPolicy.findOne({ name: "default" });
    
    if (policy) {
      if (documentRequirements !== undefined) policy.documentRequirements = documentRequirements;
      if (workLocations !== undefined)
        policy.workLocations = sanitizeWorkLocationsForSave(workLocations);
      if (salaryIncreaseRules !== undefined) policy.salaryIncreaseRules = salaryIncreaseRules;
      if (companyTimezone !== undefined) policy.companyTimezone = companyTimezone;
      if (leavePolicies !== undefined) policy.leavePolicies = leavePolicies;
      if (companyMonthStartDay !== undefined) {
        const d = Math.floor(Number(companyMonthStartDay));
        policy.companyMonthStartDay =
          Number.isFinite(d) && d >= 1 && d <= 31 ? d : 1;
      }
      if (chiefExecutiveTitle !== undefined) {
        const t = String(chiefExecutiveTitle || "").trim();
        policy.chiefExecutiveTitle = t || "Chief Executive Officer";
      }
      if (chiefExecutiveEmployeeId !== undefined) {
        const id = chiefExecutiveEmployeeId;
        if (
          id == null ||
          id === "" ||
          (typeof id === "string" && !id.trim())
        ) {
          policy.chiefExecutiveEmployeeId = null;
        } else {
          policy.chiefExecutiveEmployeeId = id;
        }
      }
      await policy.save();
    } else {
      const d = Math.floor(Number(companyMonthStartDay));
      const monthStart =
        companyMonthStartDay !== undefined &&
        Number.isFinite(d) &&
        d >= 1 &&
        d <= 31
          ? d
          : 1;
      const ceoTitle =
        chiefExecutiveTitle != null && String(chiefExecutiveTitle).trim()
          ? String(chiefExecutiveTitle).trim()
          : "Chief Executive Officer";
      let ceoId = null;
      if (
        chiefExecutiveEmployeeId != null &&
        chiefExecutiveEmployeeId !== "" &&
        String(chiefExecutiveEmployeeId).trim()
      ) {
        ceoId = chiefExecutiveEmployeeId;
      }
      policy = new OrganizationPolicy({
        name: "default",
        documentRequirements: documentRequirements || [],
        workLocations: sanitizeWorkLocationsForSave(workLocations || []),
        salaryIncreaseRules: salaryIncreaseRules || [],
        companyTimezone: companyTimezone || "Africa/Cairo",
        leavePolicies: leavePolicies || [],
        companyMonthStartDay: monthStart,
        chiefExecutiveTitle: ceoTitle,
        chiefExecutiveEmployeeId: ceoId,
      });
      await policy.save();
    }

    await policy.populate(
      "chiefExecutiveEmployeeId",
      "fullName email employeeCode department",
    );
    const out = policy.toObject();
    out.workLocations = normalizeWorkLocationsForApiResponse(out.workLocations);
    res.json(out);
  } catch (error) {
    console.error("Error updating policy:", error);
    res.status(500).json({ error: "Failed to update policy" });
  }
});

export default router;
