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
import { securityHeaders, apiLimiter } from "./middleware/security.js";

dotenv.config();

const app = express();
app.use(express.json());

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

/** Unmatched `/api/*` paths return JSON 404 (does not catch non-API routes if added later). */
app.use("/api/*", (req, res) => {
  res.status(404).json({ error: "API endpoint not found" });
});

/**
 * Express error handler: logs stack in development, generic message in production.
 * @param {Error} err
 */
app.use((err, req, res, next) => {
  console.error("Global error:", err);

  const isDevelopment = process.env.NODE_ENV !== "production";

  res.status(err.status || 500).json({
    error: isDevelopment ? err.message : "Internal server error",
    ...(isDevelopment && { stack: err.stack }),
  });
});

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
