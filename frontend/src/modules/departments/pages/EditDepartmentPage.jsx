import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FormBuilder } from "@/shared/components/FormBuilder";
import { Layout } from "@/shared/components/Layout";
import { useToast } from "@/shared/components/ToastProvider";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/reduxHooks";
import { fetchEmployeesThunk } from "@/modules/employees/store";
import { fetchDepartmentsThunk, updateDepartmentThunk } from "../store";

export function EditDepartmentPage() {
  const { departmentId } = useParams();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const departments = useAppSelector((state) => state.departments.items);
  const employees = useAppSelector((state) => state.employees.items);
  const [positions, setPositions] = useState([]);
  const [teams, setTeams] = useState([]);

  const department = departments.find((d) => d.id === departmentId);
  const { showToast } = useToast();

  useEffect(() => {
    if (!departments.length) {
      dispatch(fetchDepartmentsThunk());
    }
    if (!employees.length) {
      dispatch(fetchEmployeesThunk());
    }
  }, [dispatch, departments.length, employees.length]);

  useEffect(() => {
    if (department) {
      setPositions(
        department.positions.map((p) => ({ title: p.title, level: p.level })),
      );
      setTeams(department.teams || []);
    }
  }, [department]);

  if (!department) {
    return <div>Department not found</div>;
  }

  const employeeOptions = employees.map((emp) => ({
    // Manager scoping in backend uses `Department.head === managerEmail`
    value: emp.email,
    label: `${emp.fullName} (${emp.position})`,
  }));

  const addTeam = () => {
    setTeams([...teams, { name: "", manager: "", positions: [] }]);
  };

  const updateTeam = (index, field, value) => {
    const newTeams = [...teams];
    newTeams[index][field] = value;
    setTeams(newTeams);
  };

  const removeTeam = (index) => {
    setTeams(teams.filter((_, i) => i !== index));
  };

  const addPosition = () => {
    setPositions([...positions, { title: "", level: "" }]);
  };

  const updatePosition = (index, field, value) => {
    const newPositions = [...positions];
    newPositions[index][field] = value;
    setPositions(newPositions);
  };

  const removePosition = (index) => {
    setPositions(positions.filter((_, i) => i !== index));
  };

  return (
    <Layout
      title={`Edit ${department.name}`}
      description="Update department details, head, and positions."
    >
      <FormBuilder
        fields={[
          {
            name: "name",
            label: "Department Name",
            type: "text",
            required: true,
          },
          {
            name: "type",
            label: "Type",
            type: "select",
            required: true,
            options: [
              { label: "Permanent", value: "PERMANENT" },
              { label: "Temporary / Project", value: "PROJECT" },
            ]
          },
          {
            name: "head",
            label: "Department Manager",
            type: "select",
            options: employeeOptions,
          },
          {
            name: "description",
            label: "Description",
            type: "textarea",
            fullWidth: true,
          },
        ]}
        initialValues={{
          name: department.name,
          head: department.head || "",
          type: department.type || "PERMANENT",
          description: department.description || "",
        }}
        submitLabel="Update Department"
        onSubmit={async (values) => {
          const validPositions = positions
            .filter((p) => p.title && p.level)
            .map((p) => ({
              title: p.title,
              level: p.level,
            }));

          try {
            await dispatch(
              updateDepartmentThunk({
                ...department,
                ...values,
                positions: validPositions,
                teams: teams.filter(t => t.name),
              }),
            ).unwrap();
            showToast("Department updated successfully", "success");
            navigate("/departments");
          } catch (error) {
            console.error(error);
            showToast("Failed to update department", "error");
          }
        }}
      />

      <div className="mt-8 space-y-8">
        {/* Positions Section */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between border-b pb-4 mb-4">
            <h3 className="text-lg font-bold text-slate-800 uppercase tracking-wide">Department Positions</h3>
            <button type="button" onClick={addPosition} className="rounded-xl bg-indigo-50 text-indigo-700 px-4 py-2 text-sm font-bold hover:bg-indigo-100 transition">
              + Add Position
            </button>
          </div>
          <div className="space-y-4">
            {positions.map((pos, index) => (
              <div key={index} className="flex gap-4 items-end bg-slate-50/50 p-4 rounded-xl border border-dashed border-slate-200">
                <div className="flex-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Title</label>
                  <input type="text" value={pos.title} onChange={(e) => updatePosition(index, "title", e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2" />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Level</label>
                  <input type="text" value={pos.level} onChange={(e) => updatePosition(index, "level", e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2" />
                </div>
                <button type="button" onClick={() => removePosition(index)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
              </div>
            ))}
          </div>
        </div>

        {/* Teams Section (Special Logic: Convert Dept to Teams) */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between border-b pb-4 mb-4">
            <div>
              <h3 className="text-lg font-bold text-slate-800 uppercase tracking-wide">Teams / Sub-units</h3>
              <p className="text-xs text-slate-500">Group employees into specific functional teams within {department.name}.</p>
            </div>
            <button type="button" onClick={addTeam} className="rounded-xl bg-emerald-50 text-emerald-700 px-4 py-2 text-sm font-bold hover:bg-emerald-100 transition">
              + Create Team
            </button>
          </div>
          <div className="space-y-6">
            {teams.map((team, index) => (
              <div key={index} className="bg-slate-50/50 p-6 rounded-2xl border border-slate-200 relative">
                <button onClick={() => removeTeam(index)} className="absolute top-4 right-4 text-slate-400 hover:text-red-500"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Team Name</label>
                    <input type="text" value={team.name} onChange={(e) => updateTeam(index, "name", e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 bg-white" placeholder="e.g., UI/UX Team" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Team Manager</label>
                    <select value={team.manager} onChange={(e) => updateTeam(index, "manager", e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 bg-white">
                      <option value="">Select Manager...</option>
                      {employeeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            ))}
            {teams.length === 0 && <div className="text-center py-6 text-slate-400 text-sm italic">No teams defined. Department operates as a single unit.</div>}
          </div>
        </div>
      </div>
    </Layout>
  );
}
