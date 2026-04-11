import { useMemo, useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FormBuilder } from "@/shared/components/FormBuilder";
import { Layout } from "@/shared/components/Layout";
import { useToast } from "@/shared/components/ToastProvider";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/reduxHooks";
import { updateEmployeeThunk, processSalaryIncreaseThunk, fetchEmployeesThunk } from "../store";
import { resolveBranchesFromPolicy } from "@/shared/utils/workLocations";
import { fetchDepartmentsThunk } from "@/modules/departments/store";
import { getBranchesApi } from "@/modules/branches/api";
import { getTeamsApi } from "@/modules/teams/api";
import { getDocumentRequirementsApi } from "@/modules/organization/api";
import { EGYPT_GOVERNORATES, getCitiesForGovernorate } from "@/shared/data/egyptGovernorates";
import { skillsFromCommaText } from "@/shared/utils/skillsFromText";
import { languagesFromText, languagesToFormString } from "@/shared/utils/employeeFormLanguages";
import {
  policyBranchDisplayName,
  policyBranchMatchKeys,
  branchRecordLocationText,
} from "@/shared/utils/policyWorkLocationBranches";
import { ArrowLeft, Clock, Save, ArrowRightLeft, KeyRound, Settings, Briefcase, TrendingUp, CloudCog } from "lucide-react";
import { TransferModal } from "../components/TransferModal";
import { SalaryIncreaseModal } from "../components/SalaryIncreaseModal";

export function EditEmployeePage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { employeeId } = useParams();
  const employees = useAppSelector((state) => state.employees.items);
  const employeesLength = employees.length;
  const departments = useAppSelector((state) => state.departments.items);
  const currentUser = useAppSelector((state) => state.identity.currentUser);
  const accessToken = useAppSelector((state) => state.identity.accessToken);
  const isStoreLoading = useAppSelector((state) => state.employees.isLoading);
  const { showToast } = useToast();

  const [showResetModal, setShowResetModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showSalaryModal, setShowSalaryModal] = useState(false);
  const [documentChecklist, setDocumentChecklist] = useState([]);
  const [activeTab, setActiveTab] = useState("profile");
  const [selectedGovernorate, setSelectedGovernorate] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [socialInsuranceStatus, setSocialInsuranceStatus] = useState("NOT_INSURED");
  const [hasMedicalInsurance, setHasMedicalInsurance] = useState("NO");
  const [branches, setBranches] = useState([]);
  const [orgPolicy, setOrgPolicy] = useState(null);
  const [selectedWorkLocation, setSelectedWorkLocation] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [standaloneTeams, setStandaloneTeams] = useState([]);
  const [employmentStatus, setEmploymentStatus] = useState("ACTIVE");

  const employee = useMemo(
    () => {
      return employees.find((item) => item.id === employeeId);
    },
    [employeeId, employees],
  );

  useEffect(() => {
    if (!employeesLength) void dispatch(fetchEmployeesThunk());
    void dispatch(fetchDepartmentsThunk());
  }, [dispatch, employeesLength]);

  useEffect(() => {
    if (employee) {
      setSelectedGovernorate(employee.governorate || "");
      setSelectedCity(employee.city || "");
      setSocialInsuranceStatus(employee.socialInsurance?.status || "NOT_INSURED");
      setHasMedicalInsurance(employee.insurance?.provider ? "YES" : "NO");
      setSelectedDepartment(employee.department || "");
      setEmploymentStatus(employee.status || "ACTIVE");
    }
  }, [employee]);

  useEffect(() => {
    if (!employee || !orgPolicy) return;
    const locations = orgPolicy.workLocations || [];
    const branchName = (employee.branchId?.name || employee.workLocation || "").trim().toLowerCase();
    const branchCode = (employee.branchId?.code || "").trim().toLowerCase();
    const empCity = (employee.branchId?.city || "").trim().toLowerCase();
    if (!branchName && !branchCode && !empCity) return;

    const matchIdx = locations.findIndex((loc) => {
      const keys = (loc.branches || []).flatMap(policyBranchMatchKeys);
      if (branchName && keys.includes(branchName)) return true;
      if (branchCode && keys.includes(branchCode)) return true;
      if (empCity && loc.city.trim().toLowerCase() === empCity) return true;
      return false;
    });
    if (matchIdx >= 0) setSelectedWorkLocation(String(matchIdx));
  }, [employee, orgPolicy]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [policyData, branchesWrap] = await Promise.all([
          getDocumentRequirementsApi().catch(() => null),
          getBranchesApi()
            .then((data) => ({ ok: true, data }))
            .catch(() => ({ ok: false, data: [] })),
        ]);
        if (cancelled) return;

        if (policyData) setOrgPolicy(policyData);
        if (branchesWrap.ok && Array.isArray(branchesWrap.data)) {
          setBranches(branchesWrap.data);
        }
      } catch (err) {
        console.error("Failed to load policy/branches:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!employee || !orgPolicy) return;
    const required = orgPolicy.documentRequirements || [];
    const existing = employee.documentChecklist || [];
    const merged = required.map((req) => {
      const found = existing.find((e) => e.documentName === req.name);
      return {
        documentName: req.name,
        status: found?.status || "MISSING",
        fileUrl: found?.fileUrl || "",
        submissionDate: found?.submissionDate || null,
        description: req.description,
      };
    });
    setDocumentChecklist(merged);
  }, [employee, orgPolicy]);
 
 
   
  const cityOptions = useMemo(() => {
    return getCitiesForGovernorate(selectedGovernorate).map((c) => ({ label: c, value: c }));
  }, [selectedGovernorate]);

  useEffect(() => {
    if (!selectedDepartment) {
      setStandaloneTeams([]);
      return;
    }
    const dept = departments.find((d) => d.name === selectedDepartment);
    if (!dept?._id && !dept?.id) return;
    let cancelled = false;
    getTeamsApi({ departmentId: dept._id || dept.id })
      .then((data) => {
        if (!cancelled) setStandaloneTeams(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setStandaloneTeams([]);
      });
    return () => { cancelled = true; };
  }, [selectedDepartment, departments]);

  const teamOptions = useMemo(() => {
    if (!selectedDepartment) return [{ label: "— Select a department first —", value: "" }];
    const dept = departments.find((d) => d.name === selectedDepartment);
    const nameSet = new Set();
    const options = [];

    for (const t of dept?.teams || []) {
      if (t.name && !nameSet.has(t.name)) {
        nameSet.add(t.name);
        options.push({ label: t.name, value: t.name });
      }
    }
    for (const t of standaloneTeams) {
      if (t.name && !nameSet.has(t.name)) {
        nameSet.add(t.name);
        options.push({ label: t.name, value: t.name });
      }
    }
    if (options.length === 0) return [{ label: "— No teams in this department —", value: "" }];
    return options;
  }, [selectedDepartment, departments, standaloneTeams]);

  const workLocationOptions = useMemo(() => {
    const locations = orgPolicy?.workLocations || [];
    if (locations.length === 0) return [{ label: "— No locations configured in org policy —", value: "" }];
    return locations.map((loc, idx) => ({
      label: `${loc.city} (${loc.governorate})`,
      value: String(idx),
    }));
  }, [orgPolicy]);

  const branchOptions = useMemo(() => {
    if (!selectedWorkLocation) return [{ label: "— Select a work location first —", value: "" }];
    const locations = orgPolicy?.workLocations || [];
    const loc = locations[Number(selectedWorkLocation)];
    if (!loc) return [{ label: "— Select a work location first —", value: "" }];

    const policyEntries = loc.branches || [];
    const allBranches = Array.isArray(branches) ? branches : [];
    const locCity = (loc.city || "").trim().toLowerCase();
    const locGov = (loc.governorate || "").trim().toLowerCase();

    const matched = allBranches.filter((b) => {
      const bName = (b.name || "").trim().toLowerCase();
      const bCode = (b.code || "").trim().toLowerCase();
      const bCity = (b.city || "").trim().toLowerCase();
      const bLocation = branchRecordLocationText(b);
      for (const entry of policyEntries) {
        const keys = policyBranchMatchKeys(entry);
        if (keys.length && (keys.includes(bName) || (bCode && keys.includes(bCode)))) return true;
      }
      if (locCity && bCity && bCity === locCity) return true;
      if (locCity && bLocation && bLocation.includes(locCity)) return true;
      if (locGov && bCity && bCity.includes(locGov)) return true;
      return false;
    });

    if (matched.length > 0) {
      return matched.map((b) => ({
        label: `${b.name} (${b.code})${b.city ? ` - ${b.city}` : ""}`,
        value: b.id,
      }));
    }

    const policyLabels = policyEntries.map(policyBranchDisplayName).filter(Boolean);
    if (policyLabels.length > 0) {
      return policyLabels.map((name) => ({
        label: name,
        value: name,
      }));
    }

    // Fallback: show all branches if any exist
    if (allBranches.length > 0) {
      return allBranches.map((b) => ({
        label: `${b.name} (${b.code})${b.city ? ` - ${b.city}` : ""}`,
        value: b.id,
      }));
    }

    return [{ label: "— No branches at this location —", value: "" }];
  }, [selectedWorkLocation, orgPolicy, branches]);

  const roleFieldOptions = useMemo(() => {
    const cr = currentUser?.role;
    const extended = cr === "ADMIN" || cr === "HR_STAFF" || cr === "HR_MANAGER";
    if (extended) {
      return [
        { label: "Employee", value: "EMPLOYEE" },
        { label: "Team Leader", value: "TEAM_LEADER" },
        { label: "Manager (Department head)", value: "MANAGER" },
        { label: "HR Staff", value: "HR_STAFF" },
      ];
    }
    return [
      { label: "Employee", value: "EMPLOYEE" },
      { label: "Team Leader", value: "TEAM_LEADER" },
      { label: "Manager (Department head)", value: "MANAGER" },
    ];
  }, [currentUser?.role]);

  const handleResetPassword = async (values) => {
    try {
      const res = await fetch(`${API_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
        body: JSON.stringify({ targetEmail: employee.email, newPassword: values.newPassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reset password");
      showToast(`Password successfully forced to new value for ${employee.email}`, "success");
      setShowResetModal(false);
    } catch(err) {
      showToast(err.message, "error");
    }
  };

  const handleTransfer = async (values) => {
    try {
      const res = await fetch(`${API_URL}/employees/${employee.id}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
        body: JSON.stringify({
          toDepartment: values.toDepartment,
          newPosition: values.newPosition || undefined,
          newSalary: values.newSalary ? Number(values.newSalary) : undefined,
          resetNextReviewDate: Boolean(
            values.resetNextReviewDate ?? values.resetYearlyIncreaseDate,
          ),
          newEmployeeCode: values.newEmployeeCode ?? undefined,
          notes: values.notes,
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to process transfer");
      showToast(`${employee.fullName} transferred to ${values.toDepartment} successfully`, "success");
      setShowTransferModal(false);
    } catch(err) {
      showToast(err.message, "error");
    }
  };

  const handleSalaryIncrease = async (values) => {
    try {
      await dispatch(processSalaryIncreaseThunk({
        id: employee.id,
        ...values,
        increasePercentage: values.method === "PERCENT" ? values.value : undefined,
        increaseAmount: values.method === "FIXED" ? values.value : undefined,
      })).unwrap();
      showToast("Salary increase processed successfully", "success");
      setShowSalaryModal(false);
      navigate("/employees");
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  const canAdmin = currentUser?.role === "ADMIN" || currentUser?.role === "HR_MANAGER";
  const canEditReporting =
    canAdmin || currentUser?.role === "HR_STAFF";

  const [reportingMode, setReportingMode] = useState("default");

  useEffect(() => {
    if (employee) {
      setReportingMode(employee.useDefaultReporting !== false ? "default" : "custom");
    }
  }, [employee?.id, employee?.useDefaultReporting]);

  const colleagueOptions = useMemo(() => {
    if (!employee) return [];
    return employees
      .filter(
        (e) =>
          e.id !== employee.id &&
          e.department === employee.department,
      )
      .map((e) => ({
        label: e.fullName,
        value: e.id,
        sublabel: e.email,
      }));
  }, [employees, employee]);

  const reportingFields = useMemo(() => {
    if (!canEditReporting || !employee) return [];
    return [
      { type: "section", label: "Reporting (optional overrides)" },
      {
        name: "reportingMode",
        label: "Manager and team leader",
        type: "select",
        options: [
          {
            label: "Use department defaults (head + team leader from org chart)",
            value: "default",
          },
          { label: "Custom (pick people below)", value: "custom" },
        ],
      },
      ...(reportingMode === "custom"
        ? [
            {
              name: "managerId",
              label: "Direct manager",
              type: "searchableSelect",
              options: colleagueOptions,
              placeholder: "Search employee…",
            },
            {
              name: "teamLeaderId",
              label: "Team leader",
              type: "searchableSelect",
              options: colleagueOptions,
              placeholder: "Search employee…",
            },
          ]
        : []),
    ];
  }, [canEditReporting, employee, reportingMode, colleagueOptions]);

  if (isStoreLoading || !employee) {
    return (
      <Layout title="Edit Employee">
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
          {isStoreLoading ? "Loading..." : "Employee not found."}
        </p>
      </Layout>
    );
  }


  const transferHistory = employee.transferHistory || [];
  return (

   <Layout
      title="Edit Employee"
      description="Update employee information and organizational assignment."
      actions={
        <div className="flex items-center gap-2">
          {canAdmin && (
            <div className="relative group z-50">
              <button className="inline-flex items-center gap-1.5 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-medium text-teal-700 shadow-sm transition hover:bg-teal-100">       
                <Settings className="h-4 w-4" />
                Manage
              </button>
              <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-slate-200 bg-white p-1 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                <button
                  onClick={() => setShowTransferModal(true)}
                  className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition"
                >
                  <ArrowRightLeft className="h-4 w-4" />
                  Transfer Employee
                </button>
                <button
                  onClick={() => setShowSalaryModal(true)}
                  className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition"
                >
                  <TrendingUp className="h-4 w-4" />
                  Increase Salary
                </button>
              </div>
            </div>
          )}
          {currentUser?.role === "ADMIN" && (
            <button
              onClick={() => setShowResetModal(true)}
              className="rounded-lg border border-red-200 bg-red-50 text-red-600 px-3 py-1.5 text-sm font-medium transition hover:bg-red-100 shadow-sm"
            >
              Force Password Reset
            </button>
          )}
        </div>
      }
    >
      {/* Reset Password Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/30 backdrop-blur-[2px] p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl relative z-10">
            <h2 className="text-xl font-bold text-slate-800 mb-2">Reset User Password</h2>
            <p className="text-sm text-slate-600 mb-6">
              You are about to forcibly override the password for <strong>{employee?.email}</strong>.
            </p>
            <FormBuilder
              fields={[{ name: "newPassword", type: "password", label: "New Secure Password", required: true }]}
              submitLabel="Execute Reset"
              onCancel={() => setShowResetModal(false)}
              onSubmit={handleResetPassword}
            />
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {showTransferModal && (
        <TransferModal
          employee={employee}
          departments={departments}
          onClose={() => setShowTransferModal(false)}
          onSubmit={handleTransfer}
        />
      )}

      {/* Salary Increase Modal */}
      {showSalaryModal && (
        <SalaryIncreaseModal
          employee={employee}
          orgPolicy={orgPolicy}
          onClose={() => setShowSalaryModal(false)}
          onSubmit={handleSalaryIncrease}
        />
      )}

      {/* Tab nav */}
      <div className="flex gap-1 mb-6 border-b border-zinc-200">
        {["profile", "transfer_history"].map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-t-md transition-colors ${
              activeTab === tab
                ? "bg-white border border-b-white border-zinc-200 text-zinc-900 -mb-px"
                : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            {tab === "profile" ? "Profile" : (
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Transfer History
                {transferHistory.length > 0 && (
                  <span className="ml-1 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold px-1.5 py-0.5">
                    {transferHistory.length}
                  </span>
                )}
              </span>
            )}
          </button>
        ))}
      </div>

      {activeTab === "profile" ? (
        <>
          <FormBuilder
            onCancel={() => navigate("/employees")}
            onChange={(name, value, setFormValues) => {
              if (name === "governorate") {
                setSelectedGovernorate(value);
                setSelectedCity("");
              }
              if (name === "city") setSelectedCity(value);
              if (name === "department") {
                setSelectedDepartment(value);
                setFormValues?.((prev) => ({ ...prev, team: "" }));
              }
              if (name === "workLocation") {
                setSelectedWorkLocation(value);
                setFormValues?.((prev) => ({ ...prev, branchId: "" }));
              }
              if (name === "socialInsuranceStatus") setSocialInsuranceStatus(value);
              if (name === "hasMedicalInsurance") setHasMedicalInsurance(value);
              if (name === "status") setEmploymentStatus(value);
              if (name === "reportingMode") setReportingMode(value);
            }}
            fields={[
              { type: "section", label: "1. Personal Information" },
              { name: "fullName", label: "Full Name (English)", type: "text", required: true },
              { name: "fullNameArabic", label: "Full Name (Arabic)", type: "text", placeholder: "كما في البطاقة الوطنية" },
              { name: "dateOfBirth", label: "Date of Birth", type: "date" },
              {
                name: "gender",
                label: "Gender",
                type: "select",
                required: true,
                options: [
                  { label: "Male", value: "MALE" },
                  { label: "Female", value: "FEMALE" },
                  { label: "Other", value: "OTHER" },
                  { label: "Prefer not to say", value: "PREFER_NOT_TO_SAY" },
                ]
              },
              {
                name: "maritalStatus",
                label: "Marital Status",
                type: "select",
                required: true,
                options: [
                  { label: "Single", value: "SINGLE" },
                  { label: "Married", value: "MARRIED" },
                  { label: "Divorced", value: "DIVORCED" },
                  { label: "Widowed", value: "WIDOWED" },
                ]
              },
              { name: "nationality", label: "Nationality", type: "text" },
              { name: "idNumber", label: "National ID Number", type: "text" },
              { name: "nationalIdExpiryDate", label: "National ID Expiry Date", type: "date" },
              { name: "profilePicture", label: "Profile picture (URL)", type: "text", fullWidth: true, placeholder: "https://... or leave blank" },

              { type: "section", label: "2. Contact Information" },
              { name: "email", label: "Personal Email", type: "email", required: true },
              { name: "workEmail", label: "Work Email", type: "email" },
              { name: "phoneNumber", label: "Phone Number", type: "text" },
              { name: "emergencyPhone", label: "Emergency Contact Phone", type: "text" },
              { name: "address", label: "Current Address", type: "text", fullWidth: true },
              {
                name: "governorate",
                label: "Governorate",
                type: "select",
                options: EGYPT_GOVERNORATES.map((g) => ({ label: `${g.name} (${g.nameAr})`, value: g.name })),
              },
              {
                name: "city",
                label: "City",
                type: "select",
                options: cityOptions.length > 0
                  ? cityOptions
                  : [{ label: "— Select governorate first —", value: "" }],
              },
              { name: "additionalWhatsapp", label: "WhatsApp", type: "text", placeholder: "Optional" },
              { name: "additionalSkype", label: "Skype", type: "text", placeholder: "Optional" },

              { type: "section", label: "3. Job & Administrative (Use 'Manage' for Structural Changes)" },
              ...(canAdmin
                ? [
                    {
                      name: "role",
                      label: "Organization role",
                      type: "select",
                      required: true,
                      options: roleFieldOptions,
                    },
                  ]
                : []),
              { name: "employeeCode", label: "Employee Code", type: "text", disabled: true },
              { name: "position", label: "Job Title", type: "text", disabled: true },
              {
                name: "department",
                label: "Department",
                type: "select",
                disabled: true,
                options: departments.map(d => ({ label: d.name, value: d.name }))
              },
              {
                name: "team",
                label: "Team / Unit",
                type: "select",
                disabled: true,
                options: teamOptions,
              },
              {
                name: "workLocation",
                label: "Work Location",
                type: "select",
                options: workLocationOptions,
              },
              {
                name: "branchId",
                label: "Branch",
                type: "select",
                options: branchOptions,
              },
              { name: "subLocation", label: "Sub-Location (Floor / Wing)", type: "text" },
              { name: "onlineStorageLink", label: "Online Storage Link", type: "text" },
              { name: "dateOfHire", label: "Date of Hire", type: "date" },
              { name: "nextReviewDate", label: "Annually date of review", type: "date" , disabled: true},
              {
                name: "employmentType",
                label: "Contract Type",
                type: "select",
                required: true,
                options: [
                  { label: "Full-Time", value: "FULL_TIME" },
                  { label: "Part-Time", value: "PART_TIME" },
                  { label: "Contractor", value: "CONTRACTOR" },
                  { label: "Temporary", value: "TEMPORARY" },
                ]
              },
              {
                name: "status",
                label: "Status",
                type: "select",
                required: true,
                options: [
                  { label: "Active", value: "ACTIVE" },
                  { label: "On Leave", value: "ON_LEAVE" },
                  { label: "Resigned", value: "RESIGNED" },
                  { label: "Terminated", value: "TERMINATED" },
                ]
              },
              ...(employmentStatus === "RESIGNED" || employmentStatus === "TERMINATED"
                ? [
                    { name: "terminationDate", label: "Termination date", type: "date" },
                    {
                      name: "terminationReason",
                      label: "Termination reason",
                      type: "textarea",
                      fullWidth: true,
                      placeholder: "Brief reason (optional)",
                    },
                  ]
                : []),

              { type: "section", label: "4. Education & Skills" },
              { name: "educationDegree", label: "Degree / qualification", type: "text", placeholder: "e.g. B.Sc. Computer Science" },
              { name: "educationInstitution", label: "School / institution", type: "text", placeholder: "e.g. Cairo University" },
              { name: "educationYear", label: "Graduation year", type: "text", placeholder: "e.g. 2014" },
              { name: "educationGraduationDate", label: "Graduation date", type: "date" },
              {
                name: "skillsTechnical",
                label: "Technical skills",
                type: "textarea",
                fullWidth: true,
                placeholder: "Separate with commas — e.g. React, Node.js, SQL",
              },
              {
                name: "skillsSoft",
                label: "Soft skills",
                type: "textarea",
                fullWidth: true,
                placeholder: "e.g. Communication, Leadership, Teamwork",
              },
              {
                name: "trainingCoursesText",
                label: "Training courses",
                type: "textarea",
                fullWidth: true,
                placeholder: "Comma-separated — e.g. AWS Cloud Practitioner, Scrum Master",
              },
              {
                name: "languagesText",
                label: "Languages",
                type: "textarea",
                fullWidth: true,
                placeholder: "e.g. English (ADVANCED), Arabic — optional level in parentheses",
              },

              ...reportingFields,

              { type: "section", label: "5. Benefits & Compensation (Use 'Manage' -> 'Increase Salary' to change Base Salary)" },
              { name: "baseSalary", label: "Base Salary", type: "number"},
              {
                 name: "paymentMethod",
                 label: "Payment Method",
                 type: "select",
                 options: [
                    { label: "Bank Transfer", value: "BANK_TRANSFER" },
                    { label: "Cash", value: "CASH" },
                    { label: "Cheque", value: "CHEQUE" },
                    { label: "E-Wallet", value: "E_WALLET" },
                 ]
              },
              { name: "bankAccount", label: "Bank Account Number", type: "text" },
              { name: "currency", label: "Currency", type: "text", placeholder: "EGP" },
              { name: "financialAllowances", label: "Allowances (amount)", type: "number" },
              { name: "financialSocialSecurity", label: "Payroll / social security ref.", type: "text", placeholder: "Reference or note" },

              { type: "section", label: "6. Social Insurance & Health" },
              {
                 name: "hasMedicalInsurance",
                 label: "Has Medical Insurance?",
                 type: "select",
                 options: [
                    { label: "No", value: "NO" },
                    { label: "Yes", value: "YES" },
                 ]
              },
              ...(hasMedicalInsurance === "YES" ? [
                { name: "insuranceProvider", label: "Insurance Provider", type: "text" },
                { name: "insurancePolicy", label: "Policy Number", type: "text" },
                {
                   name: "insuranceCoverage",
                   label: "Coverage Type",
                   type: "select",
                   options: [
                      { label: "Health", value: "HEALTH" },
                      { label: "Life", value: "LIFE" },
                      { label: "Dental", value: "DENTAL" },
                      { label: "Vision", value: "VISION" },
                      { label: "Comprehensive", value: "COMPREHENSIVE" },
                   ]
                },
                { name: "insuranceValidUntil", label: "Policy valid until", type: "date" },
                { name: "medicalCondition", label: "Medical Condition / Disease Type", type: "text" },
              ] : []),
              {
                 name: "socialInsuranceStatus",
                 label: "Social Insurance Enrollment",
                 type: "select",
                 options: [
                    { label: "Not Insured", value: "NOT_INSURED" },
                    { label: "Life and Social", value: "INSURED" },
                 ]
              },
              ...(socialInsuranceStatus === "INSURED" ? [
                { name: "dateOfHireDummy", label: "Date of Hire (Reference)", type: "text", disabled: true, value: employee?.dateOfHire ? new Date(employee.dateOfHire).toLocaleDateString() : "" },
                { name: "insuranceDate", label: "Insurance Date", type: "date" },
                { name: "subscriptionWage", label: "Subscription Wage", type: "number", placeholder: "أجر الأشتراك" },
                { name: "basicWage", label: "Basic Wage / Fixed Wage", type: "number", placeholder: "أجر أساسي" },
                { name: "comprehensiveWage", label: "Comprehensive Wage / Total Wage", type: "number", placeholder: "الأجر الشامل" },
                { name: "jobType", label: "Job Type / Work Type", type: "text", placeholder: "نوع العمل" },
                { name: "form6Date", label: "Form 6 Date (Insurance End)", type: "date" },
                { name: "insuranceNumber", label: "Insurance Number", type: "text" },
              ] : [])
            ]}
            initialValues={{
              ...employee,
              role: employee.role || "EMPLOYEE",
              dateOfBirth: employee.dateOfBirth ? new Date(employee.dateOfBirth).toISOString().split('T')[0] : '',
              dateOfHire: employee.dateOfHire ? new Date(employee.dateOfHire).toISOString().split('T')[0] : '',
              nationalIdExpiryDate: employee.nationalIdExpiryDate ? new Date(employee.nationalIdExpiryDate).toISOString().split('T')[0] : '',
              governorate: employee.governorate || '',
              city: employee.city || '',
              emergencyPhone: employee.emergencyPhone || '',
              additionalWhatsapp: employee.additionalContact?.whatsapp || '',
              additionalSkype: employee.additionalContact?.skype || '',
              subLocation: employee.subLocation || '',
              fullNameArabic: employee.fullNameArabic || '',
              profilePicture: employee.profilePicture || '',
              hasMedicalInsurance: employee.insurance?.provider ? "YES" : "NO",
              insuranceProvider: employee.insurance?.provider || '',
              insurancePolicy: employee.insurance?.policyNumber || '',
              insuranceCoverage: employee.insurance?.coverageType || 'HEALTH',
              insuranceValidUntil: employee.insurance?.validUntil ? new Date(employee.insurance.validUntil).toISOString().split('T')[0] : '',
              baseSalary: employee.financial?.baseSalary || '',
              paymentMethod: employee.financial?.paymentMethod || 'BANK_TRANSFER',
              bankAccount: employee.financial?.bankAccount || '',
              currency: employee.financial?.currency || 'EGP',
              financialAllowances: employee.financial?.allowances ?? '',
              financialSocialSecurity: employee.financial?.socialSecurity || '',
              socialInsuranceStatus: employee.socialInsurance?.status || 'NOT_INSURED',
              insuranceDate: employee.socialInsurance?.insuranceDate ? new Date(employee.socialInsurance.insuranceDate).toISOString().split('T')[0] : '',
              subscriptionWage: employee.socialInsurance?.subscriptionWage || '',
              basicWage: employee.socialInsurance?.basicWage || '',
              comprehensiveWage: employee.socialInsurance?.comprehensiveWage || '',
              jobType: employee.socialInsurance?.jobType || '',
              form6Date: employee.socialInsurance?.form6Date ? new Date(employee.socialInsurance.form6Date).toISOString().split('T')[0] : '',
              insuranceNumber: employee.socialInsurance?.insuranceNumber || '',
              medicalCondition: employee.medicalCondition || '',
              nextReviewDate: employee.nextReviewDate ? new Date(employee.nextReviewDate).toISOString().split('T')[0] : '',
              reportingMode: employee.useDefaultReporting !== false ? "default" : "custom",
              managerId: employee.managerId?.id ?? employee.managerId ?? "",
              teamLeaderId: employee.teamLeaderId?.id ?? employee.teamLeaderId ?? "",
              workLocation: selectedWorkLocation,
              branchId: employee.branchId?.id ?? employee.branchId ?? employee.workLocation ?? "",
              educationDegree: employee.education?.[0]?.degree || "",
              educationGraduationDate: employee.education?.[0]?.graduationDate
                ? new Date(employee.education[0].graduationDate).toISOString().split("T")[0]
                : "",
              educationInstitution: employee.education?.[0]?.institution || "",
              educationYear: employee.education?.[0]?.year || "",
              skillsTechnical: (employee.skills?.technical || []).join(", "),
              skillsSoft: (employee.skills?.soft || []).join(", "),
              trainingCoursesText: (employee.trainingCourses || []).join(", "),
              languagesText: languagesToFormString(employee.languages),
              terminationDate: employee.terminationDate ? new Date(employee.terminationDate).toISOString().split("T")[0] : "",
              terminationReason: employee.terminationReason || "",
            }}
            submitLabel="Save Changes"
            onSubmit={async (values) => {
              try {
                const payload = { ...values };
                // Resolve workLocation from policy index to actual label
                const locIdx = Number(payload.workLocation);
                const policyLocs = orgPolicy?.workLocations || [];
                if (!isNaN(locIdx) && policyLocs[locIdx]) {
                  const loc = policyLocs[locIdx];
                  payload.workLocation = `${loc.city}, ${loc.governorate}`;
                } else {
                  delete payload.workLocation;
                }
                if (!payload.profilePicture || String(payload.profilePicture).trim() === "") {
                  delete payload.profilePicture;
                }
                for (const k of ["insuranceValidUntil", "terminationDate"]) {
                  if (payload[k] === "") delete payload[k];
                }

                const wa = (values.additionalWhatsapp || "").trim();
                const sk = (values.additionalSkype || "").trim();
                payload.additionalContact = { whatsapp: wa, skype: sk };

                if (values.hasMedicalInsurance === "YES") {
                  payload.insurance = {
                    ...(employee.insurance || {}),
                    provider: values.insuranceProvider || undefined,
                    policyNumber: values.insurancePolicy || undefined,
                    coverageType: values.insuranceCoverage || "HEALTH",
                    validUntil: values.insuranceValidUntil || null,
                  };
                  payload.medicalCondition = values.medicalCondition || undefined;
                } else {
                  payload.insurance = {
                    provider: "",
                    policyNumber: "",
                    coverageType: "HEALTH",
                    validUntil: null,
                  };
                  payload.medicalCondition = "";
                }

                payload.financial = {
                  ...(employee.financial || {}),
                  baseSalary: values.baseSalary ? Number(values.baseSalary) : employee.financial?.baseSalary,
                  paymentMethod: values.paymentMethod || "BANK_TRANSFER",
                  bankAccount: values.bankAccount || undefined,
                  currency: values.currency || "EGP",
                  allowances:
                    values.financialAllowances !== "" && values.financialAllowances != null
                      ? Number(values.financialAllowances)
                      : employee.financial?.allowances,
                  socialSecurity:
                    (values.financialSocialSecurity || "").trim() !== ""
                      ? (values.financialSocialSecurity || "").trim()
                      : employee.financial?.socialSecurity,
                };

                payload.socialInsurance = {
                  ...(employee.socialInsurance || {}),
                  status: values.socialInsuranceStatus || "NOT_INSURED",
                  insuranceDate: values.insuranceDate || undefined,
                  subscriptionWage: values.subscriptionWage ? Number(values.subscriptionWage) : undefined,
                  basicWage: values.basicWage ? Number(values.basicWage) : undefined,
                  comprehensiveWage: values.comprehensiveWage ? Number(values.comprehensiveWage) : undefined,
                  jobType: values.jobType || undefined,
                  form6Date: values.form6Date || undefined,
                  insuranceNumber: values.insuranceNumber || undefined,
                };
                payload.documentChecklist = documentChecklist;
                if (canAdmin && values.role) payload.role = values.role;
                if (!canAdmin) delete payload.role;

                if (canEditReporting) {
                  payload.useDefaultReporting = values.reportingMode === "default";
                  if (values.reportingMode === "custom") {
                    payload.managerId = values.managerId || null;
                    payload.teamLeaderId = values.teamLeaderId || null;
                  }
                }
                payload.branchId = values.branchId || null;
                // If branchId is a name string (from policy) rather than an ObjectId, store it in workLocation
                if (payload.branchId && !/^[a-f\d]{24}$/i.test(payload.branchId)) {
                  payload.workLocation = payload.branchId;
                  payload.branchId = null;
                }
                delete payload.reportingMode;

                // Cleanup pseudo-fields from values ده جزء بينضف قبل ما نبعت بيانات لي الباك اند
                delete payload.dateOfHireDummy;
                delete payload.hasMedicalInsurance;
                delete payload.insuranceProvider;
                delete payload.insurancePolicy;
                delete payload.insuranceCoverage;
                delete payload.baseSalary;
                delete payload.paymentMethod;
                delete payload.bankAccount;
                delete payload.currency;
                delete payload.socialInsuranceStatus;
                delete payload.insuranceDate;
                delete payload.subscriptionWage;
                delete payload.basicWage;
                delete payload.comprehensiveWage;
                delete payload.jobType;
                delete payload.form6Date;
                delete payload.insuranceNumber;
                delete payload.insuranceValidUntil;
                delete payload.financialAllowances;
                delete payload.financialSocialSecurity;
                delete payload.additionalWhatsapp;
                delete payload.additionalSkype;

                if (values.status === "RESIGNED" || values.status === "TERMINATED") {
                  if (values.terminationDate) payload.terminationDate = values.terminationDate;
                  else delete payload.terminationDate;
                  payload.terminationReason = (values.terminationReason || "").trim() || null;
                } else {
                  payload.terminationDate = null;
                  payload.terminationReason = null;
                }

                const degreeTrim = (values.educationDegree || "").trim();
                const instTrim = (values.educationInstitution || "").trim();
                const yearTrim = (values.educationYear || "").trim();
                const gradDate = values.educationGraduationDate || "";
                const eduTail = employee.education?.slice(1) || [];
                if (degreeTrim || gradDate || instTrim || yearTrim) {
                  payload.education = [
                    {
                      degree: degreeTrim || "",
                      institution: instTrim || employee.education?.[0]?.institution || "",
                      year: yearTrim || (gradDate ? gradDate.slice(0, 4) : (employee.education?.[0]?.year || "")),
                      graduationDate: gradDate ? gradDate : null,
                    },
                    ...eduTail,
                  ];
                } else {
                  payload.education = eduTail;
                }
                delete payload.educationDegree;
                delete payload.educationGraduationDate;
                delete payload.educationInstitution;
                delete payload.educationYear;

                payload.trainingCourses = skillsFromCommaText(values.trainingCoursesText);
                payload.languages = languagesFromText(values.languagesText);
                delete payload.trainingCoursesText;
                delete payload.languagesText;

                payload.skills = {
                  technical: skillsFromCommaText(values.skillsTechnical),
                  soft: skillsFromCommaText(values.skillsSoft),
                };
                delete payload.skillsTechnical;
                delete payload.skillsSoft;

                const newHireDate = new Date(payload.dateOfHire);
                const oldHireDate = new Date(employee.dateOfHire);

                if (newHireDate.getTime() !== oldHireDate.getTime()) {
                  if (!isNaN(newHireDate)) {
                    newHireDate.setFullYear(newHireDate.getFullYear() + 1);

                    const year = newHireDate.getFullYear();
                    const month = String(newHireDate.getMonth() + 1).padStart(2, '0');
                    const day = String(newHireDate.getDate()).padStart(2, '0');

                    payload.nextReviewDate = `${year}-${month}-${day}`;
                  }
                } else {
                  payload.nextReviewDate = employee.nextReviewDate;
                }
                await dispatch(updateEmployeeThunk({ id: employee.id, ...payload })).unwrap();
                showToast("Employee updated successfully", "success");
                navigate("/employees");
              } catch (error) {
                console.error(error);
                showToast("Failed to update employee", "error");
              }
            }}
          />

          {/* Document Checklist Section */}
          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between border-b pb-4 mb-4">
               <div>
                  <h3 className="text-lg font-bold text-slate-800 uppercase tracking-wide">Document Checklist</h3>
                  <p className="text-xs text-slate-500 italic">Mark documents as received from the employee.</p>
               </div>
               <div className="text-right">
                  <span className="text-sm font-bold text-indigo-600">
                     {documentChecklist.filter(d => d.status === "RECEIVED").length} / {documentChecklist.length} Submitted
                  </span>
                  <div className="w-48 h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden">
                     <div
                       className="h-full bg-indigo-500 transition-all duration-500"
                       style={{ width: `${(documentChecklist.filter(d => d.status === "RECEIVED").length / Math.max(1, documentChecklist.length)) * 100}%` }}
                     />
                  </div>
               </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
               {documentChecklist.map((doc, idx) => (
                 <div key={idx} className={`flex items-center gap-4 p-4 rounded-xl border transition-colors ${doc.status === "RECEIVED" ? 'bg-emerald-50/50 border-emerald-100' : 'bg-slate-50 border-slate-100'}`}>
                    <input
                      type="checkbox"
                      id={`doc-${idx}`}
                      checked={doc.status === "RECEIVED"}
                      onChange={(e) => {
                        const next = [...documentChecklist];
                        next[idx].status = e.target.checked ? "RECEIVED" : "MISSING";
                        if (e.target.checked && !next[idx].submissionDate) {
                            next[idx].submissionDate = new Date().toISOString();
                        }
                        setDocumentChecklist(next);
                      }}
                      className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div className="flex-1">
                       <label htmlFor={`doc-${idx}`} className="text-sm font-bold text-slate-800 block cursor-pointer">{doc.documentName}</label>
                       {doc.description && <p className="text-[10px] text-slate-500 italic">{doc.description}</p>}
                    </div>
                    {doc.status === "RECEIVED" && doc.submissionDate && (
                      <span className="text-[10px] font-medium text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
                         Received {new Date(doc.submissionDate).toLocaleDateString()}
                      </span>
                    )}
                 </div>
               ))}
               {documentChecklist.length === 0 && (
                 <p className="col-span-2 text-center py-6 text-slate-400 text-sm italic">
                   No documents required for this department.
                 </p>
               )}
            </div>
          </div>
        </>
      ) : (
        /* Transfer History Tab */
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Transfer History</h3>
              <p className="text-xs text-slate-500 mt-0.5">Department transfers for {employee.fullName}</p>
            </div>
            <span className="text-sm font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-full px-3 py-1">
              {transferHistory.length} record{transferHistory.length !== 1 ? "s" : ""}
            </span>
          </div>

          {transferHistory.length === 0 ? (
            <div className="py-16 text-center">
              <ArrowRightLeft className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-400 italic text-sm">No transfers recorded yet.</p>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-slate-100" />
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
                      : "bg-indigo-500";
                  const cardClass = isReactivated
                    ? "rounded-xl border border-emerald-200 bg-emerald-50/60 p-4"
                    : isTerminated
                      ? "rounded-xl border border-rose-200 bg-rose-50/60 p-4"
                      : "rounded-xl border border-slate-200 bg-slate-50/60 p-4";
                  const toDeptClass = isReactivated
                    ? "text-emerald-700"
                    : isTerminated
                      ? "text-rose-700"
                      : "text-indigo-700";
                  const arrowClass = isReactivated
                    ? "h-3.5 w-3.5 text-emerald-500"
                    : isTerminated
                      ? "h-3.5 w-3.5 text-rose-500"
                      : "h-3.5 w-3.5 text-indigo-500";

                  return (
                  <li key={idx} className="relative pl-12">
                    <div className={`absolute left-3.5 top-1.5 w-3 h-3 rounded-full border-2 border-white shadow ${markerClass}`} />
                    <div className={cardClass}>
                      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                          <span className="text-slate-500">{record.fromDepartmentName || "—"}</span>
                          <ArrowRightLeft className={arrowClass} />
                          <span className={toDeptClass}>{record.toDepartmentName}</span>
                        </div>
                        <span className="text-xs text-slate-500 bg-white border border-slate-200 rounded-full px-2.5 py-0.5">
                          {new Date(record.transferDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                        {record.newPosition && (
                          <div>
                            <p className="text-slate-400 uppercase tracking-wide mb-0.5">New Position</p>
                            <p className="font-medium text-slate-700">{record.newPosition}</p>
                          </div>
                        )}
                        {record.newSalary && (
                          <div>
                            <p className="text-slate-400 uppercase tracking-wide mb-0.5">New Salary</p>
                            <p className="font-medium text-slate-700">{new Intl.NumberFormat("en-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(record.newSalary)}</p>
                          </div>
                        )}
                        {((record.nextReviewDateReset && record.nextReviewDateAfterTransfer) ||
                          (record.yearlyIncreaseDateChanged && record.newYearlyIncreaseDate)) && (
                          <div>
                            <p className="text-slate-400 uppercase tracking-wide mb-0.5">Next review after transfer</p>
                            <p className="font-medium text-indigo-600">
                              {new Date(
                                record.nextReviewDateAfterTransfer || record.newYearlyIncreaseDate,
                              ).toLocaleDateString()}
                            </p>
                          </div>
                        )}
                        {record.processedBy && (
                          <div className="col-span-full">
                            <p className="text-slate-400 uppercase tracking-wide mb-0.5">Processed By</p>
                            <p className="font-medium text-slate-600">{record.processedBy}</p>
                          </div>
                        )}
                        {record.notes && (
                          <div className="col-span-full border-t border-slate-200 pt-2 mt-1">
                            <p className="text-slate-400 uppercase tracking-wide mb-0.5">Notes</p>
                            <p className="text-slate-600">{record.notes}</p>
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
    </Layout>
  );
}
