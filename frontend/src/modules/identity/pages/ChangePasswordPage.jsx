import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { FormBuilder } from "@/shared/components/FormBuilder";
import { useAppDispatch } from "@/shared/hooks/reduxHooks";
import { changePasswordThunk } from "../store";
import { KeyRound } from "lucide-react";

export function ChangePasswordPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-800/50 p-6 w-full">
      <div className="w-full max-w-md rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-card overflow-hidden">
        <div className="p-6 sm:p-8">
          <div className="flex items-start gap-3 mb-6">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
              <KeyRound className="h-5 w-5 text-zinc-600 dark:text-zinc-400" aria-hidden />
            </div>
            <div>
              <h1 className="text-base font-medium text-zinc-900 dark:text-zinc-100">Choose a new password</h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                Your account is using a temporary password. Enter it below, then set a strong password you’ll use
                from now on.
              </p>
            </div>
          </div>

          <ul className="text-xs text-zinc-600 dark:text-zinc-400 space-y-1 mb-6 list-disc list-inside border border-zinc-100 dark:border-zinc-800/50 rounded-md bg-zinc-50/80 dark:bg-zinc-800/50 px-3 py-2">
            <li>At least 8 characters</li>
            <li>Include uppercase, lowercase, and a number</li>
          </ul>

          <FormBuilder
            fields={[
              {
                name: "currentPassword",
                label: "Current (temporary) password",
                type: "password",
                required: true,
              },
              {
                name: "newPassword",
                label: "New password",
                type: "password",
                required: true,
              },
            ]}
            submitLabel={loading ? "Saving…" : "Save and continue"}
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

                navigate("/login");
              } catch (err) {
                setError(
                  err?.error ||
                    err?.message ||
                    "Could not update password. Check your temporary password.",
                );
              } finally {
                setLoading(false);
              }
            }}
            error={error}
            disabled={loading}
          />

          <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400 text-center">
            After saving, sign in again with your email and new password.
          </p>
        </div>
      </div>
    </main>
  );
}
