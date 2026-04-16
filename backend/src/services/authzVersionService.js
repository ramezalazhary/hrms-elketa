import { Employee } from "../models/Employee.js";

export async function bumpAuthzVersion(userId) {
  if (!userId) return null;
  const updated = await Employee.findByIdAndUpdate(
    userId,
    { $inc: { authzVersion: 1 } },
    { new: true, projection: { _id: 1, authzVersion: 1 } },
  ).lean();
  return updated?.authzVersion ?? null;
}

