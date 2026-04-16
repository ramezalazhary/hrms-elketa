import { isChiefExecutiveUser } from "../services/chiefExecutiveService.js";

export async function requireCeoOrAdmin(req, res, next) {
  try {
    const role = String(req.user?.role || "").toUpperCase();
    if (role === "ADMIN") return next();

    const isCeo = await isChiefExecutiveUser(req.user?.id);
    if (isCeo) return next();

    return res.status(403).json({
      error: "Forbidden: Only Chief Executive or Admin can manage partners",
    });
  } catch (error) {
    return next(error);
  }
}
