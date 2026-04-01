import { Router } from "express";
import crypto from "crypto";
import { OnboardingRequest } from "../models/OnboardingRequest.js";
import { OnboardingSubmission } from "../models/OnboardingSubmission.js";
import { requireAuth } from "../middleware/auth.js";
import { createEmployee } from "../services/employeeService.js";

const router = Router();

/**
 * @route POST /api/onboarding/generate
 * @desc Admin only: Generate a temporary onboarding link
 */
router.post("/generate", requireAuth, async (req, res) => {
  try {
    const { expiresHours = 48, department, position, team, employeeCode, baseSalary } = req.body;
    const user = req.user;

    const isAdmin = user.role === "ADMIN" || user.role === "HR_MANAGER" || user.role === "HR_STAFF" || user.role === 3;
    if (!isAdmin) return res.status(403).json({ error: "Unauthorized" });

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + Number(expiresHours));

    const newLink = await OnboardingRequest.create({
      token,
      expiresAt,
      metadata: { department, position, team, employeeCode, baseSalary },
      createdBy: user.email,
    });

    res.status(201).json({
      message: "Onboarding link generated",
      url: `${process.env.FRONTEND_URL || "http://localhost:5173"}/welcome/${token}`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route GET /api/onboarding/verify/:token
 * @desc Public: Verify link validity
 */
router.get("/verify/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const link = await OnboardingRequest.findOne({ token, isActive: true });

    if (!link) return res.status(404).json({ error: "Invalid link" });
    if (new Date() > link.expiresAt) return res.status(410).json({ error: "Link expired" });

    res.json({ valid: true, prefilledData: link.metadata });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route POST /api/onboarding/submit/:token
 * @desc Public: Submit onboarding data
 */
router.post("/submit/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const link = await OnboardingRequest.findOne({ token, isActive: true });

    if (!link) return res.status(404).json({ error: "Invalid link" });
    if (new Date() > link.expiresAt) return res.status(410).json({ error: "Link expired" });

    const submission = await OnboardingSubmission.create({
      linkId: link._id,
      personalData: req.body,
    });

    // Increment usage metric (Support multiple submissions)
    link.usageCount += 1;
    await link.save();

    res.json({ message: "Information submitted successfully. Wait for approval." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route GET /api/onboarding/links
 * @desc Admin only: List all links with usage metrics
 */
router.get("/links", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const isAdmin = user.role === "ADMIN" || user.role === "HR_MANAGER" || user.role === "HR_STAFF" || user.role === 3;
    if (!isAdmin) return res.status(403).json({ error: "Unauthorized" });

    const links = await OnboardingRequest.find().sort({ createdAt: -1 });
    res.json(links);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route PATCH /api/onboarding/links/:id/stop
 * @desc Admin only: Stop (deactivate) a link
 */
router.patch("/links/:id/stop", requireAuth, async (req, res) => {
  try {
    const isAdmin = req.user.role === "ADMIN" || req.user.role === "HR_MANAGER" || req.user.role === "HR_STAFF" || req.user.role === 3;
    if (!isAdmin) return res.status(403).json({ error: "Unauthorized" });

    const link = await OnboardingRequest.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!link) return res.status(404).json({ error: "Link not found" });

    res.json({ message: "Link deactivated successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route GET /api/onboarding/submissions
 * @desc Admin only: List all submissions
 */
router.get("/submissions", requireAuth, async (req, res) => {
  try {
    const isAdmin = req.user.role === "ADMIN" || req.user.role === "HR_MANAGER" || req.user.role === "HR_STAFF" || req.user.role === 3;
    if (!isAdmin) return res.status(403).json({ error: "Unauthorized" });

    const submissions = await OnboardingSubmission.find()
      .populate("linkId", "token")
      .sort({ createdAt: -1 });
    res.json(submissions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route PATCH /api/onboarding/submissions/:id
 * @desc Admin only: Approve/Reject a submission
 */
router.patch("/submissions/:id", requireAuth, async (req, res) => {
  try {
    const { status, adminNotes, editedData } = req.body;
    const user = req.user;
    const isAdmin = user.role === "ADMIN" || user.role === "HR_MANAGER" || user.role === "HR_STAFF" || user.role === 3;
    if (!isAdmin) return res.status(403).json({ error: "Unauthorized" });

    const sub = await OnboardingSubmission.findById(req.params.id);
    if (!sub) return res.status(404).json({ error: "Submission not found" });

    if (status === "APPROVED") {
      const finalData = editedData || sub.personalData;
      
      // Ensure required fields for employee creation
      if (!finalData.fullNameEng && !finalData.fullNameAr && !finalData.fullName) {
         return res.status(400).json({ error: "Full Name is required for approval" });
      }
      if (!finalData.department) {
         return res.status(400).json({ error: "Department is required for approval" });
      }

      try {
        await createEmployee({
          ...finalData,
          fullName: finalData.fullName || finalData.fullNameEng || finalData.fullNameAr,
          fullNameArabic: finalData.fullNameArabic || finalData.fullNameAr,
          nationality: finalData.nationality,
          idNumber: finalData.idNumber,
          gender: finalData.gender,
          maritalStatus: finalData.maritalStatus,
          emergencyPhone: finalData.emergencyPhoneNumber || finalData.emergencyPhone,
          team: finalData.team,
          employeeCode: finalData.employeeCode,
          financial: { baseSalary: finalData.baseSalary || 0 },
        });
        sub.status = "APPROVED";
      } catch (err) {
        return res.status(400).json({ error: `Creation failed: ${err.message}` });
      }
    } else {
      sub.status = "REJECTED";
    }

    sub.adminNotes = adminNotes;
    sub.processedBy = user.email;
    sub.processedAt = new Date();
    await sub.save();

    res.json({ message: `Submission ${status.toLowerCase()} successfully` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route DELETE /api/onboarding/links/:id
 */
router.delete("/links/:id", requireAuth, async (req, res) => {
  try {
    const isAdmin = req.user.role === "ADMIN" || req.user.role === "HR_MANAGER" || req.user.role === "HR_STAFF" || req.user.role === 3;
    if (!isAdmin) return res.status(403).json({ error: "Unauthorized" });

    await OnboardingRequest.findByIdAndDelete(req.params.id);
    res.json({ message: "Link deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
