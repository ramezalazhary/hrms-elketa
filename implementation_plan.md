# Server-Side Filtering, Alert Engine & HR Analytics Architecture

This plan merges your explicit backend-driven architectural requirements.

## Proposed Changes

---

### Phase 1 — Database Structure Preparation
#### [MODIFY] `backend/src/models/Employee.js`
- Verify existing fields: `yearlySalaryIncreaseDate`, `transferHistory`, and `nationalIdExpiryDate`.
- Add `salaryHistory`:
  ```javascript
  salaryHistory: [{
    amount: Number,
    startDate: Date,
    reason: String,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' }
  }]
  ```

#### [NEW] `backend/src/models/Alert.js`
- Create the `alerts` collection:
  - `type` (String: ID_EXPIRY, SALARY_INCREASE, TRANSFER, CONTRACT_EXPIRY)
  - `employeeId` (ObjectId ref to Employee)
  - `message` (String)
  - `severity` (String: low, medium, high)
  - `createdAt` (Date)
  - `resolved` (Boolean)

### Phase 2 — Alert Engine
#### [NEW] `backend/src/services/alerts.js` (or `backend/modules/alerts` as requested)
- Create an Alert Generation Service (cron-job or API-triggered logic) that scans employees:
  - **ID Expiry Alert**: If `nationalIdExpiryDate <= today + 60 days` -> Create High Severity `ID_EXPIRY` alert.
  - **Salary Increase Alert**: If `yearlySalaryIncreaseDate <= today + 30 days` -> Create Medium Severity `SALARY_INCREASE` alert.
  - **Transfer Alert**: Inside the transfer logic route, securely trigger a Low Severity `TRANSFER` alert.

### Phase 3 — Dashboard Analytics API
#### [NEW] `backend/src/routes/dashboard.js`
- **`GET /dashboard/alerts`**:
  - Computes counts: `idExpirySoon`, `salaryIncreaseSoon`, `recentTransfers`, `contractExpirySoon` via MongoDB aggregation.
- **`GET /dashboard/metrics`**:
  - Computes metrics: `totalEmployees`, `totalPayroll` (derived from latest salary logic), `avgSalary`, `upcomingSalaryIncreases`, `idExpiringSoon` via MongoDB aggregation pipeline.

### Phase 4 — Server-Side Employee Filtering
#### [MODIFY] `backend/src/routes/employees.js`
- Update the `GET /employees` handler to consume query parameters (`department`, `status`, `hireDateFrom`, `hireDateTo`, `salaryIncreaseFrom`, `salaryIncreaseTo`, `salaryMin`, `salaryMax`, `manager`, `location`, `idExpirySoon`, `recentTransfers`) and translate them perfectly into a MongoDB `.find(filters)` query payload.

### Phase 5 — Transfer Logic UI Updates
#### [MODIFY] `frontend/src/modules/employees/pages/EditEmployeePage.jsx`
- Replace checkbox with explicit React Radio options:
  - `Keep yearly salary increase date` (No change).
  - `Reset yearly salary increase date` (`newIncreaseDate = transferDate + 1 year`).
  - Add logic allowing for dynamic cycle calculation.

### Phase 6 — Dashboard UI Integration
#### [MODIFY] `frontend/src/pages/dashboard/DashboardPage.jsx`
- Re-wire the Dashboard hooks to call the new endpoints `GET /dashboard/alerts` and `GET /dashboard/metrics`.
- Render the Warning Banners directly injecting the payload from the DB.
- Embed the core HR Metric Widgets (`Total Employees`, `Total Payroll`, `Upcoming Salary Increases`, `ID Expiring Soon`, `Recent Transfers`). Apply hyperlink configurations dynamically routing to `/employees?filter=xyz`.

### Phase 7 — Employee Directory Filtering UI
#### [MODIFY] `frontend/src/modules/employees/pages/EmployeesListPage.jsx`
- Refactor the current client-side filter array system to utilize URL Query Params instead. State updates will push standard React Router queries and dispatch an API fetch using the new Server-Side endpoint.
- Develop the visual input fields (Date Pickers, Range Inputs, Dropdowns) for the extended filters.

### Phase 8 — Verification & Testing
- Deploy mocked employees specifically triggering 45-day ID expiry and 20-day Salary Increase timelines.
- Guarantee the DB properly flags alerts.
- Transfer an employee, select Reset, and ensure exactly +365 days maps correctly into the DB.
- Test server-side filtering via direct queries like `/employees?salaryIncreaseFrom=2026-01-01&salaryIncreaseTo=2026-03-01`.

## Open Questions

> [!WARNING]
> Everything is aligned with your master backend architecture plan! Should the Alert Engine evaluation script be designed to automatically run on a schedule (e.g., node-cron firing every night at midnight), or dynamically executed via a middleware upon Dashboard load?
