/**
 * Shapes monthly attendance report API payloads: attendance-only metrics, no salary/EGP columns.
 * Payroll still uses the full computeMonthlyAnalysis summary internally.
 *
 * @param {Record<string, unknown>} row — one summary row from computeMonthlyAnalysis
 */
export function mapSummaryForMonthlyReportApi(row) {
  const d = row.deductions || {};
  return {
    employeeId: row.employeeId,
    employeeCode: row.employeeCode,
    fullName: row.fullName,
    department: row.department,
    workingDays: row.workingDays,
    presentDays: row.presentDays,
    lateDays: row.lateDays,
    absentDays: row.absentDays,
    onLeaveDays: row.onLeaveDays,
    paidLeaveDays: row.paidLeaveDays,
    unpaidLeaveDays: row.unpaidLeaveDays,
    excusedDays: row.excusedDays,
    earlyDepartureDays: row.earlyDepartureDays,
    incompleteDays: row.incompleteDays,
    holidayDays: row.holidayDays || 0,
    totalHoursWorked: row.totalHoursWorked,
    totalExcusedMinutes: row.totalExcusedMinutes,
    avgDailyHours: row.avgDailyHours,
    deductions: {
      lateDays: d.lateDays,
      absenceDays: d.absenceDays,
      unpaidLeaveDays: d.unpaidLeaveDays,
      earlyDepartureDays: d.earlyDepartureDays,
      incompleteDays: d.incompleteDays,
      totalDeductionDays: d.totalDeductionDays,
    },
    netEffectiveDays: row.netEffectiveDays,
    approvedOvertimeUnits: Number(row.assessmentApprovedOvertimeUnits) || 0,
  };
}
