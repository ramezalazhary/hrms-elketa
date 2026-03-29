import { useNavigate, useParams } from "react-router-dom";
import { FormBuilder } from "@/shared/components/FormBuilder";
import { Layout } from "@/shared/components/Layout";
import { useToast } from "@/shared/components/ToastProvider";
import { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/reduxHooks";
import { updatePositionThunk, fetchPositionThunk } from "../store";
import { fetchDepartmentsThunk } from "@/modules/departments/store";
import { fetchTeamsThunk } from "@/modules/teams/store";

function initialDepartmentId(position) {
  if (!position?.departmentId) return null;
  return (
    position.departmentId.id ||
    position.departmentId._id ||
    position.departmentId
  );
}

function EditPositionForm({ position, positionId }) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const departments = useAppSelector((state) => state.departments?.items || []);
  const teams = useAppSelector((state) => state.teams?.items || []);
  const [selectedDept, setSelectedDept] = useState(() =>
    initialDepartmentId(position),
  );

  const handleSubmit = async (formData) => {
    try {
      await dispatch(
        updatePositionThunk({
          id: positionId,
          title: formData.title,
          level: formData.level || "",
          responsibility: formData.responsibility || "",
          departmentId: formData.departmentId,
          teamId: formData.teamId || null,
          description: formData.description || "",
          status: formData.status || "ACTIVE",
        }),
      ).unwrap();

      showToast("Position updated successfully", "success");
      navigate("/positions");
    } catch (error) {
      showToast(error?.error || "Failed to update position", "error");
    }
  };

  const filteredTeams = selectedDept
    ? teams.filter(
        (t) =>
          t.departmentId === selectedDept ||
          t.departmentId?._id === selectedDept,
      )
    : [];

  return (
    <Layout title="Edit Position" description="Update position details.">
      <FormBuilder
        onCancel={() => navigate("/positions")}
        onSubmit={handleSubmit}
        initialValues={{
          title: position.title,
          level: position.level || "",
          responsibility: position.responsibility || "",
          departmentId: initialDepartmentId(position),
          teamId:
            position.teamId?.id ||
            position.teamId?._id ||
            position.teamId ||
            null,
          description: position.description || "",
          status: position.status || "ACTIVE",
        }}
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
            placeholder:
              "Summarize the primary responsibilities and goals for this position.",
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
            onChange: (value) => setSelectedDept(value),
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
          {
            name: "status",
            label: "Status",
            type: "select",
            options: [
              { label: "Active", value: "ACTIVE" },
              { label: "Inactive", value: "INACTIVE" },
            ],
          },
        ]}
      />
    </Layout>
  );
}

export function EditPositionPage() {
  const { positionId } = useParams();
  const dispatch = useAppDispatch();
  const position = useAppSelector((state) => state.positions?.selectedPosition);
  const isLoading = useAppSelector((state) => state.positions?.isLoading);

  useEffect(() => {
    if (positionId) {
      dispatch(fetchPositionThunk(positionId));
    }
    dispatch(fetchDepartmentsThunk());
    dispatch(fetchTeamsThunk());
  }, [positionId, dispatch]);

  if (isLoading || !position) {
    return (
      <Layout title="Edit Position" description="Loading...">
        Loading...
      </Layout>
    );
  }

  return (
    <EditPositionForm key={positionId} position={position} positionId={positionId} />
  );
}
