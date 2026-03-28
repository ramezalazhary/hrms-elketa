import { useNavigate, useParams } from "react-router-dom";
import { FormBuilder } from "@/shared/components/FormBuilder";
import { Layout } from "@/shared/components/Layout";
import { useToast } from "@/shared/components/ToastProvider";
import { useEffect, useState, useMemo } from "react";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/reduxHooks";
import { updateTeamThunk, fetchTeamThunk } from "../store";
import { fetchDepartmentsThunk } from "@/modules/departments/store";
import { fetchEmployeesThunk } from "@/modules/employees/store";

export function EditTeamPage() {
  const { teamId } = useParams();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const departments = useAppSelector((state) => state.departments?.items || []);
  const employees = useAppSelector((state) => state.employees?.items || []);
  const team = useAppSelector((state) => state.teams?.selectedTeam);
  const isLoading = useAppSelector((state) => state.teams?.isLoading);
  const [selectedDeptId, setSelectedDeptId] = useState("");

  useEffect(() => {
    if (teamId) {
      dispatch(fetchTeamThunk(teamId));
    }
    dispatch(fetchDepartmentsThunk());
    dispatch(fetchEmployeesThunk());
  }, [teamId, dispatch]);

  useEffect(() => {
    if (team?.departmentId) {
      const deptId = team.departmentId?.id || team.departmentId?._id || team.departmentId;
      setSelectedDeptId(deptId);
    }
  }, [team]);

  const filteredEmployees = useMemo(() => {
    if (!selectedDeptId) return [];
    const dept = departments.find(d => d.id === selectedDeptId || d._id === selectedDeptId);
    if (!dept) return [];
    
    return employees.filter(emp => 
      emp.departmentId === selectedDeptId || 
      emp.departmentId?._id === selectedDeptId || 
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
      await dispatch(
        updateTeamThunk({
          id: teamId,
          name: formData.name,
          managerEmail: formData.managerEmail || null,
          members: formData.members || [],
          description: formData.description || "",
          status: formData.status || "ACTIVE",
        }),
      ).unwrap();

      showToast("Team updated successfully", "success");
      navigate("/teams");
    } catch (error) {
      showToast(error?.error || "Failed to update team", "error");
    }
  };

  if (isLoading || !team) {
    return (
      <Layout title="Edit Team" description="Loading...">
        Loading...
      </Layout>
    );
  }

  return (
    <Layout title="Edit Team" description="Update team details.">
      <FormBuilder
        onCancel={() => navigate("/teams")}
        onSubmit={handleSubmit}
        initialValues={{
          name: team.name,
          managerEmail: team.managerEmail || "",
          members: team.members || [],
          description: team.description || "",
          status: team.status || "ACTIVE",
        }}
        fields={[
          { name: "name", label: "Team Name", type: "text", required: true },
          { 
            name: "managerEmail", 
            label: "Team Head (Manager)", 
            type: "searchableSelect",
            placeholder: "Search employees in department...",
            options: employeeOptions 
          },
          { 
            name: "members", 
            label: "Team Members", 
            type: "searchableSelect",
            multiple: true,
            placeholder: "Select members...",
            options: employeeOptions 
          },
          {
            name: "description",
            label: "Description",
            type: "textarea",
            fullWidth: true,
          },
          {
            name: "status",
            label: "Status",
            type: "select",
            options: [
              { label: "Active", value: "ACTIVE" },
              { label: "Archived", value: "ARCHIVED" },
            ],
          },
        ]}
      />
    </Layout>
  );
}
