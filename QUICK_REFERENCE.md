# 🚀 Quick Reference Guide (مرجع سريع)

## 📍 الملفات الرئيسية

```
📁 backend/src/
├── 🚀 index.js                 → Server بدء التشغيل
├── 🌱 seedUsers.js            → بيانات أولية تجريبية
│
├── 📦 models/
│   ├── User.js                → المستخدم (email + password + role)
│   ├── Employee.js            → الموظف (بيانات شاملة من شخصية لمالية)
│   ├── Department.js          → القسم أو الإدارة
│   ├── Permission.js          → صلاحيات المستخدم المخصصة
│   └── TokenBlacklist.js      → قائمة tokens المحظورة (logout)
│
├── 🛡️ middleware/
│   ├── auth.js                → JWT و Password Hashing
│   ├── permissions.js         → التحكم بالصلاحيات حسب Role
│   ├── security.js            → Headers آمنة + Rate Limiting
│   └── validation.js          → التحقق من البيانات المدخلة
│
└── 🛣️ routes/
    ├── auth.js                → /api/auth (login, logout, refresh)
    ├── users.js               → /api/users (إدارة المستخدمين)
    ├── employees.js           → /api/employees (موظفين)
    ├── departments.js         → /api/departments (أقسام)
    └── permissions.js         → /api/permissions (صلاحيات)

📁 frontend/src/
├── 🔌 app/providers/
│   └── AppProviders.jsx       → Redux + Global Config
├── 🔀 app/router/
│   ├── AppRouter.jsx          → BrowserRouter Setup
│   └── routes.jsx             → كل الـ Routes
├── 🎭 layouts/
│   ├── authLayout/            → Login Page Layout
│   └── dashboardLayout/       → Dashboard Layout (Sidebar, Header)
├── 🏗️ modules/
│   ├── employees/             → الموظفين Module
│   ├── departments/           → الأقسام Module
│   ├── employments/           → التوظيف Module
│   ├── contracts/             → العقود Module
│   ├── positions/             → الوظائف Module
│   ├── permissions/           → الصلاحيات Module (API only)
│   └── identity/              → الهوية Module (Login)
├── 📄 pages/
│   ├── login/                 → صفحة Login
│   ├── dashboard/             → الصفحة الرئيسية
│   ├── admin/                 → إدارة المستخدمين
│   └── OrganizationStructure/ → الهيكل التنظيمي
└── 🌐 shared/
    ├── api/fetchWithAuth.js   → HTTP Client مع Auth
    ├── routing/RequireRole.jsx → حماية الصفحات بالأدوار
    └── components/            → جميع الـ Share Components
```

---

## 🎯 أسرع الطرق للقيام بـ Tasks الشائعة

### ✅ إضافة موظف جديد
1. ادخل صفحة `/employees/create`
2. ملأ الـ Form
3. اضغط Submit → POST `/api/employees`
4. موظف جديد يُضاف لـ MongoDB

### ✅ عرض قائمة الموظفين
1. انتقل لـ `/employees`
2. الصفحة تجلب بيانات من GET `/api/employees`
3. يعتمد العرض على:
   - **Admin**: يرى الجميع ✅
   - **HR**: يرى الجميع ✅
   - **Manager**: يرى موظفي قسمه فقط
   - **Employee**: يرى نفسه فقط

### ✅ تعديل ملف الموظف
1. انتقل لـ `/employees/:employeeId`
2. اضغط Edit
3. غير البيانات واضغط Save
4. PUT `/api/employees/:id` يتم التحديث

### ✅ إنشاء قسم جديد
1. **Admin فقط** يدخل `/departments/create`
2. ملأ البيانات (الاسم، رئيس القسم، الفرق، الوظائف)
3. اضغط Submit → POST `/api/departments`

### ✅ التحكم في أدوار المستخدمين
1. Admin يدخل `/admin/users`
2. اختر مستخدم
3. غير الـ Role (EMPLOYEE, MANAGER, HR_STAFF, ADMIN)
4. PUT `/api/users/:id/role` يحفظ التغيير

### ✅ إنشاء حساب جديد (User)
- **شرط أساسي**: يجب أن يكون هناك موظف بنفس البريد الإلكتروني أولاً
- 1. Admin يدخل `/admin/users`
- 2. اضغط "Create User"
- 3. ملأ: البريد، الكلمة المرورية، الـ Role
- 4. POST `/api/users` ينشئ الحساب
- المستخدم يستطيع الآن يسجل دخول

---

## 🔐 Roles & Permissions الكاملة

### 1️⃣ **EMPLOYEE (Role = 1)**
```
✅ يرى: ملفه الشخصي فقط
✅ يستطيع: عرض بيانات نفسه
❌ لا يستطيع: تعديل أو حذف أي شيء
```

### 2️⃣ **MANAGER (Role = 2)**
```
✅ يرى: موظفي القسم التابع له
✅ يستطيع: 
   - عرض موظفي قسمه
   - إضافة موظف جديد
   - تعديل موظفي قسمه
✅ يرى الأقسام: فقط القسم التابع له
❌ لا يستطيع: إنشاء/تعديل الأقسام
```

### 3️⃣ **HR_STAFF (Role = 3)**
```
✅ يرى: جميع الموظفين
✅ يستطيع:
   - عرض جميع الموظفين
   - إضافة موظف جديد
   - تعديل أي موظف
   - عرض جميع الأقسام
✅ في الأقسام: قراءة فقط
❌ لا يستطيع: إنشاء/تعديل الأقسام أو نظام الأدوار
```

### 4️⃣ **ADMIN (Role = 4)**
```
✅ يرى: كل شيء
✅ يستطيع:
   - إدارة جميع الموظفين (Create, Read, Update, Delete)
   - إدارة جميع الأقسام
   - إدارة جميع المستخدمين وأدوارهم
   - إدارة الصلاحيات المتقدمة
   - الوصول الكامل لكل النظام
```

---

## 🗂️ Collections Fields (المدخلات المتوفرة)

### **User Collection**
```javascript
{
  _id,
  email,           // unique
  passwordHash,    // bcrypt hashed
  role,            // 1,2,3,4 أو "EMPLOYEE","MANAGER","HR_STAFF","ADMIN"
  timestamps       // createdAt, updatedAt
}
```

### **Employee Collection**
```javascript
{
  // Personal
  fullName, dateOfBirth, gender, maritalStatus, nationality, idNumber, profilePicture,

  // Contact
  email (unique), workEmail, phoneNumber, address,
  additionalContact: { whatsapp, skype },

  // Job
  employeeCode (unique), position, department, team, managerId,
  dateOfHire, employmentType, workLocation,
  status: "ACTIVE|ON_LEAVE|TERMINATED|RESIGNED",

  // Education & Skills
  education: [{ degree, institution, year }],
  trainingCourses: [String],
  skills: { technical: [String], soft: [String] },
  languages: [{ language, proficiency: "BASIC|INTERMEDIATE|ADVANCED|NATIVE" }],

  // Financial
  financial: { bankAccount, baseSalary, allowances, socialSecurity, lastSalaryIncrease },

  // Metadata
  timestamps, id
}
```

### **Department Collection**
```javascript
{
  name (unique),
  head,            // email of manager
  description,
  type,            // "PERMANENT|TEMPORARY|PROJECT"
  status,          // "ACTIVE|INACTIVE|ARCHIVED"
  location,
  budget,
  positions: [{ title, level }],
  teams: [
    {
      name,
      manager,     // email
      description,
      positions: [{ title, level }],
      status      // "ACTIVE|ARCHIVED"
    }
  ],
  parentDepartmentId,  // for nested structure
  timestamps,
  id
}
```

---

## 🔄 Typical Workflows

### **Workflow 1: Employee Self-Service**
```
1. تسجيل الدخول → /login (email + password)
2. Dashboard → /
3. عرض ملفي الشخصي → /employees/:myId
4. عرض زملائي → /employees (لكن يرى القسم فقط)
```

### **Workflow 2: Manager Management**
```
1. تسجيل الدخول → /login
2. Dashboard → /
3. عرض فريقي → /employees (يرى فريقه فقط)
4. إضافة موظف جديد → /employees/create
5. تعديل موظف → /employees/:id/edit
6. عرض القسم → /departments (يرى قسمه فقط)
```

### **Workflow 3: HR Management**
```
1. تسجيل الدخول → /login
2. Dashboard → /
3. إدارة موظفين → /employees (يرى الجميع)
4. إضافة/تعديل موظف
5. عرض جميع الأقسام → /departments (قراءة فقط)
6. عرض الهيكل التنظيمي → /organizations
```

### **Workflow 4: Admin Full Control**
```
1. تسجيل الدخول → /login
2. Dashboard → /
3. إدارة موظفين → /employees (إضافة، تعديل، حذف)
4. إدارة أقسام → /departments (إضافة، تعديل، حذف)
5. إدارة مستخدمين → /admin/users (تعيين أدوار)
6. إنشاء حسابات جديدة
7. الهيكل التنظيمي → /organizations
```

---

## 🔗 API Endpoints Quick Reference

```
🔐 AUTH
POST   /api/auth/login
POST   /api/auth/refresh
POST   /api/auth/logout
POST   /api/auth/register

👤 USERS (Admin only)
GET    /api/users
PUT    /api/users/:id/role
POST   /api/users

👥 EMPLOYEES
GET    /api/employees         (Scoped by role)
GET    /api/employees/:id     (Scoped by role)
POST   /api/employees         (Manager+, HR, Admin)
PUT    /api/employees/:id     (Manager+, HR, Admin)
DELETE /api/employees/:id     (Admin only)

🏢 DEPARTMENTS
GET    /api/departments       (Scoped by role)
GET    /api/departments/:id   (Scoped by role)
POST   /api/departments       (Admin only)
PUT    /api/departments/:id   (Admin only)
DELETE /api/departments/:id   (Admin only)

🔑 PERMISSIONS
GET    /api/permissions/users/:userId/modules/:module
PUT    /api/permissions/users/:userId/modules/:module
```

---

## 🛠️ Debugging Tips

### **"Access Denied" / 403 Error**
- ✅ تحقق من الـ Role الخاص بك
- ✅ تحقق من أن البيانات (قسم، موظف) تتبعك
- ✅ Admin يستطيع فعل أي شيء

### **"Invalid Token" / 401 Error**
- ✅ تحقق من token في localStorage
- ✅ جرب logout ثم login مجدداً
- ✅ قد تكون الـ session منتهية

### **Employee لا يظهر**
- ✅ تحقق من Scope (قسمك؟)
- ✅ تحقق من Role الخاص بك
- ✅ Admin يرى الجميع

### **Department لا يظهر**
- ✅ تحقق من Role
- ✅ فقط Admin يستطيع إنشاء / تعديل
- ✅ قد لا تملك صلاحيات عرضه

---

## 📞 التواصل مع Developer

- **Backend Issues**: تحقق من Terminal console للـ Backend
- **Frontend Issues**: تحقق من Browser DevTools (Console, Network)
- **Database Issues**: تحقق من MongoDB Connection في `backend/src/config/db.js`

---

**آخر تحديث:** March 27, 2025
**الإصدار:** 1.0
