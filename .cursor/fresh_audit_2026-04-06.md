# Fresh Project Audit — Issues & Bugs Report
**Date:** 2026-04-06  
**Scope:** Full backend + frontend read-only review, zero code changes

---

## CRITICAL — Bugs That Affect Runtime Behavior

### BUG-1: `leaveRequestService` errors return wrong HTTP status in production

- **Location:** `backend/src/services/leaveRequestService.js` (47 occurrences)
- **Problem:** Every user-facing error sets `err.status` (e.g., `err.status = 400`). However, `errorMiddleware.js` reads `err.statusCode`, **not** `err.status`. The `leaveRequests.js` route file works around this by manually reading `e.status || 500` in each catch block. **But** if any future route or code path passes these errors through `next(err)` to the global error middleware (which is the Express standard pattern), they will all surface as **500 Internal Server Error** in production instead of 400/403/404/409.
- **Impact:** Currently mitigated by route-level catch blocks, but:
  - The route reads `e.status || 500`, meaning **any** thrown error without `.status` (including real server errors) will expose `error.message` to the client — **leaking internal details**.
  - The `errorMiddleware.js` + `ApiError` pattern exists precisely to prevent this, yet `leaveRequestService` doesn't use it.
- **Severity:** **HIGH** — information leak + fragile error contract

---

### BUG-2: `requireRole(3)` blocks HR_MANAGER and HR_STAFF from admin-level operations

- **Location:** 11 call sites across `bulk.js`, `departments.js`, `teams.js`, `organizationPolicy.js`, `positions.js`
- **Problem:** `requireRole(3)` uses the numeric weight system: ADMIN=3, HR_MANAGER=3, HR_STAFF=3. So HR_MANAGER and HR_STAFF technically pass. **But** the numeric check is `(roleWeight[user.role] || 1) < allowedRoles`. If `user.role` is a string not in `roleWeight` map (e.g., a new role like `"SUPER_ADMIN"`), it defaults to weight 1 and gets rejected. More importantly, the weight system means HR_STAFF can do everything an ADMIN can in these routes — there's no way to distinguish "only ADMIN" from "ADMIN + HR" using `requireRole(3)`.
- **Impact:** Over-permissive for HR_STAFF on operations that should be admin-only (like deleting departments/teams, modifying organization policy).
- **Severity:** **HIGH** — access control violation

---

### BUG-3: `requireAdminOrHrHead` in `rbac.js` excludes HR_MANAGER role

- **Location:** `backend/src/middleware/rbac.js` line 59
- **Problem:** The middleware only allows `HR_STAFF` through the head-of-HR path. A user with role `HR_MANAGER` who is also the HR department head will be rejected with 403.
- **Impact:** HR_MANAGER cannot manage users or permissions via routes that use `requireAdminOrHrHead`.
- **Severity:** **HIGH** — functional block for HR_MANAGER users

---

### BUG-4: `validateScopeAccess` department scope is not implemented

- **Location:** `backend/src/middleware/permissions.js` lines 92-100
- **Problem:** The `department` case in the switch returns `true` unconditionally — it never checks `resourceDepartment` against the user's actual department. Any user with a "department"-scoped permission effectively has "all" scope.
- **Impact:** Department-scoped permissions provide no real restriction.
- **Severity:** **HIGH** — security hole in permission system

---

### BUG-5: `/api/alerts/salary-increase-summary` has no role check

- **Location:** `backend/src/routes/alerts.js` lines 128-150
- **Problem:** The endpoint only requires `requireAuth`. Any authenticated employee can see all employees' salary data (`fullName`, `department`, `financial` including `baseSalary`).
- **Impact:** Salary information leaked to all authenticated users.
- **Severity:** **HIGH** — sensitive data exposure

---

### BUG-6: Routes leak `error.message` on 500 in catch blocks

- **Location:** 16 route files (62+ occurrences of `res.status(500).json({ error: error.message })`)
- **Problem:** Many catch blocks send `error.message` directly to the client even for unexpected server errors. In production, this can expose internal paths, database details, or stack information.
- **Impact:** Information disclosure in production.
- **Severity:** **MEDIUM-HIGH** — security best practice violation

---

## HIGH — Data Integrity & Consistency Issues

### ISSUE-7: Dual string/ObjectId storage with no guaranteed sync

- **Location:** `Employee` model (`department`/`departmentId`, `team`/`teamId`, `position`/`positionId`, `workLocation`/`branchId`)
- **Problem:** The string cache fields and ObjectId refs can diverge. `syncEmployeeOrgCaches` exists but is only called in `employeeService.createEmployee`. Other write paths (direct route updates in `employees.js`, `employments.js` assign/unassign, bulk import) may not call it consistently.
- **Impact:** Queries on `department` (string) vs `departmentId` (ObjectId) return different result sets, causing visibility gaps.
- **Severity:** **HIGH** — data consistency

---

### ISSUE-8: `employees.js` routes heavily use string `department` for filtering

- **Location:** `backend/src/routes/employees.js` (list, count, scope, CRUD, transfer)
- **Problem:** List filtering (`department: { $in: names }`), create validation (`countDocuments({ department })`), and scope checks all use the string `department` field. If the string is stale (see ISSUE-7), employees become invisible or appear in wrong departments.
- **Impact:** Employee visibility depends on stale string cache rather than authoritative `departmentId`.
- **Severity:** **HIGH** — functional correctness

---

### ISSUE-9: `attendance.js` filters employees by string `department`

- **Location:** `backend/src/routes/attendance.js` line ~209
- **Problem:** Department-head scope for attendance uses `Employee.find({ department: { $in: managedDeptNames } })`. If employee's `department` string is empty/stale but `departmentId` is correct, they won't appear.
- **Impact:** Managers may not see attendance for their actual department members.
- **Severity:** **HIGH** — functional correctness

---

### ISSUE-10: No MongoDB transactions for multi-document operations

- **Location:** `employeeOrgSync.js`, `employments.js` assign/unassign, `bulk.js` wipe+reimport, `employees.js` delete (which removes from 7+ collections)
- **Problem:** Multiple `save()`/`updateOne()`/`deleteMany()` calls without transactions. If the process crashes mid-way, data is left in an inconsistent state (e.g., employee deleted but their attendance/leave records remain, or department head reassigned but old head's role not demoted).
- **Impact:** Partial writes on failures lead to orphaned data and broken references.
- **Severity:** **MEDIUM-HIGH** — data integrity under failure conditions

---

### ISSUE-11: `Team` model has dual `members[]` (emails) and `memberIds[]` (ObjectIds)

- **Location:** `backend/src/models/Team.js`
- **Problem:** Both arrays must stay in sync. The `employments.js` route now syncs both during assign/unassign, but direct Team mutations in `teams.js` (PUT, member add/remove) may only update one array. Any code that reads `members` vs `memberIds` can get different roster views.
- **Impact:** Roster mismatches between email-based and ID-based lookups.
- **Severity:** **MEDIUM-HIGH**

---

### ISSUE-12: `Department` model has embedded `teams[]` AND standalone `Team` collection

- **Location:** `backend/src/models/Department.js` (embedded `teams[]` subdocuments) + `backend/src/models/Team.js`
- **Problem:** Two sources of truth for team data. `accessService.js` checks both. `orgResolutionService.js` merges them. But writes go to different places depending on the route: `departments.js` sometimes touches embedded arrays, `teams.js` touches standalone `Team` docs.
- **Impact:** Leader/membership lookups can differ between embedded vs standalone path.
- **Severity:** **MEDIUM-HIGH** — architectural debt creating functional bugs

---

## MEDIUM — Role & Authorization Inconsistencies

### ISSUE-13: Ad-hoc role checks scattered across 10+ files instead of using shared helpers

- **Location:** `alerts.js`, `attendance.js`, `onboarding.js` (6 instances), `permissions.js`, `positions.js`, `teams.js`, `departments.js`, `employees.js`, `auth.js`
- **Problem:** Each file writes its own `user.role === "ADMIN" || user.role === 3` check. The shared `isAdminRole()` from `utils/roles.js` is only used in 3 files. This means:
  - Adding a new admin-equivalent role requires touching 10+ files
  - Some files include `HR_MANAGER` in admin-like checks, others don't
  - Numeric legacy role `3` may or may not be checked depending on the file
- **Impact:** Inconsistent authorization behavior; maintenance nightmare.
- **Severity:** **MEDIUM** — maintainability + consistency

---

### ISSUE-14: `accessService.js` hardcodes `"HR"` while `rbac.js` uses `HR_DEPARTMENT_NAME` env var

- **Location:** `accessService.js` line 43 (`code: "HR"`, `name: "HR"`) vs `rbac.js` line 3 (`process.env.HR_DEPARTMENT_NAME || "HR"`)
- **Problem:** If the HR department is named differently (e.g., "Human Resources"), `accessService` won't find it while `rbac.js` could (if env var is set).
- **Impact:** HR scope resolution may silently fail in organizations that don't use "HR" as the exact department code/name.
- **Severity:** **MEDIUM**

---

### ISSUE-15: `isHrDepartmentHead` in `rbac.js` only checks `head` (email), not `headId`

- **Location:** `backend/src/middleware/rbac.js` line 15-19
- **Problem:** `accessService.js` was updated to check both `head` (email) and `headId` (ObjectId). But `rbac.js` still only checks `{ name: HR_DEPARTMENT_NAME, head: email }`. If the `head` email string is empty but `headId` is correctly set, the HR head will be denied access.
- **Impact:** HR department head access depends on string `head` field being populated.
- **Severity:** **MEDIUM**

---

### ISSUE-16: `onboarding.js` has 6 identical admin-check blocks with no shared function

- **Location:** `backend/src/routes/onboarding.js` lines 19, 94, 110, 128, 148, 203
- **Problem:** The exact same `user.role === "ADMIN" || user.role === "HR_MANAGER" || user.role === "HR_STAFF" || user.role === 3` expression is copy-pasted in every handler. Not using `isAdminRole` or a shared middleware.
- **Impact:** Duplication; easy to miss one if roles change.
- **Severity:** **MEDIUM** — maintainability

---

## MEDIUM — Frontend Issues

### ISSUE-17: `DashboardPage` bypasses module API layer for attendance

- **Location:** `frontend/src/pages/dashboard/DashboardPage.jsx` lines 123, 327, 499
- **Problem:** Three direct `fetchWithAuth` calls for attendance data. Uses `if (res.ok)` manually instead of `handleApiResponse`. Non-OK responses are silently ignored (no error shown to user), while all other dashboard data goes through proper module APIs.
- **Impact:** Inconsistent error handling; silent failures for attendance section. If API returns 403, user sees no data and no error message.
- **Severity:** **MEDIUM**

---

### ISSUE-18: `EmployeeProfilePage` makes 6 raw `fetchWithAuth` calls bypassing module APIs

- **Location:** `frontend/src/modules/employees/pages/EmployeeProfilePage.jsx`
- **Problem:** Attendance, leave balance, leave requests, password reset, transfer, salary increase — all direct `fetchWithAuth` calls. Each has its own error handling pattern (some try/catch, some `.ok` checks).
- **Impact:** No centralized error handling; inconsistent user feedback on failures.
- **Severity:** **MEDIUM**

---

### ISSUE-19: `EditEmployeePage` uses raw `fetchWithAuth` for policy documents

- **Location:** `frontend/src/modules/employees/pages/EditEmployeePage.jsx` line 68
- **Problem:** Calls `fetchWithAuth(\`${API_URL}/policy/documents\`)` directly while `organization/api.js` already exists and should provide this.
- **Impact:** Inconsistency with module API pattern.
- **Severity:** **LOW-MEDIUM**

---

### ISSUE-20: `contracts` module is entirely mock — no backend API exists

- **Location:** `frontend/src/modules/contracts/api.js` (uses `mockDelay`), `frontend/src/modules/contracts/store.js`
- **Problem:** The contracts feature uses mock data only. `createContractThunk` in the store has no try/catch and no `getErrorMessage`. The module is gated by `VITE_ENABLE_CONTRACTS`, but if enabled, it shows fake data.
- **Impact:** Users may see contract data that doesn't reflect reality. Store thunk errors are unhandled.
- **Severity:** **MEDIUM** (if feature flag is on)

---

### ISSUE-21: `LeadershipOrgOverview` imports `API_URL` but may not use it

- **Location:** `frontend/src/pages/home/LeadershipOrgOverview.jsx`
- **Problem:** `API_URL` is imported but all API calls now go through `@/modules/bulk/api`. The import may be unused dead code.
- **Impact:** Dead import; minor code cleanliness.
- **Severity:** **LOW**

---

## LOW-MEDIUM — Code Quality & Maintenance

### ISSUE-22: Duplicate `asyncHandler` files

- **Location:** `backend/src/middleware/asyncHandler.js` AND `backend/src/utils/asyncHandler.js`
- **Problem:** Identical implementation in two locations. Only `branches.js` imports it. Other routes use manual try/catch.
- **Impact:** Confusion about which to import; most routes don't use either.
- **Severity:** **LOW**

---

### ISSUE-23: `Employee.isActive` vs `Employee.status` used inconsistently for active checks

- **Location:** `alerts.js` uses `isActive: true`; `dashboard.js` and `reports.js` use `status: { $ne: "TERMINATED" }`
- **Problem:** Two different fields represent "active employee". `isActive` is a boolean; `status` can be `ACTIVE`, `ON_LEAVE`, `SUSPENDED`, `TERMINATED`, `RESIGNED`. An employee with `status: "SUSPENDED"` would still have `isActive: true`, so `alerts.js` would include them while `dashboard.js` would too (since `SUSPENDED ≠ TERMINATED`). But `isActive: false` is only set when `status` becomes `TERMINATED` or `RESIGNED`. The real gap: a `SUSPENDED` employee might or might not need alerts.
- **Impact:** Inconsistent business logic for who counts as "active".
- **Severity:** **LOW-MEDIUM**

---

### ISSUE-24: `validation.js` role validation mixes numbers and strings

- **Location:** `backend/src/middleware/validation.js` — `validateUserCreation`
- **Problem:** `body("role").isIn([1, 2, 3, "EMPLOYEE", "TEAM_LEADER", "MANAGER", "HR_STAFF", "HR_MANAGER", "ADMIN"])` — Express request bodies are strings from JSON. `isIn([1, 2, 3, ...])` will fail for `"1"` vs `1` depending on express-validator version and whether `toInt()` is chained.
- **Impact:** Role validation may unexpectedly reject valid numeric role values sent as strings.
- **Severity:** **LOW-MEDIUM**

---

### ISSUE-25: JWT default secrets in non-production environments

- **Location:** `backend/src/middleware/auth.js` lines 7-9
- **Problem:** `JWT_SECRET || "dev-secret"` and `JWT_REFRESH_SECRET || "dev-refresh-secret"`. If `.env` is misconfigured in staging or shared dev, all users share the same well-known secrets.
- **Impact:** Trivial token forging in any non-production environment where env is misconfigured.
- **Severity:** **LOW** in development, **CRITICAL** if accidentally deployed

---

### ISSUE-26: `verifyRefreshToken` returns `null` for all failure modes

- **Location:** `backend/src/middleware/auth.js` lines 146-167
- **Problem:** Expired token, invalid signature, missing employee, wrong token type — all return the same `null`. Callers cannot distinguish "please re-login" from "invalid token" from "account deleted".
- **Impact:** Poor user feedback on session issues; potential security logging gap.
- **Severity:** **LOW-MEDIUM**

---

### ISSUE-27: `auditService.detectChanges` only detects field changes, not removals

- **Location:** `backend/src/services/auditService.js`
- **Problem:** Only iterates keys on `current`; if a field existed in `previous` but was removed, it won't appear in the diff.
- **Impact:** Audit trail misses field deletions.
- **Severity:** **LOW-MEDIUM**

---

## Summary Table

| ID | Category | Severity | Area |
|----|----------|----------|------|
| BUG-1 | Error handling mismatch (status vs statusCode) | **CRITICAL** | leaveRequestService |
| BUG-2 | requireRole(3) over-permissive | **HIGH** | 5 route files |
| BUG-3 | HR_MANAGER excluded from rbac middleware | **HIGH** | rbac.js |
| BUG-4 | Department scope check unimplemented | **HIGH** | permissions.js |
| BUG-5 | Salary data exposed to all users | **HIGH** | alerts.js |
| BUG-6 | Error messages leaked on 500 | **MEDIUM-HIGH** | 16 route files |
| ISSUE-7 | String/ObjectId sync not guaranteed | **HIGH** | Employee model |
| ISSUE-8 | Employees filtered by stale string | **HIGH** | employees.js |
| ISSUE-9 | Attendance filtered by stale string | **HIGH** | attendance.js |
| ISSUE-10 | No transactions for multi-doc writes | **MEDIUM-HIGH** | multiple |
| ISSUE-11 | Team members/memberIds dual arrays | **MEDIUM-HIGH** | Team model |
| ISSUE-12 | Embedded teams vs standalone Teams | **MEDIUM-HIGH** | Department + Team |
| ISSUE-13 | Scattered role checks | **MEDIUM** | 10+ files |
| ISSUE-14 | Hardcoded "HR" vs env var | **MEDIUM** | accessService |
| ISSUE-15 | rbac only checks head email, not headId | **MEDIUM** | rbac.js |
| ISSUE-16 | 6 copy-pasted admin checks | **MEDIUM** | onboarding.js |
| ISSUE-17 | Dashboard bypasses module API | **MEDIUM** | DashboardPage.jsx |
| ISSUE-18 | ProfilePage raw fetch calls | **MEDIUM** | EmployeeProfilePage.jsx |
| ISSUE-19 | EditPage raw fetch for policy | **LOW-MEDIUM** | EditEmployeePage.jsx |
| ISSUE-20 | Contracts module fully mocked | **MEDIUM** | contracts module |
| ISSUE-21 | Unused API_URL import | **LOW** | LeadershipOrgOverview |
| ISSUE-22 | Duplicate asyncHandler | **LOW** | middleware + utils |
| ISSUE-23 | isActive vs status inconsistency | **LOW-MEDIUM** | alerts vs dashboard |
| ISSUE-24 | Role validation number/string mix | **LOW-MEDIUM** | validation.js |
| ISSUE-25 | Default JWT secrets | **LOW/CRITICAL** | auth.js |
| ISSUE-26 | verifyRefreshToken all-null returns | **LOW-MEDIUM** | auth.js |
| ISSUE-27 | Audit misses field removals | **LOW-MEDIUM** | auditService.js |

---

## Recommended Fix Priority

**Phase 1 — Security & Correctness (do first):**
- BUG-4: Implement real department scope check in `validateScopeAccess`
- BUG-5: Add role guard to `/alerts/salary-increase-summary`
- BUG-3: Add HR_MANAGER to `requireAdminOrHrHead`
- BUG-1: Migrate `leaveRequestService` to use `ApiError` with `statusCode`
- BUG-6: Replace `error.message` with generic message in 500 catch blocks

**Phase 2 — Access Control Hardening:**
- BUG-2: Replace `requireRole(3)` with explicit role arrays where appropriate
- ISSUE-13: Consolidate all ad-hoc role checks to `utils/roles.js`
- ISSUE-15: Update `rbac.js` `isHrDepartmentHead` to also check `headId`
- ISSUE-14: Use `HR_DEPARTMENT_NAME` env var in `accessService.js`
- ISSUE-16: Extract onboarding admin check to shared middleware

**Phase 3 — Data Integrity:**
- ISSUE-7/8/9: Ensure all Employee write paths call `syncEmployeeOrgCaches`; migrate queries to prefer `departmentId`
- ISSUE-11: Ensure all Team member mutations sync both arrays
- ISSUE-12: Decide on embedded vs standalone teams; deprecate one

**Phase 4 — Frontend Consistency:**
- ISSUE-17/18/19: Route all pages through module `api.js` + `handleApiResponse`
- ISSUE-20: Either build contracts backend or clearly mark module as demo-only

**Phase 5 — Code Quality:**
- ISSUE-22/23/24/25/26/27: Clean up duplicates, standardize patterns
