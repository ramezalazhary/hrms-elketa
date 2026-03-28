import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { FormBuilder } from "@/shared/components/FormBuilder";
import { Layout } from "@/shared/components/Layout";
import { useAppDispatch } from "@/shared/hooks/reduxHooks";
import { changePasswordThunk } from "../store";

export function ChangePasswordPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 p-6 w-full">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden self-center justify-self-center mt-[-10vh]">
        <div className="p-6 sm:p-8">
          <div className="mb-6">
             <h1 className="text-2xl font-bold text-slate-900 border-b border-slate-100 pb-3">Action Required</h1>
             <p className="mt-2 text-sm text-amber-700 bg-amber-50 p-3 rounded-lg border border-amber-200">You must change your temporary password before accessing your workspace.</p>
          </div>
          <FormBuilder
            fields={[
              {
                name: "currentPassword",
                label: "Temporary Password",
                type: "password",
                required: true,
              },
              {
                name: "newPassword",
                label: "New Secure Password",
                type: "password",
                required: true,
              },
            ]}
            submitLabel={loading ? "Updating..." : "Update Password"}
            onSubmit={async (values) => {
              try {
                setError(null);
                setLoading(true);
                await dispatch(
                  changePasswordThunk({
                    currentPassword: values.currentPassword,
                    newPassword: values.newPassword,
                  }),
                ).unwrap();
                
                // Re-login after password change because the thunk logs out by default
                navigate("/login");
              } catch (err) {
                setError(err.error || "Failed to change password. Please ensure you entered the correct temporary password.");
              } finally {
                setLoading(false);
              }
            }}
            error={error}
            disabled={loading}
          />
        </div>
      </div>
    </main>
  );
}
