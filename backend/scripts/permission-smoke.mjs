/**
 * API permission smoke tests — requires backend + MongoDB + npm run seed.
 * Usage: node scripts/permission-smoke.mjs
 */
const BASE = process.env.API_URL || "http://localhost:5000/api";

const accounts = {
  admin: { email: "admin@hr.local", password: "admin123" },
  hrHead: { email: "hrhead@hr.local", password: "hr123" },
  hrManager: { email: "hrmanager@hr.local", password: "hrm123" },
  manager: { email: "itmgr@hr.local", password: "it123" },
  employee: { email: "devops1@hr.local", password: "emp123" },
};

async function login(email, password) {
  const r = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(`login ${email}: ${data.error || r.status}`);
  return data.accessToken;
}

function authFetch(token, path, opts = {}) {
  return fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...opts.headers,
    },
  });
}

async function check(name, res, expected) {
  const pass = res.status === expected;
  const snippet = (await res.text()).slice(0, 120);
  if (!pass) {
    console.error(`  ✖ ${name}: want ${expected}, got ${res.status} — ${snippet}`);
    return false;
  }
  console.log(`  ✓ ${name} (${expected})`);
  return true;
}

async function main() {
  console.log("Permission smoke tests →", BASE);

  const tok = {
    admin: await login(accounts.admin.email, accounts.admin.password),
    hrHead: await login(accounts.hrHead.email, accounts.hrHead.password),
    hrManager: null,
    manager: await login(accounts.manager.email, accounts.manager.password),
    employee: await login(accounts.employee.email, accounts.employee.password),
  };
  try {
    tok.hrManager = await login(accounts.hrManager.email, accounts.hrManager.password);
  } catch {}

  let failed = 0;
  const run = async (n, p, r) => {
    const ok = await check(n, p, r);
    if (!ok) failed++;
  };

  console.log("\n— Users API —");
  await run(
    "ADMIN GET /users",
    await authFetch(tok.admin, "/users"),
    200,
  );
  await run(
    "HR Head GET /users (HR subset)",
    await authFetch(tok.hrHead, "/users"),
    200,
  );
  if (tok.hrManager) {
    await run(
      "HR Manager GET /users",
      await authFetch(tok.hrManager, "/users"),
      200,
    );
  }
  await run(
    "MANAGER GET /users (forbidden)",
    await authFetch(tok.manager, "/users"),
    403,
  );
  await run(
    "EMPLOYEE GET /users (forbidden)",
    await authFetch(tok.employee, "/users"),
    403,
  );

  const usersJson = await (await authFetch(tok.admin, "/users")).json();
  const adminUser = usersJson.find((u) => u.email === "admin@hr.local");
  const hrUser = usersJson.find((u) => u.email === "hrhead@hr.local");
  const itUser = usersJson.find((u) => u.email === "itmgr@hr.local");
  if (!hrUser) throw new Error("seed missing hrhead user");

  if (adminUser) {
    console.log("\n— Role changes —");
    await run(
      "HR Head PUT /users/:id/role (forbidden)",
      await authFetch(tok.hrHead, `/users/${adminUser.id}/role`, {
        method: "PUT",
        body: JSON.stringify({ role: "EMPLOYEE" }),
      }),
      403,
    );
  }

  console.log("\n— Permissions API —");
  await run(
    "ADMIN GET permissions for HR user",
    await authFetch(tok.admin, `/permissions/${hrUser.id}`),
    200,
  );
  await run(
    "HR Head GET permissions for HR user",
    await authFetch(tok.hrHead, `/permissions/${hrUser.id}`),
    200,
  );
  if (tok.hrManager) {
    await run(
      "HR Manager GET permissions for HR user",
      await authFetch(tok.hrManager, `/permissions/${hrUser.id}`),
      200,
    );
  }
  if (itUser) {
    await run(
      "HR Head GET permissions for IT user (forbidden)",
      await authFetch(tok.hrHead, `/permissions/${itUser.id}`),
      403,
    );
  }
  await run(
    "MANAGER GET permissions (forbidden)",
    await authFetch(tok.manager, `/permissions/${hrUser.id}`),
    403,
  );
  await run(
    "ADMIN POST /permissions/simulate",
    await authFetch(tok.admin, "/permissions/simulate", {
      method: "POST",
      body: JSON.stringify({ role: "EMPLOYEE", action: "manage", resource: "users" }),
    }),
    200,
  );

  console.log("\n— Departments (mutations admin-only) —");
  await run(
    "ADMIN POST /departments (bad body → 400, not 403)",
    await authFetch(tok.admin, "/departments", {
      method: "POST",
      body: JSON.stringify({}),
    }),
    400,
  );
  await run(
    "HR Head POST /departments (forbidden)",
    await authFetch(tok.hrHead, "/departments", {
      method: "POST",
      body: JSON.stringify({ name: "X", head: "a@b.c" }),
    }),
    403,
  );

  console.log("\n— Employees list scope —");
  await run(
    "ADMIN GET /employees",
    await authFetch(tok.admin, "/employees"),
    200,
  );
  await run(
    "EMPLOYEE GET /employees (self scope)",
    await authFetch(tok.employee, "/employees"),
    200,
  );

  console.log("\n— Reports —");
  await run(
    "ADMIN GET /reports/summary",
    await authFetch(tok.admin, "/reports/summary"),
    200,
  );
  await run(
    "HR GET /reports/summary",
    await authFetch(tok.hrHead, "/reports/summary"),
    200,
  );
  await run(
    "MANAGER GET /reports/summary (forbidden)",
    await authFetch(tok.manager, "/reports/summary"),
    403,
  );

  console.log(failed === 0 ? "\nAll checks passed." : `\n${failed} check(s) failed.`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
