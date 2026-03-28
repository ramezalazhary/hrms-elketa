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
import attendanceRouter from "./routes/attendance.js";
import { securityHeaders, apiLimiter } from "./middleware/security.js";

dotenv.config();

const app = express();
app.use(express.json());

// Security middleware
app.use(securityHeaders);

// CORS configuration
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// Rate limiting
app.use("/api/", apiLimiter);

// API routes
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

// 404 handler
app.use("/api/*", (req, res) => {
  res.status(404).json({ error: "API endpoint not found" });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Global error:", err);

  // Don't leak error details in production
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
