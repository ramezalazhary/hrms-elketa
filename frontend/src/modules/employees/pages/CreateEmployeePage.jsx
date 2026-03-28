import { useNavigate } from "react-router-dom";
import { FormBuilder } from "@/shared/components/FormBuilder";
import { Layout } from "@/shared/components/Layout";
import { useToast } from "@/shared/components/ToastProvider";
import { createEmployeeThunk } from "../store";
import { fetchDepartmentsThunk } from "@/modules/departments/store";
import { useState, useEffect } from "react";
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

  if (provisionedData) {
    return (
      <Layout title="Employee Created Successfully">
        <div className="rounded-lg bg-green-50 p-6 shadow-sm border border-green-200">
          <h2 className="text-xl font-bold text-green-800 mb-4">Account Auto-Provisioned!</h2>
          <p className="mb-2 text-green-900">
            A secure user vault has been automatically generated for <strong>{provisionedData.email}</strong>.
          </p>
          <div className="bg-white p-4 rounded border border-green-300 my-4 flex justify-between items-center">
             <div>
                <p className="text-sm text-slate-500 uppercase tracking-wider">Temporary Password</p>
                <p className="font-mono text-xl font-bold">{provisionedData.defaultPassword}</p>
             </div>
             <button 
                onClick={() => navigator.clipboard.writeText(provisionedData.defaultPassword)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-medium transition-colors"
              >
                Copy
              </button>
          </div>
          <p className="text-sm text-green-700 italic mb-6">
            Please securely share this password with the employee. They will be forced to change it upon their first login.
          </p>
          <button 
            onClick={() => navigate("/employees")}
            className="w-full sm:w-auto px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium transition-colors"
          >
            Acknowledge & Return to Directory
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
            const payload = { ...values };
            payload.insurance = {
              provider: values.insuranceProvider || undefined,
              policyNumber: values.insurancePolicy || undefined,
              coverageType: values.insuranceCoverage || 'HEALTH'
            };
            payload.financial = {
              baseSalary: Number(values.baseSalary) || undefined,
              currency: values.currency || 'USD'
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
            showToast("Failed to create employee", "error");
          }
        }}
      />
    </Layout>
  );
}
