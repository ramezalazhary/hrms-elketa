import { describe, expect, it } from "vitest";
import { normalizeApiBaseUrl } from "./apiBase.js";

describe("normalizeApiBaseUrl", () => {
  it("strips trailing slashes", () => {
    expect(normalizeApiBaseUrl("http://localhost:5000/api/")).toBe(
      "http://localhost:5000/api",
    );
    expect(normalizeApiBaseUrl("http://x///")).toBe("http://x");
  });

  it("leaves base without slash unchanged", () => {
    expect(normalizeApiBaseUrl("http://localhost:5000/api")).toBe(
      "http://localhost:5000/api",
    );
  });

  it("handles nullish and empty", () => {
    expect(normalizeApiBaseUrl(null)).toBe("");
    expect(normalizeApiBaseUrl(undefined)).toBe("");
    expect(normalizeApiBaseUrl("")).toBe("");
  });
});
