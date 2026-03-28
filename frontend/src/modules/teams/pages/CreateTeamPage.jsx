import { useNavigate } from "react-router-dom";
import { FormBuilder } from "@/shared/components/FormBuilder";
import { Layout } from "@/shared/components/Layout";
import { useToast } from "@/shared/components/ToastProvider";
import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/reduxHooks";
import { createTeamThunk } from "../store";
import { fetchDepartmentsThunk } from "@/modules/departments/store";

export function CreateTeamPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const departments = useAppSelector((state) => state.departments?.items || []);

  useEffect(() => {
    dispatch(fetchDepartmentsThunk());
  }, [dispatch]);

  const handleSubmit = async (formData) => {
    try {
      await dispatch(
        createTeamThunk({
          name: formData.name,
          departmentId: formData.departmentId,
          managerEmail: formData.managerEmail || null,
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
        onSubmit={handleSubmit}
        fields={[
          { name: "name", label: "Team Name", type: "text", required: true },
          {
            name: "departmentId",
            label: "Department",
            type: "select",
            required: true,
            options: departments.map((d) => ({
              label: d.name,
              value: d.id || d._id,
            })),
          },
          { name: "managerEmail", label: "Manager Email", type: "email" },
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
