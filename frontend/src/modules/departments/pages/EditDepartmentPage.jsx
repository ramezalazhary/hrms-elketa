import { useEffect, useState, useMemo } from "react";
import { Trash2, ShieldCheck } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { FormBuilder } from "@/shared/components/FormBuilder";
import { SearchableSelect } from "@/shared/components/SearchableSelect";
import { Layout } from "@/shared/components/Layout";
import { useToast } from "@/shared/components/ToastProvider";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/reduxHooks";
import { fetchEmployeesThunk } from "@/modules/employees/store";
import { employeeBelongsToDepartment } from "@/shared/utils/departmentMembership";
import { fetchDepartmentsThunk, updateDepartmentThunk } from "../store";

function mapPositionsFromDepartment(dept) {
  return (dept.positions || []).map((p) => ({
    title: p.title,
    level: p.level || "",
    responsibility: p.responsibility || "",
    members: p.members || [],
  }));
}

function mapTeamsFromDepartment(dept) {
  return (dept.teams || []).map((t) => ({
    ...t,
    leaderEmail: t.leaderEmail || t.manager || t.managerEmail || "",
    leaderTitle: t.leaderTitle || "Team Leader",
    leaderResponsibility: t.leaderResponsibility || "",
  }));
}

function EditDepartmentForm({ department, departmentEmployees }) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [positions, setPositions] = useState(() =>
    mapPositionsFromDepartment(department),
  );
  const [teams, setTeams] = useState(() => mapTeamsFromDepartment(department));
  const [removeCurrentLeader, setRemoveCurrentLeader] = useState(false);

  const isManagerRole = (role ,employeeDepartment) => role === "MANAGER" ;
  const currentHeadOption = departmentEmployees.find(
    (emp) => emp.email === department.head,
  );

  const leaderOptions = useMemo(
    () => {
      const nonManagerOptions = departmentEmployees
        .filter((emp) =>{
          return !isManagerRole(emp.role, emp.department);
        })
        .map((emp) => ({
          id: emp.email,
          label: emp.fullName,
          sublabel: emp.position,
        }));

      if (
        currentHeadOption &&
        !nonManagerOptions.some((opt) => opt.id === currentHeadOption.email)
      ) {
        nonManagerOptions.unshift({
          id: currentHeadOption.email,
          label: `${currentHeadOption.fullName} (Current Leader)`,
          sublabel: currentHeadOption.position,
        });
      }

      return nonManagerOptions;
    },
    [departmentEmployees, currentHeadOption],
  );

  const addTeam = () => {
    setTeams([
      ...teams,
      {
        name: "",
        leaderEmail: "",
        leaderTitle: "Team Leader",
        leaderResponsibility: "",
        positions: [],
        members: [],
      },
    ]);
  };

  const updateTeam = (index, field, value) => {
    setTeams((prev) =>
      prev.map((t, i) => (i === index ? { ...t, [field]: value } : t)),
    );
  };

  const removeTeam = (index) => {
    setTeams(teams.filter((_, i) => i !== index));
  };

  const addPosition = () => {
    setPositions([
      ...positions,
      { title: "", level: "", responsibility: "", members: [] },
    ]);
  };

  const updatePosition = (index, field, value) => {
    setPositions((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)),
    );
  };

  const removePosition = (index) => {
    setPositions(positions.filter((_, i) => i !== index));
  };

  return (
    <Layout
      title={`Edit ${department.name}`}
      description="Update department details, leadership, and positions."
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
            name: "code",
            label: "Department Code (e.g., HR, ENG)",
            type: "text",
            required: true,
            placeholder: "Used as prefix for employee IDs (#ENG-001)",
          },
          {
            name: "type",
            label: "Organization Type",
            type: "select",
            required: true,
            options: [
              { label: "Permanent", value: "PERMANENT" },
              { label: "Temporary / Project", value: "PROJECT" },
            ],
          },
          {
            name: "head",
            label: "Department Leader",
            type: "searchableSelect",
            placeholder: `Search employees in ${department.name}...`,
            options: leaderOptions.map((opt) => ({
              label: opt.label,
              value: opt.id,
              sublabel: opt.sublabel,
            })),
          },
          {
            name: "headTitle",
            label: "Leader Title",
            type: "text",
            placeholder: "e.g. Head of Engineering, Finance Director",
          },
          {
            name: "headResponsibility",
            label: "Leader Primary Responsibility",
            type: "textarea",
            fullWidth: true,
          },
          {
            name: "description",
            label: "General Description",
            type: "textarea",
            fullWidth: true,
          },
        ]}
        initialValues={{
          name: department.name,
          code: department.code || "",
          head: department.head || "",
          headTitle: department.headTitle || "Department Leader",
          headResponsibility: department.headResponsibility || "",
          type: department.type || "PERMANENT",
          description: department.description || "",
        }}
        submitLabel="Update Department"
        onSubmit={async (values) => {
          const validPositions = positions
            .filter((p) => p.title)
            .map((p) => ({
              title: p.title,
              level: p.level || "",
              responsibility: p.responsibility || "",
              members: p.members || [],
            }));

          try {
            const selectedHead =
              values.head && String(values.head).trim()
                ? String(values.head).trim()
                : null;
            const head = removeCurrentLeader ? null : selectedHead;
            await dispatch(
              updateDepartmentThunk({
                ...department,
                ...values,
                head,
                positions: validPositions,
                teams: teams
                  .filter((t) => t.name)
                  .map((t) => ({
                    ...t,
                    leaderEmail: t.leaderEmail || "",
                  })),
              }),
            ).unwrap();
            await dispatch(fetchEmployeesThunk());
            showToast("Department updated successfully", "success");
            navigate("/departments");
          } catch (error) {
            console.error(error);
            showToast("Failed to update department", "error");
          }
        }}
      />

      <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
        <p className="text-sm text-blue-900">
          Selecting a department leader will automatically promote that employee
          to manager (if needed), remove them from team leadership and team
          membership, and assign a department-head manager position title.
        </p>
      </div>

      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-amber-900">
            {department.head
              ? `Current leader: ${department.head}`
              : "No leader currently assigned."}
          </p>
          <button
            type="button"
            onClick={() => setRemoveCurrentLeader((prev) => !prev)}
            className="rounded-md border border-amber-300 bg-white dark:bg-zinc-900 px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-100"
          >
            {removeCurrentLeader
              ? "Keep current leader"
              : "Remove current leader"}
          </button>
        </div>
      </div>

      <div className="mt-8 space-y-8">
        <div className="rounded-2xl border border-slate-200 bg-white dark:bg-zinc-900 p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between border-b pb-4">
            <h3 className="text-lg font-bold uppercase tracking-wide text-slate-800">
              Department Positions
            </h3>
            <button
              type="button"
              onClick={addPosition}
              className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-1.5 text-sm font-medium text-zinc-800 dark:text-zinc-200 transition hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
            >
              + Add position
            </button>
          </div>
          <div className="space-y-4">
            {positions.map((pos, index) => (
              <div
                key={index}
                className="group relative flex flex-col gap-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-4"
              >
                <button
                  type="button"
                  onClick={() => removePosition(index)}
                  className="absolute right-4 top-4 rounded-lg p-2 text-zinc-400 opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                >
                  <Trash2 size={16} />
                </button>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">
                      Title
                    </label>
                    <input
                      type="text"
                      value={pos.title}
                      onChange={(e) => updatePosition(index, "title", e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white dark:bg-zinc-900 px-3 py-2"
                      placeholder="e.g. Lead Engineer"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">
                      Level (Optional)
                    </label>
                    <input
                      type="text"
                      value={pos.level}
                      onChange={(e) => updatePosition(index, "level", e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white dark:bg-zinc-900 px-3 py-2"
                      placeholder="e.g. Junior, Senior"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">
                    Employees in this position
                  </label>
                  <SearchableSelect
                    options={leaderOptions}
                    value={pos.members || []}
                    multiple={true}
                    placeholder="Select staff..."
                    onChange={(val) => updatePosition(index, "members", val)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">
                    Primary Responsibility
                  </label>
                  <textarea
                    value={pos.responsibility}
                    onChange={(e) =>
                      updatePosition(index, "responsibility", e.target.value)
                    }
                    rows={2}
                    className="w-full rounded-lg border border-slate-200 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                    placeholder="Summarize what this role does..."
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white dark:bg-zinc-900 p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between border-b pb-4">
            <div>
              <h3 className="flex items-center gap-2 text-lg font-bold uppercase tracking-wide text-slate-800">
                Teams / Sub-units
                <ShieldCheck
                  size={16}
                  className="text-emerald-500"
                  title="Strictly departmentalized"
                />
              </h3>
              <p className="text-xs italic text-slate-500">
                Only employees from {department.name} can lead or join these
                teams.
              </p>
            </div>
            <button
              type="button"
              onClick={addTeam}
              className="rounded-xl bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700 shadow-sm transition hover:bg-emerald-100"
            >
              + Create Team
            </button>
          </div>
          <div className="space-y-6">
            {teams.map((team, index) => (
              <div
                key={index}
                className="group relative rounded-2xl border border-slate-200 bg-slate-50/50 p-6"
              >
                <button
                  type="button"
                  onClick={() => removeTeam(index)}
                  className="absolute right-4 top-4 rounded-md p-1 text-slate-400 opacity-0 transition hover:text-red-500 group-hover:opacity-100"
                >
                  <Trash2 size={18} />
                </button>
                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">
                        Team Name
                      </label>
                      <input
                        type="text"
                        value={team.name}
                        onChange={(e) => updateTeam(index, "name", e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white dark:bg-zinc-900 px-3 py-2 shadow-sm"
                        placeholder="e.g., UI/UX Team"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">
                        Team Leader
                      </label>
                      <SearchableSelect
                        options={leaderOptions}
                        value={team.leaderEmail}
                        placeholder="Search departmental employees..."
                        onChange={(val) => updateTeam(index, "leaderEmail", val)}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">
                        Team Members
                      </label>
                      <SearchableSelect
                        options={leaderOptions}
                        value={team.members || []}
                        multiple={true}
                        placeholder="Select members..."
                        onChange={(val) => updateTeam(index, "members", val)}
                      />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">
                        Leader Title
                      </label>
                      <input
                        type="text"
                        value={team.leaderTitle}
                        onChange={(e) =>
                          updateTeam(index, "leaderTitle", e.target.value)
                        }
                        className="w-full rounded-lg border border-slate-200 bg-white dark:bg-zinc-900 px-3 py-2 shadow-sm"
                        placeholder="e.g. Lead Designer"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">
                        Leader Responsibility
                      </label>
                      <textarea
                        value={team.leaderResponsibility}
                        onChange={(e) =>
                          updateTeam(index, "leaderResponsibility", e.target.value)
                        }
                        rows={4}
                        className="w-full rounded-lg border border-slate-200 bg-white dark:bg-zinc-900 px-3 py-2 text-sm shadow-sm"
                        placeholder="Describe the leader's specific duties..."
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {teams.length === 0 && (
              <div className="py-6 text-center text-sm italic text-slate-400">
                No teams defined. Department operates as a single unit or has not
                been subdivided yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

export function EditDepartmentPage() {
  const { departmentId } = useParams();
  const dispatch = useAppDispatch();
  const departments = useAppSelector((state) => state.departments.items);
  const employees = useAppSelector((state) => state.employees.items);

  const department = departments.find((d) => d.id === departmentId);

  useEffect(() => {
    if (!departments.length) {
      dispatch(fetchDepartmentsThunk());
    }
    if (!employees.length) {
      dispatch(fetchEmployeesThunk());
    }
  }, [dispatch, departments.length, employees.length]);

  const departmentEmployees = useMemo(() => {
    if (!department) return [];
    return employees.filter((emp) => employeeBelongsToDepartment(emp, department));
  }, [employees, department]);

  if (!department) {
    return <div>Department not found</div>;
  }
console.log(department , 'department data 🚪🚪🚪🚪');
  return (
    <EditDepartmentForm
      key={department.id}
      department={department}
      departmentEmployees={departmentEmployees}
    />
  );
}
