/**
 * Leave visibility smoke test.
 *
 * Verifies for EMPLOYEE-role users:
 * - /leave-requests/mine returns only own requests
 * - can read history for own requests
 * - cannot read another employee's request or history
 *
 * Usage:
 *   npm run test:leave-visibility
 *
 * Optional env:
 *   API_URL=http://localhost:5001/api
 *   ADMIN_EMAIL=admin@company.com
 *   ADMIN_PASSWORD=Admin@123456
 *   EMPLOYEE_PASSWORD=Employee@123456
 *   EMPLOYEE_PASSWORD_FALLBACK=emp123
 *   HR_EMAIL=hr@example.com
 *   HR_PASSWORD=hr-password
 *   MAX_EMPLOYEES=20
 */

const BASE = process.env.API_URL || "http://localhost:5001/api";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@company.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Admin@123456";
const EMPLOYEE_PASSWORD = process.env.EMPLOYEE_PASSWORD || "Employee@123456";
const EMPLOYEE_PASSWORD_FALLBACK = process.env.EMPLOYEE_PASSWORD_FALLBACK || "emp123";
const HR_EMAIL = process.env.HR_EMAIL || "";
const HR_PASSWORD = process.env.HR_PASSWORD || "";
const MAX_EMPLOYEES = Math.max(1, Number(process.env.MAX_EMPLOYEES || 20));

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

function ownIdStringFromRow(row) {
  const id = row?.employeeId;
  if (id && typeof id === "object" && id._id) return String(id._id);
  return String(id || "");
}

async function main() {
  const adminToken = await login(ADMIN_EMAIL, ADMIN_PASSWORD);

  const empRes = await apiGet(adminToken, "/employees?limit=500");
  if (empRes.status !== 200) {
    throw new Error(`admin employees fetch failed: ${empRes.status} ${JSON.stringify(empRes.data)}`);
  }
  const allEmployees = Array.isArray(empRes.data?.employees) ? empRes.data.employees : [];
  const employees = allEmployees
    .filter((e) => String(e?.role || "").toUpperCase() === "EMPLOYEE" && e?.email)
    .slice(0, MAX_EMPLOYEES);

  if (!employees.length) {
    throw new Error("no EMPLOYEE users found to test");
  }

  const allLeaveRes = await apiGet(adminToken, "/leave-requests?limit=500");
  if (allLeaveRes.status !== 200) {
    throw new Error(`admin leave fetch failed: ${allLeaveRes.status} ${JSON.stringify(allLeaveRes.data)}`);
  }
  const allRequests = Array.isArray(allLeaveRes.data?.requests) ? allLeaveRes.data.requests : [];
  const requestByOwner = new Map();
  for (const r of allRequests) {
    const ownerId = ownIdStringFromRow(r);
    if (!ownerId) continue;
    if (!requestByOwner.has(ownerId)) requestByOwner.set(ownerId, []);
    requestByOwner.get(ownerId).push(r);
  }

  let checked = 0;
  let skippedNoRequest = 0;

  for (const emp of employees) {
    let token;
    try {
      token = await login(emp.email, EMPLOYEE_PASSWORD);
    } catch {
      token = await login(emp.email, EMPLOYEE_PASSWORD_FALLBACK);
    }

    const selfId = String(emp.id || emp._id || "");
    const mine = await apiGet(token, "/leave-requests/mine?limit=200");
    if (mine.status !== 200) {
      throw new Error(`${emp.email}: /mine failed (${mine.status})`);
    }
    const mineRows = Array.isArray(mine.data?.requests) ? mine.data.requests : [];
    for (const row of mineRows) {
      const rowOwner = ownIdStringFromRow(row);
      if (rowOwner && selfId && rowOwner !== selfId) {
        throw new Error(`${emp.email}: /mine leak detected (saw request of ${rowOwner})`);
      }
    }

    const ownRequests = requestByOwner.get(selfId) || [];
    if (!ownRequests.length) {
      skippedNoRequest += 1;
      continue;
    }

    const ownRequest = ownRequests[0];
    const ownHistory = await apiGet(token, `/leave-requests/${ownRequest._id}/history`);
    if (ownHistory.status !== 200) {
      throw new Error(`${emp.email}: own history denied (${ownHistory.status})`);
    }

    const other = allRequests.find((r) => ownIdStringFromRow(r) !== selfId);
    if (other?._id) {
      const otherDoc = await apiGet(token, `/leave-requests/${other._id}`);
      if (otherDoc.status !== 403) {
        throw new Error(`${emp.email}: expected 403 reading other request, got ${otherDoc.status}`);
      }
      const otherHistory = await apiGet(token, `/leave-requests/${other._id}/history`);
      if (otherHistory.status !== 403) {
        throw new Error(`${emp.email}: expected 403 reading other history, got ${otherHistory.status}`);
      }
    }

    checked += 1;
    console.log(`✓ ${emp.email} visibility checks passed`);
  }

  if (HR_EMAIL && HR_PASSWORD) {
    const hrToken = await login(HR_EMAIL, HR_PASSWORD);
    const mine = await apiGet(hrToken, "/leave-requests/mine?limit=50");
    if (mine.status !== 200) {
      throw new Error(`HR personal /mine failed (${mine.status})`);
    }
    const bal = await apiGet(hrToken, "/leave-requests/balance");
    if (bal.status !== 200) {
      throw new Error(`HR personal /balance failed (${bal.status})`);
    }
    console.log(`✓ ${HR_EMAIL} personal leave endpoints accessible`);
  } else {
    console.log("INFO HR personal check skipped (set HR_EMAIL and HR_PASSWORD to enable)");
  }

  console.log("\nLeave visibility smoke passed.");
  console.log(`Employees tested with requests: ${checked}`);
  console.log(`Employees skipped (no requests): ${skippedNoRequest}`);
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
