# 🚀 Getting Started Guide (دليل البدء)

---

## 📋 متطلبات التشغيل

### على الجهاز الخاص بك يجب أن تكون مثبتة:
- ✅ **Node.js** (v16 أو أحدث) - [تحميل](https://nodejs.org/)
- ✅ **npm** أو **yarn** (يأتي مع Node.js)
- ✅ **MongoDB** (Local أو Cloud) - [تحميل](https://www.mongodb.com/try/download/community)
- ✅ **Git** (اختياري) - للـ Version Control

---

## ⚡ Quick Start (بداية سريعة)

### 1️⃣ Open Project Folder
```bash
cd "c:\Users\COMPUMARTS\OneDrive\Desktop\my-react-app"
```

### 2️⃣ Setup Backend

#### أ. انتقل لمجلد Backend
```bash
cd backend
```

#### ب. تثبيت الـ Dependencies
```bash
npm install
```

#### ج. إنشاء ملف `.env` (متغيرات البيئة)
```bash
# Create .env file
cat > .env << EOF
# Database
MONGODB_URI=mongodb://localhost:27017/hrms
NODE_ENV=development

# Server
PORT=5000
FRONTEND_URL=http://localhost:5173

# JWT Secrets (استخدم أي نص طويل)
JWT_ACCESS_SECRET=your_super_secret_access_token_key_here
JWT_REFRESH_SECRET=your_super_secret_refresh_token_key_here
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# HR Department Name
HR_DEPARTMENT_NAME=HR
EOF
```

#### د. شغّل MongoDB (إذا كان Local)
```bash
# على Windows (إذا كان مثبت)
mongod

# أو استخدم MongoDB Atlas (Cloud)
# فقط غير MONGODB_URI في .env
```

#### هـ. شغّل Backend Server
```bash
npm start
# أو للتطوير مع auto-restart
npm run dev
```

**النتيجة المتوقعة:**
```
Backend running at http://localhost:5000
Environment: development
Frontend URL: http://localhost:5173
```

---

### 3️⃣ Setup Frontend

#### أ. انتقل لمجلد Frontend (في Terminal جديد)
```bash
cd frontend
```

#### ب. تثبيت الـ Dependencies
```bash
npm install
```

#### ج. شغّل Development Server
```bash
npm run dev
```

**النتيجة المتوقعة:**
```
VITE v5.x.x  ready in xxx ms

➜  Local:   http://localhost:5173/
```

---

## 🧪 Testing التطبيق

### 1. افتح المتصفح
```
http://localhost:5173
```

### 2. جرب Login
```
Email: admin@company.com
Password: admin123
(هذه البيانات من seedUsers.js)
```

### 3. اعرض الصفحات
- ✅ Dashboard: `/`
- ✅ Employees: `/employees`
- ✅ Departments: `/departments`
- ✅ Admin Users: `/admin/users`

---

## 📦 Seeding البيانات الأولية

### تغذية النظام بـ بيانات تجريبية

#### أ. فقط شغّل الـ Seed Script
```bash
cd backend
npm run seed
```

**أو يدويّاً:**
```bash
node src/seedUsers.js
```

#### ب. البيانات التي تُضاف:

**Users:**
```
admin@company.com / admin123 → Role: ADMIN
manager@company.com / manager123 → Role: MANAGER
hr@company.com / hr123 → Role: HR_STAFF
employee@company.com / employee123 → Role: EMPLOYEE
```

**Employees:**
```
احمد محمد علي → IT Department
نور الدين محمود → IT Department
فاطمة احمد محمود → HR Department
علي محمود علي → Finance Department
```

**Departments:**
```
IT
HR
Finance
```

---

## 🔧 Configuration Files

### Backend Configuration

#### `.env` File
```
MONGODB_URI=mongodb://localhost:27017/hrms
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:5173
JWT_ACCESS_SECRET=super_secret_key
JWT_REFRESH_SECRET=super_secret_key
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
HR_DEPARTMENT_NAME=HR
```

#### `backend/package.json` Scripts
```json
{
  "scripts": {
    "start": "node src/index.js",
    "dev": "nodemon src/index.js",
    "seed": "node src/seedUsers.js"
  }
}
```

### Frontend Configuration

#### `frontend/vite.config.js`
```javascript
// تكوين Vite للتطوير والـ Build
```

#### `frontend/tailwind.config.js`
```javascript
// تكوين TailwindCSS للـ Styling
```

#### `frontend/eslint.config.js`
```javascript
// تكوين ESLint للـ Code Linting
```

---

## 🗄️ Database Setup

### Option 1: MongoDB Local (على جهازك)

#### Windows:
```bash
# تحميل من
https://www.mongodb.com/try/download/community

# أو عبر Chocolatey
choco install mongodb-community

# شغّل الخدمة
mongod

# أو في Terminal
"C:\Program Files\MongoDB\Server\{version}\bin\mongod.exe"
```

#### Linux:
```bash
sudo apt-get install -y mongodb
sudo systemctl start mongodb
```

#### macOS:
```bash
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

### Option 2: MongoDB Atlas (Cloud)

1. سجّل دخول: [mongodb.com/cloud/atlas](https://mongodb.com/cloud/atlas)
2. أنشئ Cluster جديد
3. احصل على Connection String:
   ```
   mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/hrms
   ```
4. علّمه في `.env`:
   ```
   MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/hrms
   ```

---

## 📊 MongoDB Collections Auto-Creation

عند تشغيل Backend، Collections تُنشأ تلقائيّاً:
- ✅ Users
- ✅ (Users - الموظفين)
- ✅ Departments
- ✅ UserPermissions
- ✅ TokenBlacklists

---

## 🛠️ NPM Commands Reference

### Backend Commands
```bash
# تثبيت الـ Dependencies
npm install

# تشغيل Server (Production)
npm start

# تشغيل Server مع Auto-Restart (Development)
npm run dev

# تحميل البيانات الأولية
npm run seed
```

### Frontend Commands
```bash
# تثبيت الـ Dependencies
npm install

# تشغيل Development Server
npm run dev

# Build للـ Production
npm run build

# Preview الـ Build
npm run preview

# التحقق من الـ Linting
npm run lint
```

---

## 🐛 Troubleshooting

### ❌ Backend لا يقرأ MongoDB
**المشكلة:**
```
Error: Failed to connect to database
```

**الحل:**
1. تأكد أن MongoDB شغّال:
   ```bash
   mongod
   ```
2. تحقق من الـ Connection String في `.env`:
   ```bash
   MONGODB_URI=mongodb://localhost:27017/hrms
   ```
3. أعد محاولة تشغيل Backend

---

### ❌ Frontend لا يستطيع التوصل بـ Backend
**المشكلة:**
```
CORS error or 404 not found
```

**الحل:**
1. تأكد أن Backend شغّال على `http://localhost:5000`
2. تحقق من `.env` في Backend:
   ```bash
   FRONTEND_URL=http://localhost:5173
   ```
3. افتح DevTools (F12) وتحقق من Console

---

### ❌ Node Modules ضخمة جداً
**المشكلة:**
```
npm install takes too long
```

**الحل:**
```bash
# استخدم npm ci بدلاً من install
npm ci

# أو استخدم yarn
yarn install
```

---

### ❌ Port 5000 مستخدم بالفعل
**المشكلة:**
```
Error: listen EADDRINUSE :::5000
```

**الحل:**
```bash
# غيّر الـ Port في .env
PORT=5001

# أو اقتل العملية الموجودة
# Windows:
netstat -ano | findstr :5000
taskkill /PID {PID} /F

# Mac/Linux:
lsof -i :5000
kill -9 {PID}
```

---

### ❌ Login لا يعمل
**المشكلة:**
```
Invalid credentials
```

**الحل:**
1. تأكد من تشغيل `npm run seed` لتحميل البيانات الأولية
2. جرب البريد والكلمة المرورية من seedUsers.js
3. تحقق من أن MongoDB تحتوي على البيانات:
   ```bash
   # استخدم MongoDB Compass أو mongosh
   use hrms
   db.users.find()
   ```

---

## 📊 Useful MongoDB Commands

### في MongoDB Shell (mongosh):
```javascript
// اختر قاعدة البيانات
use hrms

// عرض جميع الـ Collections
show collections

// عرض المستخدمين
db.users.find()

// عرض الموظفين
db.employees.find()

// حذف كل البيانات (لإعادة البدء)
db.dropDatabase()

// محسبة الموظفين
db.employees.countDocuments()
```

---

## 🔐 Security Notes

### ⚠️ أثناء التطوير:
- الـ JWT Secrets يمكن أن تكون أي نص
- CORS يقبل Frontend من أي مكان تقريباً
- Rate Limiting معطّل

### ✅ قبل Production:
- استخدم Secrets قوية جداً:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- استخدم HTTPS بدلاً من HTTP
- فعّل Rate Limiting
- أنشئ متغيرات البيئة الآمنة
- استخدم MongoDB Atlas بدلاً من Local

---

## 📚 الملفات المهمة للمراجعة

| الملف | الوصف |
|------|-------|
| [DOCUMENTATION.md](./DOCUMENTATION.md) | توثيق شامل للمشروع |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | البنية والـ Diagrams |
| [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) | مرجع سريع |
| [API_EXAMPLES.md](./API_EXAMPLES.md) | أمثلة API و cURL |
| [backend/.env](./backend/.env) | متغيرات البيئة |
| [frontend/vite.config.js](./frontend/vite.config.js) | تكوين Vite |

---

## 🎓 Next Steps

بعد التشغيل الأساسي:
1. ✅ استكشف الصفحات المختلفة
2. ✅ جرب إنشاء موظف جديد
3. ✅ غيّر الأدوار والصلاحيات
4. ✅ افتح DevTools وشاهد Network calls
5. ✅ اقرأ الـ Backend code لفهم الـ Logic

---

## 💡 Tips & Tricks

### عرض Database في GUI:
```bash
# استخدم MongoDB Compass
# تحميل من: https://www.mongodb.com/products/compass

# أو Mongo Express (Web UI)
npm install -g mongo-express
mongo-express
# ثم اذهب إلى http://localhost:8081
```

### Debug Backend:
```bash
# شغّل مع debugging
node --inspect src/index.js

# ثم افتح Chrome DevTools
chrome://inspect
```

### Restart سريع:
```bash
# Ctrl+C لإيقاف الخادم
# ثم:
npm run dev
```

---

## 📞 Support & Help

إذا واجهت مشاكل:
1. ✅ تحقق من [Troubleshooting](#-troubleshooting) أعلاه
2. ✅ اقرأ الـ Backend Console لرسائل الخطأ
3. ✅ افتح DevTools (F12) في المتصفح
4. ✅ تحقق من .env لأن القيم صحيحة

---

**Happy Coding! 🎉**

آخر تحديث: March 27, 2025
