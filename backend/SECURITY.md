# Backend Security & Permissions Documentation

## Security Improvements

### 1. **Security Headers (Helmet)**

- Content Security Policy (CSP)
- HTTP Strict Transport Security (HSTS)
- X-Frame-Options, X-Content-Type-Options, etc.

### 2. **Rate Limiting**

- **General API**: 100 requests per 15 minutes
- **Authentication**: 5 attempts per hour for login
- **Sensitive Operations**: 10 requests per hour (create/update/delete)

### 3. **Input Validation**

- **express-validator**: Server-side validation with detailed error messages
- **Joi**: Schema-based validation for complex objects
- Password strength requirements (8+ chars, uppercase, lowercase, number)

### 4. **Enhanced Authentication**

- JWT access tokens (2-hour expiry)
- JWT refresh tokens (7-day expiry)
- Token blacklisting for logout
- Password hashing with bcrypt (12 salt rounds)

### 5. **CORS Configuration**

- Configurable frontend URL
- Proper headers for credentials
- Restricted methods and headers

## Authentication Endpoints

### Login

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "StrongPass123"
}
```

**Response:**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "role": 1
  }
}
```

### Refresh Token

```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "refresh_token_here"
}
```

### Logout

```http
POST /api/auth/logout
Authorization: Bearer access_token_here
```

### Change Password

```http
POST /api/auth/change-password
Authorization: Bearer access_token_here
Content-Type: application/json

{
  "currentPassword": "old_password",
  "newPassword": "NewStrongPass123"
}
```

## Permission System

### Permission Model

```typescript
interface IUserPermission {
  userId: string;
  module:
    | "recruitment"
    | "payroll"
    | "employees"
    | "departments";
  actions: ("view" | "create" | "edit" | "delete" | "approve" | "export")[];
  scope: "self" | "department" | "all";
}
```

### Role-Based Access Control (RBAC)

- **Role 1 (Employee)**: Limited access to own department data
- **Role 2 (Manager)**: Access to departments they manage
- **Role 3 (Admin)**: Full system access

### Permission-Based Access Control (PBAC)

Admins can assign granular permissions per user/module/action/scope.

### Permission Management Endpoints

#### Get User Permissions

```http
GET /api/permissions/{userId}
Authorization: Bearer admin_token
```

#### Create/Update Permission

```http
POST /api/permissions/{userId}
Authorization: Bearer admin_token
Content-Type: application/json

{
  "module": "employees",
  "actions": ["view", "edit"],
  "scope": "department"
}
```

#### Bulk Update Permissions

```http
PUT /api/permissions/{userId}
Authorization: Bearer admin_token
Content-Type: application/json

{
  "permissions": [
    {
      "module": "employees",
      "actions": ["view", "create"],
      "scope": "self"
    },
    {
      "module": "departments",
      "actions": ["view"],
      "scope": "all"
    }
  ]
}
```

#### Delete Permission

```http
DELETE /api/permissions/{userId}/{permissionId}
Authorization: Bearer admin_token
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Required
MONGODB_URI=mongodb://localhost:27017/hrms
JWT_SECRET=your-super-secret-jwt-key
JWT_REFRESH_SECRET=your-refresh-token-secret

# Optional
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

## Security Best Practices

1. **Use HTTPS in production**
2. **Generate strong JWT secrets**
3. **Regularly rotate refresh tokens**
4. **Monitor rate limiting logs**
5. **Validate all input on both client and server**
6. **Use environment variables for sensitive data**
7. **Keep dependencies updated**
8. **Implement proper logging and monitoring**

## Migration Notes

- **Token Format**: Now returns both access and refresh tokens
- **Password Requirements**: Enforced strong passwords
- **Rate Limiting**: May affect existing API clients
- **CORS**: More restrictive configuration
- **Validation**: Stricter input validation may reject some requests

## Testing Security

Use tools like:

- **Postman** for API testing
- **OWASP ZAP** for security scanning
- **JWT.io** for token inspection
- **MongoDB Compass** for database inspection
