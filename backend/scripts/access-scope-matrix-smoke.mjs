/**
 * Access scope matrix smoke test.
 *
 * Validates key allow/deny boundaries:
 * - Employee self vs other for employees/attendance/leaves
 * - Optional manager/tl scoped checks (when credentials provided)
 *
 * Usage:
 *   node scripts/access-scope-matrix-smoke.mjs
 *
 * Optional env:
 *   API_URL=http://localhost:5001/api
 *   ADMIN_EMAIL=admin@company.com
 *   ADMIN_PASSWORD=Admin@123456
 *   EMPLOYEE_PASSWORD=Employee@123456
 *   EMPLOYEE_PASSWORD_FALLBACK=emp123
 *   MANAGER_EMAIL=manager@company.com
 *   MANAGER_PASSWORD=manager-password
 *   TL_EMAIL=teamleader@company.com
 *   TL_PASSWORD=tl-password
 */

const BASE = process.env.API_URL || "http://localhost:5001/api";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@company.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Admin@123456";
const EMPLOYEE_PASSWORD = process.env.EMPLOYEE_PASSWORD || "Employee@123456";
const EMPLOYEE_PASSWORD_FALLBACK = process.env.EMPLOYEE_PASSWORD_FALLBACK || "emp123";
const MANAGER_EMAIL = process.env.MANAGER_EMAIL || "";
const MANAGER_PASSWORD = process.env.MANAGER_PASSWORD || "";
const TL_EMAIL = process.env.TL_EMAIL || "";
const TL_PASSWORD = process.env.TL_PASSWORD || "";

async function login(email, password) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.accessToken) {
    throw new Error(`login failed for ${email}: ${data?.error || res.status}`);
  }
  return data.accessToken;
}

async function apiGet(token, path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

function assertStatus(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

async function loginEmployee(email) {
  try {
    return await login(email, EMPLOYEE_PASSWORD);
  } catch {
    return await login(email, EMPLOYEE_PASSWORD_FALLBACK);
  }
}

async function main() {
  const adminToken = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
  const employeesRes = await apiGet(adminToken, "/employees?limit=500");
  assertStatus(
    employeesRes.status,
    200,
    "admin employees list",
  );

  const employees = Array.isArray(employeesRes.data?.employees)
    ? employeesRes.data.employees
    : [];
  const plainEmployees = employees.filter(
    (e) => String(e?.role || "").toUpperCase() === "EMPLOYEE" && e?.email,
  );
  if (plainEmployees.length < 2) {
    throw new Error("need at least 2 employee users for matrix smoke");
  }

  const a = plainEmployees[0];
  const b = plainEmployees[1];
  const aId = String(a.id || a._id || "");
  const bId = String(b.id || b._id || "");

  const aToken = await loginEmployee(a.email);

  // Employee self allow checks
  assertStatus((await apiGet(aToken, "/employees/me")).status, 200, "employee /employees/me");
  assertStatus((await apiGet(aToken, "/attendance/me")).status, 200, "employee /attendance/me");
  assertStatus((await apiGet(aToken, "/leave-requests/mine?limit=50")).status, 200, "employee /leave-requests/mine");

  // Employee other deny checks
  assertStatus((await apiGet(aToken, `/employees/${bId}`)).status, 403, "employee other profile deny");
  assertStatus((await apiGet(aToken, `/attendance/employee/${bId}`)).status, 403, "employee other attendance deny");
  assertStatus((await apiGet(aToken, `/leave-requests?employeeId=${bId}`)).status, 403, "employee other leave list deny");

  console.log(`PASS employee self/other boundaries (${a.email} vs ${b.email})`);

  if (MANAGER_EMAIL && MANAGER_PASSWORD) {
    const mgrToken = await login(MANAGER_EMAIL, MANAGER_PASSWORD);
    const mgrEmployees = await apiGet(mgrToken, "/employees?limit=200");
    assertStatus(mgrEmployees.status, 200, "manager employees list");
    const list = Array.isArray(mgrEmployees.data?.employees) ? mgrEmployees.data.employees : [];
    console.log(`PASS manager scoped employee list (${MANAGER_EMAIL}) -> ${list.length} rows`);
  } else {
    console.log("INFO manager checks skipped (set MANAGER_EMAIL/MANAGER_PASSWORD)");
  }

  if (TL_EMAIL && TL_PASSWORD) {
    const tlToken = await login(TL_EMAIL, TL_PASSWORD);
    const tlEmployees = await apiGet(tlToken, "/employees?limit=200");
    assertStatus(tlEmployees.status, 200, "team leader employees list");
    const tlAttendance = await apiGet(tlToken, "/attendance?todayOnly=true");
    assertStatus(tlAttendance.status, 200, "team leader attendance today");
    console.log(`PASS team leader scoped checks (${TL_EMAIL})`);
  } else {
    console.log("INFO team leader checks skipped (set TL_EMAIL/TL_PASSWORD)");
  }

  console.log("Access scope matrix smoke passed.");
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});

