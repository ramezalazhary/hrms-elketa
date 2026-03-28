import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Layout } from '@/shared/components/Layout'
import { useAppSelector } from '@/shared/hooks/reduxHooks'
import { useToast } from '@/shared/components/ToastProvider'
import { FormBuilder } from '@/shared/components/FormBuilder'
import { StatusBadge, DepartmentBadge } from '@/shared/components/EntityBadges'

export function EmployeeProfilePage() {
  const { employeeId } = useParams()
  const { showToast } = useToast()
  const employees = useAppSelector((state) => state.employees.items)
  const currentUser = useAppSelector((state) => state.identity.currentUser)
  const accessToken = useAppSelector((state) => state.identity.accessToken)
  const [showResetModal, setShowResetModal] = useState(false)

  const employee = useMemo(
    () => employees.find((item) => item.id === employeeId),
    [employeeId, employees],
  )

  const handleResetPassword = async (values) => {
    try {
      const res = await fetch('http://localhost:5000/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ targetEmail: employee.email, newPassword: values.newPassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reset password");
      
      showToast(`Password successfully reset for ${employee.email}`, "success");
      setShowResetModal(false);
    } catch(err) {
      showToast(err.message, "error");
    }
  }

  return (
    <Layout
      title="Employee Profile"
      description="Detailed employee identity and current employment details."
      actions={
        <div className="flex items-center gap-2">
          {currentUser?.role === "ADMIN" && (
            <button
              onClick={() => setShowResetModal(true)}
              className="rounded-lg border border-red-200 bg-red-50 text-red-600 px-3 py-1.5 text-sm font-medium transition hover:bg-red-100"
            >
              Force Password Reset
            </button>
          )}
          <Link
            className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-800 transition hover:bg-zinc-50"
            to="/employees"
          >
            Back to List
          </Link>
        </div>
      }
    >
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/30 backdrop-blur-[2px] p-4">
          <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-6 shadow-card">
            <h2 className="text-base font-medium text-zinc-900 mb-2">Reset password</h2>
            <p className="text-sm text-zinc-600 mb-6">
              You are about to forcibly override the password for <strong>{employee?.email}</strong>. 
              They will be locked out of their old account and forced to change this new temporary password immediately.
            </p>
            <FormBuilder 
              fields={[
                { name: "newPassword", type: "password", label: "New Secure Password", required: true }
              ]}
              submitLabel="Reset password"
              onCancel={() => setShowResetModal(false)}
              onSubmit={handleResetPassword}
            />
          </div>
        </div>
      )}
      {employee ? (
        <div className="space-y-6">
          {/* 1. Job & Administrative */}
          <div className="grid gap-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-card md:grid-cols-2 lg:grid-cols-3">
            <h3 className="col-span-full border-b border-zinc-100 pb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">Job & administrative</h3>
            <p><span className="block text-xs font-semibold text-slate-500 uppercase">Employee Code</span> <span className="text-slate-900 font-mono bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">{employee.employeeCode || "N/A"}</span></p>
            <p><span className="block text-xs font-semibold text-slate-500 uppercase">Status</span> <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${employee.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-amber-50 text-amber-700 border border-amber-100'}`}>{employee.status}</span></p>
            <p><span className="block text-xs font-semibold text-slate-500 uppercase">Hire Date</span> <span className="text-slate-900">{employee.dateOfHire ? new Date(employee.dateOfHire).toLocaleDateString() : "N/A"}</span></p>
            <p><span className="block text-xs font-semibold text-slate-500 uppercase">Job Title</span> <span className="text-slate-900">{employee.position}</span></p>
            <p className="flex flex-col gap-1"><span className="block text-xs font-semibold text-slate-500 uppercase">Department</span> <DepartmentBadge name={employee.department || "—"} /></p>
            <p><span className="block text-xs font-semibold text-slate-500 uppercase">Team / Unit</span> <span className="text-slate-900">{employee.team || "None"}</span></p>
            <p><span className="block text-xs font-semibold text-slate-500 uppercase">Contract</span> <span className="text-slate-900 capitalize">{employee.employmentType?.replace('_', ' ').toLowerCase()}</span></p>
            <p><span className="block text-xs font-semibold text-slate-500 uppercase">Work Location</span> <span className="text-slate-900">{employee.workLocation || "N/A"}</span></p>
            {employee.onlineStorageLink && (
              <p className="col-span-full">
                <span className="block text-xs font-semibold text-slate-500 uppercase mb-1">Online Documents</span>
                <a 
                  href={employee.onlineStorageLink} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-zinc-50 text-zinc-800 text-xs font-medium rounded-md border border-zinc-200 hover:bg-zinc-100 transition"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                  Access Digital Archive
                </a>
              </p>
            )}
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* 2. Personal Information */}
            <div className="grid gap-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-card">
              <h3 className="border-b border-zinc-100 pb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">Personal</h3>
              <p><span className="block text-xs font-semibold text-slate-500 uppercase">Full Name</span> <span className="text-slate-900 font-medium">{employee.fullName}</span></p>
              <p><span className="block text-xs font-semibold text-slate-500 uppercase">Date of Birth</span> <span className="text-slate-900">{employee.dateOfBirth ? new Date(employee.dateOfBirth).toLocaleDateString() : "N/A"}</span></p>
              <p><span className="block text-xs font-semibold text-slate-500 uppercase">Gender</span> <span className="text-slate-900 capitalize">{employee.gender?.toLowerCase()}</span></p>
              <p><span className="block text-xs font-semibold text-slate-500 uppercase">Marital Status</span> <span className="text-slate-900 capitalize">{employee.maritalStatus?.toLowerCase()}</span></p>
              <p><span className="block text-xs font-semibold text-slate-500 uppercase">Nationality / ID</span> <span className="text-slate-900">{employee.nationality || "N/A"} {employee.idNumber ? `(${employee.idNumber})` : ""}</span></p>
            </div>

            {/* 3. Contact Information */}
            <div className="grid gap-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-card">
              <h3 className="border-b border-zinc-100 pb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">Contact</h3>
              <p><span className="block text-xs font-semibold text-slate-500 uppercase">Personal Email</span> <span className="text-zinc-900 underline decoration-zinc-300">{employee.email}</span></p>
              <p><span className="block text-xs font-semibold text-slate-500 uppercase">Work Email</span> <span className="text-zinc-900 underline decoration-zinc-300">{employee.workEmail || "N/A"}</span></p>
              <p><span className="block text-xs font-semibold text-slate-500 uppercase">Phone</span> <span className="text-slate-900">{employee.phoneNumber || "N/A"}</span></p>
              <p><span className="block text-xs font-semibold text-slate-500 uppercase">Address</span> <span className="text-slate-900 whitespace-pre-line">{employee.address || "N/A"}</span></p>
            </div>
          </div>

          {/* 4. Education & Skills */}
          <div className="grid gap-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-card md:grid-cols-2">
            <h3 className="col-span-full border-b border-zinc-100 pb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">Education & skills</h3>
            <div>
              <span className="block text-xs font-semibold text-slate-500 uppercase mb-2">Education</span>
              {employee.education?.length > 0 ? (
                <ul className="space-y-2">
                  {employee.education.map((edu, idx) => (
                    <li key={idx} className="text-sm bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <span className="font-semibold text-slate-800">{edu.degree}</span> from <span className="text-slate-600">{edu.institution}</span> ({edu.year})
                    </li>
                  ))}
                </ul>
              ) : <span className="text-slate-400 italic">No education records</span>}
            </div>
            <div>
              <span className="block text-xs font-semibold text-slate-500 uppercase mb-2">Technical Skills</span>
              <div className="flex flex-wrap gap-1.5">
                {employee.skills?.technical?.length > 0 ? (
                  employee.skills.technical.map(skill => (
                    <span key={skill} className="px-2 py-0.5 bg-zinc-100 text-zinc-800 text-xs font-medium rounded border border-zinc-200">{skill}</span>
                  ))
                ) : <span className="text-slate-400 italic">None listed</span>}
              </div>
            </div>
          </div>

          {/* 5. Benefits & Compensation */}
          {currentUser?.role === "ADMIN" ? (
            <div className="grid gap-4 rounded-lg border border-zinc-200 bg-zinc-50/50 p-6 shadow-card">
              <div className="flex items-center justify-between col-span-full border-b border-zinc-200 pb-2">
                <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-700">Benefits & financial</h3>
                <span className="text-[10px] bg-zinc-200 text-zinc-800 px-1.5 rounded uppercase font-medium flex items-center gap-1">
                   <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                   Admin Access
                </span>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div>
                  <span className="block text-xs font-semibold text-slate-500 uppercase">Base Salary</span>
                  <span className="text-slate-900 font-mono text-lg font-bold">
                    {employee.financial?.baseSalary ? new Intl.NumberFormat('en-US', { style: 'currency', currency: employee.financial?.currency || 'USD' }).format(employee.financial.baseSalary) : "N/A"}
                  </span>
                </div>
                <div>
                  <span className="block text-xs font-semibold text-slate-500 uppercase">Insurance Provider</span>
                  <span className="text-slate-900 font-medium">{employee.insurance?.provider || "N/A"}</span>
                </div>
                <div>
                  <span className="block text-xs font-semibold text-slate-500 uppercase">Policy Number</span>
                  <span className="text-slate-900 font-mono tracking-wide">{employee.insurance?.policyNumber || "N/A"}</span>
                </div>
                <div>
                  <span className="block text-xs font-semibold text-slate-500 uppercase">Coverage</span>
                  <span className="text-slate-900 capitalize">{employee.insurance?.coverageType?.toLowerCase() || "N/A"}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-card grayscale opacity-60 relative overflow-hidden pointer-events-none">
              <div className="absolute inset-0 z-10 bg-zinc-100/40 backdrop-blur-[1px] flex items-center justify-center">
                 <div className="bg-zinc-900 text-white px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                    Restricted Access
                 </div>
              </div>
              <div className="flex items-center justify-between col-span-full border-b border-slate-100 pb-2">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Benefits & Financial Information</h3>
              </div>
              <div className="grid gap-4 md:grid-cols-4">
                <p><span className="block text-xs font-semibold text-slate-500 uppercase">Base Salary</span> <span className="text-slate-400">••••••</span></p>
                <p><span className="block text-xs font-semibold text-slate-500 uppercase">Provider</span> <span className="text-slate-400">••••••••••</span></p>
                <p><span className="block text-xs font-semibold text-slate-500 uppercase">Policy</span> <span className="text-slate-400">•••• ••••</span></p>
                <p><span className="block text-xs font-semibold text-slate-500 uppercase">Coverage</span> <span className="text-slate-400">•••</span></p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
          Employee not found.
        </p>
      )}
    </Layout>
  )
}
