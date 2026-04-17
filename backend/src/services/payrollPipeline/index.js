/**
 * payrollPipeline — public API.
 *
 * All consumers (routes, scripts) import from this file.
 * Internal implementation details live in payrollEngine.js.
 */

// ── Math utilities (also re-exported for scripts / frontend-mirror checks) ──
export {
  DEFAULT_PAYROLL_CONFIG,
  clampDecimalPlaces,
  roundMoney,
  computeProgressiveTax,
} from "./payrollMath.js";

// ── Validation ──
export {
  PayrollValidationError,
  validateAttendanceSummary,
  validatePayrollLine,
} from "./payrollSchemas.js";

// ── Core pipeline functions ──
export {
  // Attendance analysis (standalone entry — reads policy itself)
  computeMonthlyAnalysis,

  // Payroll line math (used by manual edits and frontend-mirror)
  computePayrollLineFromInputs,

  // Main pipeline (was computePayrollRun)
  runPayrollPipeline,

  // Finalization & run management
  finalizePayrollRun,
  resetPayrollRunProcessing,
  repairPayrollRunTotals,
  getPayrollRunDiff,

  // Manual edits
  updatePayrollRecordManually,

  // Advance / overtime helpers (exported for smoke tests)
  getOvertimeHours,
  getExtraDaysWorked,
  markAdvancesDeducted,

  // Config resolution
  resolvePayrollConfig,
} from "./payrollEngine.js";
