/**
 * @file `/api/leave-requests` — create, list, approve/reject, cancel (thin → leaveRequestService).
 */
import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { ApiError } from "../utils/ApiError.js";
import { AuditLog } from "../models/AuditLog.js";
import {
  createLeaveRequest,
  listLeaveRequests,
  applyLeaveRequestAction,
  recordLeaveRequestDirect,
  cancelLeaveRequest,
  getLeaveRequestById,
  assertCanViewEmployeeLeaveBalance,
  getLeaveBalanceSnapshot,
  addAnnualLeaveCredit,
  addAnnualLeaveCreditBulk,
} from "../services/leaveRequestService.js";

const router = Router();

function errStatus(e) {
  return e.statusCode || e.status || 500;
}

function errBody(e, fallback) {
  const code = errStatus(e);
  const isOperational = e instanceof ApiError;
  return {
    error: isOperational || code < 500 ? (e.message || fallback) : fallback,
  };
}

function attachRequestMeta(user, req) {
  user._ip = req.ip;
  user._ua = req.headers["user-agent"] || "";
}

router.post("/", requireAuth, async (req, res) => {
  try {
    attachRequestMeta(req.user, req);
    const doc = await createLeaveRequest(req.user, req.body);
    return res.status(201).json(doc);
  } catch (e) {
    return res.status(errStatus(e)).json(errBody(e, "Failed to create request"));
  }
});

router.get("/", requireAuth, async (req, res) => {
  try {
    const result = await listLeaveRequests(req.user, req.query);
    return res.json(result);
  } catch (e) {
    return res.status(errStatus(e)).json(errBody(e, "Failed to list requests"));
  }
});

router.get("/balance", requireAuth, async (req, res) => {
  try {
    const employeeId = req.query.employeeId || req.user.id;
    await assertCanViewEmployeeLeaveBalance(req.user, employeeId);
    const balance = await getLeaveBalanceSnapshot(employeeId);
    return res.json(balance);
  } catch (e) {
    return res.status(errStatus(e)).json(errBody(e, "Failed to load balance"));
  }
});

router.post("/balance-credit", requireAuth, async (req, res) => {
  try {
    attachRequestMeta(req.user, req);
    const { employeeId, days, reason } = req.body || {};
    const snapshot = await addAnnualLeaveCredit(req.user, {
      employeeId,
      days,
      reason,
    });
    return res.status(201).json(snapshot);
  } catch (e) {
    return res.status(errStatus(e)).json(errBody(e, "Failed to add credit"));
  }
});

router.post("/balance-credit/bulk", requireAuth, async (req, res) => {
  try {
    attachRequestMeta(req.user, req);
    const body = req.body || {};
    const result = await addAnnualLeaveCreditBulk(req.user, body);
    return res.status(201).json(result);
  } catch (e) {
    return res.status(errStatus(e)).json(errBody(e, "Failed to add bulk credit"));
  }
});

router.get("/:id", requireAuth, async (req, res) => {
  try {
    const doc = await getLeaveRequestById(req.params.id, req.user);
    return res.json(doc);
  } catch (e) {
    return res.status(errStatus(e)).json(errBody(e, "Failed to load request"));
  }
});

router.get("/:id/history", requireAuth, async (req, res) => {
  try {
    const doc = await getLeaveRequestById(req.params.id, req.user);
    const logs = await AuditLog.find({
      entityType: "LeaveRequest",
      entityId: doc._id,
    }).sort({ performedAt: -1 });
    return res.json(logs);
  } catch (e) {
    return res.status(errStatus(e)).json(errBody(e, "Failed to load history"));
  }
});

router.post("/:id/action", requireAuth, async (req, res) => {
  try {
    attachRequestMeta(req.user, req);
    const { action, comment, excessDeductionMethod, excessDeductionAmount } = req.body || {};
    const doc = await applyLeaveRequestAction(
      req.params.id,
      req.user,
      action,
      comment,
      { excessDeductionMethod, excessDeductionAmount },
    );
    return res.json(doc);
  } catch (e) {
    return res.status(errStatus(e)).json(errBody(e, "Action failed"));
  }
});

router.post("/:id/record-direct", requireAuth, async (req, res) => {
  try {
    attachRequestMeta(req.user, req);
    const { comment, excessDeductionMethod, excessDeductionAmount } = req.body || {};
    const doc = await recordLeaveRequestDirect(
      req.params.id, req.user, comment,
      { excessDeductionMethod, excessDeductionAmount },
    );
    return res.json(doc);
  } catch (e) {
    return res.status(errStatus(e)).json(errBody(e, "Direct record failed"));
  }
});

router.post("/:id/cancel", requireAuth, async (req, res) => {
  try {
    attachRequestMeta(req.user, req);
    const { reason } = req.body || {};
    const doc = await cancelLeaveRequest(req.params.id, req.user, reason);
    return res.json(doc);
  } catch (e) {
    return res.status(errStatus(e)).json(errBody(e, "Cancel failed"));
  }
});

export default router;
