import mongoose from "mongoose";

async function run() {
  await mongoose.connect("mongodb://localhost:27017/hrms");
  const Employee = mongoose.model("Employee", new mongoose.Schema({}));
  try {
     const x = await Employee.find({ $or: [] });
     console.log("Returned:", x.length);
  } catch (e) {
     console.log("Error:", e.message);
  }
  process.exit(0);
}
run();
