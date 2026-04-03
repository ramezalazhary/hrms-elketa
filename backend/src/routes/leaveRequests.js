/**
 * @file `/api/leave-requests` — create, list, approve/reject, cancel (thin → leaveRequestService).
 */
import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  createLeaveRequest,
  listLeaveRequests,
  applyLeaveRequestAction,
  cancelLeaveRequest,
  getLeaveRequestById,
  assertCanViewEmployeeLeaveBalance,
  getLeaveBalanceSnapshot,
  addAnnualLeaveCredit,
  addAnnualLeaveCreditBulk,
} from "../services/leaveRequestService.js";

const router = Router();

router.post("/", requireAuth, async (req, res) => {
  try {
    const doc = await createLeaveRequest(req.user, req.body);
    return res.status(201).json(doc);
  } catch (e) {
    const status = e.status || 500;
    return res.status(status).json({ error: e.message || "Failed to create request" });
  }
});

router.get("/", requireAuth, async (req, res) => {
  try {
    const result = await listLeaveRequests(req.user, req.query);
    return res.json(result);
  } catch (e) {
    const status = e.status || 500;
    return res.status(status).json({ error: e.message || "Failed to list requests" });
  }
});

router.get("/balance", requireAuth, async (req, res) => {
  try {
    const employeeId = req.query.employeeId || req.user.id;
    await assertCanViewEmployeeLeaveBalance(req.user, employeeId);
    const balance = await getLeaveBalanceSnapshot(employeeId);
    return res.json(balance);
  } catch (e) {
    const status = e.status || 500;
    return res.status(status).json({ error: e.message || "Failed to load balance" });
  }
});

router.post("/balance-credit", requireAuth, async (req, res) => {
  try {
    const { employeeId, days, reason } = req.body || {};
    const snapshot = await addAnnualLeaveCredit(req.user, {
      employeeId,
      days,
      reason,
    });
    return res.status(201).json(snapshot);
  } catch (e) {
    const status = e.status || 500;
    return res.status(status).json({ error: e.message || "Failed to add credit" });
  }
});

router.post("/balance-credit/bulk", requireAuth, async (req, res) => {
  try {
    const body = req.body || {};
    const result = await addAnnualLeaveCreditBulk(req.user, body);
    return res.status(201).json(result);
  } catch (e) {
    const status = e.status || 500;
    return res.status(status).json({ error: e.message || "Failed to add bulk credit" });
  }
});

router.get("/:id", requireAuth, async (req, res) => {
  try {
    const doc = await getLeaveRequestById(req.params.id, req.user);
    return res.json(doc);
  } catch (e) {
    const status = e.status || 500;
    return res.status(status).json({ error: e.message || "Failed to load request" });
  }
});

router.post("/:id/action", requireAuth, async (req, res) => {
  try {
    const { action, comment } = req.body || {};
    const doc = await applyLeaveRequestAction(
      req.params.id,
      req.user,
      action,
      comment,
    );
    return res.json(doc);
  } catch (e) {
    const status = e.status || 500;
    return res.status(status).json({ error: e.message || "Action failed" });
  }
});

router.post("/:id/cancel", requireAuth, async (req, res) => {
  try {
    const doc = await cancelLeaveRequest(req.params.id, req.user);
    return res.json(doc);
  } catch (e) {
    const status = e.status || 500;
    return res.status(status).json({ error: e.message || "Cancel failed" });
  }
});

export default router;
