import { Router } from "express";
import { OrganizationPolicy } from "../models/OrganizationPolicy.js";
import { Employee } from "../models/Employee.js";
import { requireAuth } from "../middleware/auth.js";
import { enforcePolicy } from "../middleware/enforcePolicy.js";
import { requireCeoOrAdmin } from "../middleware/requireCeoOrAdmin.js";
import { strictLimiter } from "../middleware/security.js";
import {
  sanitizeWorkLocationsForSave,
  normalizeWorkLocationsForApiResponse,
} from "../utils/policyWorkLocations.js";
import { normalizeWeeklyRestDays } from "../utils/weeklyRestDays.js";
import { finalizePolicyWorkingDays } from "../utils/orgPolicyWorkingDays.js";
import { validateLateDeductionTiersForSave } from "../utils/attendanceTimingCore.js";

const router = Router();

/** 24h clock string: HH:mm or HH:mm:ss (validated; invalid → fallback). */
function sanitizeOrgClockTime(raw, fallback) {
  const s = String(raw ?? "").trim();
  if (!s) return fallback;
  const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return fallback;
  const h = Number(m[1]);
  const min = Number(m[2]);
  const sec = m[3] !== undefined && m[3] !== "" ? Number(m[3]) : 0;
  if (!Number.isFinite(h) || !Number.isFinite(min) || !Number.isFinite(sec)) return fallback;
  if (h > 23 || min > 59 || sec > 59) return fallback;
  const hh = String(h).padStart(2, "0");
  const mm = String(min).padStart(2, "0");
  if (m[3] !== undefined && m[3] !== "") {
    return `${hh}:${mm}:${String(sec).padStart(2, "0")}`;
  }
  return `${hh}:${mm}`;
}

async function syncManagersToChiefExecutive(chiefExecutiveEmployeeId) {
  const ceoId = chiefExecutiveEmployeeId ? String(chiefExecutiveEmployeeId) : null;
  if (!ceoId) {
    await Employee.updateMany(
      { role: "MANAGER" },
      { $set: { managerId: null } },
    );
    return;
  }

  await Employee.updateMany(
    { role: "MANAGER", _id: { $ne: ceoId } },
    { $set: { managerId: ceoId } },
  );
  await Employee.updateOne({ _id: ceoId }, { $set: { managerId: null } });
}

async function resolveValidChiefExecutiveId(rawId) {
  if (
    rawId == null ||
    rawId === "" ||
    (typeof rawId === "string" && !rawId.trim())
  ) {
    return null;
  }
  const candidateId = String(rawId).trim();
  const exists = await Employee.exists({ _id: candidateId, isActive: true });
  return exists ? candidateId : null;
}

function sanitizePartnersForSave(rawPartners) {
  if (!Array.isArray(rawPartners)) return [];
  return rawPartners
    .map((row) => {
      const name = String(row?.name || "").trim();
      if (!name) return null;
      const title = String(row?.title || "").trim() || "Partner";
      const notes = String(row?.notes || "").trim();
      const ownershipRaw =
        row?.ownershipPercent === null || row?.ownershipPercent === ""
          ? null
          : Number(row?.ownershipPercent);
      const ownershipPercent = Number.isFinite(ownershipRaw)
        ? Math.min(100, Math.max(0, ownershipRaw))
        : null;
      const employeeId =
        row?.employeeId && typeof row.employeeId === "object"
          ? row.employeeId._id || row.employeeId.id || null
          : row?.employeeId || null;
      return {
        name,
        title,
        notes,
        ownershipPercent,
        employeeId: employeeId ? String(employeeId).trim() : null,
      };
    })
    .filter(Boolean);
}

// GET /policy/documents
router.get(
  "/documents",
  requireAuth,
  enforcePolicy("read", "organization_policy"),
  async (req, res) => {
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
        partners: [],
        leavePolicies: [],
        attendanceRules: {
          standardStartTime: "09:00",
          standardEndTime: "17:00",
          gracePeriodMinutes: 15,
          monthlyGraceUsesEnabled: false,
          monthlyGraceUsesAllowed: 0,
          workingDaysPerMonth: 22,
          lateDeductionTiers: [],
          absenceDeductionDays: 1,
          earlyDepartureDeductionDays: 0,
          incompleteRecordDeductionDays: 0,
          weeklyRestDays: [5, 6],
        },
        assessmentPayrollRules: {
          bonusDaysEnabled: true,
          bonusDayMultiplier: 1.0,
          overtimeEnabled: false,
          overtimeDayMultiplier: 1.5,
          deductionEnabled: false,
          deductionDayMultiplier: 1.0,
        },
        payrollConfig: {
          decimalPlaces: 2,
          workingDaysPerMonth: 22,
          hoursPerDay: 8,
          overtimeMultiplier: 1.5,
          personalExemptionAnnual: 20000,
          martyrsFundRate: 0.0005,
          insuranceRates: { employeeShare: 0.11, companyShare: 0.1875, maxInsurableWage: 16700, minInsurableWage: 2700 },
          taxBrackets: [
            { from: 0, to: 40000, rate: 0 },
            { from: 40000, to: 55000, rate: 0.10 },
            { from: 55000, to: 70000, rate: 0.15 },
            { from: 70000, to: 200000, rate: 0.20 },
            { from: 200000, to: 400000, rate: 0.225 },
            { from: 400000, to: 1200000, rate: 0.25 },
            { from: 1200000, to: null, rate: 0.275 },
          ],
        },
      });
    }
    const plain = policy.toObject();
    plain.workLocations = normalizeWorkLocationsForApiResponse(plain.workLocations);
    res.json(plain);
  } catch (error) {
    console.error("Error fetching policy:", error);
    res.status(500).json({ error: "Failed to fetch policy" });
  }
},
);

// PUT /policy/documents (Admin only)
router.put("/documents", requireAuth, enforcePolicy("manage", "organization_policy"), strictLimiter, async (req, res) => {
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
      partners,
      attendanceRules,
      assessmentPayrollRules,
      payrollConfig,
    } = req.body;

    /** Set when `attendanceRules` is present in the body (drives unified working days if payroll omits it). */
    let requestAttendanceWorkingDays;
    /** Set only when `payrollConfig.workingDaysPerMonth` is explicitly present in the body. */
    let requestPayrollWorkingDays;

    function sanitizeAttendanceRules(raw) {
      if (!raw || typeof raw !== "object") return undefined;
      const tiers = Array.isArray(raw.lateDeductionTiers)
        ? raw.lateDeductionTiers
            .filter((t) => t && Number.isFinite(Number(t.fromMinutes)) && Number.isFinite(Number(t.toMinutes)))
            .map((t) => {
              const fromMinutes = Math.max(0, Number(t.fromMinutes));
              let toMinutes = Number(t.toMinutes);
              const minBand = 1 / 60; // at least one second wider than `from`
              if (!Number.isFinite(toMinutes) || toMinutes <= fromMinutes) {
                toMinutes = fromMinutes + minBand;
              }
              return {
                fromMinutes,
                toMinutes,
                deductionDays: Math.max(0, Number(t.deductionDays) || 0),
              };
            })
            .sort((a, b) => a.fromMinutes - b.fromMinutes)
        : [];
      const tierCheck = validateLateDeductionTiersForSave(tiers);
      if (!tierCheck.ok) {
        const err = new Error(tierCheck.message);
        err.statusCode = 400;
        throw err;
      }
      return {
        standardStartTime: sanitizeOrgClockTime(raw.standardStartTime, "09:00"),
        standardEndTime: sanitizeOrgClockTime(raw.standardEndTime, "17:00"),
        gracePeriodMinutes: Math.max(0, Math.floor(Number.isFinite(Number(raw.gracePeriodMinutes)) ? Number(raw.gracePeriodMinutes) : 15)),
        monthlyGraceUsesEnabled: Boolean(raw.monthlyGraceUsesEnabled),
        monthlyGraceUsesAllowed: Math.max(
          0,
          Math.min(31, Math.floor(Number.isFinite(Number(raw.monthlyGraceUsesAllowed)) ? Number(raw.monthlyGraceUsesAllowed) : 0)),
        ),
        workingDaysPerMonth: Math.max(1, Math.min(31, Math.floor(Number.isFinite(Number(raw.workingDaysPerMonth)) ? Number(raw.workingDaysPerMonth) : 22))),
        lateDeductionTiers: tiers,
        absenceDeductionDays: Math.max(0, Number.isFinite(Number(raw.absenceDeductionDays)) ? Number(raw.absenceDeductionDays) : 1),
        earlyDepartureDeductionDays: Math.max(0, Number.isFinite(Number(raw.earlyDepartureDeductionDays)) ? Number(raw.earlyDepartureDeductionDays) : 0),
        incompleteRecordDeductionDays: Math.max(0, Number.isFinite(Number(raw.incompleteRecordDeductionDays)) ? Number(raw.incompleteRecordDeductionDays) : 0),
        weeklyRestDays: Array.isArray(raw.weeklyRestDays)
          ? normalizeWeeklyRestDays(raw.weeklyRestDays)
          : normalizeWeeklyRestDays(undefined),
      };
    }

    let policy = await OrganizationPolicy.findOne({ name: "default" });
    
    if (policy) {
      if (documentRequirements !== undefined) policy.documentRequirements = documentRequirements;
      if (workLocations !== undefined)
        policy.workLocations = sanitizeWorkLocationsForSave(workLocations);
      if (salaryIncreaseRules !== undefined) policy.salaryIncreaseRules = salaryIncreaseRules;
      if (companyTimezone !== undefined) policy.companyTimezone = companyTimezone;
      if (leavePolicies !== undefined) policy.leavePolicies = leavePolicies;
      if (attendanceRules !== undefined) {
        const sanitized = sanitizeAttendanceRules(attendanceRules);
        if (sanitized) {
          policy.attendanceRules = sanitized;
          requestAttendanceWorkingDays = sanitized.workingDaysPerMonth;
        }
      }
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
        const nextChiefExecutiveId =
          await resolveValidChiefExecutiveId(chiefExecutiveEmployeeId);
        if (!nextChiefExecutiveId) {
          return res.status(400).json({
            error: "Chief Executive must be a valid active employee",
          });
        }
        policy.chiefExecutiveEmployeeId = nextChiefExecutiveId;
      }
      if (partners !== undefined) {
        policy.partners = sanitizePartnersForSave(partners);
      }
      if (payrollConfig !== undefined && typeof payrollConfig === "object") {
        const pc = payrollConfig;
        const safeNum = (v, def, min = 0) => {
          const n = Number(v);
          return Number.isFinite(n) && n >= min ? n : def;
        };
        const prevPc =
          policy.payrollConfig && typeof policy.payrollConfig === "object"
            ? policy.payrollConfig.toObject
              ? policy.payrollConfig.toObject()
              : { ...policy.payrollConfig }
            : {};
        let mergedWd = prevPc.workingDaysPerMonth;
        if (Object.prototype.hasOwnProperty.call(pc, "workingDaysPerMonth")) {
          requestPayrollWorkingDays = safeNum(pc.workingDaysPerMonth, 22, 1);
          mergedWd = requestPayrollWorkingDays;
        } else if (mergedWd == null || !Number.isFinite(Number(mergedWd))) {
          mergedWd = 22;
        }
        const dpRaw = Math.floor(Number(pc.decimalPlaces));
        const decimalPlaces =
          Number.isFinite(dpRaw) && dpRaw >= 0 && dpRaw <= 8 ? dpRaw : 2;
        policy.payrollConfig = {
          decimalPlaces,
          workingDaysPerMonth: mergedWd,
          hoursPerDay: safeNum(pc.hoursPerDay, 8, 1),
          overtimeMultiplier: safeNum(pc.overtimeMultiplier, 1.5),
          personalExemptionAnnual: safeNum(pc.personalExemptionAnnual, 20000),
          martyrsFundRate: safeNum(pc.martyrsFundRate, 0.0005),
          insuranceRates: {
            employeeShare: safeNum(pc.insuranceRates?.employeeShare, 0.11),
            companyShare: safeNum(pc.insuranceRates?.companyShare, 0.1875),
            maxInsurableWage: safeNum(pc.insuranceRates?.maxInsurableWage, 16700),
            minInsurableWage: safeNum(pc.insuranceRates?.minInsurableWage, 2700),
          },
          taxBrackets: Array.isArray(pc.taxBrackets)
            ? pc.taxBrackets
                .filter((b) => Number.isFinite(b.from) && Number.isFinite(b.rate))
                .map((b) => ({ from: b.from, to: b.to ?? null, rate: b.rate }))
            : undefined,
        };
      }
      if (assessmentPayrollRules !== undefined && typeof assessmentPayrollRules === "object") {
        policy.assessmentPayrollRules = {
          bonusDaysEnabled: assessmentPayrollRules.bonusDaysEnabled ?? true,
          bonusDayMultiplier: Math.max(0, Number(assessmentPayrollRules.bonusDayMultiplier) || 1),
          overtimeEnabled: assessmentPayrollRules.overtimeEnabled ?? false,
          overtimeDayMultiplier: Math.max(0, Number(assessmentPayrollRules.overtimeDayMultiplier) || 1.5),
          deductionEnabled: assessmentPayrollRules.deductionEnabled ?? false,
          deductionDayMultiplier: Math.max(0, Number(assessmentPayrollRules.deductionDayMultiplier) || 1),
        };
      }
      finalizePolicyWorkingDays(policy, {
        attendanceWd: requestAttendanceWorkingDays,
        payrollWd: requestPayrollWorkingDays,
      });
      if (!policy.chiefExecutiveEmployeeId) {
        return res.status(400).json({
          error: "Chief Executive must be selected and active",
        });
      }
      await policy.save();
      await syncManagersToChiefExecutive(policy.chiefExecutiveEmployeeId);
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
      const ceoId = await resolveValidChiefExecutiveId(chiefExecutiveEmployeeId);
      if (!ceoId) {
        return res.status(400).json({
          error: "Chief Executive must be selected and active",
        });
      }
      policy = new OrganizationPolicy({
        name: "default",
        documentRequirements: documentRequirements || [],
        workLocations: sanitizeWorkLocationsForSave(workLocations || []),
        salaryIncreaseRules: salaryIncreaseRules || [],
        companyTimezone: companyTimezone || "Africa/Cairo",
        leavePolicies: leavePolicies || [],
        attendanceRules: sanitizeAttendanceRules(attendanceRules) || undefined,
        companyMonthStartDay: monthStart,
        chiefExecutiveTitle: ceoTitle,
        chiefExecutiveEmployeeId: ceoId,
        partners: sanitizePartnersForSave(partners),
      });
      await policy.save();
      await syncManagersToChiefExecutive(policy.chiefExecutiveEmployeeId);
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
    if (error.statusCode === 400) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: "Failed to update policy" });
  }
});

router.get(
  "/partners",
  requireAuth,
  enforcePolicy("read", "organization_policy"),
  async (req, res) => {
    try {
      const policy = await OrganizationPolicy.findOne({ name: "default" })
        .select("partners")
        .populate("partners.employeeId", "fullName email employeeCode")
        .lean();
      return res.json({ partners: policy?.partners || [] });
    } catch (error) {
      console.error("Error fetching partners:", error);
      return res.status(500).json({ error: "Failed to fetch partners" });
    }
  },
);

router.post(
  "/partners",
  requireAuth,
  requireCeoOrAdmin,
  strictLimiter,
  async (req, res) => {
    try {
      const next = sanitizePartnersForSave([req.body]);
      if (next.length === 0) {
        return res.status(400).json({ error: "Partner name is required" });
      }
      const policy = await OrganizationPolicy.findOne({ name: "default" });
      if (!policy) return res.status(404).json({ error: "Organization policy not found" });
      policy.partners.push(next[0]);
      await policy.save();
      await policy.populate("partners.employeeId", "fullName email employeeCode");
      return res.status(201).json({ partners: policy?.partners || [] });
    } catch (error) {
      console.error("Error creating partner:", error);
      return res.status(500).json({ error: "Failed to create partner" });
    }
  },
);

router.put(
  "/partners/:partnerId",
  requireAuth,
  requireCeoOrAdmin,
  strictLimiter,
  async (req, res) => {
    try {
      const next = sanitizePartnersForSave([req.body]);
      if (next.length === 0) {
        return res.status(400).json({ error: "Partner name is required" });
      }
      const policy = await OrganizationPolicy.findOne({ name: "default" });
      if (!policy) return res.status(404).json({ error: "Organization policy not found" });
      const partner = policy.partners.id(req.params.partnerId);
      if (!partner) return res.status(404).json({ error: "Partner not found" });
      Object.assign(partner, next[0]);
      await policy.save();
      await policy.populate("partners.employeeId", "fullName email employeeCode");
      return res.json({ partners: policy.partners });
    } catch (error) {
      console.error("Error updating partner:", error);
      return res.status(500).json({ error: "Failed to update partner" });
    }
  },
);

router.delete(
  "/partners/:partnerId",
  requireAuth,
  requireCeoOrAdmin,
  strictLimiter,
  async (req, res) => {
    try {
      const policy = await OrganizationPolicy.findOne({ name: "default" });
      if (!policy) return res.status(404).json({ error: "Organization policy not found" });
      const partner = policy.partners.id(req.params.partnerId);
      if (!partner) return res.status(404).json({ error: "Partner not found" });
      partner.deleteOne();
      await policy.save();
      await policy.populate("partners.employeeId", "fullName email employeeCode");
      return res.json({ partners: policy.partners });
    } catch (error) {
      console.error("Error deleting partner:", error);
      return res.status(500).json({ error: "Failed to delete partner" });
    }
  },
);

export default router;
