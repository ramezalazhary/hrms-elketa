/**
 * @file `/api/leave-requests` — create, list, approve/reject, cancel (thin → leaveRequestService).
 */
import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { enforcePolicy } from "../middleware/enforcePolicy.js";
import { normalizeRole, ROLE } from "../utils/roles.js";
import { ApiError } from "../utils/ApiError.js";
import { AuditLog } from "../models/AuditLog.js";
import { LeaveRequest } from "../models/LeaveRequest.js";
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

function asBool(v) {
  if (v == null) return false;
  const s = String(v).trim().toLowerCase();
  return s === "1" || s === "true";
}

function requireLeaveListAccess(req, res, next) {
  // Queue is actionable approvals; managed/mine/general listings are read workflows.
  const needsApprove = asBool(req.query?.queue);
  const gate = needsApprove
    ? enforcePolicy("approve", "leaves")
    : enforcePolicy("read", "leaves", (r) => ({
        selfOnly: asBool(r.query?.mine),
      }));
  return gate(req, res, next);
}

async function leaveReadContextByRequestId(req) {
  const id = String(req.params?.id || "").trim();
  if (!id) return { selfOnly: false };
  const row = await LeaveRequest.findById(id).select("employeeId").lean();
  if (!row?.employeeId) return { selfOnly: false };
  return {
    selfOnly: String(row.employeeId) === String(req.user?.id),
  };
}

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

function requireHrCreditRole(req, res, next) {
  const role = normalizeRole(req.user?.role);
  if (role === ROLE.ADMIN || role === ROLE.HR_STAFF || role === ROLE.HR_MANAGER) {
    return next();
  }
  return res.status(403).json({
    error: "Forbidden: Only HR_STAFF, HR_MANAGER, or ADMIN can manage leave credits",
  });
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

router.get("/", requireAuth, requireLeaveListAccess, async (req, res) => {
  try {
    const result = await listLeaveRequests(req.user, req.query);
    return res.json(result);
  } catch (e) {
    return res.status(errStatus(e)).json(errBody(e, "Failed to list requests"));
  }
});

router.get(
  "/balance",
  requireAuth,
  async (req, res) => {
  try {
    const employeeId = req.query.employeeId || req.user.id;
    await assertCanViewEmployeeLeaveBalance(req.user, employeeId);
    const balance = await getLeaveBalanceSnapshot(employeeId);
    return res.json(balance);
  } catch (e) {
    return res.status(errStatus(e)).json(errBody(e, "Failed to load balance"));
  }
},
);

router.get(
  "/mine",
  requireAuth,
  async (req, res) => {
  try {
    const lastMonthCutoff = new Date();
    lastMonthCutoff.setDate(lastMonthCutoff.getDate() - 30);
    const result = await listLeaveRequests(req.user, {
      ...req.query,
      mine: "true",
    });
    const requests = Array.isArray(result?.requests)
      ? result.requests.filter((row) => {
        if (!row?.submittedAt) return false;
        return new Date(row.submittedAt) >= lastMonthCutoff;
      })
      : [];
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);
    const total = requests.length;
    return res.json({
      requests,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / Math.max(1, limit)) || 1,
      },
    });
  } catch (e) {
    return res.status(errStatus(e)).json(errBody(e, "Failed to list your requests"));
  }
},
);

router.post(
  "/balance-credit",
  requireAuth,
  requireHrCreditRole,
  enforcePolicy("approve", "leaves"),
  async (req, res) => {
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
},
);

router.post(
  "/balance-credit/bulk",
  requireAuth,
  requireHrCreditRole,
  enforcePolicy("approve", "leaves"),
  async (req, res) => {
  try {
    attachRequestMeta(req.user, req);
    const body = req.body || {};
    const result = await addAnnualLeaveCreditBulk(req.user, body);
    return res.status(201).json(result);
  } catch (e) {
    return res.status(errStatus(e)).json(errBody(e, "Failed to add bulk credit"));
  }
},
);

router.get(
  "/:id",
  requireAuth,
  enforcePolicy("read", "leaves", leaveReadContextByRequestId),
  async (req, res) => {
  try {
    const doc = await getLeaveRequestById(req.params.id, req.user);
    return res.json(doc);
  } catch (e) {
    return res.status(errStatus(e)).json(errBody(e, "Failed to load request"));
  }
},
);

router.get(
  "/:id/history",
  requireAuth,
  enforcePolicy("read", "leaves", leaveReadContextByRequestId),
  async (req, res) => {
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
},
);

router.post("/:id/action", requireAuth, enforcePolicy("approve", "leaves"), async (req, res) => {
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

router.post("/:id/record-direct", requireAuth, enforcePolicy("approve", "leaves"), async (req, res) => {
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

router.post(
  "/:id/cancel",
  requireAuth,
  enforcePolicy("read", "leaves", leaveReadContextByRequestId),
  async (req, res) => {
  try {
    attachRequestMeta(req.user, req);
    const { reason } = req.body || {};
    const doc = await cancelLeaveRequest(req.params.id, req.user, reason);
    return res.json(doc);
  } catch (e) {
    return res.status(errStatus(e)).json(errBody(e, "Cancel failed"));
  }
},
);

export default router;
