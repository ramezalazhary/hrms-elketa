# Excel Import Guide - Attendance

## ✅ What's Fixed

The Excel import now:

- ✓ Accepts **flexible column names** (case-insensitive)
- ✓ Provides **detailed error messages** showing exactly which rows failed and why
- ✓ Handles **multiple date formats** (Excel serial dates and text)
- ✓ Supports **both employee code and email** for employee lookup
- ✓ Better **data validation** and **error reporting**

---

## 📋 Required Column Names

Your Excel file MUST have these columns (any of the alternative names work):

### Column 1: Employee Identifier

| Name              | Alternative Names                               |
| ----------------- | ----------------------------------------------- |
| **Employee Code** | `employee`, `code`, `emp code`, `employee_code` |
| Example: `EMP001` | Can also use email: `admin@company.com`         |

### Column 2: Date

| Name                                 | Alternative Names                    |
| ------------------------------------ | ------------------------------------ |
| **Date**                             | `attendance date`, `attendance_date` |
| Example: `2026-03-25` or `3/25/2026` | Excel dates work too                 |

### Column 3: Check-in Time

| Name                           | Alternative Names                                           |
| ------------------------------ | ----------------------------------------------------------- |
| **Check In**                   | `check-in`, `checkin`, `clock in`, `clock_in`, `start time` |
| Example: `08:30` or `08:30:00` | Can be `08:30 AM` format                                    |

### Column 4: Check-out Time

| Name                          | Alternative Names                                             |
| ----------------------------- | ------------------------------------------------------------- |
| **Check Out**                 | `check-out`, `checkout`, `clock out`, `clock_out`, `end time` |
| Example: `17:00` or `5:00 PM` | 24-hour or 12-hour format                                     |

---

## 📁 Example Excel Format

```
| Employee Code | Date       | Check In | Check Out |
|---|---|---|---|
| EMP001        | 2026-03-25 | 08:30    | 17:00     |
| EMP002        | 2026-03-25 | 09:05    | 17:30     |
| EMP003        | 2026-03-25 | 08:45    | 17:15     |
| admin@elketa.com | 2026-03-25 | 08:00 | 17:00     |
```

---

## 🚀 How to Use

### Step 1: Download Sample File (Optional)

```bash
cd backend
node generateSampleExcel.js
# Creates: backend/src/SampleAttendance.xlsx
```

### Step 2: Upload File

1. Open frontend: **http://localhost:5173**
2. Navigate to **Attendance** module
3. Click **Import Excel**
4. Select your `.xlsx` file
5. Choose: **Overwrite existing records?** (Yes/No)
6. Click **Upload**

### Step 3: Check Results

You'll see a response like:

```json
{
  "message": "✓ Import complete. 8 records processed successfully.",
  "summary": {
    "total": 10,
    "success": 8,
    "failed": 2,
    "skipped": 2
  },
  "records": [
    {
      "code": "EMP001",
      "date": "Tue Mar 25 2026",
      "status": "PRESENT",
      "hours": 8.5
    },
    {
      "code": "EMP002",
      "date": "Tue Mar 25 2026",
      "status": "PRESENT",
      "hours": 8.42
    }
  ],
  "errors": [
    "Row 5: Employee Code is empty",
    "Row 7: Invalid date format \"3/99/2026\" for employee EMP003. Use YYYY-MM-DD"
  ]
}
```

---

## ❌ Common Errors & Fixes

### Error: "Missing required columns: Employee Code"

**Cause**: Column name doesn't match any accepted name  
**Fix**: Use one of: `Employee Code`, `employee`, `code`, `emp code`, or `employee_code`

### Error: "Employee with code 'EMP001' not found"

**Cause**: Employee doesn't exist in database  
**Fix**:

1. Run seed first: `npm run seed` (in backend)
2. Use correct employee code that exists
3. Or use employee email instead

### Error: "Invalid date format"

**Cause**: Date format not recognized  
**Fix**: Use `YYYY-MM-DD` format or let Excel handle dates naturally

### Error: "Invalid time format"

**Cause**: Time format incorrect  
**Fix**: Use `HH:MM` or `HH:MM:SS` format (24-hour or 12-hour with AM/PM)

### Error: "Record already exists"

**Cause**: Record for this employee on this date already exists  
**Fix**:

- Check "Overwrite existing records" checkbox, OR
- Delete existing records first, OR
- Use different date

---

## 📊 Time Format Examples

```
✓ Valid Formats:
  08:30
  08:30:00
  8:30
  08:30 AM
  5:00 PM
  17:00

✗ Invalid:
  8:30am (no space)
  830 (no colon)
  25:00 (invalid time)
```

---

## 🔍 Debugging Tips

1. **Check backend console** for `[IMPORT]` logs showing:
   - Number of rows found
   - Column headers detected
   - Success/failure counts

2. **Save first few rows** as test to debug issues

3. **Use the error list** to fix problems row-by-row

4. **Verify employees exist** first:

   ```bash
   npm run seed  # In backend folder
   ```

5. **Check the response** - it shows:
   - Which records were imported ✓
   - Which rows failed ✗
   - Exact error for each failure

---

## 📝 Template: Copy-Paste This

```
Employee Code	Date	Check In	Check Out
EMP001	2026-03-25	08:30	17:00
EMP002	2026-03-25	09:00	17:30
EMP003	2026-03-25	08:45	17:15
```

Then:

1. Save as `.xlsx` (Excel format)
2. Use the import feature
3. Done! ✓

---

## 🆘 Still Getting 0 Records?

1. **Check response errors** - scroll down to see what failed
2. **Verify all 4 columns** are present
3. **Use seed data** - ensure employees exist: `npm run seed`
4. **Check dates** - must be valid (not in future, proper format)
5. **Check times** - must be in HH:MM format (24-hour)
6. **Check codes** - must match employee codes in database exactly

**Still stuck?** Share the error response and we'll fix it! 📋
