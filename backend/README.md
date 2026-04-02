# Backend (Express + MongoDB)

This directory contains a minimal Express + TypeScript backend for the HRMS React app.

## Setup

1. Make sure MongoDB is running locally, or set `MONGO_URI` in `.env`.
2. Install dependencies:
   ```bash
   cd backend
   npm install
   ```
3. Create `.env` from template:
   ```bash
   cp .env.example .env
   ```
4. Start backend:
   ```bash
   npm run dev
   ```

## API endpoints

- `GET /api/health` - health check
- `POST /api/auth/login` - login (returns `{ token, user: { id, email, role } }`)
- `GET /api/departments` - list departments
- `GET /api/departments/:id` - get department
- `POST /api/departments` - create department
- `PUT /api/departments/:id` - update department
- `DELETE /api/departments/:id` - delete department

- `GET /api/employees` - list employees
- `GET /api/employees/:id` - get employee
- `POST /api/employees` - create employee
- `PUT /api/employees/:id` - update employee
- `DELETE /api/employees/:id` - delete employee

## Frontend integration (example)

Replace existing mock API paths in `src/modules/*/api.ts` with the above endpoints.

## Seed demo users

Run this to create example `Employee`/`Manager`/`Admin` users in MongoDB:

```bash
cd backend
npm run seed
```

Default demo credentials:
- Admin: `admin@hr.local` / `admin123` (role `3`)
- Manager: `manager@hr.local` / `manager123` (role `2`)
- Employee: `employee@hr.local` / `employee123` (role `1`)



<!-- cd backend
node scripts/seed-real-data.js
node scripts/seed-real-data.js --apply -->