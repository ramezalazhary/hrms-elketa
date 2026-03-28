import { useNavigate } from "react-router-dom";
import { FormBuilder } from "@/shared/components/FormBuilder";
import { Layout } from "@/shared/components/Layout";
import { useToast } from "@/shared/components/ToastProvider";
import { useEffect } from "react";
import { fetchEmployeesThunk } from "@/modules/employees/store";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/reduxHooks";
import { createDepartmentThunk } from "../store";

export function CreateDepartmentPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const employees = useAppSelector((state) => state.employees.items);
  const { showToast } = useToast();

  useEffect(() => {
    dispatch(fetchEmployeesThunk());
  }, [dispatch]);

  const employeeOptions = employees.map((emp) => ({
    value: emp.email,
    label: `${emp.fullName} (${emp.position})`,
  }));

  return (
    <Layout
      title="Create Department"
      description="Register a new organizational unit or project team."
    >
      <FormBuilder
        onCancel={() => navigate("/departments")}
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
        submitLabel="Create Department"
        onSubmit={async (values) => {
          try {
            await dispatch(
              createDepartmentThunk({
                ...values,
                positions: [],
                teams: [],
              }),
            ).unwrap();
            showToast("Department created successfully", "success");
            navigate("/departments");
          } catch (error) {
            console.error(error);
            showToast("Failed to create department", "error");
          }
        }}
      />
    </Layout>
  );
}
