import { Router } from "express";
import { ManagementRequest } from "../models/ManagementRequest.js";
import { Department } from "../models/Department.js";
import { requireAuth } from "../middleware/auth.js";
import { isAdminRole } from "../utils/roles.js";

const router = Router();

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
    const isHR = user.role === "HR_STAFF" || user.role === "HR_MANAGER" || isAdmin;

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

    // Permissions: Only Admin, HR, or Department Head can approve.
    const isAdmin = isAdminRole(user.role);
    const isHR = user.role === "HR_STAFF" || user.role === "HR_MANAGER" || isAdmin;

    const request = await ManagementRequest.findById(id);
    if (!request) return res.status(404).json({ error: "Request not found" });

    let canAuthorize = isHR;
    if (!canAuthorize) {
      const managedDept = await Department.findOne({
        _id: request.departmentId,
        head: user.email,
      });
      if (managedDept) canAuthorize = true;
    }

    if (!canAuthorize)
      return res
        .status(403)
        .json({ error: "Unauthorized to process this request" });

    const isDual = request.type === "HR_MODULES";

    if (isDual) {
      if (isAdmin || user.role === "HR_STAFF" || user.role === "HR_MANAGER") {
        request.hrApproval.status = status;
        request.hrApproval.processedBy = user.email;
        request.hrApproval.processedAt = new Date();
      } else {
        // Must be department head
        request.managerApproval.status = status;
        request.managerApproval.processedBy = user.email;
        request.managerApproval.processedAt = new Date();
      }

      // Re-evaluate overall status
      if (request.managerApproval.status === "REJECTED" || request.hrApproval.status === "REJECTED") {
        request.status = "REJECTED";
      } else if (request.managerApproval.status === "APPROVED" && request.hrApproval.status === "APPROVED") {
        request.status = "APPROVED";
      } else {
        request.status = "PENDING";
      }
    } else {
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
