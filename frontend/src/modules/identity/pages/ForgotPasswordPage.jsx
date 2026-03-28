import { useState } from "react";
import { Link } from "react-router-dom";
import { Lock, ArrowLeft, CheckCircle2 } from "lucide-react";
import { forgotPasswordApi } from "../api";

/**
 * Public self-service: creates a pending password-reset request for Admin / HR head to fulfill.
 * Does not reveal whether the email exists (server returns the same message).
 */
export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus("loading");
    setError(null);

    try {
      await forgotPasswordApi(email.trim());
      setStatus("success");
    } catch (err) {
      setError(err?.error || err?.message || "Could not submit request.");
      setStatus("idle");
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-zinc-50 items-center justify-center p-6 font-sans text-zinc-900">
      <div className="w-full max-w-[400px]">
        <div className="mb-8 text-center">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 bg-white shadow-card mb-4">
            <Lock className="h-5 w-5 text-zinc-600" aria-hidden />
          </div>
          <h1 className="text-base font-medium tracking-tight text-zinc-900">Forgot password</h1>
          <p className="text-sm text-zinc-500 mt-2 leading-relaxed">
            We don’t send a reset link. Your request is queued for an administrator (or HR lead) who can set a
            new temporary password. You’ll sign in with that password, then choose your own.
          </p>
        </div>

        {status === "success" ? (
          <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-card space-y-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" aria-hidden />
              <div className="text-sm text-zinc-700 space-y-2">
                <p className="font-medium text-zinc-900">Request received</p>
                <p>
                  If an account exists for <span className="font-mono text-zinc-800">{email}</span>, a pending
                  item appears in <strong>Administration → Requests</strong> for staff who handle password
                  resets.
                </p>
                <p className="text-zinc-500">
                  After they set a temporary password, use <strong>Sign in</strong> with your email and that
                  password. You will be asked to change it immediately.
                </p>
              </div>
            </div>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-sm font-medium text-zinc-900 hover:underline"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-card">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-600 block">Work email</label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-md text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                placeholder="name@company.com"
              />
            </div>

            {error ? (
              <div className="p-2.5 rounded-md bg-zinc-50 text-zinc-700 text-xs border border-zinc-200">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={status === "loading"}
              className="w-full py-2 px-3 bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {status === "loading" ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Submitting…
                </>
              ) : (
                "Submit request"
              )}
            </button>

            <div className="text-center pt-1">
              <Link to="/login" className="text-xs text-zinc-500 hover:text-zinc-800">
                Cancel
              </Link>
            </div>
          </form>
        )}

        <p className="mt-6 text-center text-[11px] text-zinc-400">&copy; {new Date().getFullYear()}</p>
      </div>
    </div>
  );
}
