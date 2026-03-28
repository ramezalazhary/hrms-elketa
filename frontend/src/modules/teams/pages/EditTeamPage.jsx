import { useNavigate, useParams } from "react-router-dom";
import { FormBuilder } from "@/shared/components/FormBuilder";
import { Layout } from "@/shared/components/Layout";
import { useToast } from "@/shared/components/ToastProvider";
import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/reduxHooks";
import { updateTeamThunk, fetchTeamThunk } from "../store";
import { fetchDepartmentsThunk } from "@/modules/departments/store";

export function EditTeamPage() {
  const { teamId } = useParams();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const departments = useAppSelector((state) => state.departments?.items || []);
  const team = useAppSelector((state) => state.teams?.selectedTeam);
  const isLoading = useAppSelector((state) => state.teams?.isLoading);

  useEffect(() => {
    if (teamId) {
      dispatch(fetchTeamThunk(teamId));
    }
    dispatch(fetchDepartmentsThunk());
  }, [teamId, dispatch]);

  const handleSubmit = async (formData) => {
    try {
      await dispatch(
        updateTeamThunk({
          id: teamId,
          name: formData.name,
          managerEmail: formData.managerEmail || null,
          description: formData.description || "",
          positions: formData.positions || [],
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
          description: team.description || "",
          status: team.status || "ACTIVE",
        }}
        fields={[
          { name: "name", label: "Team Name", type: "text", required: true },
          { name: "managerEmail", label: "Manager Email", type: "email" },
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
