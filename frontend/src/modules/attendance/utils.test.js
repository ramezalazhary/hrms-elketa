import { describe, expect, it } from "vitest";
import {
  buildAttendanceQueryParams,
  formatAttendanceDate,
  formatTotalHours,
  getAttendanceEmployee,
  getAttendanceRowId,
} from "./utils.js";

describe("buildAttendanceQueryParams", () => {
  it("omits empty employeeCode", () => {
    expect(buildAttendanceQueryParams({ startDate: "2025-01-01", endDate: "2025-01-31" })).toBe(
      "startDate=2025-01-01&endDate=2025-01-31",
    );
    expect(buildAttendanceQueryParams({ employeeCode: "   " })).toBe("");
  });

  it("includes trimmed employeeCode", () => {
    expect(
      buildAttendanceQueryParams({
        startDate: "2025-01-01",
        employeeCode: "  E1 ",
      }),
    ).toBe("startDate=2025-01-01&employeeCode=E1");
  });
});

describe("formatAttendanceDate", () => {
  it("returns em dash for invalid input", () => {
    expect(formatAttendanceDate(null)).toBe("—");
    expect(formatAttendanceDate("")).toBe("—");
    expect(formatAttendanceDate("not-a-date")).toBe("—");
  });

  it("formats UTC calendar day for ISO midnight", () => {
    const s = formatAttendanceDate("2025-06-15T00:00:00.000Z");
    expect(s).toMatch(/Jun/);
    expect(s).toMatch(/2025/);
    expect(s).toMatch(/15/);
  });
});

describe("getAttendanceEmployee", () => {
  it("returns populated employee object", () => {
    expect(
      getAttendanceEmployee({ employeeId: { fullName: "A", email: "a@b.c" } }),
    ).toEqual({ fullName: "A", email: "a@b.c" });
    expect(getAttendanceEmployee({ employeeId: "idonly" })).toBeNull();
  });
});

describe("getAttendanceRowId", () => {
  it("prefers _id then id then index", () => {
    expect(getAttendanceRowId({ _id: "abc" }, 3)).toBe("abc");
    expect(getAttendanceRowId({ id: "x" }, 3)).toBe("x");
    expect(getAttendanceRowId({}, 2)).toBe("attendance-2");
  });
});

describe("formatTotalHours", () => {
  it("formats numbers and rejects invalid", () => {
    expect(formatTotalHours(8)).toBe("08:00:00");
    expect(formatTotalHours("7.25")).toBe("07:15:00");
    expect(formatTotalHours(8.791341782942908)).toBe("08:47:29");
    expect(formatTotalHours(null)).toBe("—");
    expect(formatTotalHours(NaN)).toBe("—");
  });
});
