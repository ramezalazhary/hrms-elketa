import { can } from "../services/authorizationPolicyService.js";
import { createAuditLog } from "../services/auditService.js";

/**
 * Single authorization gate for protected endpoints.
 */
export function enforcePolicy(action, resource, contextResolver) {
  return async (req, res, next) => {
    const context =
      typeof contextResolver === "function" ? await contextResolver(req) : {};
    const decision = await can(req.user, action, resource, context || {});
    req.authzDecision = decision;

    const actorEntityId = /^[a-f\d]{24}$/i.test(String(req.user?.id || ""))
      ? String(req.user.id)
      : "000000000000000000000000";
    await createAuditLog({
      entityType: "Authorization",
      entityId: actorEntityId,
      operation: "DECISION",
      newValues: {
        userId: req.user?.id || null,
        role: req.user?.role || null,
        action,
        resource,
        targetId: context?.targetId || context?.targetUserId || null,
        allow: decision.allow,
        decision: decision.allow ? "allow" : "deny",
        reason: decision.reason,
        scope: decision.scope,
        timestamp: new Date().toISOString(),
        context,
      },
      performedBy: req.user?.email || "unknown",
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    });

    if (!decision.allow) {
      return res.status(403).json({
        error: "Forbidden",
        reason: decision.reason,
      });
    }
    return next();
  };
}
