import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

/** MongoDB connection URI from env, or local default `hrms` database. */
const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/hrms";

/**
 * Opens a single Mongoose connection to MongoDB using `MONGO_URI`.
 *
 * @returns {Promise<void>} Resolves when connected; logs URI on success.
 * @throws Exits process with code 1 if connection fails (error logged).
 *
 * Data flow: reads `process.env.MONGO_URI` → `mongoose.connect` →
 * on success logs and returns; on failure logs and `process.exit(1)`.
 */
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
