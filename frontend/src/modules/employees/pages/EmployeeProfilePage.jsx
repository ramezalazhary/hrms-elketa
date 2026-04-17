import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams, useLocation } from 'react-router-dom'
import { Layout } from '@/shared/components/Layout'
import { useAppDispatch, useAppSelector } from '@/shared/hooks/reduxHooks'
import { useToast } from '@/shared/components/ToastProvider'
import { FormBuilder } from '@/shared/components/FormBuilder'
import { DepartmentBadge, normaliseRoleKey } from '@/shared/components/EntityBadges'
import { fetchDepartmentsThunk } from '@/modules/departments/store'
import { getDocumentRequirementsApi } from '@/modules/organization/api'
import { Clock, MapPin, Phone, TrendingUp, Settings, ArrowRightLeft, Briefcase, Mail, Shield, AlertTriangle, AlertCircle, ArrowLeft, User, UserX, Plane, Gift, Star, Edit2, Trash2 } from 'lucide-react'
import { formatTotalHours } from '@/modules/attendance/utils'
import { SalaryIncreaseModal } from '../components/SalaryIncreaseModal'
import { TransferModal } from '../components/TransferModal'
import { ManualVacationRecordsModal } from '../components/ManualVacationRecordsModal'
import { LeaveBalanceCreditModal } from '../components/LeaveBalanceCreditModal'
import { LeaveBalanceCreditHistory } from '../components/LeaveBalanceCreditHistory'
import { TerminateEmployeeModal } from '../components/TerminateEmployeeModal'
import { SubmitAssessmentModal } from '../components/SubmitAssessmentModal'
import { EditAssessmentModal } from '../components/EditAssessmentModal'
import { isHrOrAdminRole } from '../utils/evaluationAccess'
import { updateEmployeeThunk, fetchEmployeesThunk } from '../store'
import {
  listLeaveRequestsApi,
  getLeaveBalanceApi,
  createLeaveRequestApi,
  directRecordLeaveRequestApi,
  transferEmployeeApi,
  resetPasswordApi,
  processSalaryIncreaseApi,
  getEmployeeAssessmentsApi,
  getAssessmentEligibilityApi,
  deleteAssessmentApi,
} from '../api'
import { getEmployeeAttendanceApi } from '@/modules/attendance/api'
import {
  ACCESS_LEVEL,
  getEmployeesAccessLevel,
  hasAccessLevel,
} from "@/shared/utils/accessControl";

/** Days until a date from now (negative = past) */

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

const VACATION_TYPE_OPTIONS = [
  { value: "ANNUAL", label: "Annual leave" },
  { value: "SICK", label: "Sick leave" },
  { value: "UNPAID", label: "Unpaid" },
  { value: "MATERNITY", label: "Maternity" },
  { value: "PATERNITY", label: "Paternity" },
  { value: "OTHER", label: "Other" },
];

function toDateInputValue(d) {
  if (!d) return "";
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return "";
  return x.toISOString().slice(0, 10);
}

function fmtLeaveRequestDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function leaveStatusBadgeClass(status) {
  switch (status) {
    case "APPROVED":
      return "bg-emerald-100 text-emerald-800";
    case "PENDING":
      return "bg-amber-100 text-amber-900";
    case "REJECTED":
      return "bg-rose-100 text-rose-800";
    case "CANCELLED":
      return "bg-zinc-200 text-zinc-700 dark:text-zinc-300";
    default:
      return "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300";
  }
}

/** Build API payload for vacationRecords (dates as YYYY-MM-DD). */
function serializeVacationRecords(list, fallbackRecorder) {
  return (list || []).map((r) => ({
    startDate: toDateInputValue(r.startDate),
    endDate: toDateInputValue(r.endDate),
    type: r.type || "ANNUAL",
    notes: r.notes?.trim() || undefined,
    recordedBy: r.recordedBy || fallbackRecorder || undefined,
  }));
}

export function EmployeeProfilePage() {
  const { employeeId } = useParams()
  const location = useLocation()
  const { showToast } = useToast()
  const employees = useAppSelector((state) => state.employees.items)
  const departments = useAppSelector((state) => state.departments.items)
  const currentUser = useAppSelector((state) => state.identity.currentUser)
  const [showResetModal, setShowResetModal] = useState(false)

  const queryParams = new URLSearchParams(location.search);
  const initialTab = queryParams.get("tab") || "overview";
  const [activeTab, setActiveTab] = useState(initialTab)

  const [showTransferModal, setShowTransferModal] = useState(false)
  const [showSalaryModal, setShowSalaryModal] = useState(false)
  const [attendanceHistory, setAttendanceHistory] = useState([])
  const [isAttendanceLoading, setIsAttendanceLoading] = useState(false)
  const [showTerminateModal, setShowTerminateModal] = useState(false)
  const [showManualVacationModal, setShowManualVacationModal] = useState(false)
  const [showLeaveBalanceCreditModal, setShowLeaveBalanceCreditModal] = useState(false)
  const [vacationSaving, setVacationSaving] = useState(false)
  const [vacationRecording, setVacationRecording] = useState(false)
  const [leaveRequests, setLeaveRequests] = useState([])
  const [leaveRequestsLoading, setLeaveRequestsLoading] = useState(false)
  const [leaveRequestsForbidden, setLeaveRequestsForbidden] = useState(false)
  const [leaveBalanceSnapshot, setLeaveBalanceSnapshot] = useState(null)
  const [leaveBalanceLoading, setLeaveBalanceLoading] = useState(false)
  const [leaveBalanceForbidden, setLeaveBalanceForbidden] = useState(false)
  const [showAssessmentModal, setShowAssessmentModal] = useState(false)
  const [assessmentsData, setAssessmentsData] = useState([])
  const [isAssessmentsLoading, setIsAssessmentsLoading] = useState(false)
  const [assessmentsRefreshKey, setAssessmentsRefreshKey] = useState(0)
  const [editingAssessment, setEditingAssessment] = useState(null)
  /** null = loading or unknown; resolved object drives tab/submit with legacy fallback when null */
  const [assessmentGate, setAssessmentGate] = useState(null)

  const dispatch = useAppDispatch();
  const [globalPolicy, setGlobalPolicy] = useState(null);

  useEffect(() => {
    if (!employees.length) void dispatch(fetchEmployeesThunk());
    void dispatch(fetchDepartmentsThunk());
    const loadPolicy = async () => {
      try {
        const data = await getDocumentRequirementsApi();
        setGlobalPolicy(data);
      } catch (err) {
        console.error("Failed to load global policy", err);
      }
    };
    loadPolicy();
  }, [dispatch, employees.length]);

  useEffect(() => {
    if (activeTab === "attendance" && employeeId) {
      const fetchAttendance = async () => {
        setIsAttendanceLoading(true);
        try {
          const data = await getEmployeeAttendanceApi(employeeId);
          setAttendanceHistory(Array.isArray(data) ? data : []);
        } catch (err) {
          console.error("Failed to fetch attendance history", err);
        } finally {
          setIsAttendanceLoading(false);
        }
      };
      fetchAttendance();
    }
  }, [activeTab, employeeId]);

  useEffect(() => {
    if (activeTab === "assessments" && employeeId) {
      const fetchAssessments = async () => {
        setIsAssessmentsLoading(true);
        try {
          const data = await getEmployeeAssessmentsApi(employeeId);
          if (data && data.length > 0 && data[0].assessment) {
            setAssessmentsData(data[0].assessment);
          } else {
            setAssessmentsData([]);
          }
        } catch (err) {
          console.error("Failed to fetch assessments history", err);
        } finally {
          setIsAssessmentsLoading(false);
        }
      };
      fetchAssessments();
    }
  }, [activeTab, employeeId, assessmentsRefreshKey]);

  useEffect(() => {
    if (activeTab !== "vacations" || !employeeId) return;
    let cancelled = false;
    const loadLeaveRequests = async () => {
      setLeaveRequestsLoading(true);
      setLeaveRequestsForbidden(false);
      try {
        const data = await listLeaveRequestsApi({ employeeId, limit: "100" });
        if (!cancelled) {
          setLeaveRequests(data.requests || []);
          setLeaveRequestsForbidden(false);
        }
      } catch (err) {
        console.error("Failed to fetch leave requests", err);
        if (!cancelled) {
          setLeaveRequests([]);
          if (err?.status === 403) {
            setLeaveRequestsForbidden(true);
          } else {
            showToast(err?.message || "Failed to load leave requests", "error");
          }
        }
      } finally {
        if (!cancelled) setLeaveRequestsLoading(false);
      }
    };
    void loadLeaveRequests();
    return () => {
      cancelled = true;
    };
  }, [activeTab, employeeId, showToast]);

  useEffect(() => {
    if (activeTab !== "vacations" || !employeeId) return;
    let cancelled = false;
    const loadBalance = async () => {
      setLeaveBalanceLoading(true);
      setLeaveBalanceForbidden(false);
      try {
        const data = await getLeaveBalanceApi({ employeeId });
        if (!cancelled) {
          setLeaveBalanceSnapshot(data);
          setLeaveBalanceForbidden(false);
        }
      } catch (err) {
        console.error("Failed to fetch leave balance", err);
        if (!cancelled) {
          setLeaveBalanceSnapshot(null);
          if (err?.status === 403) {
            setLeaveBalanceForbidden(true);
          } else {
            showToast(err?.message || "Failed to load leave balance", "error");
          }
        }
      } finally {
        if (!cancelled) setLeaveBalanceLoading(false);
      }
    };
    void loadBalance();
    return () => {
      cancelled = true;
    };
  }, [activeTab, employeeId, showToast]);

  const employee = useMemo(
    () =>
      employees.find(
        (item) =>
          String(item.id ?? item._id ?? "") === String(employeeId ?? ""),
      ),
    [employeeId, employees],
  )

  useEffect(() => {
    if (!employeeId || !currentUser) {
      setAssessmentGate(null);
      return;
    }
    const selfById =
      currentUser.id != null &&
      String(currentUser.id) === String(employeeId);
    const selfByEmail =
      !!employee?.email &&
      !!currentUser.email &&
      String(employee.email).trim().toLowerCase() ===
      String(currentUser.email).trim().toLowerCase();
    if (selfById || selfByEmail) {
      setAssessmentGate({ canView: true, canSubmit: false });
      return;
    }
    if (currentUser.id == null) {
      setAssessmentGate(null);
      return;
    }
    let cancelled = false;
    setAssessmentGate(null);
    void (async () => {
      try {
        const r = await getAssessmentEligibilityApi(employeeId);
        if (!cancelled) {
          setAssessmentGate({
            canView: !!r.canAssess,
            canSubmit: !!r.canAssess,
          });
        }
      } catch {
        /* Leave null so legacy manager/TL/HR hints still apply for tab; submit stays API-strict */
        if (!cancelled) setAssessmentGate(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [employeeId, currentUser?.id, currentUser?.email, employee?.email]);

  const assignedTeams = useMemo(() => {
    if (!employee || !departments.length) return [];
    const found = [];
    departments.forEach(dept => {
      (dept.teams || []).forEach(team => {
        if ((team.members || []).includes(employee.email) || team.leaderEmail === employee.email) {
          found.push({ name: team.name, id: team.id, deptName: dept.name });
        }
      });
    });
    return found;
  }, [employee, departments])

  const teamChips = useMemo(() => {
    if (!employee) return [];
    const names = new Set();
    if (employee.team) names.add(employee.team);
    assignedTeams.forEach((t) => names.add(t.name));
    return [...names].filter(Boolean);
  }, [employee?.team, assignedTeams]);

  const mergedChecklist = useMemo(() => {
    if (!employee || !globalPolicy) return employee?.documentChecklist || [];
    const required = globalPolicy.documentRequirements || [];
    const existing = employee.documentChecklist || [];
    return required.map(req => {
      const found = existing.find(e => e.documentName === req.name);
      return {
        documentName: req.name,
        status: found?.status || "MISSING",
        submissionDate: found?.submissionDate || null,
        isMandatory: req.isMandatory
      };
    });
  }, [employee, globalPolicy])

  const handleResetPassword = async (values) => {
    try {
      await resetPasswordApi({ targetEmail: employee.email, newPassword: values.newPassword });
      showToast(`Password successfully reset for ${employee.email}`, "success");
      setShowResetModal(false);
    } catch (err) {
      showToast(err?.message || "Failed to reset password", "error");
    }
  }

  const isPeerView = employee?.apiViewContext === "peer";
  const viewerRoleKey = normaliseRoleKey(currentUser?.role);
  const idExpiryDays = daysUntil(employee?.nationalIdExpiryDate);
  const nextReviewAt =
    employee?.nextReviewDate ?? employee?.yearlySalaryIncreaseDate;
  const salaryIncreaseDays = daysUntil(nextReviewAt);
  const employeesAccessLevel = getEmployeesAccessLevel(currentUser);
  const canManageEmployeeActions = hasAccessLevel(employeesAccessLevel, ACCESS_LEVEL.EDIT);
  const canAdmin =
    canManageEmployeeActions &&
    (currentUser?.role === "ADMIN" || currentUser?.role === "HR_MANAGER");
  const canEditVacations =
    canManageEmployeeActions &&
    (currentUser?.role === "ADMIN" ||
      currentUser?.role === "HR_MANAGER" ||
      currentUser?.role === "HR_STAFF");
  const isSelf =
    (currentUser?.id != null &&
      employee?.id != null &&
      String(currentUser.id) === String(employee.id)) ||
    (!!currentUser?.email &&
      !!employee?.email &&
      String(currentUser.email).trim().toLowerCase() ===
      String(employee.email).trim().toLowerCase());
  const isLimitedManagerProfileView =
    !isSelf &&
    (viewerRoleKey === "MANAGER" || viewerRoleKey === "TEAM_LEADER") &&
    !isHrOrAdminRole(currentUser?.role);
  const isSelfOrAdmin = canAdmin || isSelf;

  const isDirectManager =
    employee?.managerId?.id === currentUser?.id ||
    employee?.effectiveManager?.id === currentUser?.id ||
    employee?.managerId === currentUser?.id;
  const isTeamLeader =
    employee?.teamLeaderId?.id === currentUser?.id ||
    employee?.effectiveTeamLeader?.id === currentUser?.id ||
    employee?.teamLeaderId === currentUser?.id;
  const legacyAssessHint =
    isHrOrAdminRole(currentUser?.role) ||
    isDirectManager ||
    isTeamLeader;
  const canViewAssessments =
    isSelf ||
    assessmentGate?.canView === true ||
    (assessmentGate === null && !isSelf && legacyAssessHint);
  const canSubmitAssessment =
    !isSelf && assessmentGate?.canSubmit === true;
  const canManageAssessments = isHrOrAdminRole(currentUser?.role);

  const transferHistory = employee?.transferHistory || [];

  const profileTabs = useMemo(() => {
    if (isLimitedManagerProfileView) {
      const tabs = ["overview", "vacations"];
      if (canViewAssessments) tabs.push("assessments");
      return tabs;
    }
    const tabs = ["overview", "documents", "transfer_history"];
    if (!isPeerView) tabs.push("salary_history");
    tabs.push("vacations", "attendance");
    if (canViewAssessments) tabs.push("assessments");
    return tabs;
  }, [isPeerView, canViewAssessments, isLimitedManagerProfileView]);

  useEffect(() => {
    if (isPeerView && activeTab === "salary_history") setActiveTab("overview");
    if (!profileTabs.includes(activeTab)) setActiveTab("overview");
  }, [isPeerView, activeTab, profileTabs]);

  const persistVacationRecords = useCallback(
    async (nextList) => {
      setVacationSaving(true);
      try {
        await dispatch(
          updateEmployeeThunk({
            id: employeeId,
            vacationRecords: serializeVacationRecords(
              nextList,
              currentUser?.email,
            ),
          }),
        ).unwrap();
        showToast("Vacation records saved", "success");
        return true;
      } catch (e) {
        const msg =
          typeof e === "string"
            ? e
            : e?.error || e?.message || "Failed to save vacations";
        showToast(msg, "error");
        return false;
      } finally {
        setVacationSaving(false);
      }
    },
    [dispatch, employeeId, currentUser?.email, showToast],
  );

  const addAsDirectLeaveRequest = useCallback(
    async ({ startDate, endDate, type, notes }) => {
      setVacationRecording(true);
      try {
        const created = await createLeaveRequestApi({
          employeeId,
          kind: "VACATION",
          leaveType: type,
          startDate,
          endDate,
          reason: notes,
          note: notes,
          onBehalf: true,
        });

        const requestId = created?._id || created?.id;
        if (!requestId) throw new Error("Failed to create leave request");

        await directRecordLeaveRequestApi(requestId, notes);

        try {
          const data = await listLeaveRequestsApi({ employeeId, limit: "100" });
          setLeaveRequests(data.requests || []);
        } catch {
          // Leave requests list can refresh on next tab load.
        }

        showToast("Saved as direct leave request", "success");
        return true;
      } catch (e) {
        showToast(
          e?.error || e?.message || "Failed to save as leave request",
          "error",
        );
        return false;
      } finally {
        setVacationRecording(false);
      }
    },
    [employeeId, showToast],
  );

  const addExcuseAsDirectLeaveRequest = useCallback(
    async ({ excuseDate, startTime, endTime, notes }) => {
      setVacationRecording(true);
      try {
        const created = await createLeaveRequestApi({
          employeeId,
          kind: "EXCUSE",
          excuseDate,
          startTime,
          endTime,
          reason: notes,
          note: notes,
          onBehalf: true,
        });

        const requestId = created?._id || created?.id;
        if (!requestId) throw new Error("Failed to create excuse request");

        await directRecordLeaveRequestApi(requestId, notes);

        try {
          const data = await listLeaveRequestsApi({ employeeId, limit: "100" });
          setLeaveRequests(data.requests || []);
        } catch {
          // Leave requests list can refresh on next tab load.
        }

        showToast("Excuse saved as direct leave request", "success");
        return true;
      } catch (e) {
        showToast(
          e?.error || e?.message || "Failed to save excuse as leave request",
          "error",
        );
        return false;
      } finally {
        setVacationRecording(false);
      }
    },
    [employeeId, showToast],
  );

  if (!employee) {
    return (
      <Layout title="Employee profile">
        <p className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-950">
          Employee not found.
        </p>
      </Layout>
    );
  }

  const vacationTabBadgeCount =
    (employee.vacationRecords?.length || 0) + leaveRequests.length;

  const handleTransfer = async (values) => {
    try {
      await transferEmployeeApi(employeeId, values);
      showToast("Employee transferred successfully", "success");
      setShowTransferModal(false);
      void dispatch(fetchEmployeesThunk());
    } catch (err) {
      showToast(err?.message || "Transfer failed", "error");
    }
  }

  const handleSalaryIncrease = async (values) => {
    try {
      const payload = {
        ...values,
        increasePercentage: values.method === "PERCENT" ? values.value : undefined,
        increaseAmount: values.method === "FIXED" ? values.value : undefined,
      };

      await processSalaryIncreaseApi({ id: employeeId, ...payload });
      showToast("Salary increase processed successfully", "success");
      setShowSalaryModal(false);
      void dispatch(fetchEmployeesThunk());
    } catch (err) {
      showToast(err?.message || "Increase failed", "error");
    }
  }

  const handleTerminate = async (values) => {
    try {
      await dispatch(updateEmployeeThunk({
        id: employeeId,
        status: values.status || "TERMINATED",
        terminationDate: values.terminationDate,
        terminationReason: values.terminationReason,
      })).unwrap();
      showToast(`${employee.fullName} marked as ${values.status || "TERMINATED"}`, "success");
      setShowTerminateModal(false);
    } catch (err) {
      showToast(err.message || "Termination failed", "error");
    }
  }
  const isTerminated = employee.status === "TERMINATED" || employee.status === "RESIGNED";

  return (
    <Layout
      className="max-w-5xl"
      title="Employee profile"
      description="Identity, role, documents, and contact in one place."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {(canAdmin || canEditVacations) && (
            <div className="relative group">
              <button type="button" className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200/90 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-medium text-zinc-800 dark:text-zinc-200 shadow-sm transition hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                <Settings className="h-4 w-4" />
                Manage
              </button>
              <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-2xl border border-zinc-200/90 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 p-1 opacity-0 shadow-xl ring-1 ring-zinc-950/[0.06] dark:ring-zinc-800 transition-all invisible group-hover:visible group-hover:opacity-100">
                {!isTerminated && canAdmin && (
                  <button
                    type="button"
                    onClick={() => setShowTransferModal(true)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 rounded-lg text-left"
                  >
                    <ArrowRightLeft className="h-3.5 w-3.5 shrink-0 text-zinc-500 dark:text-zinc-400" />
                    Transfer Department
                  </button>
                )}
                {!isTerminated && canEditVacations && (
                  <button
                    type="button"
                    onClick={() => setShowManualVacationModal(true)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 rounded-lg text-left"
                  >
                    <Plane className="h-3.5 w-3.5 shrink-0 text-zinc-500 dark:text-zinc-400" />
                    Manual vacation records
                  </button>
                )}
                {!isTerminated && canEditVacations && (
                  <button
                    type="button"
                    onClick={() => setShowLeaveBalanceCreditModal(true)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 rounded-lg text-left"
                  >
                    <Gift className="h-3.5 w-3.5 shrink-0 text-zinc-500 dark:text-zinc-400" />
                    Add vacation balance credit
                  </button>
                )}
                {!isTerminated && canAdmin && (
                  <button
                    type="button"
                    onClick={() => setShowSalaryModal(true)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 rounded-lg text-left"
                  >
                    <TrendingUp className="h-3.5 w-3.5 shrink-0 text-zinc-500 dark:text-zinc-400" />
                    Salary Increase
                  </button>
                )}
                {!isTerminated && canSubmitAssessment && (
                  <button
                    type="button"
                    onClick={() => setShowAssessmentModal(true)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-amber-600 hover:bg-amber-50 rounded-lg text-left"
                  >
                    <Star className="h-3.5 w-3.5 shrink-0" />
                    Submit Assessment
                  </button>
                )}
                {!isTerminated && canAdmin && (
                  <button
                    type="button"
                    onClick={() => setShowTerminateModal(true)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg text-left"
                  >
                    <UserX className="h-3.5 w-3.5 shrink-0" />
                    Terminate employment
                  </button>
                )}
              </div>
            </div>
          )}
          <Link
            className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200/90 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 shadow-sm transition hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
            to="/employees"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to list
          </Link>
        </div>
      }
    >
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-[20px] bg-white dark:bg-zinc-900 p-6 shadow-xl ring-1 ring-zinc-950/[0.08]">
            <h2 className="mb-2 text-base font-semibold text-zinc-900 dark:text-zinc-100">Reset password</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
              You are about to forcibly override the password for <strong>{employee?.email}</strong>.
            </p>
            <FormBuilder
              fields={[{ name: "newPassword", type: "password", label: "New Secure Password", required: true }]}
              submitLabel="Reset password"
              onCancel={() => setShowResetModal(false)}
              onSubmit={handleResetPassword}
            />
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* Hero banner */}
        <div className="relative overflow-hidden rounded-[20px] bg-white dark:bg-zinc-900 p-6 shadow-sm ring-1 ring-zinc-950/[0.06] dark:ring-zinc-800 md:p-8">
          <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-zinc-100/90 dark:bg-zinc-800/80" />
          <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-zinc-700 to-zinc-900 text-2xl font-semibold text-white shadow-md">
                {(employee.fullName?.trim()?.[0] || '?').toUpperCase()}
              </div>
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 md:text-2xl">{employee.fullName}</h2>
                {employee.fullNameArabic && (
                  <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400 font-arabic">{employee.fullNameArabic}</p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50 dark:bg-zinc-800/50 px-2.5 py-0.5 text-xs font-medium text-zinc-800 dark:text-zinc-200">
                    <Briefcase className="h-3.5 w-3.5" />
                    {employee.position || '—'}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50 dark:bg-zinc-800/50 px-2.5 py-0.5 text-xs font-medium text-zinc-800 dark:text-zinc-200">
                    <Mail className="h-3.5 w-3.5" />
                    {employee.email}
                  </span>
                  {employee.nationalIdExpiryDate && (
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${idExpiryDays <= 0 ? "bg-red-50 text-red-800 ring-red-200/80" :
                        idExpiryDays <= 30 ? "bg-amber-50 text-amber-900 ring-amber-200/80" :
                          "bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 ring-zinc-200/80 dark:ring-zinc-700"
                      }`}>
                      <AlertCircle className="h-3 w-3" />
                      ID: {idExpiryDays <= 0 ? "Expired" : idExpiryDays <= 30 ? "Expiring soon" : "Valid"}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/80 dark:bg-zinc-800/50 px-4 py-3 text-center md:text-left">
              <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Department</p>
              <p className="mt-0.5 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{employee.department || '—'}</p>
              {employee.employeeCode && (
                <p className="mt-1 font-mono text-[10px] text-zinc-500 dark:text-zinc-400">{employee.employeeCode}</p>
              )}
            </div>
          </div>
        </div>

        {/* Termination Info Banner */}
        {isTerminated && (
          <div className="relative overflow-hidden rounded-xl border border-rose-200 border-l-[6px] border-l-rose-500 bg-rose-50/60 p-4 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-rose-900 uppercase tracking-wide">
                  {employee.status === "RESIGNED" ? "Employee Resigned" : "Employment Terminated"}
                </h3>
                <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-rose-800">
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-rose-500" />
                    <span className="font-medium">Exit Date:</span>
                    <span className="font-bold">
                      {employee.terminationDate
                        ? new Date(employee.terminationDate).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })
                        : "Not recorded"}
                    </span>
                  </div>
                  {employee.terminationReason && (
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium">Reason:</span>
                      <span>{employee.terminationReason}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {isPeerView && (
          <div className="rounded-[20px] border border-zinc-200/90 dark:border-zinc-800/80 bg-zinc-50/80 dark:bg-zinc-800/50 p-4 text-sm text-zinc-800 dark:text-zinc-200 shadow-sm ring-1 ring-zinc-950/[0.04]">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-700 dark:text-zinc-300">Limited directory view</p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
              Personal ID details, salary and bank data, personal contact fields, and document download links are not shown at this access level. The email shown is the work email when available.
            </p>
          </div>
        )}

        {/* Modern Professional Alert Banners */}
        {isSelfOrAdmin && idExpiryDays !== null && idExpiryDays <= 60 && (
          <div className={`relative overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 border-l-[6px] p-4 flex items-center gap-4 bg-white dark:bg-zinc-900 shadow-sm transition-all hover:shadow-md ${idExpiryDays <= 0 ? "border-l-rose-500" : "border-l-amber-500"
            }`}>
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${idExpiryDays <= 0 ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-600"
              }`}>
              <AlertTriangle className="h-5 w-5" />
            </div>

            <div className="flex-1">
              <span className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 leading-none mb-1">
                {idExpiryDays <= 0 ? "Critical Compliance" : "Document Renewal"}
              </span>
              <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100 leading-tight">
                {idExpiryDays <= 0 ? (
                  <>National ID EXPIRED on {new Date(employee.nationalIdExpiryDate).toLocaleDateString()}. Renewal required immediately.</>
                ) : (
                  <>
                    National ID expires in <strong className="text-amber-600">{idExpiryDays} day{idExpiryDays !== 1 ? "s" : ""}</strong>
                    {" "}({new Date(employee.nationalIdExpiryDate).toLocaleDateString()}).
                  </>
                )}
              </p>
            </div>
          </div>
        )}

        {isSelfOrAdmin && salaryIncreaseDays !== null && salaryIncreaseDays <= 30 && salaryIncreaseDays > 0 && (
          <div className="relative flex items-center gap-4 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 border-l-[6px] border-l-zinc-900 bg-white dark:bg-zinc-900 p-4 shadow-sm transition-all hover:shadow-md">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 ring-1 ring-zinc-200/80 dark:ring-zinc-700">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Upcoming cycle</span>
              <p className="text-sm font-semibold leading-tight text-zinc-900 dark:text-zinc-100">
                Salary increase due in <strong className="text-zinc-900 dark:text-zinc-100">{salaryIncreaseDays} day{salaryIncreaseDays !== 1 ? "s" : ""}</strong>
                {" "}({new Date(nextReviewAt).toLocaleDateString()}).
              </p>
            </div>
          </div>
        )}

        {/* Tab nav */}
        <div className="no-scrollbar flex gap-0.5 overflow-x-auto rounded-2xl bg-zinc-100/90 dark:bg-zinc-800/80 p-1 ring-1 ring-zinc-200/80 dark:ring-zinc-700">
          {profileTabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${activeTab === tab
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm ring-1 ring-zinc-200/60"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                }`}
            >
              {tab === "overview" && <Briefcase className="h-3.5 w-3.5" />}
              {tab === "overview" && "Overview"}

              {tab === "documents" && <Shield className="h-3.5 w-3.5" />}
              {tab === "documents" && "Documents"}

              {tab === "transfer_history" && <ArrowRightLeft className="h-3.5 w-3.5" />}
              {tab === "transfer_history" && "Transfers"}

              {tab === "salary_history" && <TrendingUp className="h-3.5 w-3.5" />}
              {tab === "salary_history" && "Salary History"}

              {tab === "vacations" && <Plane className="h-3.5 w-3.5" />}
              {tab === "vacations" && "Vacations"}

              {tab === "attendance" && <Clock className="h-3.5 w-3.5" />}
              {tab === "attendance" && "Attendance"}

              {tab === "assessments" && <Star className="h-3.5 w-3.5 text-amber-500" />}
              {tab === "assessments" && "Assessments"}

              {tab === "vacations" && vacationTabBadgeCount > 0 && (
                <span className="rounded-full bg-zinc-200/80 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-800 dark:text-zinc-200 ring-1 ring-zinc-300/60">
                  {vacationTabBadgeCount}
                </span>
              )}

              {tab === "salary_history" && (employee.salaryHistory || []).length > 0 && (
                <span className="rounded-full bg-zinc-200/80 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-800 dark:text-zinc-200 ring-1 ring-zinc-300/60">
                  {employee.salaryHistory.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {activeTab === "overview" && (
          isLimitedManagerProfileView ? (
            <div className="grid gap-4 rounded-2xl border border-zinc-200/90 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 p-6 shadow-sm ring-1 ring-zinc-950/[0.04] md:grid-cols-2 lg:grid-cols-3">
              <h3 className="col-span-full flex items-center gap-2 border-b border-zinc-200/80 dark:border-zinc-800/80 pb-3 text-xs font-semibold uppercase tracking-wide text-zinc-800 dark:text-zinc-200">
                <span className="h-1.5 w-1.5 rounded-full bg-zinc-700" />
                Employee basic profile
              </h3>
              <p>
                <span className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Full Name</span>
                <span className="text-zinc-900 dark:text-zinc-100">{employee.fullName || "N/A"}</span>
              </p>
              <p>
                <span className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Employee Code</span>
                <span className="text-zinc-900 dark:text-zinc-100 font-mono bg-zinc-50 dark:bg-zinc-800/50 px-1.5 py-0.5 rounded border border-zinc-100 dark:border-zinc-800/50">
                  {employee.employeeCode || "N/A"}
                </span>
              </p>
              <p>
                <span className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Email</span>
                <span className="text-zinc-900 dark:text-zinc-100">{employee.email || employee.workEmail || "N/A"}</span>
              </p>
              <p>
                <span className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Department</span>
                <span className="text-zinc-900 dark:text-zinc-100">{employee.department || "N/A"}</span>
              </p>
              <p>
                <span className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Team / Unit</span>
                <span className="text-zinc-900 dark:text-zinc-100">{employee.team || "N/A"}</span>
              </p>
              <p>
                <span className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Hire Date</span>
                <span className="text-zinc-900 dark:text-zinc-100">
                  {employee.dateOfHire ? new Date(employee.dateOfHire).toLocaleDateString() : "N/A"}
                </span>
              </p>
            </div>
          ) : (
            <>
              {/* Role & Workplace */}
              <div className="grid gap-4 rounded-2xl border border-zinc-200/90 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 p-6 shadow-sm ring-1 ring-zinc-950/[0.04] md:grid-cols-2 lg:grid-cols-3">
                <h3 className="col-span-full flex items-center gap-2 border-b border-zinc-200/80 dark:border-zinc-800/80 pb-3 text-xs font-semibold uppercase tracking-wide text-zinc-800 dark:text-zinc-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-zinc-700" />
                  Role & workplace
                </h3>
                <p><span className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Employee Code</span> <span className="text-zinc-900 dark:text-zinc-100 font-mono bg-zinc-50 dark:bg-zinc-800/50 px-1.5 py-0.5 rounded border border-zinc-100 dark:border-zinc-800/50">{employee.employeeCode || "N/A"}</span></p>
                <p><span className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Status</span> <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${employee.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-amber-50 text-amber-700 border border-amber-100'}`}>{employee.status}</span></p>
                {(employee.status === "RESIGNED" || employee.status === "TERMINATED") && (employee.terminationDate || employee.terminationReason) && (
                  <p className="md:col-span-2">
                    <span className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Separation</span>
                    <span className="text-zinc-900 dark:text-zinc-100 text-sm">
                      {employee.terminationDate ? new Date(employee.terminationDate).toLocaleDateString() : "—"}
                      {employee.terminationReason ? ` · ${employee.terminationReason}` : ""}
                    </span>
                  </p>
                )}
                <p><span className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Hire Date</span> <span className="text-zinc-900 dark:text-zinc-100">{employee.dateOfHire ? new Date(employee.dateOfHire).toLocaleDateString() : "N/A"}</span></p>
                <p><span className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Next review</span> <span className="text-zinc-900 dark:text-zinc-100">{nextReviewAt ? new Date(nextReviewAt).toLocaleDateString() : "N/A"}</span></p>
                <p><span className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Job Title</span> <span className="text-zinc-900 dark:text-zinc-100">{employee.position}</span></p>
                <div className="flex flex-col gap-1"><span className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Department</span> <DepartmentBadge name={employee.department || "—"} /></div>
                <div className="flex flex-col gap-1">
                  <span className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Team / Unit</span>
                  <div className="flex flex-wrap gap-1">
                    {teamChips.length > 0 ? (
                      teamChips.map((name, idx) => (
                        <span key={`${name}-${idx}`} className="rounded-lg border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50 dark:bg-zinc-800/50 px-2 py-0.5 text-xs font-semibold text-zinc-800 dark:text-zinc-200">{name}</span>
                      ))
                    ) : (
                      <span className="text-zinc-400 italic text-sm">No team assigned</span>
                    )}
                  </div>
                </div>
                <p><span className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Contract</span> <span className="text-zinc-900 dark:text-zinc-100 capitalize">{employee.employmentType?.replace('_', ' ').toLowerCase()}</span></p>
                <p>
                  <span className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Work Location</span>
                  <span className="text-zinc-900 dark:text-zinc-100 flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-zinc-400" />
                    {[employee.workLocation, employee.subLocation].filter(Boolean).join(" · ") || "N/A"}
                  </span>
                </p>
                {employee.onlineStorageLink && (
                  <p className="col-span-full">
                    <span className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-1">Online Documents</span>
                    <a
                      href={employee.onlineStorageLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50 dark:bg-zinc-800/50 px-3 py-1.5 text-xs font-medium text-zinc-900 dark:text-zinc-100 transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                      Access Digital Archive
                    </a>
                  </p>
                )}
              </div>

              {/* Personal + Contact row */}
              <div className="grid gap-6 md:grid-cols-2">
                <div className="grid gap-4 rounded-2xl border border-zinc-200/90 dark:border-zinc-800/80 bg-gradient-to-b from-white to-zinc-50/35 p-6 shadow-sm ring-1 ring-zinc-950/[0.04]">
                  <h3 className="border-b border-zinc-200/80 dark:border-zinc-800/80 pb-2 text-xs font-semibold uppercase tracking-wide text-zinc-900 dark:text-zinc-100">Personal</h3>
                  <p><span className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Full Name (EN)</span> <span className="text-zinc-900 dark:text-zinc-100 font-medium">{employee.fullName}</span></p>
                  {employee.fullNameArabic && (
                    <p><span className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Full Name (AR)</span> <span className="text-zinc-900 dark:text-zinc-100 font-medium">{employee.fullNameArabic}</span></p>
                  )}
                  <p><span className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Date of Birth</span> <span className="text-zinc-900 dark:text-zinc-100">{employee.dateOfBirth ? new Date(employee.dateOfBirth).toLocaleDateString() : "N/A"}</span></p>
                  <p><span className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Gender</span> <span className="text-zinc-900 dark:text-zinc-100 capitalize">{employee.gender?.toLowerCase()}</span></p>
                  <p><span className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Marital Status</span> <span className="text-zinc-900 dark:text-zinc-100 capitalize">{employee.maritalStatus?.toLowerCase()}</span></p>
                  <p><span className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Nationality / ID</span> <span className="text-zinc-900 dark:text-zinc-100">{employee.nationality || "N/A"} {employee.idNumber ? `(${employee.idNumber})` : ""}</span></p>
                  {canAdmin && employee.nationalIdExpiryDate && (
                    <p>
                      <span className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">ID Expiry</span>
                      <span className={`text-sm font-medium ${idExpiryDays !== null && idExpiryDays <= 14 ? "text-red-600" : idExpiryDays !== null && idExpiryDays <= 60 ? "text-amber-600" : "text-zinc-900 dark:text-zinc-100"}`}>
                        {new Date(employee.nationalIdExpiryDate).toLocaleDateString()}
                        {idExpiryDays !== null && idExpiryDays > 0 && ` (${idExpiryDays}d)`}
                        {idExpiryDays !== null && idExpiryDays <= 0 && " ⚠ Expired"}
                      </span>
                    </p>
                  )}
                </div>

                <div className="grid gap-4 rounded-2xl border border-zinc-200/90 dark:border-zinc-800/80 bg-gradient-to-b from-white to-zinc-50/40 p-6 shadow-sm ring-1 ring-zinc-950/[0.04]">
                  <h3 className="border-b border-zinc-100 dark:border-zinc-800/50 pb-2 text-xs font-semibold uppercase tracking-wide text-zinc-900 dark:text-zinc-100">Contact</h3>
                  <p><span className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Personal Email</span> <span className="text-zinc-900 dark:text-zinc-100 underline decoration-zinc-300">{employee.email}</span></p>
                  <p><span className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Work Email</span> <span className="text-zinc-900 dark:text-zinc-100 underline decoration-zinc-300">{employee.workEmail || "N/A"}</span></p>
                  <p><span className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Phone</span> <span className="text-zinc-900 dark:text-zinc-100">{employee.phoneNumber || "N/A"}</span></p>
                  {employee.emergencyPhone && (
                    <p>
                      <span className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Emergency Phone</span>
                      <span className="text-zinc-900 dark:text-zinc-100 flex items-center gap-1">
                        <Phone className="h-3 w-3 text-red-400" />
                        {employee.emergencyPhone}
                      </span>
                    </p>
                  )}
                  <p><span className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Address</span> <span className="text-zinc-900 dark:text-zinc-100 whitespace-pre-line">{employee.address || "N/A"}</span></p>
                  {(employee.governorate || employee.city) && (
                    <p>
                      <span className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Governorate / City</span>
                      <span className="text-zinc-900 dark:text-zinc-100 flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-zinc-400" />
                        {[employee.governorate, employee.city].filter(Boolean).join(", ")}
                      </span>
                    </p>
                  )}
                  {(employee.additionalContact?.whatsapp || employee.additionalContact?.skype) && (
                    <p>
                      <span className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">WhatsApp / Skype</span>
                      <span className="text-zinc-900 dark:text-zinc-100 text-sm">
                        {[employee.additionalContact?.whatsapp, employee.additionalContact?.skype].filter(Boolean).join(" · ") || "—"}
                      </span>
                    </p>
                  )}
                </div>

                {/* Management hierarchy */}
                <div className="grid gap-4 rounded-2xl border border-zinc-200/90 dark:border-zinc-800/80 bg-gradient-to-b from-white to-zinc-50/35 p-6 shadow-sm ring-1 ring-zinc-950/[0.04]">
                  <h3 className="border-b border-zinc-100 dark:border-zinc-800/50 pb-2 text-xs font-semibold uppercase tracking-wide text-zinc-900 dark:text-zinc-100">Management & reporting</h3>
                  <div className="flex flex-col gap-4">
                    <div>
                      <span className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Direct Manager</span>
                      <div className="mt-1 flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-500 dark:text-zinc-400 shadow-inner">
                          {(employee.effectiveManager?.fullName || employee.managerId?.fullName)?.[0] || "?"}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{employee.effectiveManager?.fullName || employee.managerId?.fullName || "Not Assigned"}</p>
                          <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">{employee.effectiveManager?.email || employee.managerId?.email || "No contact info"}</p>
                        </div>
                      </div>
                    </div>
                    <div className="h-px bg-zinc-100 dark:bg-zinc-800 w-full" />
                    <div>
                      <span className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Team Leader</span>
                      <div className="mt-1 flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-xs font-bold text-zinc-600 dark:text-zinc-400 shadow-inner ring-1 ring-zinc-200/80 dark:ring-zinc-700">
                          {(employee.effectiveTeamLeader?.fullName || employee.teamLeaderId?.fullName)?.[0] || "?"}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{employee.effectiveTeamLeader?.fullName || employee.teamLeaderId?.fullName || "Not Assigned"}</p>
                          <p className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">{employee.effectiveTeamLeader?.email || employee.teamLeaderId?.email || "Direct field support"}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Education & Skills */}
              <div className="grid gap-4 rounded-2xl border border-zinc-200/90 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 p-6 shadow-sm ring-1 ring-zinc-950/[0.04]/10 md:grid-cols-3">
                <h3 className="col-span-full border-b border-zinc-100 dark:border-zinc-800/50 pb-2 text-xs font-semibold uppercase tracking-wide text-zinc-900 dark:text-zinc-100">Education & skills</h3>
                <div>
                  <span className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-2">Education</span>
                  {employee.education?.length > 0 ? (
                    <ul className="space-y-2">
                      {employee.education.map((edu, idx) => (
                        <li key={idx} className="text-sm bg-zinc-50 dark:bg-zinc-800/50 p-2 rounded-lg border border-zinc-100 dark:border-zinc-800/50">
                          <span className="font-semibold text-zinc-800 dark:text-zinc-200">{edu.degree || "—"}</span>
                          {edu.institution ? <> from <span className="text-zinc-600 dark:text-zinc-400">{edu.institution}</span></> : null}
                          {" "}
                          ({edu.graduationDate
                            ? new Date(edu.graduationDate).toLocaleDateString()
                            : (edu.year || "—")})
                        </li>
                      ))}
                    </ul>
                  ) : <span className="text-zinc-400 italic">No education records</span>}
                </div>
                <div>
                  <span className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-2">Technical skills</span>
                  <div className="flex flex-wrap gap-1.5">
                    {employee.skills?.technical?.length > 0 ? (
                      employee.skills.technical.map(skill => (
                        <span key={skill} className="rounded-md border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50 dark:bg-zinc-800/50 px-2 py-0.5 text-xs font-medium text-zinc-900 dark:text-zinc-100">{skill}</span>
                      ))
                    ) : <span className="text-zinc-400 italic">None listed</span>}
                  </div>
                </div>
                <div>
                  <span className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-2">Soft skills</span>
                  <div className="flex flex-wrap gap-1.5">
                    {employee.skills?.soft?.length > 0 ? (
                      employee.skills.soft.map(skill => (
                        <span key={skill} className="rounded-md border border-amber-200/80 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-950">{skill}</span>
                      ))
                    ) : <span className="text-zinc-400 italic">None listed</span>}
                  </div>
                </div>
                <div className="col-span-full grid gap-4 md:grid-cols-2">
                  <div>
                    <span className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-2">Training courses</span>
                    {employee.trainingCourses?.length > 0 ? (
                      <ul className="space-y-1 text-sm text-zinc-800 dark:text-zinc-200">
                        {employee.trainingCourses.map((c) => (
                          <li key={c} className="rounded-lg border border-zinc-100 dark:border-zinc-800/50 bg-zinc-50 dark:bg-zinc-800/50 px-2 py-1">{c}</li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-zinc-400 italic text-sm">None listed</span>
                    )}
                  </div>
                  <div>
                    <span className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-2">Languages</span>
                    {employee.languages?.length > 0 ? (
                      <ul className="space-y-1 text-sm text-zinc-800 dark:text-zinc-200">
                        {employee.languages.map((row, idx) => (
                          <li key={`${row.language}-${idx}`} className="rounded-lg border border-zinc-100 dark:border-zinc-800/50 bg-zinc-50 dark:bg-zinc-800/50 px-2 py-1">
                            {row.language}
                            {row.proficiency ? (
                              <span className="text-zinc-500 dark:text-zinc-400"> ({row.proficiency})</span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-zinc-400 italic text-sm">None listed</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Benefits & Financial */}
              {isSelfOrAdmin ? (
                <div className="grid gap-4 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/80 bg-gradient-to-br from-zinc-50/80 to-white p-6 shadow-sm">
                  <div className="col-span-full flex items-center justify-between border-b border-zinc-200/50 dark:border-zinc-800/80 pb-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-900 dark:text-zinc-100">Benefits & financial</h3>
                    <span className="flex items-center gap-1 rounded-md bg-zinc-200/60 px-2 py-0.5 text-[10px] font-medium uppercase text-zinc-900 dark:text-zinc-100">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                      {isSelf ? "My Records" : "Admin Access"}
                    </span>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <span className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Base Salary</span>
                      <span className="text-zinc-900 dark:text-zinc-100 font-mono text-lg font-bold">
                        {employee.financial?.baseSalary
                          ? new Intl.NumberFormat('en-EG', { style: 'currency', currency: employee.financial?.currency || 'EGP' }).format(employee.financial.baseSalary)
                          : "N/A"}
                      </span>
                    </div>
                    <div>
                      <span className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Insurance Provider</span>
                      <span className="text-zinc-900 dark:text-zinc-100 font-medium">{employee.insurance?.provider || "N/A"}</span>
                    </div>
                    <div>
                      <span className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Policy Number</span>
                      <span className="text-zinc-900 dark:text-zinc-100 font-mono tracking-wide">{employee.insurance?.policyNumber || "N/A"}</span>
                    </div>
                    <div>
                      <span className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Policy valid until</span>
                      <span className="text-zinc-900 dark:text-zinc-100">{employee.insurance?.validUntil ? new Date(employee.insurance.validUntil).toLocaleDateString() : "N/A"}</span>
                    </div>
                    <div className="md:col-span-2">
                      <span className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Medical Condition / Disease</span>
                      <span className="text-zinc-900 dark:text-zinc-100">{employee.medicalCondition || "N/A"}</span>
                    </div>
                    <div>
                      <span className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Payment Method</span>
                      <span className="text-zinc-900 dark:text-zinc-100 font-medium capitalize">{employee.financial?.paymentMethod?.replace('_', ' ').toLowerCase() || "N/A"}</span>
                    </div>
                    <div>
                      <span className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Bank Account</span>
                      <span className="text-zinc-900 dark:text-zinc-100 font-mono tracking-wide">{employee.financial?.bankAccount || "N/A"}</span>
                    </div>
                    <div>
                      <span className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Allowances</span>
                      <span className="text-zinc-900 dark:text-zinc-100 font-mono text-sm font-bold">
                        {employee.financial?.allowances != null
                          ? new Intl.NumberFormat("en-EG", { style: "currency", currency: employee.financial?.currency || "EGP" }).format(employee.financial.allowances)
                          : "N/A"}
                      </span>
                    </div>
                    <div>
                      <span className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Social security ref.</span>
                      <span className="text-zinc-900 dark:text-zinc-100">{employee.financial?.socialSecurity || "N/A"}</span>
                    </div>
                  </div>

                  {/* Social Insurance & Medical */}
                  <div className="mt-2 border-t border-zinc-200/50 dark:border-zinc-800/80 pt-4">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-900 dark:text-zinc-100 mb-3">Social Insurance & Medical</h4>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <span className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Status</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${employee.socialInsurance?.status === 'INSURED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800'}`}>
                          {employee.socialInsurance?.status === 'INSURED' ? 'Insured' : 'Not Insured'}
                        </span>
                      </div>
                      <div>
                        <span className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Insurance Number</span>
                        <span className="text-zinc-900 dark:text-zinc-100 font-mono tracking-wide">{employee.socialInsurance?.insuranceNumber || "N/A"}</span>
                      </div>
                      <div>
                        <span className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Subscription Wage</span>
                        <span className="text-zinc-900 dark:text-zinc-100 font-mono text-sm font-bold">
                          {employee.socialInsurance?.subscriptionWage
                            ? new Intl.NumberFormat('en-EG', { style: 'currency', currency: 'EGP' }).format(employee.socialInsurance.subscriptionWage)
                            : "N/A"}
                        </span>
                      </div>
                      <div>
                        <span className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Insurance Date</span>
                        <span className="text-zinc-900 dark:text-zinc-100">{employee.socialInsurance?.insuranceDate ? new Date(employee.socialInsurance.insuranceDate).toLocaleDateString() : "N/A"}</span>
                      </div>
                      <div>
                        <span className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Form 6 / Expiry</span>
                        <span className="text-zinc-900 dark:text-zinc-100">{employee.socialInsurance?.form6Date ? new Date(employee.socialInsurance.form6Date).toLocaleDateString() : "N/A"}</span>
                      </div>
                      <div>
                        <span className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Basic Wage (Fixed)</span>
                        <span className="text-zinc-900 dark:text-zinc-100 font-mono text-sm font-bold">
                          {employee.socialInsurance?.basicWage
                            ? new Intl.NumberFormat('en-EG', { style: 'currency', currency: 'EGP' }).format(employee.socialInsurance.basicWage)
                            : "N/A"}
                        </span>
                      </div>
                      <div>
                        <span className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Comprehensive Wage (Total)</span>
                        <span className="text-zinc-900 dark:text-zinc-100 font-mono text-sm font-bold">
                          {employee.socialInsurance?.comprehensiveWage
                            ? new Intl.NumberFormat('en-EG', { style: 'currency', currency: 'EGP' }).format(employee.socialInsurance.comprehensiveWage)
                            : "N/A"}
                        </span>
                      </div>
                      <div>
                        <span className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Job Type (Work Type)</span>
                        <span className="text-zinc-900 dark:text-zinc-100">{employee.socialInsurance?.jobType || "N/A"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Multiple insurances */}
                  {employee.insurances?.length > 0 && (
                    <div className="mt-2">
                      <span className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-2">All Insurance Records</span>
                      <div className="grid gap-2 md:grid-cols-2">
                        {employee.insurances.map((ins, idx) => (
                          <div key={idx} className="rounded-lg border border-zinc-100 dark:border-zinc-800/50 bg-zinc-50/40 dark:bg-zinc-800/50 p-3 text-xs">
                            <p className="font-semibold text-zinc-800 dark:text-zinc-200">{ins.providerName || "—"}</p>
                            <p className="text-zinc-500 dark:text-zinc-400">Policy: {ins.policyNumber || "—"} · {ins.coverageType || "—"}</p>
                            {ins.expiryDate && <p className="text-zinc-500 dark:text-zinc-400 mt-0.5">Expires: {new Date(ins.expiryDate).toLocaleDateString()}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid gap-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-card grayscale opacity-60 relative overflow-hidden pointer-events-none">
                  <div className="absolute inset-0 z-10 bg-zinc-100/40 dark:bg-zinc-800/80 backdrop-blur-[1px] flex items-center justify-center">
                    <div className="bg-zinc-900 text-white px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2">
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                      Restricted Access
                    </div>
                  </div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Benefits & Financial Information</h3>
                  <div className="grid gap-4 md:grid-cols-4">
                    <p><span className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Base Salary</span> <span className="text-zinc-400">••••••</span></p>
                    <p><span className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">Provider</span> <span className="text-zinc-400">••••••••••</span></p>
                  </div>
                </div>
              )}
            </>
          )
        )}

        {activeTab === "documents" && (
          <div className="rounded-2xl border border-zinc-200/90 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 p-6 shadow-sm ring-1 ring-zinc-950/[0.04]/5">
            <div className="mb-4 flex flex-col gap-3 border-b border-zinc-100 dark:border-zinc-800/50 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-900 dark:text-zinc-100">Required documents</h3>
              <div className="flex flex-col items-end">
                <span className="mb-1 text-[10px] font-bold uppercase tracking-widest text-zinc-800 dark:text-zinc-200">
                  {mergedChecklist.filter(d => d.status === "RECEIVED").length} / {mergedChecklist.length} received
                </span>
                <div className="h-1.5 w-36 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-zinc-700 to-zinc-900 transition-all duration-700"
                    style={{ width: `${(mergedChecklist.filter(d => d.status === "RECEIVED").length / Math.max(1, mergedChecklist.length)) * 100}%` }}
                  />
                </div>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {mergedChecklist.length > 0 ? (
                mergedChecklist.map((doc, idx) => (
                  <div key={idx} className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${doc.status === "RECEIVED" ? 'bg-emerald-50/30 border-emerald-100/50' : 'bg-rose-50/30 border-rose-100/50'}`}>
                    <div className={`mt-0.5 shrink-0 w-4 h-4 rounded-full flex items-center justify-center ${doc.status === "RECEIVED" ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                      {doc.status === "RECEIVED" ? (
                        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4"><path d="M5 13l4 4L19 7" /></svg>
                      ) : (
                        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4"><path d="M6 18L18 6M6 6l12 12" /></svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate" title={doc.documentName}>{doc.documentName}</p>
                        {doc.isMandatory && <span className="text-[8px] bg-rose-100 text-rose-600 px-1 rounded font-bold shrink-0">REQUIRED</span>}
                      </div>
                      {doc.status === "RECEIVED" && doc.submissionDate ? (
                        <p className="text-[9px] text-emerald-600 font-medium mt-0.5">Submitted {new Date(doc.submissionDate).toLocaleDateString()}</p>
                      ) : (
                        <p className="text-[9px] text-rose-500 font-medium mt-0.5 italic">Pending Submission</p>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-full py-4 text-center">
                  <p className="text-xs text-zinc-400 italic">No global document requirements defined in Organization Rules.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "transfer_history" && (
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-200">Transfer History</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Department transfers for {employee.fullName}</p>
              </div>
              <span className="rounded-full border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-100 dark:bg-zinc-800 px-3 py-1 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                {transferHistory.length} record{transferHistory.length !== 1 ? "s" : ""}
              </span>
            </div>

            {transferHistory.length === 0 ? (
              <div className="py-16 text-center">
                <ArrowRightLeft className="h-10 w-10 text-zinc-300 mx-auto mb-3" />
                <p className="text-zinc-400 italic text-sm">No transfers recorded yet.</p>
              </div>
            ) : (
              <div className="relative">
                <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-zinc-100 dark:bg-zinc-800" />
                <ol className="space-y-6">
                  {[...transferHistory].reverse().map((record, idx) => {
                    const noteText = String(record.notes || "").toLowerCase();
                    const isReactivated =
                      noteText.includes("reactivated") ||
                      noteText.includes("-> active");
                    const isTerminated =
                      noteText.includes("to terminated") ||
                      noteText.includes("to resigned");
                    const markerClass = isReactivated
                      ? "bg-emerald-500"
                      : isTerminated
                        ? "bg-rose-500"
                        : "bg-zinc-600";
                    const cardClass = isReactivated
                      ? "rounded-xl border border-emerald-200 bg-emerald-50/60 p-4"
                      : isTerminated
                        ? "rounded-xl border border-rose-200 bg-rose-50/60 p-4"
                        : "rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-800/50 p-4";
                    const toDeptClass = isReactivated
                      ? "text-emerald-700"
                      : isTerminated
                        ? "text-rose-700"
                        : "text-zinc-700 dark:text-zinc-300";
                    const arrowClass = isReactivated
                      ? "h-3.5 w-3.5 text-emerald-500"
                      : isTerminated
                        ? "h-3.5 w-3.5 text-rose-500"
                        : "h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400";

                    return (
                      <li key={idx} className="relative pl-12">
                        <div className={`absolute left-3.5 top-1.5 w-3 h-3 rounded-full border-2 border-white shadow ${markerClass}`} />
                        <div className={cardClass}>
                          <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                              <span className="text-zinc-500 dark:text-zinc-400">{record.fromDepartmentName || "—"}</span>
                              <ArrowRightLeft className={arrowClass} />
                              <span className={toDeptClass}>{record.toDepartmentName}</span>
                            </div>
                            <span className="text-xs text-zinc-500 dark:text-zinc-400 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full px-2.5 py-0.5">
                              {new Date(record.transferDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                            {record.newPosition && (
                              <div>
                                <p className="text-zinc-400 uppercase tracking-wide mb-0.5">New Position</p>
                                <p className="font-medium text-zinc-700 dark:text-zinc-300">{record.newPosition}</p>
                              </div>
                            )}
                            {record.newSalary && (
                              <div>
                                <p className="text-zinc-400 uppercase tracking-wide mb-0.5">New Salary</p>
                                <p className="font-medium text-zinc-700 dark:text-zinc-300">{new Intl.NumberFormat("en-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(record.newSalary)}</p>
                              </div>
                            )}
                            {((record.nextReviewDateReset && record.nextReviewDateAfterTransfer) ||
                              (record.yearlyIncreaseDateChanged && record.newYearlyIncreaseDate)) && (
                                <div>
                                  <p className="text-zinc-400 uppercase tracking-wide mb-0.5">Next review after transfer</p>
                                  <p className="font-medium text-zinc-800 dark:text-zinc-200">
                                    {new Date(
                                      record.nextReviewDateAfterTransfer || record.newYearlyIncreaseDate,
                                    ).toLocaleDateString()}
                                  </p>
                                </div>
                              )}
                            {record.newEmployeeCode && (
                              <div>
                                <p className="text-zinc-400 uppercase tracking-wide mb-0.5">New Code</p>
                                <p className="font-medium text-zinc-800 dark:text-zinc-200">
                                  {record.previousEmployeeCode && <span className="text-zinc-400 line-through mr-1">{record.previousEmployeeCode}</span>}
                                  {record.newEmployeeCode}
                                </p>
                              </div>
                            )}
                            {record.processedBy && (
                              <div className="col-span-full mt-2 border-t border-zinc-200/50 dark:border-zinc-800/80 pt-2">
                                <p className="text-zinc-400 uppercase tracking-wide mb-0.5">Processed By</p>
                                <p className="font-medium text-zinc-600 dark:text-zinc-400">{record.processedBy}</p>
                              </div>
                            )}
                            {record.notes && (
                              <div className="col-span-full border-t border-zinc-200 dark:border-zinc-800 pt-2 mt-1">
                                <p className="text-zinc-400 uppercase tracking-wide mb-0.5">Notes</p>
                                <p className="text-zinc-600 dark:text-zinc-400">{record.notes}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}
          </div>
        )}
        {activeTab === "salary_history" && isSelfOrAdmin && (
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-200">Salary Increase History</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 tracking-wide">Historical timeline of base salary adjustments for {employee.fullName}</p>
              </div>
              <TrendingUp className="h-6 w-6 text-zinc-600 dark:text-zinc-400" />
            </div>

            {(employee.salaryHistory || []).length === 0 ? (
              <div className="py-20 text-center border-2 border-dashed border-zinc-100 dark:border-zinc-800/50 rounded-3xl">
                <TrendingUp className="h-10 w-10 text-zinc-200 mx-auto mb-3" />
                <p className="text-zinc-400 italic text-sm">No recorded salary increases for this employee.</p>
              </div>
            ) : (
              <div className="relative">
                <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-zinc-50 dark:bg-zinc-800/50" />
                <ol className="space-y-8">
                  {[...employee.salaryHistory].reverse().map((record, idx) => (
                    <li key={idx} className="relative pl-12">
                      <div className="absolute left-3.5 top-1.5 w-3 h-3 rounded-full bg-zinc-700 border-2 border-white shadow-sm ring-4 ring-zinc-100" />
                      <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-gradient-to-br from-white to-zinc-50/25 p-5 shadow-sm transition-all hover:shadow-md">
                        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-700 dark:text-zinc-300 mb-1 block">Transaction Recorded</span>
                            <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{record.reason || "Annual Salary Increase"}</h4>
                          </div>
                          <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-1 shadow-sm">
                            {new Date(record.effectiveDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                          <div className="bg-white dark:bg-zinc-900/60 p-2.5 rounded-xl border border-zinc-100 dark:border-zinc-800/50">
                            <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Previous Salary</p>
                            <p className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">{new Intl.NumberFormat('en-EG', { style: 'currency', currency: employee.financial?.currency || 'EGP', maximumFractionDigits: 0 }).format(record.previousSalary)}</p>
                          </div>
                          <div className="bg-white dark:bg-zinc-900/60 p-2.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 ring-2 ring-zinc-950/[0.04]">
                            <p className="text-[9px] font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1">New Salary</p>
                            <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">{new Intl.NumberFormat('en-EG', { style: 'currency', currency: employee.financial?.currency || 'EGP', maximumFractionDigits: 0 }).format(record.newSalary)}</p>
                          </div>
                          <div className="bg-white dark:bg-zinc-900/60 p-2.5 rounded-xl border border-zinc-100 dark:border-zinc-800/50">
                            <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Increase Amount</p>
                            <p className="text-sm font-semibold text-emerald-600">+{new Intl.NumberFormat('en-EG', { style: 'currency', currency: employee.financial?.currency || 'EGP', maximumFractionDigits: 0 }).format(record.increaseAmount)}</p>
                          </div>
                          <div className="rounded-xl bg-zinc-900 p-2.5 shadow-lg shadow-zinc-900/15">
                            <p className="text-[9px] font-bold text-zinc-100/80 uppercase tracking-wider mb-1">Growth Percent</p>
                            <p className="text-sm font-bold text-white">+{record.increasePercentage}%</p>
                          </div>
                          {record.processedBy && (
                            <div className="col-span-full pt-2 flex items-center gap-2 border-t border-zinc-200/80 dark:border-zinc-800/80/50 mt-1">
                              <div className="h-6 w-6 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-[10px] uppercase font-bold text-zinc-500 dark:text-zinc-400">{record.processedBy[0]}</div>
                              <div>
                                <p className="text-[10px] text-zinc-400">Processed by</p>
                                <p className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400">{record.processedBy}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}
        {activeTab === "vacations" && (
          <div className="rounded-[20px] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm ring-1 ring-zinc-950/[0.06] dark:ring-zinc-800">
            <div className="mb-6 flex flex-col gap-2 border-b border-zinc-100 dark:border-zinc-800/50 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-200">Vacations & leave</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Leave requests from Time off for {employee.fullName}.{" "}
                  {canEditVacations
                    ? "To add or edit legacy rows on the employee file, use Manage → Manual vacation records."
                    : "HR can maintain manual file records from Manage → Manual vacation records."}
                </p>
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-800 text-white shadow-lg shadow-zinc-900/20">
                <Plane className="h-5 w-5" />
              </div>
            </div>

            {!leaveRequestsForbidden && (
              <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/30 dark:bg-zinc-800/50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100 mb-1">
                  Leave requests (app)
                </p>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-3">
                  Submitted through Time off — vacation and excuse, with approval status.
                </p>
                {leaveRequestsLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="h-8 w-8 rounded-full border-2 border-zinc-600 border-t-transparent animate-spin" />
                  </div>
                ) : leaveRequests.length === 0 ? (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 italic py-4 text-center border border-dashed border-zinc-200/80 dark:border-zinc-800/80 rounded-lg bg-white dark:bg-zinc-900/50">
                    No leave requests on file for this employee.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {leaveRequests.map((r) => {
                      const typeLabel =
                        r.kind === "VACATION"
                          ? VACATION_TYPE_OPTIONS.find((o) => o.value === r.leaveType)?.label ||
                          r.leaveType ||
                          "Vacation"
                          : "Excuse";
                      return (
                        <li
                          key={r._id}
                          className="rounded-lg border border-zinc-200/80 dark:border-zinc-800/80/80 bg-white dark:bg-zinc-900/90 px-3 py-2.5 sm:flex sm:items-start sm:justify-between sm:gap-3"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${leaveStatusBadgeClass(r.status)}`}
                              >
                                {r.status}
                              </span>
                              <span className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">{typeLabel}</span>
                              {r.kind === "VACATION" && r.computed?.days != null && (
                                <span className="text-[11px] text-zinc-500 dark:text-zinc-400">{r.computed.days} day(s)</span>
                              )}
                              {r.kind === "EXCUSE" && r.computed?.minutes != null && (
                                <span className="text-[11px] text-zinc-500 dark:text-zinc-400">{r.computed.minutes} min</span>
                              )}
                            </div>
                            <p className="mt-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                              {r.kind === "VACATION"
                                ? `${fmtLeaveRequestDate(r.startDate)} → ${fmtLeaveRequestDate(r.endDate)}`
                                : `${fmtLeaveRequestDate(r.excuseDate)} · ${r.startTime || "—"}–${r.endTime || "—"}`}
                            </p>
                            {(r.submittedAt || r.createdAt) && (
                              <p className="mt-0.5 text-[10px] text-zinc-400">
                                Submitted {fmtLeaveRequestDate(r.submittedAt || r.createdAt)}
                              </p>
                            )}
                            {r.approvals?.length > 0 && (
                              <p className="mt-1 text-[10px] text-zinc-400">
                                {r.approvals.map((a) => `${a.role}: ${a.status}`).join(" · ")}
                              </p>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}

            {!leaveBalanceForbidden && (
              <div className="mt-6 rounded-xl border border-zinc-100 dark:border-zinc-800/50 bg-zinc-50/20 dark:bg-zinc-800/50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100 mb-1">
                  Vacation entitlement credits
                </p>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-3">
                  HR manual increases to annual leave balance (same policy year view as Time off).
                </p>
                {leaveBalanceLoading ? (
                  <div className="flex justify-center py-6">
                    <div className="h-7 w-7 rounded-full border-2 border-zinc-400 border-t-transparent animate-spin" />
                  </div>
                ) : leaveBalanceSnapshot?.vacation?.credits?.length ? (
                  <LeaveBalanceCreditHistory
                    credits={leaveBalanceSnapshot.vacation.credits}
                    compact
                  />
                ) : (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 italic py-3 text-center border border-dashed border-zinc-100 dark:border-zinc-800/50 rounded-lg bg-white dark:bg-zinc-900/60">
                    No manual balance credits recorded for this employee.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
        {activeTab === "attendance" && (
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-200">Daily Attendance History</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 tracking-wide">Last 30 recorded logs for {employee.fullName}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-800 text-white shadow-lg shadow-zinc-900/20">
                <Clock className="h-5 w-5" />
              </div>
            </div>

            {isAttendanceLoading ? (
              <div className="py-20 text-center">
                <div className="h-8 w-8 rounded-full border-2 border-zinc-600 border-t-transparent animate-spin mx-auto mb-4" />
                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 tracking-widest uppercase">Fetching Records...</p>
              </div>
            ) : attendanceHistory.length === 0 ? (
              <div className="py-20 text-center border-2 border-dashed border-zinc-100 dark:border-zinc-800/50 rounded-3xl">
                <AlertTriangle className="h-10 w-10 text-zinc-200 mx-auto mb-3" />
                <p className="text-zinc-400 italic text-sm">No attendance records found for this employee.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Monthly Summary Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pb-6 border-b border-zinc-100 dark:border-zinc-800/50">
                  <div className="bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800/50">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase mb-1">Present Days</p>
                    <p className="text-xl font-black text-zinc-900 dark:text-zinc-100">{attendanceHistory.filter(h => h.status === 'PRESENT').length}</p>
                  </div>
                  <div className="bg-amber-50/50 p-3 rounded-xl border border-amber-100/50">
                    <p className="text-[10px] font-bold text-amber-500 uppercase mb-1">Late Arrivals</p>
                    <p className="text-xl font-black text-amber-600">{attendanceHistory.filter(h => h.status === 'LATE').length}</p>
                  </div>
                  <div className="bg-rose-50/50 p-3 rounded-xl border border-rose-100/50">
                    <p className="text-[10px] font-bold text-rose-500 uppercase mb-1">Absences</p>
                    <p className="text-xl font-black text-rose-600">{attendanceHistory.filter(h => h.status === 'ABSENT').length}</p>
                  </div>
                  <div className="bg-zinc-50/50 dark:bg-zinc-800/50 p-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80/50">
                    <p className="text-[10px] font-bold text-zinc-700 dark:text-zinc-300 uppercase mb-1">Avg. Hours</p>
                    <div className="font-semibold text-zinc-800 dark:text-zinc-200">
                      {formatTotalHours(attendanceHistory.reduce((acc, curr) => acc + (curr.totalHours || 0), 0) / Math.max(1, attendanceHistory.length))}
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-zinc-100 dark:border-zinc-800/50">
                        <th className="pb-3 text-[10px] font-black uppercase tracking-widest text-zinc-400">Date</th>
                        <th className="pb-3 text-[10px] font-black uppercase tracking-widest text-zinc-400">Status</th>
                        <th className="pb-3 text-[10px] font-black uppercase tracking-widest text-zinc-400">Check In</th>
                        <th className="pb-3 text-[10px] font-black uppercase tracking-widest text-zinc-400">Check Out</th>
                        <th className="pb-3 text-[10px] font-black uppercase tracking-widest text-zinc-400 text-right">Work Hours</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50">
                      {attendanceHistory.map((log) => (
                        <tr key={log.id || log._id} className="group hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                          <td className="py-3 text-xs font-bold text-zinc-700 dark:text-zinc-300">
                            {new Date(log.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                          </td>
                          <td className="py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${log.status === 'PRESENT' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                log.status === 'LATE' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                  'bg-rose-50 text-rose-600 border-rose-100'
                              }`}>
                              {log.status}
                            </span>
                          </td>
                          <td className="py-3 text-xs font-mono font-medium text-zinc-600 dark:text-zinc-400">
                            {log.checkIn || "—"}
                          </td>
                          <td className="py-3 text-xs font-mono font-medium text-zinc-600 dark:text-zinc-400">
                            {log.checkOut || "—"}
                          </td>
                          <td className="py-3 text-xs font-black text-zinc-900 dark:text-zinc-100 text-right">
                            {formatTotalHours(log.totalHours)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "assessments" && canViewAssessments && (
          <div className="rounded-2xl border border-amber-200/50 bg-white dark:bg-zinc-900 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-200">Performance Assessments</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 tracking-wide">Historical timeline of evaluations and financial bonuses for {employee.fullName}</p>
              </div>
              <Star className="h-6 w-6 text-amber-500" />
            </div>

            {isAssessmentsLoading ? (
              <div className="py-20 text-center">
                <div className="h-8 w-8 rounded-full border-2 border-amber-500 border-t-transparent animate-spin mx-auto mb-4" />
                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 tracking-widest uppercase">Fetching Records...</p>
              </div>
            ) : assessmentsData.length === 0 ? (
              <div className="py-20 text-center border-2 border-dashed border-zinc-100 dark:border-zinc-800/50 rounded-3xl">
                <Star className="h-10 w-10 text-zinc-200 mx-auto mb-3" />
                <p className="text-zinc-400 italic text-sm">No assessments on record for this employee.</p>
              </div>
            ) : (
              <div className="space-y-8">
                {(() => {
                  const MONTH_LABELS = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
                  const sorted = [...assessmentsData].sort((a, b) => {
                    const ya = a.period?.year ?? 0;
                    const yb = b.period?.year ?? 0;
                    if (yb !== ya) return yb - ya;
                    return (b.period?.month ?? 0) - (a.period?.month ?? 0);
                  });
                  const groups = new Map();
                  for (const rec of sorted) {
                    const key = rec.period ? `${rec.period.year}-${String(rec.period.month).padStart(2, "0")}` : "ungrouped";
                    const label = rec.period ? `${MONTH_LABELS[rec.period.month]} ${rec.period.year}` : "Earlier Reviews";
                    if (!groups.has(key)) groups.set(key, { label, records: [] });
                    groups.get(key).records.push(rec);
                  }
                  return [...groups.entries()].map(([key, { label, records }]) => (
                    <div key={key}>
                      <h4 className="text-xs font-bold text-amber-700 uppercase tracking-widest mb-4 border-l-2 border-amber-400 pl-3">{label}</h4>
                      <div className="relative">
                        <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-amber-50" />
                        <ol className="space-y-6">
                          {records.map((record, idx) => {
                            const overallStars = record.overall ?? record.rating ?? 0;

                            // Dynamic scores (new PerformanceReview format)
                            const hasDynamicScores = Array.isArray(record.scores) && record.scores.length > 0;
                            // Legacy scores fallback
                            const legacyScores = [
                              record.commitment != null && { title: "Commitment", score: record.commitment },
                              record.attitude != null && { title: "Attitude", score: record.attitude },
                              record.quality != null && { title: "Quality", score: record.quality },
                            ].filter(Boolean);
                            const displayScores = hasDynamicScores ? record.scores : legacyScores;

                            const hasGoals = Array.isArray(record.goalsForNextPeriod) && record.goalsForNextPeriod.length > 0;
                            const hasPayroll = (record.daysBonus ?? 0) > 0 || (record.overtime ?? 0) > 0 || (record.deduction ?? 0) > 0;

                            const bonusBadge = record.bonusStatus && record.bonusStatus !== "NONE" ? {
                              PENDING_HR: { bg: "bg-amber-50 text-amber-700 border-amber-200", text: "Pending HR Approval" },
                              APPROVED: { bg: "bg-emerald-50 text-emerald-700 border-emerald-200", text: "Bonus Approved" },
                              REJECTED: { bg: "bg-rose-50 text-rose-700 border-rose-200", text: "Bonus Rejected" },
                            }[record.bonusStatus] : null;

                            return (
                              <li key={record.id || idx} className="relative pl-12">
                                <div className="absolute left-3.5 top-1.5 w-3 h-3 rounded-full bg-amber-500 border-2 border-white shadow-sm ring-4 ring-amber-50" />
                                <div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-white to-amber-50/20 p-5 shadow-sm transition-all hover:shadow-md">

                                  {/* ── Header: period + overall stars + date badge ── */}
                                  <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                                    <div>
                                      <span className="text-[10px] font-bold uppercase tracking-widest text-amber-600 mb-1 block">
                                        {record.reviewPeriod || (record.period ? `${MONTH_LABELS[record.period.month]} ${record.period.year}` : "—")}
                                      </span>
                                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Overall Score</p>
                                      <div className="flex gap-1 mt-1 items-center">
                                        {[1, 2, 3, 4, 5].map(star => (
                                          <Star key={star} size={16} className={star <= Math.round(overallStars) ? "text-amber-500 fill-current" : "text-amber-100"} />
                                        ))}
                                        {overallStars > 0 && (
                                          <span className="ml-2 text-xs font-bold text-amber-700">{Number(overallStars).toFixed(2)}</span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1.5">
                                      <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-1 shadow-sm">
                                        {record.date}
                                      </span>
                                      {bonusBadge && (
                                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md border ${bonusBadge.bg}`}>
                                          {bonusBadge.text}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* ── Evaluation Metrics (dynamic template scores or legacy) ── */}
                                  {displayScores.length > 0 && (
                                    <div className="mb-4">
                                      <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-2">Evaluation Metrics</p>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {displayScores.map((s, si) => (
                                          <div key={si} className="flex items-center justify-between rounded-lg border border-zinc-100 dark:border-zinc-800/50 bg-white dark:bg-zinc-900/80 px-3 py-2">
                                            <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-tight truncate max-w-[8rem]">{s.title}</span>
                                            <div className="flex items-center gap-0.5">
                                              {[1, 2, 3, 4, 5].map(star => (
                                                <Star key={star} size={11} className={star <= s.score ? "text-amber-500 fill-current" : "text-zinc-200"} />
                                              ))}
                                              <span className="ml-1.5 text-[10px] font-bold text-amber-700">{s.score}/5</span>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* ── Payroll numbers ── */}
                                  {hasPayroll && (
                                    <div className="grid grid-cols-3 gap-2 mb-4">
                                      {[
                                        ["Days Bonus", record.daysBonus ?? 0],
                                        ["Overtime h", record.overtime ?? 0],
                                        ["Deduction", `${record.deduction ?? 0} EGP`],
                                      ].map(([lbl, val]) => (
                                        <div key={lbl} className="rounded-lg border border-zinc-100 dark:border-zinc-800/50 bg-white dark:bg-zinc-900/80 px-2 py-1.5">
                                          <span className="font-bold text-[9px] text-zinc-400 uppercase tracking-tighter block">{lbl}</span>
                                          <span className="font-bold text-sm text-zinc-800 dark:text-zinc-200">{val}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {/* ── Notes / Context ── */}
                                  {record.notesPrevious?.trim?.() && (
                                    <div className="mb-3 rounded-xl border border-zinc-100 dark:border-zinc-800/50 bg-zinc-50/80 dark:bg-zinc-800/50 px-3 py-2.5">
                                      <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Notes / Context</p>
                                      <p className="text-xs text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">{record.notesPrevious}</p>
                                    </div>
                                  )}

                                  {/* ── Manager Feedback ── */}
                                  {record.feedback?.trim?.() && (
                                    <div className="bg-white dark:bg-zinc-900/60 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800/50 mb-4">
                                      <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Manager Feedback</p>
                                      <p className="text-sm text-zinc-700 dark:text-zinc-300 italic">"{record.feedback}"</p>
                                    </div>
                                  )}

                                  {/* ── Goals for next period ── */}
                                  {hasGoals && (
                                    <div className="bg-blue-50/50 rounded-xl border border-blue-100/70 px-4 py-3 mb-4">
                                      <p className="text-[9px] font-bold uppercase tracking-widest text-blue-500 mb-2.5">🎯 Goals Set for Next Period</p>
                                      <ul className="space-y-2">
                                        {record.goalsForNextPeriod.map((g, gi) => (
                                          <li key={gi} className="flex items-start gap-2.5 text-xs text-zinc-700 dark:text-zinc-300">
                                            <span className={`mt-1 shrink-0 w-2 h-2 rounded-full ${g.status === "ACHIEVED" ? "bg-emerald-400" :
                                                g.status === "PARTIAL" ? "bg-amber-400" :
                                                  g.status === "MISSED" ? "bg-rose-400" :
                                                    "bg-blue-300"
                                              }`} />
                                            <span className="flex-1">{g.description}</span>
                                            {g.status && g.status !== "PENDING" && (
                                              <span className={`shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded ${g.status === "ACHIEVED" ? "bg-emerald-100 text-emerald-700" :
                                                  g.status === "PARTIAL" ? "bg-amber-100 text-amber-700" :
                                                    "bg-rose-100 text-rose-700"
                                                }`}>{g.status}</span>
                                            )}
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}

                                  {/* ── Footer: evaluator + bonus recommendation ── */}
                                  <div className="flex flex-wrap items-center justify-between gap-4 border-t border-amber-100/50 pt-3">
                                    <div className="flex items-center gap-2">
                                      <div className="h-6 w-6 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-[10px] uppercase font-bold text-zinc-500 dark:text-zinc-400">
                                        {record.evaluatorId?.fullName?.[0] || "?"}
                                      </div>
                                      <div>
                                        <p className="text-[10px] text-zinc-400">Evaluated by</p>
                                        <p className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400">{record.evaluatorId?.fullName || "A Manager"} ({record.evaluatorId?.position || "Management"})</p>
                                      </div>
                                    </div>
                                    {record.getThebounes && (
                                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase tracking-widest rounded-lg border border-emerald-100">
                                        <Gift size={12} /> Bonus Recommended
                                      </span>
                                    )}
                                    {canManageAssessments && record.id && (
                                      <div className="flex items-center gap-1 ml-auto">
                                        <button
                                          type="button"
                                          onClick={() => setEditingAssessment(record)}
                                          title="Edit assessment"
                                          className="p-1.5 rounded-lg text-zinc-400 hover:text-blue-600 hover:bg-blue-50 transition"
                                        >
                                          <Edit2 size={14} />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={async () => {
                                            if (!window.confirm("Are you sure you want to delete this assessment? This action cannot be undone.")) return;
                                            try {
                                              await deleteAssessmentApi(record.id);
                                              showToast("Assessment deleted", "success");
                                              setAssessmentsRefreshKey(k => k + 1);
                                            } catch (err) {
                                              showToast(err.error || "Failed to delete assessment", "error");
                                            }
                                          }}
                                          title="Delete assessment"
                                          className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition"
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      </div>
                                    )}
                                  </div>

                                </div>
                              </li>
                            );
                          })}
                        </ol>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            )}
          </div>
        )}

        {showTransferModal && (
          <TransferModal
            employee={employee}
            departments={departments}
            onClose={() => setShowTransferModal(false)}
            onSubmit={handleTransfer}
          />
        )}

        {showManualVacationModal && (
          <ManualVacationRecordsModal
            employee={employee}
            onClose={() => setShowManualVacationModal(false)}
            onPersist={persistVacationRecords}
            onAddAsLeaveRequest={addAsDirectLeaveRequest}
            onAddExcuseAsLeaveRequest={addExcuseAsDirectLeaveRequest}
            saving={vacationSaving}
            recording={vacationRecording}
            recorderEmail={currentUser?.email}
          />
        )}

        {showLeaveBalanceCreditModal && (
          <LeaveBalanceCreditModal
            employeeId={employeeId}
            employeeName={employee.fullName}
            onClose={() => setShowLeaveBalanceCreditModal(false)}
            onSuccess={async (snapshot) => {
              await dispatch(fetchEmployeesThunk());
              if (snapshot) setLeaveBalanceSnapshot(snapshot);
              const rem = snapshot?.vacation?.remainingDays;
              showToast(
                typeof rem === "number"
                  ? `Credit added. Vacation balance: ${rem} day(s) remaining.`
                  : "Vacation balance credit added.",
                "success",
              );
            }}
          />
        )}

        {showSalaryModal && (
          <SalaryIncreaseModal
            employee={employee}
            orgPolicy={globalPolicy}
            onClose={() => setShowSalaryModal(false)}
            onSubmit={handleSalaryIncrease}
          />
        )}

        {showTerminateModal && (
          <TerminateEmployeeModal
            employee={employee}
            onClose={() => setShowTerminateModal(false)}
            onSubmit={handleTerminate}
          />
        )}

        {showAssessmentModal && (
          <SubmitAssessmentModal
            employee={employee}
            onClose={() => setShowAssessmentModal(false)}
            onSuccess={() => {
              setAssessmentsRefreshKey(prev => prev + 1);
              setActiveTab("assessments");
            }}
          />
        )}

        {editingAssessment && (
          <EditAssessmentModal
            record={editingAssessment}
            onClose={() => setEditingAssessment(null)}
            onSuccess={() => {
              setEditingAssessment(null);
              setAssessmentsRefreshKey(prev => prev + 1);
            }}
          />
        )}
      </div>
    </Layout>
  )
}
