import { Router } from "express";
import { ManagementRequest } from "../models/ManagementRequest.js";
import { Department } from "../models/Department.js";
import { requireAuth } from "../middleware/auth.js";
import { isAdminRole, normalizeRole } from "../utils/roles.js";

const router = Router();

function normEmail(e) {
  return String(e || "").trim().toLowerCase();
}

/** @route POST /api/management-requests - Create a new request. */
router.post("/", requireAuth, async (req, res) => {
  try {
    const { type, message, departmentId, departmentName } = req.body;
    const user = req.user;

    const newRequest = await ManagementRequest.create({
      senderEmail: user.email,
      senderName: user.fullName || user.email.split("@")[0],
      senderRole: user.role,
      departmentId,
      departmentName,
      type,
      message,
      status: "PENDING",
      managerApproval: type === "HR_MODULES" ? { status: "PENDING" } : undefined,
      hrApproval: type === "HR_MODULES" ? { status: "PENDING" } : undefined,
    });

    res.status(201).json(newRequest);
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({ error: Object.values(error.errors).map(e => e.message).join(', ') });
    }
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

/** @route GET /api/management-requests - List requests (filtered). */
router.get("/", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    let query = {};

    const isAdmin = isAdminRole(user.role);
    const r = normalizeRole(user.role);
    const isHR = r === "HR_STAFF" || r === "HR_MANAGER" || isAdmin;

    if (!isHR) {
      const managedDept = await Department.findOne({ head: user.email });
      if (managedDept) {
        query.departmentId = managedDept._id;
      } else {
        // If not a dept head, they can only see their own sent requests.
        query.senderEmail = user.email;
      }
    }

    const requests = await ManagementRequest.find(query).sort({
      createdAt: -1,
    });
    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

/** @route PATCH /api/management-requests/:id - Update status (Approve/Reject). */
router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const { status } = req.body;
    const { id } = req.params;
    const user = req.user;

    const isAdmin = isAdminRole(user.role);
    const r = normalizeRole(user.role);
    const isHRUser = r === "HR_STAFF" || r === "HR_MANAGER" || isAdmin;

    const request = await ManagementRequest.findById(id);
    if (!request) return res.status(404).json({ error: "Request not found" });

    const dept = request.departmentId
      ? await Department.findById(request.departmentId).lean()
      : null;
    const isDeptHead =
      Boolean(dept?.head) && normEmail(dept.head) === normEmail(user.email);

    const canAuthorize = isHRUser || isDeptHead;
    if (!canAuthorize) {
      return res.status(403).json({ error: "Unauthorized to process this request" });
    }

    const isDual = request.type === "HR_MODULES";

    if (isDual) {
      const ma = request.managerApproval;
      const ha = request.hrApproval;
      if (!ma || !ha) {
        return res.status(500).json({ error: "Invalid HR_MODULES request shape" });
      }

      // Sequential: department head (or admin) completes manager leg first; then HR completes HR leg.
      // Same person can be both — second click applies HR after manager is APPROVED.
      if (ma.status === "PENDING") {
        if (!isDeptHead && !isAdmin) {
          return res.status(403).json({
            error:
              "The department head must approve the manager step first. Administrators can also complete this step.",
          });
        }
        ma.status = status;
        ma.processedBy = user.email;
        ma.processedAt = new Date();
      } else if (ma.status === "APPROVED" && ha.status === "PENDING") {
        if (!isHRUser) {
          return res.status(403).json({
            error: "HR confirmation is required to finalize this request after the department head approves.",
          });
        }
        ha.status = status;
        ha.processedBy = user.email;
        ha.processedAt = new Date();
      } else if (ma.status === "REJECTED" || ha.status === "REJECTED") {
        return res.status(400).json({ error: "This request is already rejected" });
      } else {
        return res.status(400).json({ error: "This request is already finalized" });
      }

      if (ma.status === "REJECTED" || ha.status === "REJECTED") {
        request.status = "REJECTED";
      } else if (ma.status === "APPROVED" && ha.status === "APPROVED") {
        request.status = "APPROVED";
      } else {
        request.status = "PENDING";
      }
    } else {
      if (!isHRUser && !isDeptHead) {
        return res.status(403).json({ error: "Unauthorized to process this request" });
      }
      request.status = status;
    }

    request.processedBy = user.email;
    request.processedAt = new Date();
    await request.save();

    res.json(request);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
