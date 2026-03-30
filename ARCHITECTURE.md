# Project Architecture

Last updated: 2026-03-30

This document reflects the current code in the repository, not the older documentation snapshots. It focuses on the real structure under the root, `frontend`, and `backend` folders and excludes generated directories such as `node_modules`, `dist`, `.git`, and `tmp`.

## 1. Repository Shape

```text
my-react-app/
|-- backend/                  Express + MongoDB API
|-- frontend/                 React + Vite SPA
|-- API_EXAMPLES.md
|-- ARCHITECTURE.md
|-- CONNECTION_DIAGNOSTIC.md
|-- DOCUMENTATION.md
|-- EXCEL_IMPORT_GUIDE.md
|-- GETTING_STARTED.md
|-- QUICK_REFERENCE.md
|-- connectionTest.mjs
|-- docker-compose.yml
|-- package.json
`-- package-lock.json
```

## 2. System Overview

The project is an HRMS-style full-stack application with:

- A React 19 single-page frontend in `frontend`
- An Express + Mongoose backend in `backend`
- MongoDB as the primary datastore
- JWT-based authentication with refresh tokens
- Role-based and department-based access control
- HR workflows for employees, departments, teams, positions, employments, attendance, reports, password resets, and organization rules

High-level request flow:

```text
Browser
  -> React Router + Redux Toolkit
  -> module API helpers
  -> shared fetchWithAuth()
  -> /api/* Express routes
  -> middleware (auth / RBAC / rate limiting / validation)
  -> Mongoose models
  -> MongoDB
```

## 3. Root-Level Responsibilities

### `package.json`

The root package is mainly an orchestration layer. It exposes:

- `npm run test:frontend`
- `npm run test:api`
- `npm run test`

### Root documentation and helper files

- `ARCHITECTURE.md`: architecture reference
- `DOCUMENTATION.md`, `GETTING_STARTED.md`, `QUICK_REFERENCE.md`: broader project docs
- `API_EXAMPLES.md`: request/response usage examples
- `EXCEL_IMPORT_GUIDE.md`: attendance import workflow
- `CONNECTION_DIAGNOSTIC.md`: troubleshooting reference
- `connectionTest.mjs`: script to test backend reachability, MongoDB connectivity, and login flow
- `docker-compose.yml`: local MongoDB container setup

### `docker-compose.yml`

Defines a MongoDB container:

- image: `mongo:latest`
- port mapping: `27017:27017`
- named volume: `mongodb_data`

## 4. Frontend Architecture

## 4.1 Frontend Stack

- Vite
- React 19
- React Router 7
- Redux Toolkit
- Tailwind CSS
- Geist variable font
- Lucide icons
- Recharts
- Vitest

Key config files:

- `frontend/package.json`
- `frontend/vite.config.js`
- `frontend/eslint.config.js`
- `frontend/tailwind.config.js`
- `frontend/components.json`

Important Vite behavior:

- Alias `@` points to `frontend/src`
- Dev proxy forwards `/api` to `http://localhost:5000`
- Vitest includes `src/**/*.test.{js,jsx}`

## 4.2 Frontend Folder Map

```text
frontend/
|-- public/
|-- src/
|   |-- app/                 app bootstrapping
|   |   |-- providers/
|   |   |-- router/
|   |   `-- store/
|   |-- assets/
|   |-- components/          small shared UI primitives
|   |-- layouts/             route shells
|   |-- lib/
|   |-- modules/             feature modules
|   |-- pages/               standalone pages
|   `-- shared/              cross-cutting API, UI, hooks, routing, utils
|-- .env
|-- index.html
|-- vite.config.js
`-- tailwind.config.js
```

Notes:

- `frontend/src/routes` currently exists but is empty.
- The real router lives under `frontend/src/app/router`.
- `frontend/src/App.jsx` is intentionally empty; routing is mounted from `main.jsx`.

## 4.3 Frontend Boot Flow

Entry path:

```text
src/main.jsx
  -> AppProviders
  -> AppRouter
  -> createBrowserRouter(appRoutes)
```

Core files:

- `frontend/src/main.jsx`
- `frontend/src/app/providers/AppProviders.jsx`
- `frontend/src/app/router/AppRouter.jsx`
- `frontend/src/app/router/routes.jsx`
- `frontend/src/app/store/index.js`

Responsibilities:

- `main.jsx` mounts the SPA
- `AppProviders` wraps Redux `Provider` and `ToastProvider`
- `AppRouter` creates the single browser router
- `routes.jsx` defines top-level auth and protected route trees
- `store/index.js` combines all Redux slices

## 4.4 Layouts and Navigation

### Auth layout

`frontend/src/layouts/authLayout/AuthLayout.jsx`

- Minimal wrapper for login and password-related pages

### Dashboard layout

`frontend/src/layouts/dashboardLayout/DashboardLayout.jsx`

- Main authenticated shell
- Sidebar navigation
- Role-aware menu generation
- Mobile sidebar handling
- Logout action
- Fetches departments when needed to resolve HR-head-specific access decisions

The sidebar is dynamically shaped by:

- system role
- permissions on the `attendance` module
- whether the current user is head of the HR department

## 4.5 Routing Model

The router is split into two top-level branches:

### Public/authenticated-before-login branch

Mounted inside `AuthLayout`:

- `/login`
- `/forgot-password`
- `/change-password`

### Protected application branch

Mounted inside `DashboardLayout` and guarded by `RequireRole`:

- `/`
- `/dashboard`
- `/organizations`
- `/admin/users`
- `/admin/password-requests`
- `/admin/organization-rules`
- `/reports`
- all routes exported from `coreModuleRoutes`

Route guards:

- `frontend/src/shared/routing/RequireRole.jsx`
- `frontend/src/shared/routing/RequireAdminOrHrHead.jsx`

Special behavior:

- users with `requirePasswordChange` are redirected to `/change-password`
- admin-only and HR-head-only pages use dedicated guards

## 4.6 Frontend State Architecture

Redux slices currently registered:

- `identity`
- `employees`
- `departments`
- `teams`
- `positions`
- `employments`
- `contracts`
- `attendance`

Patterns used across modules:

- `createAsyncThunk` for server calls
- `createSlice` for loading state and entity state
- module-local `api.js` files for transport logic
- selectors are simple direct `useAppSelector` reads from slice state

Shared Redux hooks:

- `frontend/src/shared/hooks/reduxHooks.js`

## 4.7 Frontend Shared API Layer

Key files:

- `frontend/src/shared/api/apiBase.js`
- `frontend/src/shared/api/fetchWithAuth.js`

Responsibilities:

- normalize `VITE_API_URL`
- attach `Authorization: Bearer <token>`
- automatically try token refresh on `401`
- retry the original request after refresh

Authentication state is persisted in `localStorage` under `auth`.

## 4.8 Frontend Feature Modules

The frontend follows a feature-module approach under `frontend/src/modules`.

### `identity`

Files:

- `api.js`
- `routes.jsx`
- `store.js`
- `pages/LoginPage.jsx`
- `pages/ForgotPasswordPage.jsx`
- `pages/ChangePasswordPage.jsx`

Responsibilities:

- login
- refresh token
- logout
- password change
- forgot-password request

### `employees`

Files:

- `api.js`
- `routes.jsx`
- `store.js`
- employee list/profile/create/edit pages

Responsibilities:

- fetch employee list
- fetch employee detail
- create/update/delete employee records

### `departments`

Files:

- `api.js`
- `routes.jsx`
- `store.js`
- list/create/edit/structure pages

Responsibilities:

- manage departments
- browse department-specific structure
- work with department teams and metadata returned by backend

### `teams`

Files:

- `api.js`
- `routes.jsx`
- `store.js`
- list/create/edit pages

Responsibilities:

- CRUD for standalone team collection

### `positions`

Files:

- `api.js`
- `routes.jsx`
- `store.js`
- list/create/edit pages

Responsibilities:

- CRUD for normalized job positions

### `employments`

Files:

- `api.js`
- `routes.jsx`
- `store.js`
- `pages/AssignEmploymentPage.jsx`

Responsibilities:

- assign/unassign employees to department/team/position
- fetch assignment history for an employee

### `attendance`

Files:

- `api.js`
- `routes.jsx`
- `store.js`
- `utils.js`
- `utils.test.js`
- `pages/AttendancePage.jsx`

Responsibilities:

- attendance list/filtering
- create/update/delete attendance records
- Excel import
- download template

### `contracts`

Files:

- `api.js`
- `routes.jsx`
- `store.js`

Current state:

- still mock-oriented
- not yet backed by an Express route in the current backend

### `organization`

Files:

- `api.js`
- `pages/OrganizationRulesPage.jsx`

Responsibilities:

- read/update organization-wide document requirements via `/api/policy/documents`

### `permissions`

Files:

- `api.js`

Responsibilities:

- fetch/replace/delete granular per-user permissions

### `users`

Files:

- `api.js`

Responsibilities:

- user listing
- role updates
- account creation
- password request management
- forced password reset

## 4.9 Standalone Pages

Not everything is module-scoped. Some pages live under `frontend/src/pages`:

- `dashboard/DashboardPage.jsx`
- `home/HomePage.jsx`
- `home/LeadershipOrgOverview.jsx`
- `admin/UsersAdminPage.jsx`
- `admin/PasswordRequestsPage.jsx`
- `OrganizationStructure/OrganizationStructurePage.jsx`
- `reports/ReportsPage.jsx`
- `login/LoginPage.jsx`

Important page behaviors:

- `HomePage` shows either simple personal context or leadership analytics depending on role
- `DashboardPage` renders different dashboards for admin, department head, team leader, and employee
- `ReportsPage` consumes `/api/reports/summary`
- `OrganizationStructurePage` builds a read-friendly org overview from departments, teams, and employees

## 4.10 Shared UI and Utilities

Shared frontend resources live under `frontend/src/shared`.

Main areas:

- `shared/api`: transport helpers
- `shared/components`: `Layout`, `DataTable`, `Filters`, `FormBuilder`, `Modal`, `Pagination`, `ToastProvider`, `EntityBadges`, `SearchableSelect`
- `shared/hooks`: typed-ish Redux hooks wrapper
- `shared/routing`: role guards
- `shared/utils`: `id.js`, `password.js`

## 5. Backend Architecture

## 5.1 Backend Stack

- Node.js with ES modules
- Express 4
- Mongoose
- JWT
- bcryptjs
- helmet
- express-rate-limit
- multer
- xlsx
- express-validator
- Joi

Key config files:

- `backend/package.json`
- `backend/.env`
- `backend/.env.example`
- `backend/SECURITY.md`

## 5.2 Backend Folder Map

```text
backend/
|-- scripts/                smoke/integration scripts
|-- src/
|   |-- config/
|   |-- middleware/
|   |-- models/
|   |-- routes/
|   |-- services/           currently empty
|   |-- seedUsers.js
|   |-- seedAttendanceDemo.js
|   |-- clearDatabase.js
|   |-- testAttendanceImport.js
|   `-- index.js
|-- .env
|-- .env.example
|-- README.md
`-- SECURITY.md
```

Important architectural note:

- `backend/src/services` exists but is currently empty.
- Most business logic is still implemented directly inside route files.

## 5.3 Backend Startup Flow

Entry file:

- `backend/src/index.js`

Startup sequence:

```text
dotenv.config()
-> express()
-> express.json()
-> helmet security headers
-> CORS
-> /api rate limiter
-> route mounting
-> API 404 handler
-> global error handler
-> connectDb()
-> app.listen(PORT)
```

Mounted API roots:

- `/api/auth`
- `/api/users`
- `/api/permissions`
- `/api/departments`
- `/api/teams`
- `/api/positions`
- `/api/employees`
- `/api/employments`
- `/api/reports`
- `/api/attendance`
- `/api/management-requests`
- `/api/policy`

## 5.4 Middleware Layers

### `config/db.js`

- connects Mongoose using `MONGO_URI`

### `middleware/auth.js`

Provides:

- `requireAuth`
- `generateAccessToken`
- `generateRefreshToken`
- `verifyRefreshToken`
- `logout`
- `hashPassword`
- `verifyPassword`
- `requireRole`

Notes:

- JWT access and refresh tokens are both supported
- revoked access tokens are persisted in `TokenBlacklist`
- legacy numeric roles are normalized where needed

### `middleware/rbac.js`

Provides:

- `isHrDepartmentHead`
- `requireSystemAdmin`
- `requireAdminOrHrHead`

### `middleware/permissions.js`

Provides:

- module/action/scope checks using `UserPermission`

### `middleware/security.js`

Provides:

- `securityHeaders`
- `apiLimiter`
- `authLimiter`
- `strictLimiter`

Rate limiting is effectively disabled in development and enabled in production.

### `middleware/validation.js`

Provides:

- express-validator chains
- Joi schemas
- validation middleware factories

## 5.5 Backend Route Architecture

The API is organized by domain.

### `routes/auth.js`

Responsibilities:

- login
- refresh token
- logout
- register
- change password
- forgot password
- list pending password reset requests
- admin/HR-head reset password
- admin status toggle

Important design detail:

- authentication now uses the `Employee` model directly
- the legacy `User` model is no longer the runtime source of truth

### `routes/users.js`

Responsibilities:

- list login-capable users
- update system role
- create login account on top of an existing employee record

Access model:

- admin and HR head can read
- only admin can change roles
- HR head is limited to HR employees

### `routes/permissions.js`

Responsibilities:

- list permissions for a user
- create/upsert a permission row
- replace all permissions for a user
- delete one permission
- delete all permissions

### `routes/employees.js`

Responsibilities:

- employee CRUD
- scope-aware data access
- create employee plus default login bootstrap
- keep legacy string fields and normalized refs aligned

Access scopes resolved dynamically:

- `all`
- `department`
- `team`
- `self`

### `routes/departments.js`

Responsibilities:

- department CRUD
- role-filtered read access
- merge nested department teams with standalone `Team` collection
- synchronize employee assignments on rename/delete
- store attendance policy and required documents

### `routes/teams.js`

Responsibilities:

- team CRUD
- team/department integrity validation
- force-delete behavior with employee unassignment

### `routes/positions.js`

Responsibilities:

- position CRUD
- validate team/department relationships
- force-delete behavior with employee unassignment

### `routes/employments.js`

Responsibilities:

- assign employee to department/team/position
- unassign employee
- expose all assignments for a single employee

Important detail:

- supports primary assignment plus `additionalAssignments`

### `routes/attendance.js`

Responsibilities:

- attendance list/create/update/delete
- access filtering by role/scope
- attendance Excel template download
- Excel import with parsing and overwrite support
- status/hour calculation using department attendance policy

### `routes/reports.js`

Responsibilities:

- organization summary report
- org-chart-like report data
- warnings for missing assignments/managers

### `routes/managementRequests.js`

Responsibilities:

- create management requests
- list requests scoped by role
- approve/reject requests

Special workflow:

- `HR_MODULES` requests use dual approval: manager + HR

### `routes/organizationPolicy.js`

Responsibilities:

- get and update organization-wide document requirements

## 5.6 Backend Domain Model

The system uses Mongoose models under `backend/src/models`.

### `Employee`

This is the central record in the system. It combines:

- account/auth fields
- HR profile fields
- organizational assignment fields
- financial and insurance data
- document checklist
- additional assignments

Important architectural fact:

- the old separation between `User` and `Employee` has effectively been merged into `Employee`

### `Department`

Stores:

- department identity and status
- head metadata
- attendance policy (`standardStartTime`, `gracePeriod`)
- nested teams
- department-level positions
- required documents
- optional parent department

### `Team`

Standalone normalized team document with:

- `departmentId`
- leader metadata
- members
- positions
- status

### `Position`

Normalized job position document with:

- `departmentId`
- optional `teamId`
- title, level, description, status

### `Attendance`

Stores:

- employee reference
- employee code
- date
- check-in/check-out
- derived status
- total hours
- last manager/admin who handled the record

### `UserPermission`

Stores granular module permissions:

- `userId`
- `module`
- `actions`
- `scope`

### `ManagementRequest`

Stores approval workflows initiated by users, including:

- request type
- sender info
- department context
- overall status
- manager approval state
- HR approval state

### `OrganizationPolicy`

Stores global company document requirements.

### `PasswordResetRequest`

Stores pending admin/HR-handled password reset requests.

### `TokenBlacklist`

Stores revoked access tokens with TTL cleanup.

### `User`

`backend/src/models/User.js` still exists in the repository, but the active authentication flow uses `Employee` instead.

## 5.7 Current Data-Model Transition Areas

Several parts of the backend are in a migration/compatibility phase:

### Employee identity and assignment storage

Employees currently keep both:

- legacy string fields such as `department`, `team`, `position`
- normalized references such as `departmentId`, `teamId`, `positionId`

This is intentional and supports older frontend/backend assumptions during transition.

### Team storage

Teams currently exist in two shapes:

- nested inside `Department.teams`
- normalized in the standalone `Team` collection

Many department responses merge both representations.

This is a key architectural nuance and should be preserved carefully when refactoring.

## 6. Access-Control Model

The authorization model is layered:

### Layer 1: authentication

- access token required for most API routes

### Layer 2: coarse role checks

- `requireRole`
- `requireAdminOrHrHead`

### Layer 3: dynamic scope checks

Used especially in:

- employees
- attendance
- request visibility

Common scopes:

- all
- department
- team
- subordinates
- self

### Layer 4: granular permissions

`UserPermission` supports per-module action lists and scope values such as:

- `view`
- `create`
- `edit`
- `delete`
- `approve`
- `export`

## 7. Reporting and Dashboard Flow

Frontend dashboards consume a mixture of:

- Redux-managed entities such as employees/departments/teams
- direct `fetchWithAuth()` calls for reports and management requests

Examples:

- `HomePage` chooses between personal view and leadership analytics
- `DashboardPage` branches into admin, department head, team leader, or employee dashboards
- `ReportsPage` consumes `/api/reports/summary`
- attendance widgets consume `/api/attendance?todayOnly=true`

## 8. Import, Seed, and Test Tooling

## 8.1 Backend scripts

Located in `backend/scripts`:

- `full-api-smoke.mjs`
- `permission-smoke.mjs`

These scripts validate:

- login and refresh flow
- protected route reachability
- report shapes
- permission boundaries

## 8.2 Backend source utilities

Under `backend/src` there are additional operational scripts such as:

- `seedUsers.js`
- `seedAttendanceDemo.js`
- `seedAttendanceTestPlayers.js`
- `clearDatabase.js`
- Excel template/test generation helpers
- `testAttendanceImport.js`

## 8.3 Frontend tests

Current test files observed:

- `frontend/src/modules/attendance/utils.test.js`
- `frontend/src/shared/api/apiBase.test.js`

## 9. Notable Architectural Observations

These points are important for future updates:

1. The real auth/account source of truth is `Employee`, not `User`.
2. Business logic is still concentrated in route files; the `services` layer has not been extracted yet.
3. The org structure is partially normalized and partially legacy-compatible.
4. The frontend is feature-module-based, but some strategic pages still live outside modules.
5. The contracts area is still closer to a placeholder than a fully integrated backend feature.
6. Existing older docs in the repo do not fully match the current codebase and should be treated carefully.

## 10. Practical Entry Points for Future Work

If you need to change behavior quickly, these are the best starting points:

- Frontend app boot and routes:
  - `frontend/src/main.jsx`
  - `frontend/src/app/router/routes.jsx`
- Frontend auth and API behavior:
  - `frontend/src/modules/identity/store.js`
  - `frontend/src/shared/api/fetchWithAuth.js`
- Frontend feature modules:
  - `frontend/src/modules/*`
- Backend startup:
  - `backend/src/index.js`
- Backend auth and access control:
  - `backend/src/middleware/auth.js`
  - `backend/src/middleware/rbac.js`
  - `backend/src/routes/auth.js`
- Backend HR core domains:
  - `backend/src/routes/employees.js`
  - `backend/src/routes/departments.js`
  - `backend/src/routes/teams.js`
  - `backend/src/routes/positions.js`
  - `backend/src/routes/employments.js`
  - `backend/src/routes/attendance.js`

## 11. Summary

This repository is a modular HR platform with:

- a React SPA frontend
- an Express/MongoDB backend
- a merged employee/account domain model
- layered role/scope/permission access control
- a hybrid org-structure model that mixes legacy and normalized data
- operational support for attendance import, reporting, password administration, and smoke testing

The most important architectural constraint today is compatibility: several modules are already normalized, but the codebase still preserves older data shapes and flows to keep the system working end to end.
