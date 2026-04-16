/**
 * Declared company holiday covers `dateStr` for this employee (by id + department).
 * @param {Array} holidays  - lean CompanyHoliday docs
 * @param {string} dateStr  - "YYYY-MM-DD" UTC calendar key
 * @param {*} empId
 * @param {*} deptId
 * @returns {{ isHoliday: boolean, title?: string }}
 */
export function isHolidayForEmployee(holidays, dateStr, empId, deptId) {
  const ts = new Date(`${dateStr}T00:00:00.000Z`).getTime();
  for (const holiday of holidays || []) {
    const start = new Date(holiday.startDate).setUTCHours(0, 0, 0, 0);
    const end = new Date(holiday.endDate).setUTCHours(23, 59, 59, 999);
    if (ts < start || ts > end) continue;
    if (holiday.scope === "COMPANY") return { isHoliday: true, title: holiday.title };
    if (holiday.scope === "DEPARTMENT" && deptId && String(holiday.targetDepartmentId) === String(deptId)) {
      return { isHoliday: true, title: holiday.title };
    }
    if (holiday.scope === "EMPLOYEE" && String(holiday.targetEmployeeId) === String(empId)) {
      return { isHoliday: true, title: holiday.title };
    }
  }
  return { isHoliday: false };
}
