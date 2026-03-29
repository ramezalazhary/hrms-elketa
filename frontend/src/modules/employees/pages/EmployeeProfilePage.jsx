import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Layout } from '@/shared/components/Layout'
import { useAppDispatch, useAppSelector } from '@/shared/hooks/reduxHooks'
import { useToast } from '@/shared/components/ToastProvider'
import { FormBuilder } from '@/shared/components/FormBuilder'
import { DepartmentBadge } from '@/shared/components/EntityBadges'
import { fetchDepartmentsThunk } from '@/modules/departments/store'
import { getDocumentRequirementsApi } from '@/modules/organization/api'
import { API_URL } from '@/shared/api/apiBase'
import { Mail, Briefcase, ArrowLeft, Shield } from 'lucide-react'

export function EmployeeProfilePage() {
  const { employeeId } = useParams()
  const { showToast } = useToast()
  const employees = useAppSelector((state) => state.employees.items)
  const departments = useAppSelector((state) => state.departments.items)
  const currentUser = useAppSelector((state) => state.identity.currentUser)
  const accessToken = useAppSelector((state) => state.identity.accessToken)
  const [showResetModal, setShowResetModal] = useState(false)

  const dispatch = useAppDispatch();

  const [globalPolicy, setGlobalPolicy] = useState(null);

  useEffect(() => {
    if (!departments.length) {
      void dispatch(fetchDepartmentsThunk());
    }
    const loadPolicy = async () => {
      try {
        const data = await getDocumentRequirementsApi();
        setGlobalPolicy(data);
      } catch (err) {
        console.error("Failed to load global policy", err);
      }
    };
    loadPolicy();
  }, [dispatch, departments.length]);

  const employee = useMemo(
    () => employees.find((item) => item.id === employeeId),
    [employeeId, employees],
  )

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
  }, [employee, departments]);

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
  }, [employee, globalPolicy]);

  const handleResetPassword = async (values) => {
    try {
      const res = await fetch(`${API_URL}/auth/reset-password`, {
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
      className="max-w-5xl"
      title="Employee profile"
      description="Identity, role, documents, and contact in one place."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {currentUser?.role === "ADMIN" && (
            <button
              type="button"
              onClick={() => setShowResetModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 shadow-sm transition hover:bg-rose-100"
            >
              <Shield className="h-4 w-4" />
              Reset password
            </button>
          )}
          <Link
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-teal-200 hover:bg-teal-50/80 hover:text-teal-900"
            to="/employees"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to list
          </Link>
        </div>
      }
    >
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-teal-100 bg-white p-6 shadow-2xl shadow-teal-900/10 ring-1 ring-teal-500/10">
            <h2 className="mb-2 text-base font-semibold text-slate-900">Reset password</h2>
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
          <div className="relative overflow-hidden rounded-2xl border border-teal-100/90 bg-gradient-to-br from-teal-600 via-teal-700 to-cyan-800 p-6 text-white shadow-xl shadow-teal-900/20 md:p-8">
            <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-cyan-400/25" />
            <div className="pointer-events-none absolute bottom-0 left-1/3 h-28 w-28 rounded-full bg-violet-500/20 blur-2xl" />
            <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-2xl font-bold ring-2 ring-white/25 backdrop-blur-sm">
                  {(employee.fullName?.trim()?.[0] || '?').toUpperCase()}
                </div>
                <div>
                  <h2 className="text-xl font-semibold tracking-tight md:text-2xl">{employee.fullName}</h2>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-teal-100">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium backdrop-blur-sm">
                      <Briefcase className="h-3.5 w-3.5" />
                      {employee.position || '—'}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium backdrop-blur-sm">
                      <Mail className="h-3.5 w-3.5" />
                      {employee.email}
                    </span>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-white/25 bg-white/10 px-4 py-3 text-center backdrop-blur-sm md:text-left">
                <p className="text-[10px] font-medium uppercase tracking-wide text-teal-100/90">Department</p>
                <p className="mt-0.5 text-sm font-semibold text-white">{employee.department || '—'}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm ring-1 ring-teal-500/5 md:grid-cols-2 lg:grid-cols-3">
            <h3 className="col-span-full flex items-center gap-2 border-b border-teal-100 pb-3 text-xs font-semibold uppercase tracking-wide text-teal-800">
              <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
              Role & workplace
            </h3>
            <p><span className="block text-xs font-semibold text-slate-500 uppercase">Employee Code</span> <span className="text-slate-900 font-mono bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">{employee.employeeCode || "N/A"}</span></p>
            <p><span className="block text-xs font-semibold text-slate-500 uppercase">Status</span> <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${employee.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-amber-50 text-amber-700 border border-amber-100'}`}>{employee.status}</span></p>
            <p><span className="block text-xs font-semibold text-slate-500 uppercase">Hire Date</span> <span className="text-slate-900">{employee.dateOfHire ? new Date(employee.dateOfHire).toLocaleDateString() : "N/A"}</span></p>
            <p><span className="block text-xs font-semibold text-slate-500 uppercase">Job Title</span> <span className="text-slate-900">{employee.position}</span></p>
            <p className="flex flex-col gap-1"><span className="block text-xs font-semibold text-slate-500 uppercase">Department</span> <DepartmentBadge name={employee.department || "—"} /></p>
            <p className="flex flex-col gap-1">
              <span className="block text-xs font-semibold text-slate-500 uppercase">Team / Unit</span> 
              <div className="flex flex-wrap gap-1">
                {assignedTeams.length > 0 ? (
                  assignedTeams.map(t => (
                    <span key={t.id ?? t.name} className="rounded-lg border border-violet-200/80 bg-violet-50 px-2 py-0.5 text-xs font-semibold text-violet-800">
                      {t.name}
                    </span>
                  ))
                ) : (
                  <span className="text-slate-400 italic text-sm">No team assigned</span>
                )}
              </div>
            </p>
            <p><span className="block text-xs font-semibold text-slate-500 uppercase">Contract</span> <span className="text-slate-900 capitalize">{employee.employmentType?.replace('_', ' ').toLowerCase()}</span></p>
            <p><span className="block text-xs font-semibold text-slate-500 uppercase">Work Location</span> <span className="text-slate-900">{employee.workLocation || "N/A"}</span></p>
            {employee.onlineStorageLink && (
              <p className="col-span-full">
                <span className="block text-xs font-semibold text-slate-500 uppercase mb-1">Online Documents</span>
                <a 
                  href={employee.onlineStorageLink} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-cyan-200/80 bg-cyan-50 px-3 py-1.5 text-xs font-medium text-cyan-900 transition hover:bg-cyan-100"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                  Access Digital Archive
                </a>
              </p>
            )}
          </div>

          {/* 1.5 Document Checklist & Progress */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm ring-1 ring-violet-500/5">
            <div className="mb-4 flex flex-col gap-3 border-b border-violet-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-violet-900">Required documents</h3>
              <div className="flex flex-col items-end">
                <span className="mb-1 text-[10px] font-bold uppercase tracking-widest text-teal-700">
                  {mergedChecklist.filter(d => d.status === "RECEIVED").length} / {mergedChecklist.length} received
                </span>
                <div className="h-1.5 w-36 overflow-hidden rounded-full bg-slate-100">
                  <div 
                    className="h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 transition-all duration-700"
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
                            <p className="text-xs font-bold text-slate-800 truncate" title={doc.documentName}>{doc.documentName}</p>
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
                   <p className="text-xs text-slate-400 italic">No global document requirements defined in Organization Rules.</p>
                 </div>
               )}
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="grid gap-4 rounded-2xl border border-slate-200/90 bg-gradient-to-b from-white to-teal-50/30 p-6 shadow-sm ring-1 ring-teal-500/5">
              <h3 className="border-b border-teal-100 pb-2 text-xs font-semibold uppercase tracking-wide text-teal-900">Personal</h3>
              <p><span className="block text-xs font-semibold text-slate-500 uppercase">Full Name</span> <span className="text-slate-900 font-medium">{employee.fullName}</span></p>
              <p><span className="block text-xs font-semibold text-slate-500 uppercase">Date of Birth</span> <span className="text-slate-900">{employee.dateOfBirth ? new Date(employee.dateOfBirth).toLocaleDateString() : "N/A"}</span></p>
              <p><span className="block text-xs font-semibold text-slate-500 uppercase">Gender</span> <span className="text-slate-900 capitalize">{employee.gender?.toLowerCase()}</span></p>
              <p><span className="block text-xs font-semibold text-slate-500 uppercase">Marital Status</span> <span className="text-slate-900 capitalize">{employee.maritalStatus?.toLowerCase()}</span></p>
              <p><span className="block text-xs font-semibold text-slate-500 uppercase">Nationality / ID</span> <span className="text-slate-900">{employee.nationality || "N/A"} {employee.idNumber ? `(${employee.idNumber})` : ""}</span></p>
            </div>

            {/* 3. Contact Information */}
            <div className="grid gap-4 rounded-2xl border border-slate-200/90 bg-gradient-to-b from-white to-cyan-50/30 p-6 shadow-sm ring-1 ring-cyan-500/5">
              <h3 className="border-b border-cyan-100 pb-2 text-xs font-semibold uppercase tracking-wide text-cyan-900">Contact</h3>
              <p><span className="block text-xs font-semibold text-slate-500 uppercase">Personal Email</span> <span className="text-zinc-900 underline decoration-zinc-300">{employee.email}</span></p>
              <p><span className="block text-xs font-semibold text-slate-500 uppercase">Work Email</span> <span className="text-zinc-900 underline decoration-zinc-300">{employee.workEmail || "N/A"}</span></p>
              <p><span className="block text-xs font-semibold text-slate-500 uppercase">Phone</span> <span className="text-slate-900">{employee.phoneNumber || "N/A"}</span></p>
              <p><span className="block text-xs font-semibold text-slate-500 uppercase">Address</span> <span className="text-slate-900 whitespace-pre-line">{employee.address || "N/A"}</span></p>
            </div>
          </div>

          {/* 4. Education & Skills */}
          <div className="grid gap-4 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm ring-1 ring-violet-500/10 md:grid-cols-2">
            <h3 className="col-span-full border-b border-violet-100 pb-2 text-xs font-semibold uppercase tracking-wide text-violet-900">Education & skills</h3>
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
                    <span key={skill} className="rounded-md border border-teal-200/80 bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-900">{skill}</span>
                  ))
                ) : <span className="text-slate-400 italic">None listed</span>}
              </div>
            </div>
          </div>

          {/* 5. Benefits & Compensation */}
          {currentUser?.role === "ADMIN" ? (
            <div className="grid gap-4 rounded-2xl border border-violet-200/60 bg-gradient-to-br from-violet-50/80 to-white p-6 shadow-sm">
              <div className="col-span-full flex items-center justify-between border-b border-violet-200/50 pb-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-violet-900">Benefits & financial</h3>
                <span className="flex items-center gap-1 rounded-md bg-violet-200/60 px-2 py-0.5 text-[10px] font-medium uppercase text-violet-900">
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
        <p className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-950">
          Employee not found.
        </p>
      )}
    </Layout>
  )
}
