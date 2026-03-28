import mongoose from "mongoose";
import dotenv from "dotenv";
import { Employee } from "./models/Employee.js";
import { hashPassword } from "./middleware/auth.js";

dotenv.config();

const employeesData = [
  { code: "EMP001", name: "Ahmed Mohamed Ali", dept: "Information Technology" },
  { code: "EMP002", name: "Mahmoud Ibrahim Hassan", dept: "Human Resources" },
  { code: "EMP003", name: "Sara Khaled Ahmed", dept: "Accounting & Finance" },
  { code: "EMP004", name: "Omar Abdullah Mohamed", dept: "Sales & Marketing" },
  { code: "EMP005", name: "Nora Hussein Salem", dept: "Customer Service" },
  { code: "EMP006", name: "Youssef Abdel Rahman", dept: "General Administration" },
  { code: "EMP007", name: "Mona Tarek Mahmoud", dept: "Procurement" },
  { code: "EMP008", name: "Karim Sami Awad", dept: "Quality Control" },
  { code: "EMP009", name: "Hoda Ali Mostafa", dept: "Legal Affairs" },
  { code: "EMP010", name: "Walid Hossam El-Din", dept: "Warehousing & Distribution" },
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/hrms");
    console.log("Connected to MongoDB");

    const defaultPass = await hashPassword("Welcome123!");

    for (const data of employeesData) {
      const email = `${data.code.toLowerCase()}@hr.local`;
      
      const existing = await Employee.findOne({ employeeCode: data.code });
      if (existing) {
        console.log(`Employee ${data.code} already exists, skipping.`);
        continue;
      }

      const newEmp = new Employee({
        fullName: data.name,
        email: email,
        employeeCode: data.code,
        department: data.dept,
        position: "Tester",
        status: "ACTIVE",
        passwordHash: defaultPass,
        role: data.dept === "Human Resources" ? "HR_STAFF" : "EMPLOYEE",
        isActive: true,
        gender: "MALE",
        maritalStatus: "SINGLE",
      });

      await newEmp.save();
      console.log(`Seeded: ${data.name} (${data.code})`);
    }

    console.log("Seeding completed successfully.");
    process.exit(0);
  } catch (err) {
    console.error("Seeding failed:", err);
    process.exit(1);
  }
}

seed();
