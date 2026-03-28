import { useEffect, useMemo } from 'react'
import { Layout } from '@/shared/components/Layout'
import { useAppDispatch, useAppSelector } from '@/shared/hooks/reduxHooks'
import { fetchDepartmentsThunk } from '@/modules/departments/store'
import { fetchEmployeesThunk } from '@/modules/employees/store'
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts'

const coreModules = [ 'Employees', 'Departments', 'Positions', 'Employments', 'Contracts', 'Identity' ]
const futureModules = ['Payroll', 'Attendance', 'Recruitment']

function EmployeeDashboard({ currentUser }) {
  return (
    <Layout
      title={`Welcome back, ${currentUser?.email?.split('@')[0] || 'Employee'}`}
      description="Your personal HR hub and profile overview."
    >
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
         <article className="rounded-3xl border border-white/40 bg-white/60 backdrop-blur-xl p-8 shadow-sm flex flex-col items-center col-span-1 lg:col-span-1 relative overflow-hidden group">
             <div className="absolute inset-x-0 top-0 h-2 bg-gradient-to-r from-blue-400 to-indigo-500"></div>
             <div className="h-28 w-28 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-500 mb-5 shadow-lg flex items-center justify-center text-white text-4xl font-bold ring-4 ring-white/50 group-hover:scale-105 transition-transform duration-300">
               {currentUser?.email?.[0]?.toUpperCase() || 'U'}
             </div>
             <h2 className="text-xl font-bold text-slate-800">{currentUser?.email || 'User'}</h2>
             <span className="mt-2 inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-700/10">Standard Employee</span>
         </article>
         
         <article className="rounded-3xl border border-white/40 bg-white/60 backdrop-blur-xl p-8 shadow-sm col-span-1 lg:col-span-2 relative overflow-hidden">
            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
              <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              Upcoming Analytics
            </h3>
            <div className="rounded-2xl bg-slate-50/50 p-8 border-2 border-slate-200/60 border-dashed text-center flex flex-col items-center justify-center h-48 transition-colors hover:bg-slate-100/50">
               <div className="bg-indigo-100/50 p-4 rounded-full mb-4">
                 <span className="text-3xl filter drop-shadow-sm">📈</span>
               </div>
               <p className="text-slate-600 font-medium text-base">Your personal performance and attendance analytics will appear here.</p>
               <p className="text-slate-400 text-sm mt-2 font-medium">Pending future HR module activation.</p>
            </div>
         </article>
      </div>
    </Layout>
  )
}

function TeamLeaderDashboard({ employees }) {
  return (
    <Layout
      title="Team Dashboard"
      description="Directly managing and monitoring your assigned team members."
    >
      <div className="overflow-hidden rounded-3xl border border-white/40 bg-white/60 backdrop-blur-xl shadow-sm">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
           <h2 className="text-lg font-bold text-slate-800">Your Team Members</h2>
           <span className="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-full">{employees.length} Members</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Employee Name</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Position</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Email</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {employees.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-12 text-center text-slate-500 font-medium">No team members assigned yet.</td>
                </tr>
              ) : (
                employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-white/40 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-800 group-hover:text-blue-700 transition-colors">{emp.fullName}</div>
                      <div className="text-xs text-slate-400">{emp.employeeCode}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 font-medium">{emp.position}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                        emp.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {emp.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">{emp.email}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  )
}


function AdminDashboard({ employees, departments, employeesPerDepartment }) {
  // Aggregate Metrics
  const totalPayroll = useMemo(() => {
    return employees.reduce((sum, emp) => sum + (emp.financial?.baseSalary || 0), 0);
  }, [employees]);

  const activeEmployees = employees.filter(e => e.status === "ACTIVE").length;

  // Pie Chart: Status Distribution
  const statusData = useMemo(() => {
    const statuses = { ACTIVE: 0, ON_LEAVE: 0, RESIGNED: 0, TERMINATED: 0 };
    employees.forEach(emp => { if (statuses[emp.status] !== undefined) statuses[emp.status]++; });
    return [
      { name: "Active", value: statuses.ACTIVE, color: "#10b981" },
      { name: "On Leave", value: statuses.ON_LEAVE, color: "#f59e0b" },
      { name: "Resigned", value: statuses.RESIGNED, color: "#64748b" },
      { name: "Terminated", value: statuses.TERMINATED, color: "#ef4444" }
    ].filter(s => s.value > 0);
  }, [employees]);

  // Bar Chart: Employees per Department
  const deptData = useMemo(() => {
    return employeesPerDepartment.map(d => ({
      name: d.departmentName,
      members: d.employeeCount,
    })).sort((a,b) => b.members - a.members);
  }, [employeesPerDepartment]);

  return (
    <Layout
      title="Global Analytics Ecosystem"
      description="Real-time visualization of structural operations, payroll, and workforce metrics."
    >
      <div className="grid gap-5 md:grid-cols-4 mb-8">
         <article className="rounded-2xl border border-white/50 bg-white/70 backdrop-blur-xl p-5 shadow-sm relative overflow-hidden group">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">Total Headcount</p>
          <div className="mt-2 flex items-baseline gap-2">
            <p className="text-3xl font-extrabold text-slate-900 tracking-tight">{employees.length}</p>
            <span className="text-sm font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">{activeEmployees} Active</span>
          </div>
        </article>
        <article className="rounded-2xl border border-white/50 bg-white/70 backdrop-blur-xl p-5 shadow-sm relative overflow-hidden group">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500"></div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">Company Payroll</p>
          <p className="mt-2 text-3xl font-extrabold text-slate-900 tracking-tight">
             {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(totalPayroll)}
          </p>
        </article>
        <article className="rounded-2xl border border-white/50 bg-white/70 backdrop-blur-xl p-5 shadow-sm relative overflow-hidden group">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-purple-500 to-pink-500"></div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">Total Departments</p>
          <p className="mt-2 text-3xl font-extrabold text-slate-900 tracking-tight">{departments.length}</p>
        </article>
        <article className="rounded-2xl border border-white/50 bg-white/70 backdrop-blur-xl p-5 shadow-sm relative overflow-hidden group">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-500 to-orange-500"></div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">Ratio (Emp / Dept)</p>
          <p className="mt-2 text-3xl font-extrabold text-slate-900 tracking-tight">
            {departments.length > 0 ? (employees.length / departments.length).toFixed(1) : '0.0'}
          </p>
        </article>
      </div>

      <div className="grid gap-6 md:grid-cols-2 mb-8">
        <section className="col-span-1 rounded-3xl border border-white/40 bg-white/60 backdrop-blur-xl p-6 shadow-sm">
          <h2 className="mb-6 text-lg font-bold text-slate-800 flex items-center gap-2">
             <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>
             Workforce Status
          </h2>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                   contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                   itemStyle={{ fontWeight: 'bold' }}
                />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="col-span-1 rounded-3xl border border-white/40 bg-white/60 backdrop-blur-xl p-6 shadow-sm">
          <h2 className="mb-6 text-lg font-bold text-slate-800 flex items-center gap-2">
             <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
             Department Footprints
          </h2>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={deptData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{fontSize: 12, fill: '#64748b'}} tickLine={false} axisLine={false} />
                <YAxis tick={{fontSize: 12, fill: '#64748b'}} tickLine={false} axisLine={false} />
                <Tooltip 
                  cursor={{fill: '#f1f5f9'}}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="members" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </Layout>
  )
}

export function DashboardPage() {
  const dispatch = useAppDispatch()
  const currentUser = useAppSelector((state) => state.identity.currentUser)
  const role = currentUser?.role || 1
  
  const employees = useAppSelector((state) => state.employees.items)
  const departments = useAppSelector((state) => state.departments.items)

  useEffect(() => {
    if (role >= 2 || ["TEAM_LEADER", "MANAGER", "HR_STAFF", "ADMIN"].includes(role)) {
      void dispatch(fetchEmployeesThunk())
      void dispatch(fetchDepartmentsThunk())
    }
  }, [dispatch, role])

  const employeesPerDepartment = useMemo(() => {
    const counts = new Map()

    for (const department of departments) {
      counts.set(department.name, 0)
    }

    for (const employee of employees) {
      counts.set(employee.department, (counts.get(employee.department) ?? 0) + 1)
    }

    return Array.from(counts.entries()).map(([departmentName, employeeCount]) => ({
      departmentName,
      employeeCount,
    }))
  }, [departments, employees])

  if (role === 1 || role === "EMPLOYEE") {
    return <EmployeeDashboard currentUser={currentUser} />
  }

  if (role === 2 || role === "MANAGER") {
    return <TeamLeaderDashboard employees={employees} />;
  }

  if (role === "TEAM_LEADER") {
    return <TeamLeaderDashboard employees={employees} />;
  }


  return (
    <AdminDashboard 
      employees={employees} 
      departments={departments} 
      employeesPerDepartment={employeesPerDepartment} 
    />
  )
}
