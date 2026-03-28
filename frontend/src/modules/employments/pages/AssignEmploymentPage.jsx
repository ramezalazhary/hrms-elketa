import { useState, useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '@/shared/hooks/reduxHooks'
import { Layout } from '@/shared/components/Layout'
import { fetchDepartmentsThunk } from '@/modules/departments/store'
import { fetchTeamsThunk } from '@/modules/teams/store'
import { fetchEmployeesThunk } from '@/modules/employees/store'
import { fetchPositionsThunk } from '@/modules/positions/store'
import { assignEmploymentThunk, fetchEmployeeAssignmentsThunk } from '../store'
import { useNavigate } from 'react-router-dom'

export function AssignEmploymentPage() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({
    employeeId: '',
    departmentId: '',
    teamId: '',
    positionId: '',
    isPrimary: true,
  })
  const [searchTerm, setSearchTerm] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const departments = useAppSelector(state => state.departments?.items || [])
  const teams = useAppSelector(state => state.teams?.items || [])
  const employees = useAppSelector(state => state.employees?.items || [])
  const positions = useAppSelector(state => state.positions?.items || [])
  const currentAssignments = useAppSelector(state => state.employments?.selectedAssignments || [])
  const isLoading = useAppSelector(state => state.employments?.isLoading || false)

  useEffect(() => {
    dispatch(fetchDepartmentsThunk())
    dispatch(fetchTeamsThunk({}))
    dispatch(fetchEmployeesThunk())
    dispatch(fetchPositionsThunk({}))
  }, [dispatch])

  const filteredEmployees = employees.filter(emp =>
    emp.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.email?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const selectedEmployee = employees.find(e => e.id === formData.employeeId)
  const filteredTeams = teams.filter(t => t.departmentId === formData.departmentId)
  const filteredPositions = positions.filter(p => p.departmentId === formData.departmentId)

  const handleEmployeeSelect = (employeeId) => {
    setFormData(prev => ({ ...prev, employeeId }))
    dispatch(fetchEmployeeAssignmentsThunk(employeeId))
    setStep(2)
    setError('')
  }

  const handleDepartmentSelect = (departmentId) => {
    setFormData(prev => ({ 
      ...prev, 
      departmentId, 
      teamId: '', 
      positionId: '' 
    }))
    setStep(3)
  }

  const handleTeamSelect = (teamId) => {
    setFormData(prev => ({ ...prev, teamId }))
    setStep(4)
  }

  const handlePositionSelect = (positionId) => {
    setFormData(prev => ({ ...prev, positionId }))
    setStep(5)
  }

  const handleAssignmentTypeSelect = (isPrimary) => {
    setFormData(prev => ({ ...prev, isPrimary }))
    setStep(6)
  }

  const handleSubmit = async () => {
    try {
      setError('')
      const payload = {
        employeeId: formData.employeeId,
        departmentId: formData.departmentId,
        ...(formData.teamId && { teamId: formData.teamId }),
        ...(formData.positionId && { positionId: formData.positionId }),
        isPrimary: formData.isPrimary,
      }
      
      await dispatch(assignEmploymentThunk(payload)).unwrap()
      setSuccess(`Successfully assigned ${selectedEmployee?.name} to ${departments.find(d => d.id === formData.departmentId)?.name}`)
      
      setTimeout(() => {
        navigate('/employees')
      }, 2000)
    } catch (err) {
      setError(err || 'Failed to assign employment')
    }
  }

  const handleBack = () => {
    setStep(Math.max(1, step - 1))
    setError('')
  }

  return (
    <Layout title="Assign Employment" description="Assign an employee to a department, team, and position">
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded">
          {success}
        </div>
      )}

      <div className="bg-white rounded-lg border border-zinc-200 shadow-card p-6">
        <div className="mb-6">
          <div className="flex justify-between items-center">
            {[1, 2, 3, 4, 5, 6].map(s => (
              <div
                key={s}
                className={`flex items-center justify-center w-10 h-10 rounded-full text-sm font-medium ${
                  s <= step
                    ? 'bg-zinc-900 text-white'
                    : 'bg-zinc-100 text-zinc-500'
                }`}
              >
                {s}
              </div>
            ))}
          </div>
        </div>

        {/* Step 1: Select Employee */}
        {step === 1 && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Step 1: Select Employee</h2>
            <div className="mb-4">
              <input
                type="text"
                placeholder="Search employee by name or email..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-zinc-200 rounded-md focus:outline-none focus:ring-1 focus:ring-zinc-400"
              />
            </div>
            <div className="max-h-96 overflow-y-auto border border-gray-300 rounded-lg">
              {filteredEmployees.length > 0 ? (
                filteredEmployees.map(emp => (
                  <div
                    key={emp.id}
                    onClick={() => handleEmployeeSelect(emp.id)}
                    className="p-4 border-b border-zinc-100 hover:bg-zinc-50 cursor-pointer"
                  >
                    <div className="font-semibold">{emp.name}</div>
                    <div className="text-sm text-gray-600">{emp.email}</div>
                  </div>
                ))
              ) : (
                <div className="p-4 text-gray-500">No employees found</div>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Select Department */}
        {step === 2 && (
          <div>
            <h2 className="text-xl font-semibold mb-4">
              Step 2: Select Department for {selectedEmployee?.name}
            </h2>
            <div className="grid grid-cols-1 gap-3">
              {departments.map(dept => (
                <button
                  key={dept.id}
                  onClick={() => handleDepartmentSelect(dept.id)}
                  className="p-4 text-left border border-zinc-200 rounded-lg hover:bg-zinc-50 hover:border-zinc-300 transition"
                >
                  <div className="font-semibold">{dept.name}</div>
                  <div className="text-sm text-gray-600">{dept.description || 'No description'}</div>
                </button>
              ))}
            </div>
            <button
              onClick={handleBack}
              className="mt-4 px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
            >
              Back
            </button>
          </div>
        )}

        {/* Step 3: Select Team */}
        {step === 3 && (
          <div>
            <h2 className="text-xl font-semibold mb-4">
              Step 3: Select Team (Optional)
            </h2>
            <div className="grid grid-cols-1 gap-3 mb-4">
              <button
                onClick={() => handleTeamSelect('')}
                className="p-4 text-left border border-zinc-200 rounded-lg hover:bg-zinc-50 hover:border-zinc-300 transition"
              >
                <div className="font-semibold">Skip - No Team</div>
                <div className="text-sm text-gray-600">Assign directly to department</div>
              </button>
              {filteredTeams.map(team => (
                <button
                  key={team.id}
                  onClick={() => handleTeamSelect(team.id)}
                  className="p-4 text-left border border-zinc-200 rounded-lg hover:bg-zinc-50 hover:border-zinc-300 transition"
                >
                  <div className="font-semibold">{team.name}</div>
                  <div className="text-sm text-gray-600">Manager: {team.managerEmail || 'Unassigned'}</div>
                </button>
              ))}
            </div>
            <button
              onClick={handleBack}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
            >
              Back
            </button>
          </div>
        )}

        {/* Step 4: Select Position */}
        {step === 4 && (
          <div>
            <h2 className="text-xl font-semibold mb-4">
              Step 4: Select Position (Optional)
            </h2>
            <div className="grid grid-cols-1 gap-3 mb-4">
              <button
                onClick={() => handlePositionSelect('')}
                className="p-4 text-left border border-zinc-200 rounded-lg hover:bg-zinc-50 hover:border-zinc-300 transition"
              >
                <div className="font-semibold">Skip - No Position</div>
                <div className="text-sm text-gray-600">Assign without specific position</div>
              </button>
              {filteredPositions.map(pos => (
                <button
                  key={pos.id}
                  onClick={() => handlePositionSelect(pos.id)}
                  className="p-4 text-left border border-zinc-200 rounded-lg hover:bg-zinc-50 hover:border-zinc-300 transition"
                >
                  <div className="font-semibold">{pos.title}</div>
                  <div className="text-sm text-gray-600">Level: {pos.level}</div>
                </button>
              ))}
            </div>
            <button
              onClick={handleBack}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
            >
              Back
            </button>
          </div>
        )}

        {/* Step 5: Assign As Primary or Additional */}
        {step === 5 && (
          <div>
            <h2 className="text-xl font-semibold mb-4">
              Step 5: Assignment Type
            </h2>
            {currentAssignments.length > 0 && (
              <div className="mb-4 p-4 bg-zinc-50 border border-zinc-200 rounded-lg">
                <div className="font-medium text-zinc-900 mb-2">Current assignments</div>
                <div className="text-sm text-zinc-700">
                  {currentAssignments.map((assign, idx) => (
                    <div key={idx}>
                      {assign.departmentId.name}
                      {assign.isPrimary && <span className="font-semibold"> (Primary)</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 gap-3 mb-4">
              <button
                onClick={() => handleAssignmentTypeSelect(true)}
                className="p-4 text-left border border-zinc-200 rounded-lg hover:bg-zinc-50 hover:border-zinc-300 transition"
              >
                <div className="font-semibold">Primary Assignment</div>
                <div className="text-sm text-gray-600">Main reporting line and department</div>
              </button>
              <button
                onClick={() => handleAssignmentTypeSelect(false)}
                className="p-4 text-left border border-zinc-200 rounded-lg hover:bg-zinc-50 hover:border-zinc-300 transition"
              >
                <div className="font-semibold">Additional Assignment</div>
                <div className="text-sm text-gray-600">Cross-functional or matrix assignment</div>
              </button>
            </div>
            <button
              onClick={handleBack}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
            >
              Back
            </button>
          </div>
        )}

        {/* Step 6: Review and Confirm */}
        {step === 6 && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Step 6: Review Assignment</h2>
            <div className="bg-gray-50 p-6 rounded-lg mb-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-gray-600 text-sm">Employee</div>
                  <div className="font-semibold">{selectedEmployee?.name}</div>
                </div>
                <div>
                  <div className="text-gray-600 text-sm">Department</div>
                  <div className="font-semibold">
                    {departments.find(d => d.id === formData.departmentId)?.name}
                  </div>
                </div>
                {formData.teamId && (
                  <div>
                    <div className="text-gray-600 text-sm">Team</div>
                    <div className="font-semibold">
                      {teams.find(t => t.id === formData.teamId)?.name}
                    </div>
                  </div>
                )}
                {formData.positionId && (
                  <div>
                    <div className="text-gray-600 text-sm">Position</div>
                    <div className="font-semibold">
                      {positions.find(p => p.id === formData.positionId)?.title}
                    </div>
                  </div>
                )}
                <div>
                  <div className="text-gray-600 text-sm">Assignment Type</div>
                  <div className="font-semibold">
                    {formData.isPrimary ? 'Primary' : 'Additional'}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleBack}
                className="px-6 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={isLoading}
                className="flex-1 px-6 py-2 bg-zinc-900 text-white rounded-md hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Assigning...' : 'Confirm & Assign'}
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
