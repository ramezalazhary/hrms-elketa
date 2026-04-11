import { describe, it, expect } from "vitest";
import {
  computePayrollLikeModule,
  formatPayrollEgp,
  roundAtDecimalPlaces,
  verifyPayrollData,
  round2,
} from "./payrollVerification";

describe("formatPayrollEgp", () => {
  it("rounds with payroll engine rules then formats (e.g. 5340.125 → 2 dp → 5340.13)", () => {
    expect(roundAtDecimalPlaces(5340.125, 2)).toBe(5340.13);
    expect(formatPayrollEgp(5340.125, 2)).toMatch(/340\.13/);
  });
});

describe("round2", () => {
  it("matches backend-style rounding", () => {
    expect(round2(1.005)).toBe(1);
    expect(round2(10.999)).toBe(11);
    expect(round2(10.994)).toBe(10.99);
  });
});

describe("computePayrollLikeModule", () => {
  it("matches uninsured path: net = due before insurance", () => {
    const r = computePayrollLikeModule({
      baseSalary: 10000,
      allowances: 500,
      absentDays: 1,
      attendanceDeduction: 200,
      isInsured: false,
    });
    expect(r.grossSalary).toBe(10500);
    expect(r.absentDeduction).toBe(round2((10500 / 22) * 1));
    expect(r.dueBeforeInsurance).toBe(
      round2(r.grossSalary + r.totalAdditions - r.totalDeductions),
    );
    expect(r.netSalary).toBe(r.dueBeforeInsurance);
  });

  it("passes through explicit attendance deduction (non-absence) amount", () => {
    const r = computePayrollLikeModule({
      baseSalary: 8000,
      attendanceDeduction: 400,
    });
    expect(r.attendanceDeduction).toBe(400);
  });

  it("caps salary advance to available pre-tax pool (ONE_TIME larger than pay)", () => {
    const r = computePayrollLikeModule({
      baseSalary: 5000,
      allowances: 0,
      workingDays: 22,
      advanceAmount: 100_000,
      isInsured: false,
    });
    const pool = round2(r.effectiveGross + r.totalAdditions);
    const other = round2(r.absentDeduction + r.attendanceDeduction + r.fixedDeduction);
    const maxAdv = round2(Math.max(0, pool - other));
    expect(r.advanceRequested).toBe(100_000);
    expect(r.advanceAmount).toBe(maxAdv);
    expect(r.dueBeforeInsurance).toBeGreaterThanOrEqual(0);
  });
});

describe("verifyPayrollData", () => {
  it("passes when uninsured row totals and formulas align", () => {
    const records = [
      {
        employeeCode: "U1",
        grossSalary: 8000,
        totalAdditions: 400,
        totalDeductions: 100,
        dueBeforeInsurance: 8300,
        isInsured: false,
        netSalary: 8300,
        employeeInsurance: 0,
        companyInsurance: 0,
        monthlyTax: 0,
        martyrsFundDeduction: 0,
      },
    ];
    const totals = {
      totalGross: 8000,
      totalAdditions: 400,
      totalDeductions: 100,
      totalNet: 8300,
      totalEmployeeInsurance: 0,
      totalCompanyInsurance: 0,
      totalTax: 0,
      totalMartyrsFund: 0,
    };
    const { allPassed, checks } = verifyPayrollData(records, totals);
    expect(allPassed).toBe(true);
    expect(checks.every((c) => c.ok)).toBe(true);
  });

  it("passes when insured row net matches due − insurance − tax − martyrs", () => {
    const due = 20000;
    const ei = 1837;
    const ci = 3131.25;
    const mt = 412.5;
    const mf = 8.35;
    const net = round2(due - ei - mt - mf);
    const records = [
      {
        employeeCode: "I1",
        grossSalary: 20000,
        totalAdditions: 0,
        totalDeductions: 0,
        dueBeforeInsurance: due,
        isInsured: true,
        employeeInsurance: ei,
        companyInsurance: ci,
        monthlyTax: mt,
        martyrsFundDeduction: mf,
        netSalary: net,
      },
    ];
    const totals = {
      totalGross: 20000,
      totalAdditions: 0,
      totalDeductions: 0,
      totalNet: net,
      totalEmployeeInsurance: ei,
      totalCompanyInsurance: ci,
      totalTax: mt,
      totalMartyrsFund: mf,
    };
    const { allPassed } = verifyPayrollData(records, totals);
    expect(allPassed).toBe(true);
  });

  it("fails when sum of net does not match run total", () => {
    const records = [
      {
        employeeCode: "A",
        grossSalary: 5000,
        totalAdditions: 0,
        totalDeductions: 0,
        dueBeforeInsurance: 5000,
        isInsured: false,
        netSalary: 5000,
        employeeInsurance: 0,
        companyInsurance: 0,
        monthlyTax: 0,
        martyrsFundDeduction: 0,
      },
    ];
    const totals = {
      totalGross: 5000,
      totalAdditions: 0,
      totalDeductions: 0,
      totalNet: 4999,
      totalEmployeeInsurance: 0,
      totalCompanyInsurance: 0,
      totalTax: 0,
      totalMartyrsFund: 0,
    };
    const { allPassed, checks } = verifyPayrollData(records, totals);
    expect(allPassed).toBe(false);
    expect(checks.find((c) => c.id === "sum-net")?.ok).toBe(false);
  });
});
