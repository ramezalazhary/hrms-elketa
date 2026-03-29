#!/usr/bin/env node
/**
 * Full-stack API smoke + integration checks: reachability, negative auth cases,
 * refresh token, authenticated list/detail routes, and reports JSON shape.
 *
 * Requires: MongoDB + `npm run dev` (or start) on PORT (default 5000).
 *
 *   node scripts/full-api-smoke.mjs
 *
 * Tries seed credentials in order: seedUsers (superadmin), then permission-smoke accounts.
 */
const PORT = process.env.PORT || 5000;
const BASE = process.env.API_URL || `http://localhost:${PORT}/api`;

const LOGIN_CANDIDATES = [
  { email: "superadmin@elketa.com", password: "emp123", label: "seedUsers admin" },
  { email: "admin@hr.local", password: "admin123", label: "permission-smoke admin" },
  { email: "hala_hr@elketa.com", password: "emp123", label: "seedUsers HR" },
];

async function tryLogin(email, password) {
  const r = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) return { ok: false, status: r.status, error: data.error || r.status };
  return { ok: true, token: data.accessToken, refresh: data.refreshToken, user: data.user };
}

async function authGet(token, path) {
  const r = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await r.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  const n = Array.isArray(json) ? json.length : null;
  return { status: r.status, json, arrayLength: n };
}

function assertReportsSummaryShape(data, label) {
  if (!data || typeof data !== "object") throw new Error(`${label}: not an object`);
  const { summary, warnings } = data;
  if (!summary || typeof summary !== "object") throw new Error(`${label}: missing summary`);
  for (const key of ["departments", "teams", "positions", "employees"]) {
    if (!summary[key] || typeof summary[key] !== "object") {
      throw new Error(`${label}: summary.${key} missing`);
    }
  }
  if (!Array.isArray(warnings)) throw new Error(`${label}: warnings must be array`);
}

function assertOrgReportShape(data, label) {
  if (!data || typeof data !== "object") throw new Error(`${label}: not an object`);
  if (!Array.isArray(data.organizationChart)) {
    throw new Error(`${label}: organizationChart must be array`);
  }
  if (typeof data.totalDepartments !== "number") {
    throw new Error(`${label}: totalDepartments must be number`);
  }
}

function assertEmploymentShape(data, label) {
  if (!data || typeof data !== "object") throw new Error(`${label}: not an object`);
  if (data.assignments && !Array.isArray(data.assignments)) {
    throw new Error(`${label}: assignments must be array`);
  }
}

async function main() {
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  HRMS API smoke + integration checks");
  console.log("═══════════════════════════════════════════════════════════\n");
  console.log("  Base URL:", BASE);

  const opt = await fetch(`${BASE}/auth/login`, { method: "OPTIONS" });
  console.log("  OPTIONS /auth/login:", opt.status, opt.ok ? "OK" : "FAIL");
  if (!opt.ok && opt.status !== 204) {
    console.error("\n  Backend not reachable. Start: cd backend && npm run dev\n");
    process.exit(1);
  }

  let failed = 0;
  const fail = (msg) => {
    console.log(`  ✖ ${msg}`);
    failed++;
  };
  const pass = (msg) => console.log(`  ✓ ${msg}`);

  // Negative: wrong password (use first candidate email if exists)
  {
    const guest = LOGIN_CANDIDATES[0];
    const bad = await tryLogin(guest.email, "definitely-wrong-password-xyz");
    if (bad.ok) fail(`Login with wrong password should fail (got success)`);
    else if (bad.status !== 401) fail(`Login wrong password: want 401, got ${bad.status}`);
    else pass(`POST /auth/login invalid password → 401`);
  }

  // Negative: bogus Bearer
  {
    const r = await authGet("not.a.valid.jwt", "/employees");
    if (r.status !== 401) fail(`GET /employees bogus token: want 401, got ${r.status}`);
    else pass(`GET /employees invalid JWT → 401`);
  }

  let token = null;
  let refresh = null;
  let usedLabel = null;
  for (const c of LOGIN_CANDIDATES) {
    const L = await tryLogin(c.email, c.password);
    if (L.ok && L.token) {
      token = L.token;
      refresh = L.refresh;
      usedLabel = `${c.label} (${c.email})`;
      break;
    }
  }

  if (!token) {
    console.error("\n  ✖ No login succeeded. Seed the DB, then retry:");
    console.error("     cd backend && npm run seed\n");
    process.exit(1);
  }

  pass(`Login: ${usedLabel}`);

  // Refresh flow
  if (refresh) {
    const rr = await fetch(`${BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: refresh }),
    });
    const body = await rr.json().catch(() => ({}));
    if (!rr.ok || !body.accessToken) {
      fail(`POST /auth/refresh: want 200 + accessToken, got ${rr.ok ? "missing token" : rr.status}`);
    } else {
      pass(`POST /auth/refresh → new accessToken`);
      token = body.accessToken;
    }
  } else {
    fail(`Login response missing refreshToken (refresh test skipped)`);
  }

  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - 3);
  const q = `startDate=${start.toISOString().slice(0, 10)}&endDate=${end.toISOString().slice(0, 10)}`;

  const routes = [
    ["/employees", "GET /employees"],
    ["/departments", "GET /departments"],
    ["/teams", "GET /teams"],
    ["/positions", "GET /positions"],
    [`/attendance?${q}`, "GET /attendance (date range)"],
    ["/users", "GET /users"],
    ["/policy/documents", "GET /policy/documents"],
    ["/management-requests", "GET /management-requests"],
  ];

  let employeesPayload = null;
  for (const [path, name] of routes) {
    const g = await authGet(token, path);
    const extra = g.arrayLength != null ? ` → ${g.arrayLength} rows` : "";
    if (g.status === 200) {
      pass(`${name}: 200${extra}`);
      if (path === "/employees" && Array.isArray(g.json)) employeesPayload = g.json;
    } else {
      // /users may be 403 for non-admin — don't count as hard failure for smoke
      if (path === "/users" && g.status === 403) {
        console.log(`  ⊘ ${name}: 403 (role — expected for some accounts)`);
      } else {
        fail(`${name}: ${g.status}${extra}`);
      }
    }
  }

  // Employee detail + employments (first list id)
  const firstEmp = Array.isArray(employeesPayload) ? employeesPayload[0] : null;
  const empId =
    firstEmp && (firstEmp._id != null ? String(firstEmp._id) : firstEmp.id != null ? String(firstEmp.id) : null);
  if (empId) {
    const detail = await authGet(token, `/employees/${empId}`);
    if (detail.status !== 200) fail(`GET /employees/:id → ${detail.status}`);
    else pass(`GET /employees/:id (${empId.slice(0, 8)}…)`);

    const empl = await authGet(token, `/employments/employee/${empId}`);
    if (empl.status !== 200) {
      fail(`GET /employments/employee/:id → ${empl.status}`);
    } else {
      try {
        assertEmploymentShape(empl.json, "employments");
        pass(`GET /employments/employee/:id (shape OK)`);
      } catch (e) {
        fail(`employments shape: ${e.message}`);
      }
    }
  } else {
    console.log("  ⊘ Skipping employee detail / employments (no employees in list)");
  }

  // Reports (Admin / HR_STAFF only)
  {
    const rep = await authGet(token, "/reports/summary");
    if (rep.status === 200) {
      try {
        assertReportsSummaryShape(rep.json, "reports/summary");
        pass(`GET /reports/summary (JSON shape OK)`);
      } catch (e) {
        fail(`reports/summary shape: ${e.message}`);
      }
    } else if (rep.status === 403) {
      console.log("  ⊘ GET /reports/summary: 403 (role — OK for non-report roles)");
    } else {
      fail(`GET /reports/summary → ${rep.status}`);
    }
  }

  {
    const org = await authGet(token, "/reports/organizations");
    if (org.status === 200) {
      try {
        assertOrgReportShape(org.json, "reports/organizations");
        pass(`GET /reports/organizations (JSON shape OK)`);
      } catch (e) {
        fail(`reports/organizations shape: ${e.message}`);
      }
    } else if (org.status === 403) {
      console.log("  ⊘ GET /reports/organizations: 403 (role — OK for non-report roles)");
    } else {
      fail(`GET /reports/organizations → ${org.status}`);
    }
  }

  console.log("\n  Frontend dev should use: VITE_API_URL=" + BASE);
  console.log("  Vite proxy: /api → http://localhost:" + PORT);
  console.log("\n═══════════════════════════════════════════════════════════\n");

  process.exit(failed > 0 ? 2 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
