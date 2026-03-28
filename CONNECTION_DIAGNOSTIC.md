# Frontend-Backend Connection Diagnostic

## Quick Checklist

### 1. **Database Connection** ✓

- MongoDB URI: `mongodb://localhost:27017/hrms`
- Collection: `employees`
- Status: Check if MongoDB is running

### 2. **Backend Server**

```bash
cd backend
npm run dev
# Should output: Backend running at http://localhost:5000
```

### 3. **Frontend Server**

```bash
cd frontend
npm run dev
# Should output: Vite dev server at http://localhost:5173
```

---

## Connection Flow

### Frontend → Backend Request

```
1. Frontend: http://localhost:5173
2. Makes POST request to: http://localhost:5000/api/auth/login
3. Headers: Content-Type: application/json
4. Body: { email: "...", password: "..." }
```

### Backend Configuration

- **Port**: 5000 (from `backend/.env` PORT=5000)
- **CORS**: Enabled for http://localhost:5173
- **API Base**: `/api/*`
- **Auth Route**: `POST /api/auth/login`

### Frontend Configuration

- **API URL**: `http://localhost:5000/api` (from `frontend/.env`)
- **Endpoints**: Defined in `frontend/src/modules/identity/api.js`

---

## Test Credentials (After Running Seeder)

```
Email: superadmin@elketa.com
Password: emp123

Email: ahmad_cto@elketa.com
Password: emp123

Email: hala_hr@elketa.com
Password: emp123
```

---

## Testing Steps

### Step 1: Verify Backend is Running

```bash
# In terminal 1:
cd backend
npm run dev
# You should see: "Backend running at http://localhost:5000"
```

### Step 2: Verify MongoDB Connection

```bash
# Check if MongoDB is running on port 27017
# Should see in backend logs: "MongoDB connected mongodb://localhost:27017/hrms"
```

### Step 3: Seed Test Data

```bash
# In terminal 2:
cd backend
npm run seed
# Should see: "Seeding completed..."
```

### Step 4: Start Frontend

```bash
# In terminal 3:
cd frontend
npm run dev
# Should see: "Local: http://localhost:5173"
```

### Step 5: Test Login Flow

1. Navigate to http://localhost:5173/login
2. Open Browser DevTools (F12)
3. Go to the **Network** tab
4. Enter email: `superadmin@elketa.com`
5. Enter password: `emp123`
6. Click Sign In
7. **Watch the Network tab** for the POST request to `/api/auth/login`

---

## Common Issues & Solutions

### Issue 1: "Invalid credentials" Error

**Cause**: User doesn't exist in database
**Solution**:

- Run: `npm run seed` to populate test users
- Verify email is exact match (check for typos)

### Issue 2: "Cannot POST /api/auth/login"

**Cause**: Backend server not running or wrong port
**Solution**:

- Check backend is running on port 5000
- Check `.env` PORT setting
- Restart backend with `npm run dev`

### Issue 3: CORS Error in Browser Console

**Cause**: Frontend URL mismatch in backend config
**Solution**:

- Verify `backend/.env` has `FRONTEND_URL=http://localhost:5173`
- Restart backend after any `.env` changes

### Issue 4: "Cannot GET http://localhost:5000/api"

**Cause**: Frontend trying to reach backend directly
**Solution**: This is normal - only `/api/auth/login` (POST) is valid

### Issue 5: "MongoDB connection error"

**Cause**: MongoDB not running
**Solution**:

- Start MongoDB locally: Check if port 27017 is open
- Or use remote MongoDB: Update MONGO_URI in `.env`

---

## Debug Network Requests

### Browser DevTools Method

1. Open http://localhost:5173 in browser
2. Press **F12** to open DevTools
3. Click **Network** tab
4. Try to login
5. Click the **`login`** request in the Network tab
6. Check:
   - **Request Headers**: Authorization, Content-Type
   - **Request Body**: Should see email and password
   - **Response**: Should be `{ accessToken, refreshToken, user }`
   - **Status Code**: 200 for success, 401 for invalid credentials

### Backend Console Debug

- Backend logs all login attempts: `console.log("request data:", payload)`
- Check for error messages in backend console

---

## Verification Checklist

- [ ] MongoDB is running
- [ ] Backend running on http://localhost:5000
- [ ] Frontend running on http://localhost:5173
- [ ] `backend/.env` has correct settings:
  - `PORT=5000`
  - `FRONTEND_URL=http://localhost:5173`
  - `MONGO_URI=mongodb://localhost:27017/hrms`
  - `JWT_SECRET` and `JWT_REFRESH_SECRET` set
- [ ] `frontend/.env` has:
  - `VITE_API_URL=http://localhost:5000/api`
- [ ] Test users exist (ran `npm run seed`)
- [ ] Can login with `superadmin@elketa.com` / `emp123`

---

## Network Traffic Example (Successful Login)

```
REQUEST:
POST http://localhost:5000/api/auth/login
Content-Type: application/json

{
  "email": "superadmin@elketa.com",
  "password": "emp123"
}

RESPONSE (200 OK):
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "superadmin@elketa.com",
    "role": "ADMIN",
    "requirePasswordChange": false
  }
}
```

---

## Files Involved in Connection

### Backend

- `backend/src/index.js` - Server entry, CORS config
- `backend/.env` - Port, CORS origin, MongoDB URI
- `backend/src/routes/auth.js` - Login endpoint
- `backend/src/middleware/auth.js` - JWT token generation

### Frontend

- `frontend/.env` - API URL
- `frontend/src/modules/identity/api.js` - API calls
- `frontend/src/modules/identity/store.js` - Redux login logic
- `frontend/src/modules/identity/pages/LoginPage.jsx` - Login UI

---

## Next Steps

1. **Run the diagnostic** following the steps above
2. **Check the Network tab** for the actual error
3. **Share the error** from the Network response or browser console
4. **We'll fix it** based on the specific error message
