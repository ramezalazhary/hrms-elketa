import mongoose from "mongoose";

/**
 * Replica sets and sharded clusters support multi-document transactions.
 * Standalone mongod does not — match pattern used in departments route.
 */
export async function mongoSupportsTransactions() {
  try {
    const db = mongoose.connection?.db;
    if (!db?.admin) return false;
    const hello = await db.admin().command({ hello: 1 });
    return Boolean(hello?.setName || hello?.msg === "isdbgrid");
  } catch {
    return false;
  }
}
