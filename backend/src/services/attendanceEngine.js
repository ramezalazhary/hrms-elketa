/**
 * attendanceEngine.js — Core attendance processing engine
 *
 * Converts raw attendance_events → attendance_daily records.
 * Pipeline: fetch events → filter voided → sort → resolve policy → pair → calculate → upsert
 */

import { AttendanceEvent } from "../models/AttendanceEvent.js";
import { AttendanceDaily } from "../models/AttendanceDaily.js";
import { AttendancePolicy } from "../models/AttendancePolicy.js";
import { AttendanceMetric } from "../models/AttendanceMetric.js";
import { Employee } from "../models/Employee.js";

// ─── Utilities ────────────────────────────────────────────────────────────────

function dayStart(date) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function dayEnd(date) {
  const d = new Date(date);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

function diffMinutes(start, end) {
  return (end.getTime() - start.getTime()) / 60000;
}

function parseHHmm(str) {
  const [h, m] = str.split(":").map(Number);
  return { hours: h, minutes: m };
}

function setTimeOnDate(date, hhmmStr) {
  const d = new Date(date);
  const { hours, minutes } = parseHHmm(hhmmStr);
  d.setUTCHours(hours, minutes, 0, 0);
  return d;
}

function getDayOfWeek(date) {
  const days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  return days[new Date(date).getUTCDay()];
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function roundTo2(n) {
  return Math.round(n * 100) / 100;
}

// ─── Policy Resolution ───────────────────────────────────────────────────────

/**
 * Resolve the best-matching policy for an employee.
 * Priority: INDIVIDUAL > TEAM > DEPARTMENT > ALL (default)
 */
export async function resolvePolicy(employee) {
  // 1. Individual policy
  const individual = await AttendancePolicy.findOne({
    appliesTo: "INDIVIDUAL",
    employeeIds: employee._id,
  });
  if (individual) return individual;

  // 2. Team policy
  if (employee.teamId) {
    const teamPolicy = await AttendancePolicy.findOne({
      appliesTo: "TEAM",
      teamId: employee.teamId,
    });
    if (teamPolicy) return teamPolicy;
  }

  // 3. Department policy
  if (employee.departmentId) {
    const deptPolicy = await AttendancePolicy.findOne({
      appliesTo: "DEPARTMENT",
      departmentId: employee.departmentId,
    });
    if (deptPolicy) return deptPolicy;
  }

  // 4. Default policy
  const defaultPolicy = await AttendancePolicy.findOne({ isDefault: true });
  if (defaultPolicy) return defaultPolicy;

  // Fallback: first policy
  return AttendancePolicy.findOne({});
}

// ─── Event Pairing ────────────────────────────────────────────────────────────

/**
 * Pairs CHECK_IN/CHECK_OUT events into work segments.
 * Handles edge cases: double check-in, missing check-out, orphan check-out.
 */
export function pairEvents(events, policy) {
  const workPairs = [];
  const breakPairs = [];
  let openCheckIn = null;
  let openBreakStart = null;

  for (const event of events) {
    switch (event.eventType) {
      case "CHECK_IN":
        if (openCheckIn) {
          // Double check-in: close previous with implied checkout
          workPairs.push({
            checkIn: openCheckIn.timestamp,
            checkOut: event.timestamp,
            duration: roundTo2(diffMinutes(openCheckIn.timestamp, event.timestamp)),
            type: "WORK",
            implied: true,
          });
        }
        openCheckIn = event;
        break;

      case "CHECK_OUT":
        if (openCheckIn) {
          workPairs.push({
            checkIn: openCheckIn.timestamp,
            checkOut: event.timestamp,
            duration: roundTo2(diffMinutes(openCheckIn.timestamp, event.timestamp)),
            type: "WORK",
            implied: false,
          });
          openCheckIn = null;
        }
        // Orphan check-out (no matching check-in) — skip silently
        break;

      case "BREAK_START":
        openBreakStart = event;
        break;

      case "BREAK_END":
        if (openBreakStart) {
          breakPairs.push({
            checkIn: openBreakStart.timestamp,
            checkOut: event.timestamp,
            duration: roundTo2(diffMinutes(openBreakStart.timestamp, event.timestamp)),
            type: "BREAK",
            implied: false,
          });
          openBreakStart = null;
        }
        break;

      default:
        break;
    }
  }

  // Handle unclosed check-in at end of day
  if (openCheckIn && policy) {
    const shiftEnd = setTimeOnDate(openCheckIn.timestamp, policy.workEndTime);
    workPairs.push({
      checkIn: openCheckIn.timestamp,
      checkOut: shiftEnd,
      duration: roundTo2(diffMinutes(openCheckIn.timestamp, shiftEnd)),
      type: "WORK",
      implied: true,
    });
  }

  return { workPairs, breakPairs };
}

// ─── Daily Calculation ────────────────────────────────────────────────────────

/**
 * Core function: process a single day for a single employee.
 * Returns the upserted AttendanceDaily document.
 */
export async function processDay(employeeId, date) {
  const employee = await Employee.findById(employeeId).lean();
  if (!employee) throw new Error(`Employee ${employeeId} not found`);

  const policy = await resolvePolicy(employee);
  if (!policy) throw new Error("No attendance policy found");

  const targetDate = dayStart(date);
  const dayOfWeek = getDayOfWeek(targetDate);

  // Check if it's a working day
  const isWorkingDay = policy.workingDays.includes(dayOfWeek);

  // Determine event time window
  let windowStart, windowEnd;

  if (policy.isNightShift) {
    // Night shift: look at previous day's evening through today's morning
    const prevDay = new Date(targetDate);
    prevDay.setUTCDate(prevDay.getUTCDate());
    windowStart = setTimeOnDate(prevDay, policy.workStartTime);
    const nextDay = new Date(targetDate);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    windowEnd = setTimeOnDate(nextDay, policy.workEndTime);
  } else {
    windowStart = dayStart(targetDate);
    windowEnd = dayEnd(targetDate);
  }

  // Fetch events
  const events = await AttendanceEvent.find({
    employeeId,
    isVoided: { $ne: true },
    timestamp: { $gte: windowStart, $lte: windowEnd },
  }).sort({ timestamp: 1 }).lean();

  // Determine if any event is WFH source
  const hasWFH = events.some(e => e.source === "WFH");

  // Pair events
  const { workPairs, breakPairs } = pairEvents(events, policy);

  // Calculate totals
  const totalWorkMinutes = workPairs.reduce((sum, p) => sum + p.duration, 0);
  const totalBreakMinutes = breakPairs.reduce((sum, p) => sum + p.duration, 0);

  // Auto-deduct break if configured and worked enough
  let effectiveBreakMinutes = totalBreakMinutes;
  if (policy.autoBreakDeductMin > 0 && totalWorkMinutes > 360 && totalBreakMinutes === 0) {
    effectiveBreakMinutes = policy.autoBreakDeductMin;
  }

  const netWorkMinutes = Math.max(0, totalWorkMinutes - effectiveBreakMinutes);
  const workHours = roundTo2(netWorkMinutes / 60);

  // First check-in and last check-out
  const firstCheckIn = workPairs.length > 0 ? workPairs[0].checkIn : null;
  const lastCheckOut = workPairs.length > 0 ? workPairs[workPairs.length - 1].checkOut : null;

  // Calculate late minutes
  let lateMinutes = 0;
  if (firstCheckIn && isWorkingDay) {
    const shiftStart = setTimeOnDate(targetDate, policy.workStartTime);
    const diff = diffMinutes(shiftStart, firstCheckIn);
    if (diff > policy.graceMinutes) {
      lateMinutes = roundTo2(diff - policy.graceMinutes);
    }
  }

  // Calculate early leave
  let earlyLeaveMin = 0;
  if (lastCheckOut && isWorkingDay) {
    const shiftEnd = setTimeOnDate(targetDate, policy.workEndTime);
    const diff = diffMinutes(lastCheckOut, shiftEnd);
    if (diff > 0) {
      earlyLeaveMin = roundTo2(diff);
    }
  }

  // Calculate overtime
  let overtimeHours = 0;
  if (workHours > policy.scheduledHours) {
    const otMinutes = (workHours - policy.scheduledHours) * 60;
    if (otMinutes >= policy.overtimeThresholdMin) {
      overtimeHours = roundTo2(otMinutes / 60);
    }
  }

  // Calculate late deduction
  let lateDeduction = 0;
  let lateDeductionUnit = "HOURS";
  if (lateMinutes > 0 && policy.lateDeductionRules?.length > 0) {
    const totalLateAfterGrace = diffMinutes(setTimeOnDate(targetDate, policy.workStartTime), firstCheckIn);
    const rule = policy.lateDeductionRules.find(r => totalLateAfterGrace >= r.fromMinutes && totalLateAfterGrace <= (r.toMinutes || 99999));
    if (rule) {
      lateDeduction = rule.deductionValue;
      lateDeductionUnit = rule.deductionUnit;
    }
  }

  // Determine status
  let status;
  if (!isWorkingDay) {
    status = dayOfWeek === "SAT" || dayOfWeek === "SUN" ? "WEEKEND" : "WEEKEND";
  } else if (events.length === 0) {
    status = "ABSENT";
  } else if (hasWFH) {
    status = "WFH";
  } else if (workHours < policy.halfDayThresholdHours) {
    status = "HALF_DAY";
  } else if (lateMinutes > 0) {
    status = "LATE";
  } else {
    status = "PRESENT";
  }

  // Deduction flag
  const deductionReadyFlag =
    status === "ABSENT" ||
    status === "HALF_DAY" ||
    lateDeduction > 0;

  // Build daily record
  const dailyData = {
    employeeId,
    date: targetDate,
    firstCheckIn,
    lastCheckOut,
    eventPairs: [...workPairs, ...breakPairs],
    status,
    scheduledHours: isWorkingDay ? policy.scheduledHours : 0,
    workHours,
    breakMinutes: effectiveBreakMinutes,
    overtimeHours,
    lateMinutes,
    lateDeduction,
    lateDeductionUnit,
    earlyLeaveMin,
    isAbsent: events.length === 0 && isWorkingDay,
    deductionReadyFlag,
    overtimeApproved: false,
    policyId: policy._id,
    shiftType: policy.shiftType,
    processedAt: new Date(),
    processedBy: "ENGINE",
    eventIds: events.map(e => e._id),
  };

  // Upsert
  const result = await AttendanceDaily.findOneAndUpdate(
    { employeeId, date: targetDate },
    dailyData,
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  return result;
}

// ─── Bulk Processing ──────────────────────────────────────────────────────────

/**
 * Process a date range for one or all employees.
 */
export async function processBulk({ employeeId, startDate, endDate }) {
  const employees = employeeId
    ? [await Employee.findById(employeeId).lean()]
    : await Employee.find({ status: "ACTIVE" }).lean();

  const start = dayStart(startDate);
  const end = dayStart(endDate);
  const results = { processed: 0, errors: [] };

  for (const emp of employees) {
    if (!emp) continue;
    const current = new Date(start);

    while (current <= end) {
      try {
        await processDay(emp._id, current);
        results.processed++;
      } catch (err) {
        results.errors.push({
          employeeId: emp._id,
          date: current.toISOString().slice(0, 10),
          error: err.message,
        });
      }
      current.setUTCDate(current.getUTCDate() + 1);
    }
  }

  return results;
}

// ─── Metrics Aggregation ──────────────────────────────────────────────────────

/**
 * Generate aggregated metrics for a period.
 */
export async function generateMetric({ employeeId, periodType, periodStart, periodEnd }) {
  const employee = await Employee.findById(employeeId).lean();
  if (!employee) throw new Error("Employee not found");
  
  const policy = await resolvePolicy(employee);
  const start = dayStart(periodStart);
  const end = dayStart(periodEnd);

  const dailyRecords = await AttendanceDaily.find({
    employeeId,
    date: { $gte: start, $lte: end },
  }).lean();

  const workingDayRecords = dailyRecords.filter(
    r => r.status !== "WEEKEND" && r.status !== "HOLIDAY"
  );

  const sum = (arr, field) => roundTo2(arr.reduce((s, r) => s + (r[field] || 0), 0));
  const count = (arr, status) => arr.filter(r => r.status === status).length;

  const totalWorkDays = workingDayRecords.length;
  const presentDays = count(dailyRecords, "PRESENT") + count(dailyRecords, "LATE");
  const absentDays = count(dailyRecords, "ABSENT");
  const lateDays = count(dailyRecords, "LATE");
  const halfDays = count(dailyRecords, "HALF_DAY");
  const leaveDays = count(dailyRecords, "ON_LEAVE");
  const wfhDays = count(dailyRecords, "WFH");
  const totalWorkHours = sum(workingDayRecords, "workHours");

  // Calculate Aggregated Deductions
  let totalLateDeductionDays = 0;
  dailyRecords.forEach(r => {
    if (r.lateDeduction > 0) {
      if (r.lateDeductionUnit === "DAYS") {
        totalLateDeductionDays += r.lateDeduction;
      } else if (r.lateDeductionUnit === "HOURS") {
        totalLateDeductionDays += r.lateDeduction / (policy.scheduledHours || 8);
      } else if (r.lateDeductionUnit === "MINUTES") {
        totalLateDeductionDays += r.lateDeduction / ((policy.scheduledHours || 8) * 60);
      }
    }
  });

  const totalAbsentDeductionDays = absentDays * (policy.absentDeductionDays || 1);

  // Attendance score calculation
  let score = 100;
  if (totalWorkDays > 0) {
    score -= (absentDays / totalWorkDays) * 50;
    score -= (lateDays / totalWorkDays) * 20;
    score -= (halfDays / totalWorkDays) * 10;
  }
  const approvedOTHours = sum(
    workingDayRecords.filter(r => r.overtimeApproved),
    "overtimeHours"
  );
  if (approvedOTHours > 0) {
    score += Math.min(5, (approvedOTHours / 40) * 5);
  }
  score = roundTo2(clamp(score, 0, 100));

  // Build label
  let periodLabel;
  const y = start.getUTCFullYear();
  const m = String(start.getUTCMonth() + 1).padStart(2, "0");
  switch (periodType) {
    case "WEEKLY":
      periodLabel = `${y}-W${getWeekNumber(start)}`;
      break;
    case "MONTHLY":
      periodLabel = `${y}-${m}`;
      break;
    case "QUARTERLY":
      periodLabel = `${y}-Q${Math.ceil((start.getUTCMonth() + 1) / 3)}`;
      break;
    case "YEARLY":
      periodLabel = `${y}`;
      break;
    default:
      periodLabel = `${y}-${m}`;
  }

  const metricData = {
    employeeId,
    scope: "EMPLOYEE",
    periodType,
    periodStart: start,
    periodEnd: end,
    periodLabel,
    totalWorkDays,
    presentDays,
    absentDays,
    lateDays,
    halfDays,
    leaveDays,
    wfhDays,
    holidayDays: count(dailyRecords, "HOLIDAY"),
    totalWorkHours,
    totalOvertimeHours: sum(workingDayRecords, "overtimeHours"),
    totalLateMinutes: sum(workingDayRecords, "lateMinutes"),
    totalEarlyLeaveMin: sum(workingDayRecords, "earlyLeaveMin"),
    totalBreakMinutes: sum(workingDayRecords, "breakMinutes"),
    avgDailyHours: totalWorkDays > 0 ? roundTo2(totalWorkHours / totalWorkDays) : 0,
    deductionTriggerCount: workingDayRecords.filter(r => r.deductionReadyFlag).length,
    totalLateDeductionDays: roundTo2(totalLateDeductionDays),
    totalAbsentDeductionDays: roundTo2(totalAbsentDeductionDays),
    approvedOvertimeHours: approvedOTHours,
    attendanceScore: score,
    generatedAt: new Date(),
  };

  return AttendanceMetric.findOneAndUpdate(
    { employeeId, periodType, periodStart: start },
    metricData,
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

/**
 * Generate monthly metrics for all employees in a given month.
 */
export async function generateMonthlyMetrics(year, month) {
  const periodStart = new Date(Date.UTC(year, month - 1, 1));
  const periodEnd = new Date(Date.UTC(year, month, 0)); // Last day of month

  const employees = await Employee.find({ status: "ACTIVE" }).lean();
  const results = { generated: 0, errors: [] };

  for (const emp of employees) {
    try {
      await generateMetric({
        employeeId: emp._id,
        periodType: "MONTHLY",
        periodStart,
        periodEnd,
      });
      results.generated++;
    } catch (err) {
      results.errors.push({ employeeId: emp._id, error: err.message });
    }
  }

  return results;
}

function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return String(Math.ceil(((d - yearStart) / 86400000 + 1) / 7)).padStart(2, "0");
}
