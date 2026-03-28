# 📚 API Examples & Testing Guide

---

## 🔐 Authentication Examples

### 1️⃣ Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "ahmed@company.com",
    "password": "securePassword123"
  }'
```

**Response (Success):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "60f7b3a8c1d2e3f4g5h6i7j8",
    "email": "ahmed@company.com",
    "role": "ADMIN"
  }
}
```

### 2️⃣ Refresh Token
```bash
curl -X POST http://localhost:5000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }'
```

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### 3️⃣ Register User (Admin Only)
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "sara@company.com",
    "password": "newPassword456",
    "role": "HR_STAFF"
  }'
```

**Response:**
```json
{
  "message": "User created successfully",
  "user": {
    "id": "60f7b3a8c1d2e3f4g5h6i7j9",
    "email": "sara@company.com",
    "role": "HR_STAFF"
  }
}
```

### 4️⃣ Logout
```bash
curl -X POST http://localhost:5000/api/auth/logout \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Response:**
```json
{
  "message": "Logged out successfully"
}
```

---

## 👥 Employees Endpoints

### 📋 Get All Employees (Scoped)
```bash
curl -X GET http://localhost:5000/api/employees \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Response:**
```json
[
  {
    "id": "60f7b3a8c1d2e3f4g5h6i7j8",
    "fullName": "أحمد محمد علي",
    "email": "ahmed.work@company.com",
    "position": "Software Developer",
    "department": "IT",
    "status": "ACTIVE",
    "dateOfHire": "2020-06-01T00:00:00Z"
  },
  {
    "id": "60f7b3a8c1d2e3f4g5h6i7j9",
    "fullName": "نور الدين محمود",
    "email": "nour.work@company.com",
    "position": "Project Manager",
    "department": "IT",
    "status": "ACTIVE",
    "dateOfHire": "2019-03-15T00:00:00Z"
  }
]
```

### 📄 Get Single Employee
```bash
curl -X GET http://localhost:5000/api/employees/60f7b3a8c1d2e3f4g5h6i7j8 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Response:**
```json
{
  "id": "60f7b3a8c1d2e3f4g5h6i7j8",
  "fullName": "أحمد محمد علي",
  "dateOfBirth": "1990-05-15T00:00:00Z",
  "gender": "MALE",
  "maritalStatus": "MARRIED",
  "nationality": "Egyptian",
  "idNumber": "30001011234569",
  "profilePicture": "https://example.com/photo.jpg",
  "email": "ahmed.personal@gmail.com",
  "workEmail": "ahmed.work@company.com",
  "phoneNumber": "+201001234567",
  "address": "القاهرة، مصر",
  "additionalContact": {
    "whatsapp": "+201001234567",
    "skype": "ahmed.m"
  },
  "employeeCode": "EMP-0001",
  "position": "Senior Software Developer",
  "department": "IT",
  "team": "Backend Development",
  "managerId": "60f7b3a8c1d2e3f4g5h6i7j2",
  "dateOfHire": "2020-06-01T00:00:00Z",
  "employmentType": "FULL_TIME",
  "workLocation": "Cairo Office",
  "status": "ACTIVE",
  "onlineStorageLink": "https://drive.google.com/...",
  "education": [
    {
      "degree": "Bachelor's in Computer Science",
      "institution": "Cairo University",
      "year": "2015"
    }
  ],
  "trainingCourses": ["Node.js Advanced", "MongoDB Optimization", "Docker Fundamentals"],
  "skills": {
    "technical": ["JavaScript", "Node.js", "MongoDB", "React", "Docker"],
    "soft": ["Leadership", "Communication", "Problem Solving", "Team Work"]
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
  "financial": {
    "bankAccount": "1234567890",
    "baseSalary": 15000,
    "allowances": 2000,
    "socialSecurity": "SS12345678",
    "lastSalaryIncrease": "2024-01-15T00:00:00Z"
  }
}
```

### ➕ Create New Employee
```bash
curl -X POST http://localhost:5000/api/employees \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "فاطمة أحمد محمود",
    "email": "fatima.work@company.com",
    "department": "HR",
    "position": "HR Manager",
    "status": "ACTIVE",
    "employmentType": "FULL_TIME",
    "dateOfHire": "2023-01-15T00:00:00Z",
    "gender": "FEMALE",
    "maritalStatus": "SINGLE",
    "dateOfBirth": "1995-08-20T00:00:00Z",
    "nationality": "Egyptian",
    "phoneNumber": "+201001234568",
    "workLocation": "Cairo Office"
  }'
```

**Response (Created):**
```json
{
  "message": "Employee created successfully",
  "employee": {
    "id": "60f7b3a8c1d2e3f4g5h6i7k0",
    "fullName": "فاطمة أحمد محمود",
    "email": "fatima.work@company.com",
    "department": "HR",
    "position": "HR Manager",
    "status": "ACTIVE",
    "employmentType": "FULL_TIME",
    "dateOfHire": "2023-01-15T00:00:00Z"
  }
}
```

### ✏️ Update Employee
```bash
curl -X PUT http://localhost:5000/api/employees/60f7b3a8c1d2e3f4g5h6i7j8 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "position": "Lead Software Developer",
    "baseSalary": 18000,
    "allowances": 2500,
    "status": "ACTIVE"
  }'
```

**Response:**
```json
{
  "message": "Employee updated successfully",
  "employee": {
    "id": "60f7b3a8c1d2e3f4g5h6i7j8",
    "fullName": "أحمد محمد علي",
    "position": "Lead Software Developer",
    "financial": {
      "baseSalary": 18000,
      "allowances": 2500
    }
  }
}
```

### 🗑️ Delete Employee (Admin Only)
```bash
curl -X DELETE http://localhost:5000/api/employees/60f7b3a8c1d2e3f4g5h6i7j8 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Response:**
```json
{
  "message": "Employee deleted successfully"
}
```

---

## 🏢 Departments Endpoints

### 📋 Get All Departments (Scoped)
```bash
curl -X GET http://localhost:5000/api/departments \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Response:**
```json
[
  {
    "id": "60f7b3a8c1d2e3f4g5h6i7m0",
    "name": "Information Technology",
    "head": "manager@company.com",
    "description": "IT Department",
    "type": "PERMANENT",
    "status": "ACTIVE",
    "location": "Cairo Office",
    "budget": 500000,
    "positions": [
      { "title": "Software Developer", "level": "Junior" },
      { "title": "Software Developer", "level": "Senior" }
    ],
    "teams": [
      {
        "id": "60f7b3a8c1d2e3f4g5h6i7m1",
        "name": "Backend Team",
        "manager": "backend-lead@company.com",
        "status": "ACTIVE"
      }
    ]
  }
]
```

### 📄 Get Single Department
```bash
curl -X GET http://localhost:5000/api/departments/60f7b3a8c1d2e3f4g5h6i7m0 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Response:** (Same structure as above - full detail)

### ➕ Create Department (Admin Only)
```bash
curl -X POST http://localhost:5000/api/departments \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Human Resources",
    "head": "hr-manager@company.com",
    "description": "Human Resources Department",
    "type": "PERMANENT",
    "status": "ACTIVE",
    "location": "Cairo Office",
    "budget": 300000,
    "positions": [
      { "title": "HR Manager", "level": "Senior" },
      { "title": "HR Officer", "level": "Junior" }
    ],
    "teams": [
      {
        "name": "Recruitment Team",
        "manager": "recruitment-lead@company.com",
        "description": "Handles hiring and recruitment",
        "positions": [
          { "title": "Recruitment Officer", "level": "Junior" }
        ]
      }
    ]
  }'
```

**Response:**
```json
{
  "message": "Department created successfully",
  "department": {
    "id": "60f7b3a8c1d2e3f4g5h6i7m7",
    "name": "Human Resources",
    "head": "hr-manager@company.com",
    "status": "ACTIVE",
    "teams": [...]
  }
}
```

### ✏️ Update Department (Admin Only)
```bash
curl -X PUT http://localhost:5000/api/departments/60f7b3a8c1d2e3f4g5h6i7m0 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "head": "new-manager@company.com",
    "status": "ACTIVE",
    "budget": 600000
  }'
```

---

## 👤 Users Management Endpoints

### 📋 Get All Users (Admin Only)
```bash
curl -X GET http://localhost:5000/api/users \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Response:**
```json
[
  {
    "id": "60f7b3a8c1d2e3f4g5h6i7j8",
    "email": "ahmed@company.com",
    "role": "ADMIN"
  },
  {
    "id": "60f7b3a8c1d2e3f4g5h6i7j9",
    "email": "sara@company.com",
    "role": "HR_STAFF"
  }
]
```

### 🔄 Update User Role (Admin Only)
```bash
curl -X PUT http://localhost:5000/api/users/60f7b3a8c1d2e3f4g5h6i7j9/role \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "role": "MANAGER"
  }'
```

**Valid Roles:**
- `1` or `"EMPLOYEE"`
- `2` or `"MANAGER"`
- `3` or `"HR_STAFF"`
- `4` or `"ADMIN"`

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "60f7b3a8c1d2e3f4g5h6i7j9",
    "email": "sara@company.com",
    "role": "MANAGER"
  }
}
```

### ➕ Create User Account (Admin Only)
```bash
curl -X POST http://localhost:5000/api/users \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "email": "nour@company.com",
    "password": "securePassword789",
    "role": "MANAGER"
  }'
```

**Response:**
```json
{
  "message": "User created successfully",
  "user": {
    "id": "60f7b3a8c1d2e3f4g5h6i7k1",
    "email": "nour@company.com",
    "role": "MANAGER"
  }
}
```

---

## 🔑 Permissions Management

### 📖 Get User Permissions (Admin Only)
```bash
curl -X GET http://localhost:5000/api/permissions/users/60f7b3a8c1d2e3f4g5h6i7j9/modules/employees \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Response:**
```json
{
  "userId": "60f7b3a8c1d2e3f4g5h6i7j9",
  "module": "employees",
  "actions": ["view", "create", "edit"],
  "scope": "department"
}
```

### 🔐 Set User Permissions (Admin Only)
```bash
curl -X PUT http://localhost:5000/api/permissions/users/60f7b3a8c1d2e3f4g5h6i7j9/modules/employees \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "actions": ["view", "create", "edit", "delete"],
    "scope": "all"
  }'
```

**Valid Values:**
- **actions**: "view", "create", "edit", "delete", "export"
- **scope**: "self", "department", "all"

**Response:**
```json
{
  "message": "Permissions updated successfully",
  "permission": {
    "userId": "60f7b3a8c1d2e3f4g5h6i7j9",
    "module": "employees",
    "actions": ["view", "create", "edit", "delete"],
    "scope": "all"
  }
}
```

---

## 📝 Common Error Responses

### ❌ 401 Unauthorized
```json
{
  "error": "Invalid or expired token"
}
```
**Solution**: Refresh token or log in again

### ❌ 403 Forbidden
```json
{
  "error": "You do not have permission to access this resource"
}
```
**Solution**: Check your role and permissions

### ❌ 404 Not Found
```json
{
  "error": "Employee not found"
}
```
**Solution**: Check if the ID is correct

### ❌ 409 Conflict
```json
{
  "error": "Employee with this email already exists"
}
```
**Solution**: Use a different email

### ❌ 422 Unprocessable Entity
```json
{
  "error": "Validation failed",
  "details": "email must be a valid email address"
}
```
**Solution**: Fix input data according to validation rules

---

## 🧪 Testing with Frontend

### Using Fetch API
```javascript
// Login
const response = await fetch('http://localhost:5000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'ahmed@company.com', password: 'password' })
});

const data = await response.json();
const token = data.accessToken;

// Get Employees
const employeesResponse = await fetch('http://localhost:5000/api/employees', {
  method: 'GET',
  headers: { 'Authorization': `Bearer ${token}` }
});

const employees = await employeesResponse.json();
```

### Using Redux Store
```javascript
// In React component
import { useAppDispatch, useAppSelector } from '@/shared/hooks/reduxHooks';
import { getEmployees } from '@/modules/employees/store';

export function EmployeesList() {
  const dispatch = useAppDispatch();
  const employees = useAppSelector(state => state.employees.list);

  useEffect(() => {
    dispatch(getEmployees());
  }, [dispatch]);

  return (
    <ul>
      {employees.map(emp => (
        <li key={emp.id}>{emp.fullName}</li>
      ))}
    </ul>
  );
}
```

---

**Last Updated:** March 27, 2025 ✅
