import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/hrms";

export const connectDb = async () => {
  try {
    await mongoose.connect(mongoUri, {
      autoIndex: true,
    });
    console.log("MongoDB connected", mongoUri);
  } catch (error) {
    console.error("MongoDB connection error", error);
    process.exit(1);
  }
};
