import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PAGE_POLICY_CATALOG } from "../src/services/authorizationPolicyService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

const routeFiles = [
  "frontend/src/app/router/routes.jsx",
  "frontend/src/modules/employees/routes.jsx",
  "frontend/src/modules/attendance/routes.jsx",
  "frontend/src/modules/payroll/routes.jsx",
  "frontend/src/modules/departments/routes.jsx",
  "frontend/src/modules/teams/routes.jsx",
  "frontend/src/modules/positions/routes.jsx",
  "frontend/src/modules/employments/routes.jsx",
  "frontend/src/modules/contracts/routes.jsx",
];

const sensitivePrefixes = [
  "/dashboard",
  "/attendance",
  "/payroll",
  "/reports",
  "/organizations",
  "/departments",
  "/teams",
  "/positions",
  "/advances",
  "/admin/users",
  "/admin/password-requests",
  "/admin/organization-rules",
  "/admin/holidays",
  "/leave-operations",
  "/employees",
  "/employees/time-off/approvals",
  "/employees/bonus-approvals",
  "/employees/onboarding",
];

function normalizeCatalogPath(raw) {
  return String(raw || "").replace(/\s*\(.+\)\s*$/, "").trim();
}

function hasCatalogCoverage(routePath, catalogPaths) {
  const normalized = String(routePath || "").trim();
  for (const base of catalogPaths) {
    if (!base) continue;
    if (normalized === base) return true;
    if (normalized.startsWith(`${base}/`)) return true;
  }
  return false;
}

async function readPathsFromRouteFile(absPath) {
  const text = await fs.readFile(absPath, "utf8");
  const regex = /path:\s*["'`]([^"'`]+)["'`]/g;
  const paths = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    paths.push(match[1]);
  }
  return paths.filter((p) => p.startsWith("/"));
}

async function main() {
  const catalogPaths = PAGE_POLICY_CATALOG.map((p) => normalizeCatalogPath(p.path)).filter(Boolean);
  const allRoutePaths = [];
  for (const rel of routeFiles) {
    const abs = path.join(repoRoot, rel);
    const paths = await readPathsFromRouteFile(abs);
    allRoutePaths.push(...paths);
  }

  const candidates = allRoutePaths.filter((p) =>
    sensitivePrefixes.some((prefix) => p === prefix || p.startsWith(`${prefix}/`)),
  );

  const missing = candidates.filter((routePath) => !hasCatalogCoverage(routePath, catalogPaths));
  if (missing.length > 0) {
    console.error("Page policy mapping validation failed.");
    console.error("Missing catalog coverage for routes:");
    for (const item of missing) console.error(`- ${item}`);
    process.exit(1);
  }

  console.log("Page policy mapping validation passed.");
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});

