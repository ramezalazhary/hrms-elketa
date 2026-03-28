# 📊 الهيكل البصري والمخططات

## 🏗️ Backend Project Tree

```
backend/
│
├── src/
│   ├── index.js                          ← 🚀 نقطة البداية (Server Configuration)
│   ├── seedUsers.js                      ← 🌱 ملف البيانات الأولية (Seed Script)
│   │
│   ├── config/
│   │   └── db.js                         ← 🔗 MongoDB Connection Configuration
│   │
│   ├── middleware/                       ← 🛡️ طبقة الفحوصات والتحقق
│   │   ├── auth.js                       ← 🔐 JWT Token Generation & Verification
│   │   │                                    (generateAccessToken, generateRefreshToken,
│   │   │                                     hashPassword, verifyPassword)
│   │   ├── permissions.js                ← 🔑 Role-based Access Control (RBAC)
│   │   ├── security.js                   ← 🔰 Security Headers & Rate Limiting
│   │   └── validation.js                 ← ✔️ Input Validation (Joi Schema)
│   │
│   ├── models/                           ← 📦 MongoDB Schemas (Collections)
│   │   ├── User.js                       ← 👤 User Model (Authentication)
│   │   │                                    Fields: email, passwordHash, role, timestamps
│   │   │
│   │   ├── Employee.js                   ← 👨‍💼 Employee Model (Core Data)
│   │   │                                    ├── Personal Info (fullName, DOB, gender, etc.)
│   │   │                                    ├── Contact Info (email, phone, address)
│   │   │                                    ├── Job Details (position, department, salary)
│   │   │                                    ├── Education & Skills (courses, languages)
│   │   │                                    └── Financial Info (salary, allowances)
│   │   │
│   │   ├── Department.js                 ← 🏢 Department Model (Organization)
│   │   │                                    ├── Department Info (name, head, description)
│   │   │                                    ├── Positions (list of job titles)
│   │   │                                    ├── Teams (nested teams within dept)
│   │   │                                    └── parentDepartmentId (recursive structure)
│   │   │
│   │   ├── Permission.js                 ← 🔐 UserPermission Model (Granular Access Control)
│   │   │                                    Fields: userId, module, actions, scope
│   │   │                                    Modules: employees, departments, contracts
│   │   │                                    Actions: view, create, edit, delete, export
│   │   │                                    Scopes: self, department, all
│   │   │
│   │   └── TokenBlacklist.js             ← 🚫 Blacklist Model (Token Invalidation on Logout)
│   │                                        Auto-TTL Index for cleanup
│   │
│   └── routes/                           ← 🛣️ API Endpoints (Grouped by Feature)
│       ├── auth.js                       ← /api/auth/
│       │                                    ├── POST /login (authenticate)
│       │                                    ├── POST /refresh (token refresh)
│       │                                    ├── POST /logout (blacklist token)
│       │                                    └── POST /register (create user)
│       │
│       ├── users.js                      ← /api/users/
│       │                                    ├── GET / (list users)
│       │                                    ├── PUT /:id/role (update role)
│       │                                    └── POST / (create user account)
│       │
│       ├── employees.js                  ← /api/employees/
│       │                                    ├── GET / (list with scope filtering)
│       │                                    ├── GET /:id (detail with permissions)
│       │                                    ├── POST / (create new employee)
│       │                                    ├── PUT /:id (update employee)
│       │                                    └── DELETE /:id (soft delete)
│       │
│       ├── departments.js                ← /api/departments/
│       │                                    ├── GET / (list with role filtering)
│       │                                    ├── GET /:id (detail)
│       │                                    ├── POST / (admin only)
│       │                                    ├── PUT /:id (admin only)
│       │                                    └── DELETE /:id (admin only)
│       │
│       └── permissions.js                ← /api/permissions/
│                                            ├── GET /users/:userId/modules/:module
│                                            └── PUT /users/:userId/modules/:module
│
├── package.json
├── README.md
└── SECURITY.md
```

---

## 🎨 Frontend Project Tree

```
frontend/
│
├── src/
│   ├── main.jsx                          ← 🎯 React Entry Point (Vite)
│   ├── App.jsx                           ← 🏗️ Main App Component
│   ├── App.css
│   ├── index.css                         ← 🎨 Global Styles
│   │
│   ├── app/
│   │   ├── providers/
│   │   │   └── AppProviders.jsx          ← 🔌 Global Providers Setup
│   │   │                                    (Redux Provider, Toast, etc.)
│   │   │
│   │   ├── router/
│   │   │   ├── AppRouter.jsx             ← 🔀 Router Configuration (BrowserRouter)
│   │   │   └── routes.jsx                ← 📋 All Routes Definition
│   │   │                                    ├── Auth Layout (/ /login)
│   │   │                                    └── Dashboard Layout (/employees, etc.)
│   │   │
│   │   └── store/
│   │       └── index.js                  ← 📦 Redux Store Configuration
│   │
│   ├── layouts/                          ← 🎭 Layout Components
│   │   ├── authLayout/
│   │   │   └── AuthLayout.jsx            ← 🔐 Layout for Login, Register Pages
│   │   │
│   │   └── dashboardLayout/
│   │       └── DashboardLayout.jsx       ← 📊 Layout for Protected Pages
│   │                                        (Sidebar, Header, Footer)
│   │
│   ├── modules/                          ← 🏗️ Feature Modules (Organizational)
│   │   │
│   │   ├── employees/                    ← 👥 Employees Module
│   │   │   ├── api.js                    ← API Calls to /api/employees
│   │   │   │                                (getEmployees, getEmployee, createEmployee, etc.)
│   │   │   │
│   │   │   ├── routes.jsx                ← Module Routes
│   │   │   │                                ├── GET /employees (list)
│   │   │   │                                ├── GET /employees/:id (detail)
│   │   │   │                                ├── POST /employees/create (create form)
│   │   │   │                                └── PUT /employees/:id/edit (edit form)
│   │   │   │
│   │   │   ├── store.js                  ← Redux Slices (State Management)
│   │   │   │                                (actions: getEmployees, selectEmployee, etc.)
│   │   │   │
│   │   │   └── pages/
│   │   │       ├── EmployeesListPage.jsx    ← 📋 List View
│   │   │       ├── EmployeeProfilePage.jsx  ← 👤 Profile View
│   │   │       ├── CreateEmployeePage.jsx   ← ➕ Create Form
│   │   │       └── EditEmployeePage.jsx     ← ✏️ Edit Form
│   │   │
│   │   ├── departments/                  ← 🏢 Departments Module (Same structure)
│   │   │   ├── api.js
│   │   │   ├── routes.jsx
│   │   │   ├── store.js
│   │   │   └── pages/
│   │   │       ├── DepartmentsListPage.jsx
│   │   │       ├── CreateDepartmentPage.jsx
│   │   │       └── EditDepartmentPage.jsx
│   │   │
│   │   ├── employments/                  ← 💼 Employments Module
│   │   │   ├── api.js
│   │   │   ├── routes.jsx
│   │   │   ├── store.js
│   │   │   └── pages/
│   │   │       └── AssignEmploymentPage.jsx
│   │   │
│   │   ├── contracts/                    ← 📄 Contracts Module
│   │   │   ├── api.js
│   │   │   ├── routes.jsx
│   │   │   ├── store.js
│   │   │   └── pages/
│   │   │       └── CreateContractPage.jsx
│   │   │
│   │   ├── identity/                     ← 🔐 Identity Module
│   │   │   ├── api.js
│   │   │   ├── routes.jsx
│   │   │   ├── store.js
│   │   │   └── pages/
│   │   │       └── LoginPage.jsx
│   │   │
│   │   ├── positions/                    ← 📍 Positions Module
│   │   │   ├── api.js
│   │   │   ├── routes.jsx
│   │   │   └── store.js
│   │   │
│   │   ├── permissions/                  ← 🔑 Permissions Module (Read-only API)
│   │   │   └── api.js
│   │   │
│   │   └── index.jsx                     ← Export all module routes
│   │                                        (coreModuleRoutes)
│   │
│   ├── pages/                            ← 📄 Standalone Pages (Non-modular)
│   │   ├── login/
│   │   │   └── LoginPage.jsx             ← 🔓 Login Page
│   │   │
│   │   ├── dashboard/
│   │   │   └── DashboardPage.jsx         ← 📊 Dashboard Home
│   │   │
│   │   ├── admin/
│   │   │   └── UsersAdminPage.jsx        ← 👨‍⚙️ Admin Users Management
│   │   │                                     (Create accounts, Manage roles)
│   │   │
│   │   └── OrganizationStructure/
│   │       └── OrganizationStructurePage.jsx ← 🏗️ Org Chart Visualization
│   │
│   ├── shared/                           ← 🌐 Shared Resources
│   │   ├── api/
│   │   │   ├── fetchWithAuth.js          ← 🔐 HTTP Client with Token Injection
│   │   │   │                                (Auto-adds Authorization header)
│   │   │   │                                (Handles token refresh on 401)
│   │   │   │
│   │   │   └── mockApi.js                ← 🎭 Mock API for Testing
│   │   │
│   │   ├── components/                   ← 🧩 Reusable UI Components
│   │   │   ├── DataTable.jsx             ← 📊 Tabular Data Display
│   │   │   ├── Filters.jsx               ← 🔍 Filter Controls
│   │   │   ├── FormBuilder.jsx           ← 📝 Dynamic Form Generator
│   │   │   ├── Layout.jsx                ← 🎨 Layout Wrapper
│   │   │   ├── Modal.jsx                 ← 💬 Modal Dialog
│   │   │   ├── Pagination.jsx            ← 📖 Pagination Controls
│   │   │   ├── ToastProvider.jsx         ← 🔔 Toast Notifications
│   │   │   └── ui/
│   │   │       └── button.jsx            ← 🔘 Reusable Button Component
│   │   │
│   │   ├── hooks/
│   │   │   └── reduxHooks.js             ← 🪝 Custom Redux Hooks
│   │   │                                    (useAppDispatch, useAppSelector)
│   │   │
│   │   ├── routing/
│   │   │   └── RequireRole.jsx           ← 🔐 HOC for Role-based Access
│   │   │                                    (ProtectedComponent wrapper)
│   │   │
│   │   └── utils/
│   │       └── id.js                     ← 🆔 ID Generation Utility
│   │
│   └── assets/
│       └── ...                           ← 📦 Images, Icons, etc.
│
├── components.json                       ← ⚙️ Component Library Config
├── eslint.config.js                      ← ✅ Linter Configuration
├── postcss.config.js                     ← 🎨 PostCSS Configuration (for Tailwind)
├── tailwind.config.js                    ← 🎨 Tailwind CSS Configuration
├── vite.config.js                        ← ⚡ Vite Configuration
├── index.html                            ← 📄 HTML Entry Point
├── package.json                          ← 📦 Dependencies
├── README.md                             ← 📖 Documentation
└── public/                               ← 🖼️ Static Files
```

---

## 🔄 Data Flow Architecture

### **User Authentication Flow:**
```
┌────────────────────────────────────────────────────────────┐
│ LOGIN PAGE (React)                                         │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
        ┌──────────────────────────┐
        │ Redux Dispatch           │
        │ (loginAsync Action)      │
        └──────────┬───────────────┘
                   │
                   ▼
┌────────────────────────────────────────────────────────────┐
│ POST /api/auth/login                                       │
│ Body: { email, password }                                  │
│ Backend: verify email → hash password → check DB          │
│ Response: { accessToken, refreshToken, user }             │
└────────────┬───────────────────────────────────────────────┘
             │
             ▼
    ┌─────────────────────┐
    │ Store Tokens        │
    │ localStorage        │
    └──────────┬──────────┘
             │
             ▼
    ┌─────────────────────┐
    │ Set User in Redux   │
    │ Redirect to /       │
    └─────────────────────┘
```

### **Protected Route Access:**
```
┌────────────────────────────────────────────┐
│ User navigates to /employees               │
└────────────┬───────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────┐
│ RequireRole HOC                            │
│ Check: user.role in allowed roles?         │
└────────────┬───────────────────────────────┘
             │
    ┌────────┴────────┐
    │                 │
    ▼                 ▼
 ✅ YES            ❌ NO
 │                  │
 │                  ▼
 │          Redirect to /login
 │
 ▼
┌────────────────────────────────────────────┐
│ Render EmployeesListPage                   │
│ useSelector: employees from Redux          │
│ useEffect: fetch employees on mount        │
└────────────┬───────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────┐
│ fetchWithAuth('/api/employees')            │
│ • Get token from localStorage              │
│ • Attach Authorization header              │
│ • Send GET request                         │
└────────────┬───────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────┐
│ Backend: GET /api/employees                │
│ • Verify JWT                               │
│ • Check permissions (scope)                │
│ • Filter based on user role                │
│ • Return filtered list                     │
└────────────┬───────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────┐
│ Update Redux State                         │
│ Re-render component with data              │
│ Display employees table                    │
└────────────────────────────────────────────┘
```

### **Permissions Model:**
```
┌─────────────────────────────────────────────────────────────┐
│ USER REQUEST (GET /api/employees)                           │
└─────────┬───────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│ Backend: resolveEmployeeAccess(user)                        │
└─────────┬───────────────────────────────────────────────────┘
          │
    ┌─────┴────┬──────────┬──────────┐
    │          │          │          │
    ▼          ▼          ▼          ▼
 ROLE=3    ROLE=2     HR HEAD   EMPLOYEE
 (ADMIN)   (MANAGER)  (HR)      (ROLE=1)
    │          │          │          │
    ▼          ▼          ▼          ▼
  SCOPE:    SCOPE:     SCOPE:    SCOPE:
  "all"     "dept"     "all"     "self"
    │          │          │          │
    └──────────┴──────────┴──────────┘
               │
               ▼
    ┌────────────────────────┐
    │ Filter DB Query by:    │
    │ • Scope                │
    │ • Department           │
    │ • Email                │
    └────────┬───────────────┘
             │
             ▼
   RETURN SCOPED DATA
```

---

## 📊 Entity Relationship Diagram

```
┌──────────────────┐         ┌──────────────────┐
│      User        │         │    Employee      │
├──────────────────┤         ├──────────────────┤
│ _id (PK)         │────────▶│ _id (PK)         │
│ email (unique)   │         │ email (unique)   │
│ passwordHash     │         │ fullName         │
│ role             │◀────────│ department       │
│ timestamps       │         │ position         │
└──────────────────┘         └──────────────────┘
         ▲                            ▲
         │                            │
    1:1 Rel.                     1:Many Rel.
         │                            │
         │                            │
┌──────────────────────┐    ┌──────────────────┐
│   TokenBlacklist     │    │    Department    │
├──────────────────────┤    ├──────────────────┤
│ _id (PK)             │    │ _id (PK)         │
│ token                │    │ name (unique)    │
│ expiresAt (TTL)      │    │ head (REF User)  │
└──────────────────────┘    │ teams (array)    │
                            │ positions[]      │
                            └──────────────────┘
                                     ▲
                                     │
                              1:Many Rel.
                                     │
                               ┌──────────────────┐
                               │ UserPermission   │
                               ├──────────────────┤
                               │ _id (PK)         │
                               │ userId (REF)     │
                               │ module           │
                               │ actions[]        │
                               │ scope            │
                               └──────────────────┘
```

---

## 🔐 Role-Based Access Control Matrix

```
┌───────────────┬──────────┬──────────┬──────────────┬────────┐
│ Action        │ EMPLOYEE │ MANAGER  │ HR_STAFF     │ ADMIN  │
├───────────────┼──────────┼──────────┼──────────────┼────────┤
│ View Dept.    │ Own Dept │ Own Depts│ All Depts    │ All    │
│ Create Dept.  │ ❌       │ ❌       │ ❌           │ ✅     │
│ Edit Dept.    │ ❌       │ ❌       │ ❌           │ ✅     │
│ Delete Dept.  │ ❌       │ ❌       │ ❌           │ ✅     │
├───────────────┼──────────┼──────────┼──────────────┼────────┤
│ View Employee │ Own Prof │ Dept Emp │ All Emp      │ All    │
│ Create Emp.   │ ❌       │ ✅       │ ✅           │ ✅     │
│ Edit Employee │ ❌       │ Dept Emp │ All Emp      │ ✅     │
│ Delete Emp.   │ ❌       │ ❌       │ ❌           │ ✅     │
├───────────────┼──────────┼──────────┼──────────────┼────────┤
│ View Users    │ ❌       │ ❌       │ HR Users Only│ All    │
│ Create User   │ ❌       │ ❌       │ HR Users     │ ✅     │
│ Edit User     │ ❌       │ ❌       │ ❌           │ ✅     │
│ Delete User   │ ❌       │ ❌       │ ❌           │ ✅     │
├───────────────┼──────────┼──────────┼──────────────┼────────┤
│ Manage Perms. │ ❌       │ ❌       │ ❌           │ ✅     │
└───────────────┴──────────┴──────────┴──────────────┴────────┘
```

---

## 🔌 API Endpoints Summary

```
┌────────────────────────────────────────────────────────────┐
│ AUTHENTICATION ROUTES                                      │
├────────────────────────────────────────────────────────────┤
│ POST   /api/auth/login             → Get tokens            │
│ POST   /api/auth/refresh           → Refresh access token  │
│ POST   /api/auth/logout            → Blacklist token       │
│ POST   /api/auth/register          → Create user           │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│ USER MANAGEMENT ROUTES                                     │
├────────────────────────────────────────────────────────────┤
│ GET    /api/users                  → List users (admin)    │
│ PUT    /api/users/:id/role         → Update role           │
│ POST   /api/users                  → Create user account   │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│ EMPLOYEE ROUTES                                            │
├────────────────────────────────────────────────────────────┤
│ GET    /api/employees              → List (with filtering) │
│ GET    /api/employees/:id          → Get detail            │
│ POST   /api/employees              → Create               │
│ PUT    /api/employees/:id          → Update               │
│ DELETE /api/employees/:id          → Delete               │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│ DEPARTMENT ROUTES                                          │
├────────────────────────────────────────────────────────────┤
│ GET    /api/departments            → List (with filtering) │
│ GET    /api/departments/:id        → Get detail            │
│ POST   /api/departments            → Create (admin only)   │
│ PUT    /api/departments/:id        → Update (admin only)   │
│ DELETE /api/departments/:id        → Delete (admin only)   │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│ PERMISSION ROUTES                                          │
├────────────────────────────────────────────────────────────┤
│ GET    /api/permissions/users/:userId/modules/:module      │
│ PUT    /api/permissions/users/:userId/modules/:module      │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│ OTHER MODULES (Stubs)                                      │
├────────────────────────────────────────────────────────────┤
│ /api/employments                   → (Future)              │
│ /api/contracts                     → (Future)              │
│ /api/positions                     → (Future)              │
└────────────────────────────────────────────────────────────┘
```

---

**آخر تحديث:** March 27, 2025 ✅
