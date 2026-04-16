import { describe, it, expect } from "vitest";
import {
  ACCESS_LEVEL,
  getLeaveApprovalsAccessLevel,
  canApproveLeaves,
  canAccessLeaveApprovals,
  getDashboardAccessLevel,
  canAccessDashboardPage,
} from "./accessControl";

describe("leave approvals access control", () => {
  it("grants HR manager edit baseline, but no default access for HR/HR staff", () => {
    expect(getLeaveApprovalsAccessLevel({ role: "HR" })).toBe(ACCESS_LEVEL.NONE);
    expect(getLeaveApprovalsAccessLevel({ role: "HR_STAFF" })).toBe(ACCESS_LEVEL.NONE);
    expect(getLeaveApprovalsAccessLevel({ role: "HR_MANAGER" })).toBe(ACCESS_LEVEL.EDIT);
  });

  it("grants manager and team leader baseline edit access", () => {
    expect(getLeaveApprovalsAccessLevel({ role: "MANAGER" })).toBe(ACCESS_LEVEL.EDIT);
    expect(getLeaveApprovalsAccessLevel({ role: "TEAM_LEADER" })).toBe(ACCESS_LEVEL.EDIT);
  });

  it("requires explicit override for HR/HR_STAFF to access leave approvals", () => {
    expect(canAccessLeaveApprovals({ role: "HR" })).toBe(false);
    expect(canAccessLeaveApprovals({ role: "HR_STAFF" })).toBe(false);

    const hrWithOverride = {
      role: "HR",
      pageAccessOverrides: [{ pageId: "leave_approvals", level: "VIEW" }],
    };
    expect(canAccessLeaveApprovals(hrWithOverride)).toBe(true);
    expect(canApproveLeaves(hrWithOverride)).toBe(false);
  });

  it("lets explicit override take precedence over baseline role", () => {
    const user = {
      role: "HR_MANAGER",
      pageAccessOverrides: [{ pageId: "leave_approvals", level: "VIEW" }],
    };
    expect(getLeaveApprovalsAccessLevel(user)).toBe(ACCESS_LEVEL.VIEW);
    expect(canApproveLeaves(user)).toBe(false);
  });

  it("denies regular employee without override", () => {
    expect(getLeaveApprovalsAccessLevel({ role: "EMPLOYEE" })).toBe(ACCESS_LEVEL.NONE);
    expect(canApproveLeaves({ role: "EMPLOYEE" })).toBe(false);
  });

  it("keeps dashboard baseline visible for leadership roles", () => {
    expect(getDashboardAccessLevel({ role: "HR" })).toBe(ACCESS_LEVEL.VIEW);
    expect(getDashboardAccessLevel({ role: "HR_STAFF" })).toBe(ACCESS_LEVEL.VIEW);
    expect(getDashboardAccessLevel({ role: "HR_MANAGER" })).toBe(ACCESS_LEVEL.VIEW);
    expect(getDashboardAccessLevel({ role: "MANAGER" })).toBe(ACCESS_LEVEL.VIEW);
    expect(getDashboardAccessLevel({ role: "TEAM_LEADER" })).toBe(ACCESS_LEVEL.VIEW);
    expect(canAccessDashboardPage({ role: "EMPLOYEE" })).toBe(false);
  });
});
