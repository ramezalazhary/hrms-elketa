import { useNavigate } from "react-router-dom";
import { FormBuilder } from "@/shared/components/FormBuilder";
import { Layout } from "@/shared/components/Layout";
import { useToast } from "@/shared/components/ToastProvider";
import { useEffect, useMemo, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/reduxHooks";
import { createPositionThunk } from "../store";
import { fetchDepartmentsThunk } from "@/modules/departments/store";
import { fetchTeamsThunk } from "@/modules/teams/store";

export function CreatePositionPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const departments = useAppSelector((state) => state.departments?.items || []);
  const teams = useAppSelector((state) => state.teams?.items || []);
  const [selectedDept, setSelectedDept] = useState(null);

  useEffect(() => {
    dispatch(fetchDepartmentsThunk());
    dispatch(fetchTeamsThunk());
  }, [dispatch]);

  const handleSubmit = async (formData) => {
    try {
      await dispatch(
        createPositionThunk({
          title: formData.title,
          level: formData.level || "",
          responsibility: formData.responsibility || "",
          departmentId: formData.departmentId,
          teamId: formData.teamId || null,
          description: formData.description || "",
          status: "ACTIVE",
        }),
      ).unwrap();

      showToast("Position created successfully", "success");
      navigate("/positions");
    } catch (error) {
      showToast(error?.error || "Failed to create position", "error");
    }
  };

  const filteredTeams = selectedDept
    ? teams.filter(
        (t) =>
          t.departmentId === selectedDept ||
          t.departmentId?._id === selectedDept,
      )
    : [];

  const devDemoFill = useMemo(() => {
    if (!import.meta.env.DEV) return undefined;
    return {
      getValues: () => {
        const firstDeptId = departments[0]?.id || departments[0]?._id || "";
        const deptTeams = teams.filter(
          (t) =>
            t.departmentId === firstDeptId ||
            t.departmentId?._id === firstDeptId,
        );
        const firstTeamId = deptTeams[0]?.id || deptTeams[0]?._id || "";
        return {
          title: `Demo Position ${Date.now().toString(36).slice(-5)}`,
          level: "Mid",
          departmentId: firstDeptId,
          teamId: firstTeamId || "",
          description: "Demo position for UI testing.",
        };
      },
      afterFill: (patch) => {
        if (patch.departmentId) setSelectedDept(patch.departmentId);
      },
    };
  }, [departments, teams]);

  return (
    <Layout
      title="Create Position"
      description="Add a new position to the organization."
    >
      <FormBuilder
        onCancel={() => navigate("/positions")}
        submitLabel="Create Position"
        devDemoFill={devDemoFill}
        onSubmit={handleSubmit}
        fields={[
          {
            name: "title",
            label: "Position Title",
            type: "text",
            required: true,
          },
          {
            name: "level",
            label: "Seniority Level",
            type: "select",
            options: [
              { label: "None / Optional", value: "" },
              { label: "Junior", value: "Junior" },
              { label: "Mid", value: "Mid" },
              { label: "Senior", value: "Senior" },
              { label: "Lead", value: "Lead" },
              { label: "Executive", value: "Executive" },
            ],
          },
          {
            name: "responsibility",
            label: "Responsibility / Key Duties",
            type: "textarea",
            placeholder: "Summarize the primary responsibilities and goals for this position.",
            fullWidth: true,
          },
          {
            name: "departmentId",
            label: "Department",
            type: "select",
            required: true,
            options: departments.map((d) => ({
              label: d.name,
              value: d.id || d._id,
            })),
            onChange: (value) => setSelectedDept(value || null),
          },
          {
            name: "teamId",
            label: "Team (Optional)",
            type: "select",
            options: [
              { label: "None", value: null },
              ...filteredTeams.map((t) => ({
                label: t.name,
                value: t.id || t._id,
              })),
            ],
          },
          {
            name: "description",
            label: "Description",
            type: "textarea",
            fullWidth: true,
          },
        ]}
      />
    </Layout>
  );
}
