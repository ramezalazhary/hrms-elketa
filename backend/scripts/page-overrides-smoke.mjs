/**
 * Smoke: validates page-catalog + resolve-preview + page-overrides endpoints.
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
  return { token: data.accessToken, user: data.user };
}

async function api(token, method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

function assertOk(cond, message) {
  if (!cond) throw new Error(message);
}

async function main() {
  const { token, user } = await login(accounts.admin.email, accounts.admin.password);

  const catalog = await api(token, "GET", "/permissions/page-catalog");
  assertOk(catalog.status === 200, "catalog endpoint failed");
  assertOk(Array.isArray(catalog.data?.pages), "catalog pages not returned");
  assertOk(catalog.data.pages.some((p) => p.pageId === "dashboard"), "dashboard page missing from catalog");

  const targetUserId = user?.id;
  assertOk(Boolean(targetUserId), "missing target user id from login");

  const saveOverrides = await api(token, "PUT", `/permissions/page-overrides/${targetUserId}`, {
    overrides: [{ pageId: "dashboard", level: "VIEW" }],
  });
  assertOk(saveOverrides.status === 200, "saving page overrides failed");

  // Saving overrides bumps authzVersion for target user, so refresh token context.
  const relogin = await login(accounts.admin.email, accounts.admin.password);
  const readOverrides = await api(relogin.token, "GET", `/permissions/page-overrides/${targetUserId}`);
  assertOk(readOverrides.status === 200, "reading page overrides failed");
  assertOk(
    Array.isArray(readOverrides.data?.overrides) &&
      readOverrides.data.overrides.some((o) => o.pageId === "dashboard" && o.level === "VIEW"),
    "saved dashboard override not found",
  );

  const preview = await api(relogin.token, "POST", "/permissions/resolve-preview", {
    role: "HR_STAFF",
    hrLevel: "STAFF",
    hrTemplates: [],
    pageAccessOverrides: [{ pageId: "dashboard", level: "VIEW" }],
  });
  assertOk(preview.status === 200, "preview resolver failed");
  const dashboard = (preview.data?.pages || []).find((p) => p.pageId === "dashboard");
  assertOk(Boolean(dashboard), "dashboard preview missing");
  assertOk(dashboard.level === "VIEW", `expected dashboard VIEW, got ${dashboard?.level}`);

  const permissionsDeniedPreview = await api(relogin.token, "POST", "/permissions/resolve-preview", {
    role: "HR_STAFF",
    hrLevel: "STAFF",
    hrTemplates: [],
    isHrDepartmentMember: false,
    pageAccessOverrides: [],
  });
  assertOk(permissionsDeniedPreview.status === 200, "permissions denied preview failed");
  const permissionsDeniedPage = (permissionsDeniedPreview.data?.pages || []).find(
    (p) => p.pageId === "permissions_admin",
  );
  assertOk(Boolean(permissionsDeniedPage), "permissions_admin preview missing");
  assertOk(
    permissionsDeniedPage.level === "NONE",
    `expected permissions_admin NONE, got ${permissionsDeniedPage?.level}`,
  );

  const permissionsNoOverridePreview = await api(relogin.token, "POST", "/permissions/resolve-preview", {
    role: "HR_STAFF",
    hrLevel: "STAFF",
    hrTemplates: [],
    isHrDepartmentMember: true,
    pageAccessOverrides: [],
  });
  assertOk(permissionsNoOverridePreview.status === 200, "permissions no-override preview failed");
  const permissionsAllowedPage = (permissionsNoOverridePreview.data?.pages || []).find(
    (p) => p.pageId === "permissions_admin",
  );
  assertOk(Boolean(permissionsAllowedPage), "permissions_admin no-override preview missing");
  assertOk(
    permissionsAllowedPage.level === "NONE",
    `expected permissions_admin NONE without override, got ${permissionsAllowedPage?.level}`,
  );

  console.log("Page overrides smoke passed.");
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});

