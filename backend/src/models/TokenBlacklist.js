import { Schema, model } from "mongoose";

const TokenBlacklistSchema = new Schema({
  token: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } }, // TTL index
});

export const TokenBlacklist = model(
  "TokenBlacklist",
  TokenBlacklistSchema,
);
