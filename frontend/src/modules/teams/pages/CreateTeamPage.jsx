import { useNavigate } from "react-router-dom";
import { FormBuilder } from "@/shared/components/FormBuilder";
import { Layout } from "@/shared/components/Layout";
import { useToast } from "@/shared/components/ToastProvider";
import { useEffect, useMemo, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/reduxHooks";
import { createTeamThunk } from "../store";
import { fetchDepartmentsThunk } from "@/modules/departments/store";
import { fetchEmployeesThunk } from "@/modules/employees/store";

export function CreateTeamPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const departments = useAppSelector((state) => state.departments?.items || []);
  const employees = useAppSelector((state) => state.employees?.items || []);
  const [selectedDeptId, setSelectedDeptId] = useState("");

  useEffect(() => {
    dispatch(fetchDepartmentsThunk());
    dispatch(fetchEmployeesThunk());
  }, [dispatch]);

  const filteredEmployees = useMemo(() => {
    if (!selectedDeptId) return [];
    const deptIdStr = typeof selectedDeptId === 'object' ? selectedDeptId.value : selectedDeptId;
    const dept = departments.find(d => d.id === deptIdStr || d._id === deptIdStr);
    if (!dept) return [];
    
    return employees.filter(emp => 
      emp.departmentId === deptIdStr || 
      emp.departmentId?._id === deptIdStr || 
      emp.department === dept.name
    );
  }, [selectedDeptId, employees, departments]);

  const employeeOptions = useMemo(() => 
    filteredEmployees.map(emp => ({
      label: emp.fullName,
      value: emp.email,
      sublabel: emp.position
    })), 
  [filteredEmployees]);

  const handleSubmit = async (formData) => {
    try {
      const deptId = typeof formData.departmentId === 'object' ? formData.departmentId.value : formData.departmentId;
      await dispatch(
        createTeamThunk({
          name: formData.name,
          departmentId: deptId,
          leaderEmail: formData.leaderEmail || null,
          leaderTitle: formData.leaderTitle || "Team Leader",
          leaderResponsibility: formData.leaderResponsibility || "",
          members: formData.members || [],
          description: formData.description || "",
          positions: formData.positions || [],
          status: "ACTIVE",
        }),
      ).unwrap();

      showToast("Team created successfully", "success");
      navigate("/teams");
    } catch (error) {
      showToast(error?.error || "Failed to create team", "error");
    }
  };

  return (
    <Layout title="Create Team" description="Add a new team to a department.">
      <FormBuilder
        onCancel={() => navigate("/teams")}
        submitLabel="Create Team"
        onSubmit={handleSubmit}
        fields={[
          { 
            name: "departmentId",
            label: "Parent Department",
            type: "select",
            required: true,
            options: departments.map((d) => ({
              label: d.name,
              value: d.id || d._id,
            })),
            onChange: (val) => setSelectedDeptId(val),
          },
          { name: "name", label: "Team Name", type: "text", required: true },
          { 
            name: "leaderEmail", 
            label: "Team Leader", 
            type: "searchableSelect",
            disabled: !selectedDeptId,
            placeholder: selectedDeptId ? "Search employees in department..." : "Select department first...",
            options: employeeOptions 
          },
          { 
            name: "leaderTitle", 
            label: "Leader Title", 
            type: "text",
            placeholder: "e.g. Lead Designer, Tech Lead",
          },
          { 
            name: "leaderResponsibility", 
            label: "Leader Responsibility", 
            type: "textarea",
            fullWidth: true,
            placeholder: "Primary duties of the team leader...",
          },
          { 
            name: "members", 
            label: "Team Members", 
            type: "searchableSelect",
            multiple: true,
            disabled: !selectedDeptId,
            placeholder: selectedDeptId ? "Select members..." : "Select department first...",
            options: employeeOptions 
          },
          {
            name: "description",
            label: "General Description",
            type: "textarea",
            fullWidth: true,
          },
        ]}
      />
    </Layout>
  );
}
