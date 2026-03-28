import { useNavigate } from "react-router-dom";
import { FormBuilder } from "@/shared/components/FormBuilder";
import { Layout } from "@/shared/components/Layout";
import { useToast } from "@/shared/components/ToastProvider";
import { createEmployeeThunk } from "../store";
import { fetchDepartmentsThunk } from "@/modules/departments/store";
import { useState, useEffect, useMemo } from "react";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/reduxHooks";

export function CreateEmployeePage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const departments = useAppSelector((state) => state.departments.items);
  const [provisionedData, setProvisionedData] = useState(null);

  useEffect(() => {
    dispatch(fetchDepartmentsThunk());
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
          dateOfBirth: "1990-06-15",
          gender: "MALE",
          maritalStatus: "SINGLE",
          nationality: "Demo",
          idNumber: "",
          email: `demo.employee.${Date.now()}@example.com`,
          workEmail: "",
          phoneNumber: "+10000000000",
          address: "123 Demo Street",
          employeeCode: "",
          position: "Software Engineer",
          department: d?.name ?? "",
          team: teamName,
          workLocation: "Remote",
          onlineStorageLink: "",
          dateOfHire: new Date().toISOString().slice(0, 10),
          employmentType: "FULL_TIME",
          status: "ACTIVE",
          insuranceProvider: "Demo Insurance",
          insurancePolicy: "POL-DEMO-001",
          insuranceCoverage: "HEALTH",
          baseSalary: "75000",
          currency: "USD",
        };
      },
    };
  }, [departments]);

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
              onClick={() => {
                void navigator.clipboard.writeText(provisionedData.defaultPassword);
              }}
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
        fields={[
          { type: "section", label: "1. Personal Information" },
          { name: "fullName", label: "Full Name", type: "text", required: true },
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
          { name: "idNumber", label: "ID Number", type: "text" },

          { type: "section", label: "2. Contact Information" },
          { name: "email", label: "Personal Email", type: "email", required: true },
          { name: "workEmail", label: "Work Email", type: "email" },
          { name: "phoneNumber", label: "Phone Number", type: "text" },
          { name: "address", label: "Current Address", type: "text", fullWidth: true },

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
          { name: "workLocation", label: "Work Location", type: "text" },
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
          
          { type: "section", label: "4. Benefits & Compensation" },
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
          { name: "baseSalary", label: "Base Salary", type: "number" },
          { name: "currency", label: "Currency", type: "text", placeholder: "USD" },
        ]}
        submitLabel="Create Employee"
        onSubmit={async (values) => {
          try {
            const {
              insuranceProvider,
              insurancePolicy,
              insuranceCoverage,
              baseSalary,
              currency,
              ...rest
            } = values;

            const payload = { ...rest };
            for (const key of ["dateOfBirth", "dateOfHire"]) {
              if (payload[key] === "") delete payload[key];
            }

            payload.insurance = {
              provider: insuranceProvider || undefined,
              policyNumber: insurancePolicy || undefined,
              coverageType: insuranceCoverage || "HEALTH",
            };
            payload.financial = {
              baseSalary: baseSalary === "" ? undefined : Number(baseSalary),
              currency: currency || "USD",
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
