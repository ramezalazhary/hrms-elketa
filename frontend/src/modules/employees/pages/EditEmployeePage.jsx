import { useMemo, useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FormBuilder } from "@/shared/components/FormBuilder";
import { Layout } from "@/shared/components/Layout";
import { useToast } from "@/shared/components/ToastProvider";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/reduxHooks";
import { updateEmployeeThunk, processSalaryIncreaseThunk } from "../store";
import { fetchDepartmentsThunk } from "@/modules/departments/store";
import { getDocumentRequirementsApi } from "@/modules/organization/api";
import { API_URL } from "@/shared/api/apiBase";
import { EGYPT_GOVERNORATES, getCitiesForGovernorate } from "@/shared/data/egyptGovernorates";
import { ArrowLeft, Clock, Save, ArrowRightLeft, KeyRound, Settings, Briefcase, TrendingUp } from "lucide-react";
import { TransferModal } from "../components/TransferModal";
import { SalaryIncreaseModal } from "../components/SalaryIncreaseModal";

export function EditEmployeePage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { employeeId } = useParams();
  const employees = useAppSelector((state) => state.employees.items);
  const departments = useAppSelector((state) => state.departments.items);
  const currentUser = useAppSelector((state) => state.identity.currentUser);
  const accessToken = useAppSelector((state) => state.identity.accessToken);
  const status = useAppSelector((state) => state.employees.status);
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
  const [policyLocations, setPolicyLocations] = useState([]);

  const employee = useMemo(
    () => employees.find((item) => item.id === employeeId),
    [employeeId, employees],
  );

  useEffect(() => {
    if (!departments.length) dispatch(fetchDepartmentsThunk());
  }, [dispatch, departments.length]);

  useEffect(() => {
    if (employee) {
      setSelectedGovernorate(employee.governorate || "");
      setSelectedCity(employee.city || "");
      setSocialInsuranceStatus(employee.socialInsurance?.status || "NOT_INSURED");
      setHasMedicalInsurance(employee.insurance?.provider ? "YES" : "NO");
    }
  }, [employee]);

  useEffect(() => {
    async function syncChecklist() {
      if (employee) {
        try {
          const data = await getDocumentRequirementsApi();
          const required = data.documentRequirements || [];
          const existing = employee.documentChecklist || [];
          const merged = required.map(req => {
            const found = existing.find(e => e.documentName === req.name);
            return {
               documentName: req.name,
               status: found?.status || "MISSING",
               fileUrl: found?.fileUrl || "",
               submissionDate: found?.submissionDate || null,
               description: req.description
            };
          });
          setDocumentChecklist(merged);
        } catch (err) {
          console.error("Failed to load global policy:", err);
        }
      }
    }
    syncChecklist();

    const loadPolicy = async () => {
      try {
        const data = await getDocumentRequirementsApi();
        if (data.workLocations) setPolicyLocations(data.workLocations);
      } catch (err) {}
    };
    loadPolicy();
  }, [employee]);

  const cityOptions = useMemo(() => {
    return getCitiesForGovernorate(selectedGovernorate).map((c) => ({ label: c, value: c }));
  }, [selectedGovernorate]);

  const selectedBranches = useMemo(() => {
    return policyLocations.find((l) => l.city === selectedCity)?.branches || [];
  }, [policyLocations, selectedCity]);

  const branchOptions = selectedBranches.length > 0 
      ? selectedBranches.map((b) => ({ label: b, value: b }))
      : [{ label: "— Select city or register branches in Policy —", value: "" }];

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
          resetYearlyIncreaseDate: values.resetYearlyIncreaseDate === "YES",
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

  if (status === "loading" || !employee) {
    return (
      <Layout title="Edit Employee">
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
          {status === "loading" ? "Loading..." : "Employee not found."}
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
            onChange={(name, value) => {
              if (name === "governorate") {
                setSelectedGovernorate(value);
                setSelectedCity("");
              }
              if (name === "city") setSelectedCity(value);
              if (name === "socialInsuranceStatus") setSocialInsuranceStatus(value);
              if (name === "hasMedicalInsurance") setHasMedicalInsurance(value);
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

              { type: "section", label: "3. Job & Administrative (Use 'Manage' for Structural Changes)" },
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
                options: departments.flatMap(d => (d.teams || []).map(t => ({ label: `${t.name} (${d.name})`, value: t.name })))
              },
              {
                name: "workLocation",
                label: "Work Location / Branch",
                type: "select",
                options: branchOptions
              },
              { name: "subLocation", label: "Sub-Location (Floor / Wing)", type: "text" },
              { name: "onlineStorageLink", label: "Online Storage Link", type: "text" },
              { name: "dateOfHire", label: "Date of Hire", type: "date" },
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

              { type: "section", label: "4. Benefits & Compensation (Use 'Manage' -> 'Increase Salary' to change Base Salary)" },
              { name: "baseSalary", label: "Base Salary", type: "number", disabled: true },
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

              { type: "section", label: "5. Social Insurance & Health" },
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
              dateOfBirth: employee.dateOfBirth ? new Date(employee.dateOfBirth).toISOString().split('T')[0] : '',
              dateOfHire: employee.dateOfHire ? new Date(employee.dateOfHire).toISOString().split('T')[0] : '',
              nationalIdExpiryDate: employee.nationalIdExpiryDate ? new Date(employee.nationalIdExpiryDate).toISOString().split('T')[0] : '',
              annualAnniversaryDate: employee.annualAnniversaryDate ? new Date(employee.annualAnniversaryDate).toISOString().split('T')[0] : '',
              governorate: employee.governorate || '',
              city: employee.city || '',
              emergencyPhone: employee.emergencyPhone || '',
              subLocation: employee.subLocation || '',
              fullNameArabic: employee.fullNameArabic || '',
              hasMedicalInsurance: employee.insurance?.provider ? "YES" : "NO",
              insuranceProvider: employee.insurance?.provider || '',
              insurancePolicy: employee.insurance?.policyNumber || '',
              insuranceCoverage: employee.insurance?.coverageType || 'HEALTH',
              baseSalary: employee.financial?.baseSalary || '',
              paymentMethod: employee.financial?.paymentMethod || 'BANK_TRANSFER',
              bankAccount: employee.financial?.bankAccount || '',
              currency: employee.financial?.currency || 'EGP',
              socialInsuranceStatus: employee.socialInsurance?.status || 'NOT_INSURED',
              insuranceDate: employee.socialInsurance?.insuranceDate ? new Date(employee.socialInsurance.insuranceDate).toISOString().split('T')[0] : '',
              subscriptionWage: employee.socialInsurance?.subscriptionWage || '',
              basicWage: employee.socialInsurance?.basicWage || '',
              comprehensiveWage: employee.socialInsurance?.comprehensiveWage || '',
              jobType: employee.socialInsurance?.jobType || '',
              form6Date: employee.socialInsurance?.form6Date ? new Date(employee.socialInsurance.form6Date).toISOString().split('T')[0] : '',
              insuranceNumber: employee.socialInsurance?.insuranceNumber || '',
              medicalCondition: employee.medicalCondition || '',
            }}
            submitLabel="Save Changes"
            onSubmit={async (values) => {
              try {
                const payload = { ...values };
                if (values.hasMedicalInsurance === "YES") {
                  payload.insurance = {
                    provider: values.insuranceProvider,
                    policyNumber: values.insurancePolicy,
                    coverageType: values.insuranceCoverage
                  };
                  payload.medicalCondition = values.medicalCondition || undefined;
                } else {
                  payload.insurance = { provider: "", policyNumber: "", coverageType: "HEALTH" };
                  payload.medicalCondition = ""; // Clear if no health insurance
                }
                
                payload.financial = {
                  baseSalary: values.baseSalary ? Number(values.baseSalary) : undefined,
                  paymentMethod: values.paymentMethod || "BANK_TRANSFER",
                  bankAccount: values.bankAccount || undefined,
                  currency: values.currency || 'EGP'
                };
                payload.socialInsurance = {
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
                
                // Cleanup pseudo-fields from values
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
                {[...transferHistory].reverse().map((record, idx) => (
                  <li key={idx} className="relative pl-12">
                    <div className="absolute left-3.5 top-1.5 w-3 h-3 rounded-full bg-indigo-500 border-2 border-white shadow" />
                    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                          <span className="text-slate-500">{record.fromDepartmentName || "—"}</span>
                          <ArrowRightLeft className="h-3.5 w-3.5 text-indigo-500" />
                          <span className="text-indigo-700">{record.toDepartmentName}</span>
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
                        {record.yearlyIncreaseDateChanged && record.newYearlyIncreaseDate && (
                          <div>
                            <p className="text-slate-400 uppercase tracking-wide mb-0.5">New Increase Date</p>
                            <p className="font-medium text-indigo-600">{new Date(record.newYearlyIncreaseDate).toLocaleDateString()}</p>
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
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}
