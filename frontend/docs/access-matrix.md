# Access Matrix

This matrix documents route-level access guards in the frontend and the intended audience after the latest authorization updates.

## Public routes

| Route | Page | Guard |
|---|---|---|
| `/login` | Login | Public |
| `/forgot-password` | Forgot password | Public |
| `/change-password` | Change password | Public |
| `/welcome/:token` | Welcome | Public |

## Authenticated shell

All routes below are mounted under dashboard shell with base guard:

- `RequireRole(["EMPLOYEE","TEAM_LEADER","MANAGER","HR","HR_STAFF","HR_MANAGER","ADMIN"])`

## Core routes

| Route | Page | Guard |
|---|---|---|
| `/` | Home | Base guard |
| `/dashboard` | Dashboard | Base guard |
| `/organizations` | Organization structure | `RequireEmployeeRead` |

## Admin & policy routes

| Route | Page | Guard |
|---|---|---|
| `/admin/users` | Users & permissions | `RequirePermissionsManager` |
| `/admin/password-requests` | Password requests | `RequireAdminOrHrHead` |
| `/admin/organization-rules` | Organization rules | `RequireRole(["ADMIN"])` |
| `/admin/holidays` | Holidays | `RequireRole(["ADMIN","HR","HR_MANAGER","HR_STAFF"])` |
| `/reports` | Reports | `RequireReportsView` |

## Employees module

| Route | Page | Guard |
|---|---|---|
| `/employees` | Employees list | `RequireEmployeeRead` |
| `/employees/:employeeId` | Employee profile | `RequireEmployeeRead` |
| `/employees/create` | Create employee | `RequireRole(["ADMIN"])` |
| `/employees/:employeeId/edit` | Edit employee | `RequireRole(["ADMIN"])` |
| `/employees/time-off` | Time off | Base guard (self-service + scoped API checks) |
| `/employees/time-off/approvals` | Leave approvals | `RequireLeaveApprover` |
| `/employees/time-off/bulk-credit` | Bulk leave credit | `RequireRole(["HR_STAFF","HR_MANAGER","ADMIN"])` |
| `/employees/bonus-approvals` | Bonus approvals | `RequireBonusApprover` |
| `/employees/onboarding` | Onboarding approvals | `RequireRole(["HR_STAFF","HR_MANAGER","ADMIN"])` |

## Departments / teams / positions

| Route | Page | Guard |
|---|---|---|
| `/departments` | Departments list | `RequireRole([3,"ADMIN","HR","HR_STAFF","HR_MANAGER"])` |
| `/departments/:departmentId` | Department structure | `RequireRole([2,3,"MANAGER","ADMIN","HR","HR_STAFF","HR_MANAGER"])` |
| `/departments/create` | Create department | `RequireRole([3,"ADMIN"])` |
| `/departments/:departmentId/edit` | Edit department | `RequireRole([3,"ADMIN"])` |
| `/teams` | Teams list | `RequireRole([3,"ADMIN"])` |
| `/teams/create` | Create team | `RequireRole([3,"ADMIN"])` |
| `/teams/:teamId/edit` | Edit team | `RequireRole([3,"ADMIN"])` |
| `/positions` | Positions list | `RequireRole([3,"ADMIN","HR_STAFF","HR_MANAGER"])` |
| `/positions/create` | Create position | `RequireRole([3,"ADMIN","HR","HR_STAFF","HR_MANAGER"])` |
| `/positions/:positionId/edit` | Edit position | `RequireRole([3,"ADMIN","HR","HR_STAFF","HR_MANAGER"])` |

## Attendance / payroll / employments / contracts

| Route | Page | Guard |
|---|---|---|
| `/attendance` | Attendance | `RequireRole([2,3,"MANAGER","HR_STAFF","HR_MANAGER","ADMIN"])` |
| `/payroll` | Payroll runs | `RequirePayrollManager` |
| `/payroll/:id` | Payroll run details | `RequirePayrollManager` |
| `/advances` | Advances | `RequireRole(["HR_STAFF","HR_MANAGER","ADMIN","EMPLOYEE","MANAGER","TEAM_LEADER"])` |
| `/employments` | Redirect | Base guard |
| `/employments/assign` | Assign employment | `RequireRole([3,4,"HR_STAFF","ADMIN"])` |
| `/contracts/create` | Create contract | `RequireRole(["HR_STAFF","HR_MANAGER","ADMIN"])` |

## Notes

- Route guards are only UX boundary. Backend policy and scope enforcement remain the source of truth.
- Immediate access revocation is enforced server-side via `authzVersion` token invalidation.
