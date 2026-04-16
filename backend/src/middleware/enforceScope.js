import { inScopeWithLeadership } from "../services/scopeService.js";

/**
 * Scope gate: validates requester scope against a resolved target employee.
 */
export function enforceScope(targetResolver) {
  return async (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const target =
      typeof targetResolver === "function" ? await targetResolver(req) : null;
    if (!target) return next();
    const allowed = await inScopeWithLeadership(req.user, target);
    if (!allowed) {
      return res.status(403).json({ error: "Forbidden: target is out of scope" });
    }
    req.scopeTarget = target;
    return next();
  };
}
