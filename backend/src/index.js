/**
 * @file Express application entry. Loads env, connects MongoDB, mounts `/api/*` routers,
 * applies security headers + CORS + rate limiting, and registers 404 / global error handlers.
 *
 * Startup flow: `dotenv` → `express()` + `express.json()` → `securityHeaders` → `cors` → `apiLimiter` →
 * route mounts → 404 → error middleware → `connectDb()` → `listen(PORT)`.
 */
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDb } from "./config/db.js";
import departmentsRouter from "./routes/departments.js";
import employeesRouter from "./routes/employees.js";
import authRouter from "./routes/auth.js";
import usersRouter from "./routes/users.js";
import permissionsRouter from "./routes/permissions.js";
import teamsRouter from "./routes/teams.js";
import positionsRouter from "./routes/positions.js";
import employmentsRouter from "./routes/employments.js";
import reportsRouter from "./routes/reports.js";
import organizationPolicyRouter from "./routes/organizationPolicy.js";
import leaveRequestsRouter from "./routes/leaveRequests.js";
import attendanceRouter from "./routes/attendance.js";
import managementRequestsRouter from "./routes/managementRequests.js";
import onboardingRouter from "./routes/onboarding.js";
import alertsRouter from "./routes/alerts.js";
import dashboardRouter from "./routes/dashboard.js";
import bulkRouter from "./routes/bulk.js";
import branchesRouter from "./routes/branches.js";
import assessmentsRouter from "./routes/assessments.js";
import assessmentTemplatesRouter from "./routes/assessmentTemplates.js";
import payrollRouter from "./routes/payroll.js";
import advancesRouter from "./routes/advances.js";
import holidaysRouter from "./routes/holidays.js";
import { securityHeaders, apiLimiter } from "./middleware/security.js";
import { errorMiddleware } from "./middleware/errorMiddleware.js";
import { NotFoundError } from "./utils/ApiError.js";


dotenv.config();

const app = express();
app.use(express.json({ limit: "2mb" }));


app.use(securityHeaders);

// CORS: allow specific origin in production, permissive in development
const corsOptions =
  process.env.NODE_ENV === "production"
    ? {
      origin: process.env.FRONTEND_URL || "http://localhost:5173",
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    }
    : {
      // In development allow any origin (useful when Vite picks different ports)
      origin: (origin, cb) => cb(null, true),
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    };

app.use(cors(corsOptions));

app.use("/api/", apiLimiter);

app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/permissions", permissionsRouter);
app.use("/api/departments", departmentsRouter);
app.use("/api/teams", teamsRouter);
app.use("/api/positions", positionsRouter);
app.use("/api/employees", employeesRouter);
app.use("/api/employments", employmentsRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/attendance", attendanceRouter);
app.use("/api/management-requests", managementRequestsRouter);
app.use("/api/onboarding", onboardingRouter);
app.use("/api/alerts", alertsRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/policy", organizationPolicyRouter);
app.use("/api/leave-requests", leaveRequestsRouter);
app.use("/api/bulk", bulkRouter);
app.use("/api/branches", branchesRouter);
app.use("/api/assessments", assessmentsRouter);
app.use("/api/assessment-templates", assessmentTemplatesRouter);
app.use("/api/payroll", payrollRouter);
app.use("/api/advances", advancesRouter);
app.use("/api/holidays", holidaysRouter);

/** Unmatched `/api/*` paths → 404 via the error middleware. */
app.use("/api/*", (req, _res, next) => {
  next(new NotFoundError(`API endpoint not found: ${req.method} ${req.originalUrl}`));
});

/** Centralised error handler (ApiError / Mongoose / generic). */
app.use(errorMiddleware);


const port = Number(process.env.PORT) || 5000;

connectDb()
  .then(() => {
    app.listen(port, () => {
      console.log(`Backend running at http://localhost:${port}`);
      console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
      console.log(
        `Frontend URL: ${process.env.FRONTEND_URL || "http://localhost:5173"}`,
      );
    });
  })
  .catch((err) => {
    console.error("Failed to connect to database:", err);
    process.exit(1);
  });

/* ── Process-level safety nets ── */
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  process.exit(1);
});