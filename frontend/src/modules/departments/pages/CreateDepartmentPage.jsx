import { useNavigate } from "react-router-dom";
import { FormBuilder } from "@/shared/components/FormBuilder";
import { Layout } from "@/shared/components/Layout";
import { useToast } from "@/shared/components/ToastProvider";
import { useEffect, useState } from "react";
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
    label: emp.fullName,
    sublabel: emp.department // Show department to disambiguate
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
            name: "code",
            label: "Department Code (e.g., HR, ENG)",
            type: "text",
            required: true,
            placeholder: "Used as prefix for employee IDs (#ENG-001)",
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
            label: "Department Leader (Optional)",
            type: "searchableSelect",
            placeholder: "Search for an employee to lead this department...",
            options: employeeOptions,
          },
          {
            name: "headTitle",
            label: "Leader Title",
            type: "text",
            placeholder: "e.g. Head of HR, Director of Operations",
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
        submitLabel="Create Department"
        onSubmit={async (values) => {
          try {
            const head =
              values.head && String(values.head).trim()
                ? String(values.head).trim()
                : undefined;
            await dispatch(
              createDepartmentThunk({
                ...values,
                head,
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
