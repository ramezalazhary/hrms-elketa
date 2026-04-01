import { useNavigate } from "react-router-dom";
import { FormBuilder } from "@/shared/components/FormBuilder";
import { Layout } from "@/shared/components/Layout";
import { useToast } from "@/shared/components/ToastProvider";
import { createEmployeeThunk } from "../store";
import { fetchDepartmentsThunk } from "@/modules/departments/store";
import { useState, useEffect, useMemo } from "react";
import { getDocumentRequirementsApi } from "@/modules/organization/api";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/reduxHooks";
import { EGYPT_GOVERNORATES, getCitiesForGovernorate } from "@/shared/data/egyptGovernorates";

export function CreateEmployeePage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const departments = useAppSelector((state) => state.departments.items);
  const [provisionedData, setProvisionedData] = useState(null);
  const role = useAppSelector((state) => state.identity.currentUser?.role);
  const [selectedGovernorate, setSelectedGovernorate] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [socialInsuranceStatus, setSocialInsuranceStatus] = useState("NOT_INSURED");
  const [hasMedicalInsurance, setHasMedicalInsurance] = useState("NO");
  const [policyLocations, setPolicyLocations] = useState([]);

  useEffect(() => {
    dispatch(fetchDepartmentsThunk());
    const loadPolicy = async () => {
      try {
        const data = await getDocumentRequirementsApi();
        if (data.workLocations) setPolicyLocations(data.workLocations);
      } catch (err) {}
    };
    loadPolicy();
  }, [dispatch]);

  const devDemoFill = useMemo(() => {
    if (!import.meta.env.DEV) return undefined;
    return {
      label: "Fill demo data",
      getValues: () => {
        const d = departments[0];
        const teamName = d?.teams?.[0]?.name ?? "";
        return {
          fullName: "Demo Employee",
          fullNameArabic: "موظف تجريبي",
          dateOfBirth: "1990-06-15",
          gender: "MALE",
          maritalStatus: "SINGLE",
          nationality: "Egyptian",
          idNumber: "12345678901234",
          nationalIdExpiryDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
          email: `demo.employee.${Date.now()}@example.com`,
          workEmail: "",
          phoneNumber: "+201001234567",
          emergencyPhone: "+201009876543",
          address: "123 Demo Street, Cairo",
          governorate: "Cairo",
          city: "Nasr City",
          employeeCode: "",
          position: "Software Engineer",
          department: d?.name ?? "",
          team: teamName,
          workLocation: "Cairo HQ",
          subLocation: "",
          onlineStorageLink: "",
          dateOfHire: new Date().toISOString().slice(0, 10),
          employmentType: "FULL_TIME",
          status: "ACTIVE",
          insuranceProvider: "Misr Insurance",
          insurancePolicy: "POL-DEMO-001",
          insuranceCoverage: "HEALTH",
          baseSalary: "20000",
          paymentMethod: "BANK_TRANSFER",
          bankAccount: "9876543210",
          currency: "EGP",
          hasMedicalInsurance: "YES",
          socialInsuranceStatus: "INSURED",
          insuranceDate: new Date().toISOString().slice(0, 10),
          subscriptionWage: "2500",
          basicWage: "5000",
          comprehensiveWage: "20000",
          jobType: "Software Engineering",
          form6Date: "",
          insuranceNumber: "12345678",
          medicalCondition: "",
        };
      },
    };
  }, [departments]);

  const cityOptions = useMemo(() => {
    return getCitiesForGovernorate(selectedGovernorate).map((c) => ({ label: c, value: c }));
  }, [selectedGovernorate]);

  const selectedBranches = useMemo(() => {
    return policyLocations.find((l) => l.governorate === selectedGovernorate && l.city === selectedCity)?.branches || [];
  }, [policyLocations, selectedGovernorate, selectedCity]);

  const branchOptions = selectedBranches.length > 0 
      ? selectedBranches.map((b) => ({ label: b, value: b }))
      : [{ label: "— Select city or register branches in Policy —", value: "" }];

  if (provisionedData) {
    return (
      <Layout
        title="Employee created"
        description="A login was created with a temporary password."
      >
        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-card space-y-5 max-w-xl">
          <div>
            <p className="text-sm text-zinc-700">
              Sign-in was enabled for <span className="font-medium text-zinc-900">{provisionedData.email}</span>.
              Share the temporary password through a secure channel (not email, if possible).
            </p>
          </div>
          <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Temporary password</p>
              <p className="font-mono text-lg font-medium text-zinc-900 mt-1">{provisionedData.defaultPassword}</p>
            </div>
            <button
              type="button"
              onClick={() => { void navigator.clipboard.writeText(provisionedData.defaultPassword); }}
              className="px-3 py-2 rounded-md border border-zinc-200 bg-white text-sm font-medium text-zinc-800 hover:bg-zinc-50"
            >
              Copy
            </button>
          </div>
          <ol className="text-sm text-zinc-600 space-y-2 list-decimal list-inside border-t border-zinc-100 pt-4">
            <li>They open <strong>Sign in</strong> and use this email and temporary password.</li>
            <li>They are taken to <strong>Change password</strong> and must pick a new password before using the app.</li>
            <li>If they forget before changing it, they can use <strong>Forgot password</strong> so an admin can set another temporary password.</li>
          </ol>
          <button
            type="button"
            onClick={() => navigate("/employees")}
            className="w-full sm:w-auto px-4 py-2 bg-zinc-900 text-white rounded-md hover:bg-zinc-800 text-sm font-medium"
          >
            Back to employees
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout
      title="Create Employee"
      description="Capture core employee identity and organizational assignment."
    >
      <FormBuilder
        onCancel={() => navigate("/employees")}
        devDemoFill={devDemoFill}
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

          { type: "section", label: "3. Job & Administrative" },
          { name: "employeeCode", label: "Employee Code", type: "text" },
          { name: "position", label: "Job Title", type: "text", required: true },
          {
            name: "department",
            label: "Department",
            type: "select",
            required: true,
            options: departments.map(d => ({ label: d.name, value: d.name }))
          },
          {
            name: "team",
            label: "Team / Unit",
            type: "select",
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
          {
            name: "role",
            label: "Privilege Level",
            type: "select",
            required: true,
            options: role === "ADMIN" || role === "HR_STAFF" || role === 3
              ? [
                  { label: "Employee", value: "EMPLOYEE" },
                  { label: "Team Leader", value: "TEAM_LEADER" },
                  { label: "Manager", value: "MANAGER" },
                  { label: "HR Staff", value: "HR_STAFF" },
                  { label: "Admin", value: "ADMIN" },
                ]
              : [
                  { label: "Employee", value: "EMPLOYEE" },
                  { label: "Team Leader", value: "TEAM_LEADER" },
                  { label: "Manager", value: "MANAGER" },
                ]
          },
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

          { type: "section", label: "4. Benefits & Compensation" },
           { name: "baseSalary", label: "Base Salary", type: "number" },
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
             { name: "dateOfHireDummy", label: "Date of Hire (Reference)", type: "text", disabled: true, value: devDemoFill?.getValues()?.dateOfHire }, // Visually read-only mapping usually requires explicit component logic, but we'll adapt using placeholder for clarity
             { name: "insuranceDate", label: "Insurance Date", type: "date" },
             { name: "subscriptionWage", label: "Subscription Wage", type: "number", placeholder: "أجر الأشتراك" },
             { name: "basicWage", label: "Basic Wage / Fixed Wage", type: "number", placeholder: "أجر أساسي" },
             { name: "comprehensiveWage", label: "Comprehensive Wage / Total Wage", type: "number", placeholder: "الأجر الشامل" },
             { name: "jobType", label: "Job Type / Work Type", type: "text", placeholder: "نوع العمل" },
             { name: "form6Date", label: "Form 6 Date (Insurance End)", type: "date" },
             { name: "insuranceNumber", label: "Insurance Number", type: "text" },
           ] : [])
         ]}
        submitLabel="Create Employee"
        onSubmit={async (values) => {
          try {
            const {
              insuranceProvider,
              insurancePolicy,
              insuranceCoverage,
              baseSalary,
              paymentMethod,
              bankAccount,
              hasMedicalInsurance,
              currency,
              socialInsuranceStatus,
              insuranceDate,
              subscriptionWage,
              basicWage,
              comprehensiveWage,
              jobType,
              form6Date,
              insuranceNumber,
              medicalCondition,
              ...rest
            } = values;

            const payload = { ...rest };
            for (const key of ["dateOfBirth", "dateOfHire", "nationalIdExpiryDate", "dateOfHireDummy"]) {
              if (payload[key] === "") delete payload[key];
            }

            if (hasMedicalInsurance === "YES") {
              payload.insurance = {
                provider: insuranceProvider || undefined,
                policyNumber: insurancePolicy || undefined,
                coverageType: insuranceCoverage || "HEALTH",
              };
              if (medicalCondition) payload.medicalCondition = medicalCondition;
            } else {
              payload.medicalCondition = ""; // Clear it if no medical insurance
            }

            payload.financial = {
              baseSalary: baseSalary === "" ? undefined : Number(baseSalary),
              paymentMethod: paymentMethod || "BANK_TRANSFER",
              bankAccount: bankAccount || undefined,
              currency: currency || "EGP",
            };
            payload.socialInsurance = {
              status: socialInsuranceStatus || "NOT_INSURED",
              insuranceDate: insuranceDate || undefined,
              subscriptionWage: subscriptionWage === "" ? undefined : Number(subscriptionWage),
              basicWage: basicWage === "" ? undefined : Number(basicWage),
              comprehensiveWage: comprehensiveWage === "" ? undefined : Number(comprehensiveWage),
              jobType: jobType || undefined,
              form6Date: form6Date || undefined,
              insuranceNumber: insuranceNumber || undefined,
            };

            const response = await dispatch(createEmployeeThunk(payload)).unwrap();

            if (response.userProvisioned) {
              setProvisionedData({ email: values.email, defaultPassword: response.defaultPassword });
            } else {
              showToast("Employee created successfully", "success");
              navigate("/employees");
            }
          } catch (error) {
            console.error(error);
            const msg =
              error?.error ||
              error?.message ||
              (typeof error === "string" ? error : null) ||
              "Failed to create employee";
            showToast(msg, "error");
          }
        }}
      />
    </Layout>
  );
}
