# Authorization Policy Contract

This document defines the shared authorization contract between backend policy checks and frontend visibility/guards.

## Source of truth

- Backend authorization policy is the only source of truth.
- Frontend guards and UI visibility must mirror this contract exactly.
- Route guards are UX-level only; backend still enforces final access.

## Canonical roles

- `EMPLOYEE`
- `TEAM_LEADER`
- `MANAGER`
- `HR`
- `HR_STAFF`
- `HR_MANAGER`
- `ADMIN`

## Canonical resources and actions

### `dashboard`
- `read`: any authenticated user.

### `employees`
- `read`: role/template-based, scoped by backend.
- `create`, `edit`, `delete`, `transfer`, `process_increase`: policy-driven and scoped.

### `attendance`
- `read`: role/template-based.
- `manage`: requires explicit manage-capable role/template.
- UI must never infer manage from role name alone.

### `leaves`
- `read`, `approve`

### `assessments`
- `read`, `assess`, `manage`

### `payroll`
- `view`, `manage`

### `reports`
- `read` (expressed in API as route access)

### `permissions`
- `manage`

### `users`
- `manage`

### `holidays` (route-level policy in current backend)
- `read` (list)
- `manage` (create/update/delete)

## Contract invariants

- Any permission/template/role update that changes access must bump `authzVersion`.
- `requireAuth` and refresh validation must reject stale versions.
- Deleted/inactive users must not pass authenticated access checks.
- Frontend quick actions and sidebar links must use the same predicates as route guards.

