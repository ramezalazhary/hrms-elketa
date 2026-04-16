# Home/Dashboard Mode-Role Contract

This document is the UI behavior contract for `Home`, `Dashboard`, and sidebar visibility.

## Core Rules

- `Home` is always personal for all roles.
- `Dashboard` is always management-focused.
- `Dashboard` route remains protected by access control (`RequireDashboardAccess`).
- `Personal mode` shows personal navigation only.
- `Management mode` shows management navigation according to access levels.

## Page Behavior Matrix

| Role | Home (`/`) | Dashboard (`/dashboard`) |
| --- | --- | --- |
| EMPLOYEE | Personal experience only | Access only when `canAccessDashboardPage` is granted; otherwise blocked by route guard |
| TEAM_LEADER | Personal experience only | Management experience (team-focused) |
| MANAGER | Personal experience only | Management experience (department-focused) |
| HR / HR_STAFF / HR_MANAGER | Personal experience only | Management experience (operations and summaries) |
| ADMIN | Personal experience only | Full management experience |

## Sidebar Matrix

### Personal Mode

- Visible: `Home`, `Time off`
- Hidden: management links/groups (`Dashboard`, organizations, HR operations, admin links)

### Management Mode

- `Dashboard` visible when `canAccessDashboardPage` is true
- Management links/groups are shown only by access checks in `accessControl`
- Route guards remain the source of truth for direct URL access

## UX Intent

- Keep `Home` calm, direct, and personally relevant.
- Keep management operations centralized under `Dashboard`.
- Avoid role surprises by using predictable page meaning, independent of temporary mode toggles.
