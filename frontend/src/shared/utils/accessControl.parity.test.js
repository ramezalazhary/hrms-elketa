import { describe, expect, it } from "vitest";
import {
  canAccessDashboardPage,
  canAccessLeaveApprovals,
  canApproveLeaves,
  getLeaveApprovalsAccessLevel,
} from "./accessControl";
import fixture from "../../../../docs/policy-parity.fixture.json";

describe("access control parity fixture", () => {
  it("matches leave approvals fixture expectations", () => {
    for (const row of fixture.leaveApprovals || []) {
      const user = { role: row.role };
      expect(getLeaveApprovalsAccessLevel(user)).toBe(row.level);
      expect(canAccessLeaveApprovals(user)).toBe(Boolean(row.canAccess));
      expect(canApproveLeaves(user)).toBe(Boolean(row.canApprove));
    }
  });

  it("matches dashboard fixture expectations", () => {
    for (const row of fixture.dashboardAccess || []) {
      const user = { role: row.role };
      expect(canAccessDashboardPage(user)).toBe(Boolean(row.canAccess));
    }
  });
});

