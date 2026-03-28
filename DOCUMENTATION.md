# 📋 توثيق مشروع إدارة الموارد البشرية

---

## 🎯 نظرة عامة على المشروع

مشروع **Full-Stack** لإدارة الموارد البشرية يتضمن:

- **Backend**: Node.js + Express + MongoDB
- **Frontend**: React + Vite + TailwindCSS + Redux

---

# 🔧 الـ BACKEND (الأهم)

## 📁 هيكل فولدرات Backend

```
backend/
├── src/
│   ├── index.js                    // نقطة البداية (Server Entry Point)
│   ├── seedUsers.js                // ملف البيانات الأولية
│   ├── config/
│   │   └── db.js                   // تكوين قاعدة البيانات MongoDB
│   ├── middleware/
│   │   ├── auth.js                 // التوثيق والـ JWT
│   │   ├── permissions.js          // الصلاحيات والتحكم بالوصول
│   │   ├── security.js             // الأمان (Headers, Rate Limiting)
│   │   └── validation.js           // التحقق من صحة البيانات (Validation)
│   ├── models/                     // Data Models (MongoDB Schemas)
│   │   ├── Employee.js             // موديل الموظف
│   │   ├── Department.js           // موديل القسم
│   │   ├── User.js                 // موديل المستخدم (للتسجيل)
│   │   ├── Permission.js           // موديل الصلاحيات
│   │   └── TokenBlacklist.js       // موديل الـ Tokens المحظورة (Logout)
│   └── routes/
│       ├── auth.js                 // مسارات المصادقة
│       ├── users.js                // مسارات إدارة المستخدمين
│       ├── employees.js            // مسارات الموظفين
│       ├── departments.js          // مسارات الأقسام
│       └── permissions.js          // مسارات الصلاحيات
├── package.json
├── README.md
└── SECURITY.md
```

---

## 🛣️ الـ Routes (المسارات المتاحة)

### 🔐 **1. Auth Routes** (`/api/auth`)

| Method   | المسار      | الوصف             | من يستطيع           |
| -------- | ----------- | ----------------- | ------------------- |
| **POST** | `/login`    | تسجيل الدخول      | الجميع              |
| **POST** | `/refresh`  | تحديث الـ Token   | المستخدمون المسجلون |
| **POST** | `/logout`   | تسجيل الخروج      | المستخدمون المسجلون |
| **POST** | `/register` | إنشاء مستخدم جديد | Admin فقط           |

---

### 👥 **2. Users Routes** (`/api/users`)

| Method   | المسار      | الوصف              | من يستطيع       |
| -------- | ----------- | ------------------ | --------------- |
| **GET**  | `/`         | قائمة المستخدمين   | Admin + HR Head |
| **PUT**  | `/:id/role` | تحديث دور المستخدم | Admin فقط       |
| **POST** | `/`         | إنشاء حساب تسجيل   | Admin فقط       |

---

### 🧑‍💼 **3. Employees Routes** (`/api/employees`)

| Method     | المسار | الوصف               | من يستطيع                  |
| ---------- | ------ | ------------------- | -------------------------- |
| **GET**    | `/`    | قائمة الموظفين      | جميع المستخدمين المسجلين   |
| **GET**    | `/:id` | تفاصيل موظف معين    | جميع المستخدمين المسجلين   |
| **POST**   | `/`    | إنشاء موظف جديد     | HR Staff + Manager + Admin |
| **PUT**    | `/:id` | تحديث بيانات الموظف | HR Staff + Manager + Admin |
| **DELETE** | `/:id` | حذف موظف            | Admin فقط                  |

**نظام الوصول:**

- ✅ **Admin**: رؤية جميع الموظفين ✏️ تعديل حذف
- ✅ **HR Staff**: رؤية جميع الموظفين ✏️ تعديل
- ✅ **Manager**: رؤية الموظفين في قسمه ✏️ تعديل
- ✅ **Employee**: رؤية ملفه الشخصي فقط

---

### 🏢 **4. Departments Routes** (`/api/departments`)

| Method     | المسار | الوصف              | من يستطيع       |
| ---------- | ------ | ------------------ | --------------- |
| **GET**    | `/`    | قائمة الأقسام      | جميع المستخدمين |
| **GET**    | `/:id` | تفاصيل قسم معين    | جميع المستخدمين |
| **POST**   | `/`    | إنشاء قسم جديد     | Admin فقط       |
| **PUT**    | `/:id` | تحديث بيانات القسم | Admin فقط       |
| **DELETE** | `/:id` | حذف قسم            | Admin فقط       |

---

### 🔑 **5. Permissions Routes** (`/api/permissions`)

| Method  | المسار                           | الوصف                       | من يستطيع |
| ------- | -------------------------------- | --------------------------- | --------- |
| **GET** | `/users/:userId/modules/:module` | الحصول على صلاحيات المستخدم | Admin فقط |
| **PUT** | `/users/:userId/modules/:module` | تحديث صلاحيات المستخدم      | Admin فقط |

---

### 👥 **6. Teams Routes** (`/api/teams`)

| Method     | المسار | الوصف               | من يستطيع                  |
| ---------- | ------ | ------------------- | -------------------------- |
| **GET**    | `/`    | قائمة الفرق         | جميع المستخدمين المسجلين   |
| **GET**    | `/:id` | تفاصيل فريق معين    | جميع المستخدمين المسجلين   |
| **POST**   | `/`    | إنشاء فريق جديد     | Admin فقط                  |
| **PUT**    | `/:id` | تحديث بيانات الفريق | Admin فقط                  |
| **DELETE** | `/:id` | حذف فريق            | Admin فقط                  |

---

### 📍 **7. Positions Routes** (`/api/positions`)

| Method     | المسار | الوصف               | من يستطيع                  |
| ---------- | ------ | ------------------- | -------------------------- |
| **GET**    | `/`    | قائمة الوظائف       | جميع المستخدمين المسجلين   |
| **GET**    | `/:id` | تفاصيل وظيفة معينة  | جميع المستخدمين المسجلين   |
| **POST**   | `/`    | إنشاء وظيفة جديدة   | Admin + HR Staff           |
| **PUT**    | `/:id` | تحديث بيانات الوظيفة| Admin + HR Staff           |
| **DELETE** | `/:id` | حذف وظيفة           | Admin فقط                  |

---

### 💼 **8. Employments Routes** (`/api/employments`)

| Method     | المسار                 | الوصف                     | من يستطيع                  |
| ---------- | ---------------------- | ------------------------- | -------------------------- |
| **POST**   | `/assign`              | تعيين موظف في وظيفة       | Admin + HR Staff           |
| **DELETE** | `/unassign`            | إزالة تعيين موظف          | Admin + HR Staff           |
| **GET**    | `/employee/:employeeId`| قائمة تعيينات موظف        | جميع المستخدمين المسجلين   |

---

### 📊 **9. Reports Routes** (`/api/reports`)

| Method     | المسار             | الوصف                     | من يستطيع                  |
| ---------- | ------------------ | ------------------------- | -------------------------- |
| **GET**    | `/summary`         | ملخص بيانات النظام        | Admin + HR Staff           |
| **GET**    | `/organizations`   | الهيكل التنظيمي للمنظمة   | Admin + HR Staff           |

---

## 📊 Collections (قاعدة البيانات MongoDB)

### 1️⃣ **Collection: Users** (المستخدمون)

```json
{
  "_id": ObjectId("..."),
  "email": "ahmed@company.com",
  "passwordHash": "bcrypt_hashed_password",
  "role": "ADMIN",  // EMPLOYEE, MANAGER, HR_STAFF, ADMIN
  "createdAt": ISODate("2025-01-15T10:30:00Z"),
  "updatedAt": ISODate("2025-01-15T10:30:00Z")
}
```

---

### 2️⃣ **Collection: Employees** (الموظفين)

```json
{
  "_id": ObjectId("..."),

  // معلومات شخصية
  "fullName": "أحمد محمد علي",
  "dateOfBirth": ISODate("1990-05-15T00:00:00Z"),
  "gender": "MALE",  // MALE, FEMALE, OTHER, PREFER_NOT_TO_SAY
  "maritalStatus": "MARRIED",  // SINGLE, MARRIED, DIVORCED, WIDOWED
  "nationality": "Egyptian",
  "idNumber": "30001011234569",
  "profilePicture": "https://...",

  // معلومات الاتصال
  "email": "ahmed.work@company.com",  // البريد المهني
  "workEmail": "ahmed@company.com",
  "phoneNumber": "+201001234567",
  "address": "القاهرة، مصر",
  "additionalContact": {
    "whatsapp": "+201001234567",
    "skype": "ahmed.m"
  },

  // تفاصيل الوظيفة
  "employeeCode": "EMP-0001",
  "position": "Software Developer",
  "department": "IT",
  "team": "Backend Development",
  "managerId": "ID_OF_MANAGER",
  "dateOfHire": ISODate("2020-06-01T00:00:00Z"),
  "employmentType": "FULL_TIME",  // FULL_TIME, PART_TIME, CONTRACTOR, TEMPORARY
  "workLocation": "Cairo Office",
  "status": "ACTIVE",  // ACTIVE, ON_LEAVE, TERMINATED, RESIGNED
  "onlineStorageLink": "https://drive.google.com/...",

  // التعليم والمهارات
  "education": [
    {
      "degree": "Bachelor's",
      "institution": "Cairo University",
      "year": "2015"
    }
  ],
  "trainingCourses": ["Node.js Advanced", "MongoDB Optimization"],
  "skills": {
    "technical": ["JavaScript", "Node.js", "MongoDB", "React"],
    "soft": ["Leadership", "Communication", "Problem Solving"]
  },
  "languages": [
    {
      "language": "Arabic",
      "proficiency": "NATIVE"
    },
    {
      "language": "English",
      "proficiency": "ADVANCED"
    }
  ],

  // الراتب والمزايا
  "financial": {
    "bankAccount": "1234567890",
    "baseSalary": 15000,
    "allowances": 2000,
    "socialSecurity": "SS12345678",
    "lastSalaryIncrease": ISODate("2024-01-15T00:00:00Z")
  },

  "id": "..."  // معرف يمكن للـ Frontend معالجته بسهولة
}
```

---

### 3️⃣ **Collection: Departments** (الأقسام)

```json
{
  "_id": ObjectId("..."),
  "name": "Information Technology",
  "head": "manager@company.com",  // بريد رئيس القسم
  "description": "IT Department",
  "type": "PERMANENT",  // PERMANENT, TEMPORARY, PROJECT
  "status": "ACTIVE",  // ACTIVE, INACTIVE, ARCHIVED
  "location": "Cairo Office",
  "budget": 500000,

  // الوظائف في القسم
  "positions": [
    {
      "title": "Software Developer",
      "level": "Junior"
    },
    {
      "title": "Software Developer",
      "level": "Senior"
    }
  ],

  // الفرق الفرعية
  "teams": [
    {
      "_id": ObjectId("..."),
      "name": "Backend Team",
      "manager": "backend-lead@company.com",
      "description": "Backend Development Team",
      "positions": [
        { "title": "Backend Developer", "level": "Senior" }
      ],
      "status": "ACTIVE"
    }
  ],

  // للهياكل التنظيمية المعقدة
  "parentDepartmentId": ObjectId("..."),  // إن كان تابع لقسم آخر

  "createdAt": ISODate("..."),
  "updatedAt": ISODate("..."),
  "id": "..."
}
```

---

### 4️⃣ **Collection: UserPermissions** (صلاحيات المستخدمين)

```json
{
  "_id": ObjectId("..."),
  "userId": "USER_ID",
  "module": "employees",  // employees, departments, contracts, etc.
  "actions": ["view", "create", "edit"],  // view, create, edit, delete, export
  "scope": "department",  // self, department, all
  "createdAt": ISODate("..."),
  "updatedAt": ISODate("...")
}
```

**أمثلة:**

- HR Head → employees module → scope: "all" → actions: ["view", "create", "edit", "delete", "export"]
- Manager → employees module → scope: "department" → actions: ["view", "edit"]
- Employee → employees module → scope: "self" → actions: ["view"]

---

### 5️⃣ **Collection: TokenBlacklist** (الـ Tokens المحظورة عند Logout)

```json
{
  "_id": ObjectId("..."),
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresAt": ISODate("2025-02-15T10:30:00Z")  // يُحذف تلقائياً (TTL Index)
}
```

---

## 🔐 نظام الأدوار (Roles)

| الرقم | الدور    | الصلاحيات                   |
| ----- | -------- | --------------------------- |
| **1** | EMPLOYEE | عرض ملفه الشخصي فقط         |
| **2** | MANAGER  | إدارة موظفي قسمه            |
| **3** | HR_STAFF | إدارة جميع الموظفين (بقيود) |
| **4** | ADMIN    | صلاحيات كاملة               |

---

---

# 🎨 الـ FRONTEND (React)

## 📄 الصفحات الموجودة

### **مجموعة الصفحات الرئيسية**

| المسار           | اسم الصفحة                 | الوصف                     | من يستطيع الدخول           |
| ---------------- | -------------------------- | ------------------------- | -------------------------- |
| `/login`         | **Login Page**             | صفحة تسجيل الدخول         | زوار بدون حساب             |
| `/`              | **Dashboard**              | الصفحة الرئيسية           | جميع المستخدمين            |
| `/organizations` | **Organization Structure** | الهيكل التنظيمي           | جميع المستخدمين            |
| `/admin/users`   | **Users Admin Page**       | إدارة المستخدمين والأدوار | Manager + HR_STAFF + Admin |

---

### **🧑‍💼 مجموعة الموظفين (Employees Module)**

#### الصفحات:

| المسار                        | الصفحة               | الوصف               | من يستطيع                  |
| ----------------------------- | -------------------- | ------------------- | -------------------------- |
| `/employees`                  | **Employees List**   | قائمة الموظفين      | الجميع                     |
| `/employees/create`           | **Create Employee**  | إضافة موظف جديد     | Manager + HR_STAFF + Admin |
| `/employees/:employeeId/edit` | **Edit Employee**    | تعديل بيانات الموظف | Manager + HR_STAFF + Admin |
| `/employees/:employeeId`      | **Employee Profile** | ملف تعريفي للموظف   | الجميع                     |

#### البيانات المتاحة:

- 📊 **API**: `/api/employees`
- 🗄️ **Store (Redux)**: `modules/employees/store.js`
- 🎨 **الـ Routes**: `modules/employees/routes.jsx`

---

### **🏢 مجموعة الأقسام (Departments Module)**

#### الصفحات:

| المسار                            | الصفحة                | الوصف              | من يستطيع    |
| --------------------------------- | --------------------- | ------------------ | ------------ |
| `/departments`                    | **Departments List**  | قائمة الأقسام      | الجميع       |
| `/departments/create`             | **Create Department** | إضافة قسم جديد     | Admin فقط ⚠️ |
| `/departments/:departmentId/edit` | **Edit Department**   | تعديل بيانات القسم | Admin فقط ⚠️ |

#### البيانات المتاحة:

- 📊 **API**: `/api/departments`
- 🗄️ **Store (Redux)**: `modules/departments/store.js`
- 🎨 **الـ Routes**: `modules/departments/routes.jsx`

---

### **💼 مجموعة التوظيف (Employments Module)**

#### الصفحات:

| المسار                | الصفحة                | الوصف                |
| --------------------- | --------------------- | -------------------- |
| `/employments/assign` | **Assign Employment** | تعيين موظف على وظيفة |

#### البيانات المتاحة:

- 📊 **API**: `/api/employments`
- 🗄️ **Store (Redux)**: `modules/employments/store.js`
- 🎨 **الـ Routes**: `modules/employments/routes.jsx`

---

### **📋 مجموعة العقود (Contracts Module)**

#### الصفحات:

| المسار              | الصفحة              | الوصف          |
| ------------------- | ------------------- | -------------- |
| `/contracts/create` | **Create Contract** | إنشاء عقد جديد |

#### البيانات المتاحة:

- 📊 **API**: `/api/contracts`
- 🗄️ **Store (Redux)**: `modules/contracts/store.js`
- 🎨 **الـ Routes**: `modules/contracts/routes.jsx`

---

### **🏛️ مجموعة الهوية (Identity Module)**

#### الصفحات:

| المسار            | الصفحة                    | الوصف                     |
| ----------------- | ------------------------- | ------------------------- |
| `/identity/login` | **Login Page (Identity)** | صفحة تسجيل الدخول البديلة |

#### البيانات المتاحة:

- 📊 **API**: `/api/identity`
- 🗄️ **Store (Redux)**: `modules/identity/store.js`
- 🎨 **الـ Routes**: `modules/identity/routes.jsx`

---

### **📍 مجموعة الوظائف (Positions Module)**

#### البيانات المتاحة:

- 📊 **API**: `/api/positions`
- 🗄️ **Store (Redux)**: `modules/positions/store.js`
- 🎨 **الـ Routes**: `modules/positions/routes.jsx`

---

### **🔑 مجموعة الصلاحيات (Permissions Module)**

#### البيانات المتاحة:

- 📊 **API**: `/api/permissions`

---

## 🏗️ هيكل Frontend

```
frontend/
├── src/
│   ├── main.jsx                      // Entry Point
│   ├── App.jsx                       // Main App Component
│   ├── app/
│   │   ├── providers/
│   │   │   └── AppProviders.jsx      // Redux + Global Providers
│   │   ├── router/
│   │   │   ├── AppRouter.jsx         // Router Config
│   │   │   └── routes.jsx            // All Routes Definition
│   │   └── store/
│   │       └── index.js              // Redux Configuration
│   ├── layouts/
│   │   ├── authLayout/               // Layout للصفحات المصادقة
│   │   └── dashboardLayout/          // Layout للـ Dashboard
│   ├── modules/                      // Feature Modules
│   │   ├── employees/
│   │   │   ├── api.js                // API Calls
│   │   │   ├── routes.jsx            // Module Routes
│   │   │   ├── store.js              // Redux Store
│   │   │   └── pages/                // صفحات الـ Module
│   │   ├── departments/              // نفس البنية
│   │   ├── employments/              // نفس البنية
│   │   ├── contracts/                // نفس البنية
│   │   ├── identity/                 // نفس البنية
│   │   ├── positions/                // نفس البنية
│   │   ├── permissions/              // نفس البنية
│   │   └── index.jsx                 // Export All Routes
│   ├── pages/
│   │   ├── login/
│   │   │   └── LoginPage.jsx
│   │   ├── dashboard/
│   │   │   └── DashboardPage.jsx
│   │   ├── admin/
│   │   │   └── UsersAdminPage.jsx
│   │   └── OrganizationStructure/
│   │       └── OrganizationStructurePage.jsx
│   ├── shared/                       // مشتركات جميع الـ Components
│   │   ├── api/
│   │   │   ├── fetchWithAuth.js      // Fetch مع الـ Authentication
│   │   │   └── mockApi.js            // Mock للاختبار
│   │   ├── components/               // Global Components
│   │   │   ├── DataTable.jsx
│   │   │   ├── Filters.jsx
│   │   │   ├── FormBuilder.jsx
│   │   │   ├── Layout.jsx
│   │   │   ├── Modal.jsx
│   │   │   ├── Pagination.jsx
│   │   │   ├── ToastProvider.jsx
│   │   │   └── ui/button.jsx
│   │   ├── hooks/
│   │   │   └── reduxHooks.js
│   │   ├── routing/
│   │   │   └── RequireRole.jsx       // Higher Order Component للصلاحيات
│   │   └── utils/
│   │       └── id.js
│   └── assets/
│       └── ...
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── eslint.config.js
└── package.json
```

---

## 🔄 تدفق البيانات (Data Flow)

```
Frontend (React)
  ↓
  → Components (صفحات، forms)
  ↓
  → Redux (State Management)
  ↓
  → API Call (fetch with Auth Token)
  ↓
  ← Backend (Express)
  ↓
  → Middleware (Auth, Validation, Permissions)
  ↓
  → Routes
  ↓
  → Models (MongoDB Query)
  ↓
  ← Response JSON
  ↓
  → Redux Store Update
  ↓
  → Re-render Components
```

---

## 🔒 نظام التوثيق والأمان

### **على Frontend:**

1. ✅ تخزين الـ Access Token و Refresh Token
2. ✅ Attach Token لكل Request (Authorization Header)
3. ✅ عند انتهاء Token، استخدم Refresh Token لطلب token جديد
4. ✅ حماية الروتس حسب الصلاحيات (RequireRole Component)

### **على Backend:**

1. ✅ التحقق من صحة الـ JWT Token
2. ✅ التحقق من صلاحيات المستخدم
3. ✅ تحديد النطاق (scope) - سواء كان الموظف في قسمه أم لا
4. ✅ إضافة Token للـ Blacklist عند Logout

---

## 📌 ملاحظات هامة

### ⚠️ **Permissions Pattern:**

- **Admin** و **HR Head**: صلاحيات كاملة
- **Managers**: يرون فقط موظفي قسمهم
- **Employees**: يرون إلا ملفهم الشخصي وملفات زملائهم

### ⚠️ **Collections Design:**

- كل موظف له بريد **فريد** (unique email)
- كل مستخدم مرتبط بموظف موجود
- الـ Department تحتوي على Teams متعددة

### ⚠️ **Status States:**

- **Employees**: ACTIVE, ON_LEAVE, TERMINATED, RESIGNED
- **Departments**: ACTIVE, INACTIVE, ARCHIVED
- **Teams**: ACTIVE, ARCHIVED

---

## 🚀 NextSteps (مستقبلاً)

- [ ] إضافة مجموعة الرواتب (Payroll Module)
- [ ] إضافة نظام الحضور (Attendance Module)
- [ ] إضافة نظام التوظيف (Recruitment Module)
- [ ] إضافة نظام الإجازات (Leave Management)
- [ ] إضافة التقارير المتقدمة (Advanced Reports)

---

**تم إعداد التوثيق بتاريخ:** `March 27, 2025`
