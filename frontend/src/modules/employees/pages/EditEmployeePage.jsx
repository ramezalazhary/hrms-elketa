import { useMemo, useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FormBuilder } from "@/shared/components/FormBuilder";
import { Layout } from "@/shared/components/Layout";
import { useToast } from "@/shared/components/ToastProvider";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/reduxHooks";
import { updateEmployeeThunk } from "../store";
import { fetchDepartmentsThunk } from "@/modules/departments/store";

export function EditEmployeePage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { employeeId } = useParams();
  const employees = useAppSelector((state) => state.employees.items);
  const departments = useAppSelector((state) => state.departments.items);
  const currentUser = useAppSelector((state) => state.identity.currentUser);
  const accessToken = useAppSelector((state) => state.identity.accessToken);
  const { showToast } = useToast();

  const [showResetModal, setShowResetModal] = useState(false);

  useEffect(() => {
    dispatch(fetchDepartmentsThunk());
  }, [dispatch]);

  const employee = useMemo(
    () => employees.find((item) => item.id === employeeId),
    [employeeId, employees],
  );

  const handleResetPassword = async (values) => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const rootUrl = API_URL.endsWith('/api') ? API_URL.substring(0, API_URL.length - 4) : API_URL;
      const res = await fetch(`${rootUrl}/api/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ targetEmail: employee.email, newPassword: values.newPassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reset password");
      
      showToast(`Password successfully forced to new value for ${employee.email}`, "success");
      setShowResetModal(false);
    } catch(err) {
      showToast(err.message, "error");
    }
  }

  if (!employee) {
    return (
      <Layout title="Edit Employee">
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
          Employee not found.
        </p>
      </Layout>
    );
  }

  return (
    <Layout
      title="Edit Employee"
      description="Update employee information and organizational assignment."
      actions={
        <div className="flex items-center gap-2">
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
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/30 backdrop-blur-[2px] p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl relative z-10 animate-in zoom-in duration-200">
            <h2 className="text-xl font-bold text-slate-800 mb-2">Reset User Password</h2>
            <p className="text-sm text-slate-600 mb-6">
              You are about to forcibly override the password for <strong>{employee?.email}</strong>. 
              They will be locked out of their old account and forced to change this new temporary password immediately.
            </p>
            <FormBuilder 
              fields={[
                { name: "newPassword", type: "password", label: "New Secure Password", required: true }
              ]}
              submitLabel="Execute Reset"
              onCancel={() => setShowResetModal(false)}
              onSubmit={handleResetPassword}
            />
          </div>
        </div>
      )}

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
        initialValues={{
          ...employee,
          dateOfBirth: employee.dateOfBirth ? new Date(employee.dateOfBirth).toISOString().split('T')[0] : '',
          dateOfHire: employee.dateOfHire ? new Date(employee.dateOfHire).toISOString().split('T')[0] : '',
          insuranceProvider: employee.insurance?.provider || '',
          insurancePolicy: employee.insurance?.policyNumber || '',
          insuranceCoverage: employee.insurance?.coverageType || 'HEALTH',
          baseSalary: employee.financial?.baseSalary || '',
          currency: employee.financial?.currency || 'USD',
        }}
        submitLabel="Save Changes"
        onSubmit={async (values) => {
          try {
            // Reconstruct nested payload for backend
            const payload = { ...values };
            payload.insurance = {
              provider: values.insuranceProvider,
              policyNumber: values.insurancePolicy,
              coverageType: values.insuranceCoverage
            };
            payload.financial = {
              baseSalary: Number(values.baseSalary) || 0,
              currency: values.currency || 'USD'
            };

            await dispatch(
              updateEmployeeThunk({
                id: employee.id,
                ...payload,
              }),
            ).unwrap();
            showToast("Employee updated successfully", "success");
            navigate("/employees");
          } catch (error) {
            console.error(error);
            showToast("Failed to update employee", "error");
          }
        }}
      />
    </Layout>
  );
}
