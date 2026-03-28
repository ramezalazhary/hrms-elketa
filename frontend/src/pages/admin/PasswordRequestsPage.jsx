import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/shared/components/Layout";
import { Modal } from "@/shared/components/Modal";
import { useToast } from "@/shared/components/ToastProvider";
import { getPasswordRequestsApi, forceResetPasswordApi } from "@/modules/users/api";
import { generateCompliantTemporaryPassword } from "@/shared/utils/password";
import { Inbox, KeyRound, RefreshCw, ArrowRight } from "lucide-react";

export function PasswordRequestsPage() {
  const { showToast } = useToast();
  const [requests, setRequests] = useState([]);
  const [isLoading, setLoading] = useState(false);
  const [activeRequest, setActiveRequest] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const data = await getPasswordRequestsApi();
      setRequests(data);
    } catch (err) {
      console.error(err);
      showToast(err?.error || "Failed to load password requests", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  useEffect(() => {
    if (activeRequest) {
      setNewPassword(generateCompliantTemporaryPassword());
    }
  }, [activeRequest]);

  const handleConfirmReset = async () => {
    if (!activeRequest || !newPassword.trim()) return;
    setSubmitting(true);
    try {
      await forceResetPasswordApi(activeRequest.email, newPassword.trim());
      setRequests((prev) => prev.filter((r) => r._id !== activeRequest._id));
      showToast(
        `Temporary password set for ${activeRequest.email}. Ask them to sign in, then they must choose a new password.`,
        "success",
      );
      setActiveRequest(null);
    } catch (err) {
      console.error(err);
      showToast(err?.error || "Failed to reset password", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout
      title="Password reset requests"
      description="Employees who used “Forgot password” on the sign-in page. Set a temporary password and share it securely; they will change it after login."
    >
      <div className="mb-8 rounded-lg border border-zinc-200 bg-zinc-50/80 p-4 text-sm text-zinc-700 space-y-3">
        <p className="font-medium text-zinc-900">How this works</p>
        <ol className="list-decimal list-inside space-y-2 text-zinc-600">
          <li>
            User opens <Link className="text-zinc-900 underline font-medium" to="/forgot-password">Forgot password</Link>{" "}
            and enters their work email.
          </li>
          <li>Their request appears below (same message is shown even if the email is unknown — for privacy).</li>
          <li>
            You set a temporary password here. They sign in at <Link className="text-zinc-900 underline font-medium" to="/login">Sign in</Link>, then
            are required to replace it with their own password.
          </li>
        </ol>
      </div>

      <div className="space-y-4">
        {isLoading && (
          <div className="flex items-center justify-center p-10 rounded-lg border border-zinc-200 bg-white shadow-card">
            <RefreshCw className="h-5 w-5 text-zinc-400 animate-spin" aria-hidden />
            <span className="ml-2 text-sm text-zinc-500">Loading…</span>
          </div>
        )}

        {!isLoading && requests.length === 0 && (
          <div className="flex flex-col items-center justify-center p-12 rounded-lg border border-dashed border-zinc-200 bg-white text-center">
            <Inbox className="h-10 w-10 text-zinc-300 mb-3" aria-hidden />
            <p className="text-sm font-medium text-zinc-800">No pending requests</p>
            <p className="text-sm text-zinc-500 mt-1 max-w-sm">
              When someone submits the forgot-password form, their email will show up here until you set a new
              temporary password.
            </p>
          </div>
        )}

        <div className="grid gap-3">
          {requests.map((req) => (
            <article
              key={req._id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-zinc-200 bg-white p-4 shadow-card"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-md border border-zinc-200 bg-zinc-50 text-zinc-700 flex items-center justify-center text-sm font-medium shrink-0">
                  {req.email[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h4 className="font-medium text-zinc-900 truncate">{req.email}</h4>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Requested {new Date(req.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveRequest(req)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-medium rounded-md transition-colors"
              >
                Set temporary password
                <ArrowRight className="h-4 w-4" />
              </button>
            </article>
          ))}
        </div>
      </div>

      <Modal
        open={!!activeRequest}
        title="Set temporary password"
        onClose={() => !submitting && setActiveRequest(null)}
        maxWidth="max-w-md"
      >
        {activeRequest ? (
          <div className="space-y-4">
            <p className="text-sm text-zinc-600">
              Account: <span className="font-mono text-zinc-900">{activeRequest.email}</span>
            </p>
            <p className="text-xs text-zinc-500">
              Share this password with the user through a secure channel. They must use uppercase, lowercase, and a
              number in their own password later — this temporary value already meets the server rules.
            </p>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-600 flex items-center gap-2">
                <KeyRound className="h-3.5 w-3.5" />
                Temporary password
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="flex-1 rounded-md border border-zinc-200 px-3 py-2 text-sm font-mono text-zinc-900"
                  autoComplete="off"
                />
                <button
                  type="button"
                  className="shrink-0 rounded-md border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                  onClick={() => setNewPassword(generateCompliantTemporaryPassword())}
                >
                  Regenerate
                </button>
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                disabled={submitting}
                className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
                onClick={() => setActiveRequest(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting || newPassword.length < 8}
                className="rounded-md bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                onClick={handleConfirmReset}
              >
                {submitting ? "Saving…" : "Save and close request"}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </Layout>
  );
}
