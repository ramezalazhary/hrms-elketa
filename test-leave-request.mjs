import { connectDb } from "./backend/src/config/db.js";
import { Employee } from "./backend/src/models/Employee.js";
import { createLeaveRequest } from "./backend/src/services/leaveRequestService.js";
import dotenv from "dotenv";

dotenv.config({ path: "./backend/.env" });

async function run() {
  await connectDb();
  const employee = await Employee.findOne();
  if(!employee) return console.log("NO EMP");
  try {
     const doc = await createLeaveRequest({ id: employee._id.toString(), email: employee.email, role: employee.role }, {
         kind: "VACATION",
         leaveType: "ANNUAL",
         startDate: "2026-05-10",
         endDate: "2026-05-15",
     });
     console.log("SUCCESS:", doc);
  } catch (e) {
     console.error("FAILED:", e.message || e);
  }
  process.exit(0);
}
run();
