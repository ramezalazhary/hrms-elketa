/** Normalize Mongo id from string, ObjectId, or populated `{ _id }`. */
export function normalizeMongoId(val) {
  if (val == null || val === "") return "";
  if (typeof val === "object" && val._id != null) return String(val._id);
  return String(val);
}

/**
 * Whether an employee belongs to a department row.
 * Legacy data may use `department` as the short code (e.g. "HR") while
 * `Department.name` is a longer title; `Department.code` disambiguates.
 */
export function employeeBelongsToDepartment(emp, department) {
  if (!emp || !department) return false;
  const deptId = normalizeMongoId(department.id ?? department._id);
  const empDeptId = normalizeMongoId(emp.departmentId);
  if (deptId && empDeptId && empDeptId === deptId) return true;
  if (department.name && emp.department === department.name) return true;
  if (department.code && emp.department) {
    const code = String(department.code).trim().toUpperCase();
    const label = String(emp.department).trim().toUpperCase();
    if (label === code) return true;
  }
  return false;
}
