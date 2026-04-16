/**
 * Authorization matrix smoke test using /permissions/simulate endpoint.
 * Requires running backend and seeded users.
 */
const BASE = process.env.API_URL || "http://localhost:5001/api";

const accounts = {
  admin: { email: "admin@hr.local", password: "admin123" },
};

async function login(email, password) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`login failed: ${data.error || res.status}`);
  return data.accessToken;
}

async function simulate(token, payload) {
  const res = await fetch(`${BASE}/permissions/simulate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  return { status: res.status, data };
}

function assertAllow(name, result, allowExpected) {
  const ok = result.status === 200 && Boolean(result.data?.allow) === allowExpected;
  if (!ok) {
    throw new Error(
      `${name} failed. expected allow=${allowExpected}, got status=${result.status}, payload=${JSON.stringify(result.data)}`,
    );
  }
}

async function main() {
  const cases = [
    {
      name: "ATTENDANCE_NONE_cannot_read",
      payload: {
        role: "HR_STAFF",
        pageAccessOverrides: [{ pageId: "attendance", level: "NONE" }],
        resource: "attendance",
        action: "read",
      },
      expected: false,
    },
    {
      name: "ATTENDANCE_VIEW_can_read_only",
      payload: {
        role: "HR_STAFF",
        pageAccessOverrides: [{ pageId: "attendance", level: "VIEW" }],
        resource: "attendance",
        action: "read",
      },
      expected: true,
    },
    {
      name: "ATTENDANCE_VIEW_cannot_manage",
      payload: {
        role: "HR_STAFF",
        pageAccessOverrides: [{ pageId: "attendance", level: "VIEW" }],
        resource: "attendance",
        action: "manage",
      },
      expected: false,
    },
    {
      name: "ATTENDANCE_EDIT_can_manage",
      payload: {
        role: "HR_STAFF",
        pageAccessOverrides: [{ pageId: "attendance", level: "EDIT" }],
        resource: "attendance",
        action: "manage",
      },
      expected: true,
    },
    {
      name: "PERMISSIONS_NONE_cannot_manage",
      payload: {
        role: "HR_STAFF",
        isHrDepartmentMember: true,
        pageAccessOverrides: [{ pageId: "permissions_admin", level: "NONE" }],
        resource: "permissions",
        action: "manage",
      },
      expected: false,
    },
    {
      name: "PERMISSIONS_EDIT_can_manage",
      payload: {
        role: "HR_STAFF",
        isHrDepartmentMember: true,
        pageAccessOverrides: [{ pageId: "permissions_admin", level: "EDIT" }],
        resource: "permissions",
        action: "manage",
      },
      expected: true,
    },
    {
      name: "ATTENDANCE_ADMIN_can_manage",
      payload: {
        role: "HR_STAFF",
        pageAccessOverrides: [{ pageId: "attendance", level: "ADMIN" }],
        resource: "attendance",
        action: "manage",
      },
      expected: true,
    },
  ];

  for (const tc of cases) {
    const adminToken = await login(accounts.admin.email, accounts.admin.password);
    const result = await simulate(adminToken, tc.payload);
    assertAllow(tc.name, result, tc.expected);
    console.log(`✓ ${tc.name}`);
  }
  console.log("Authorization matrix smoke passed.");
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
