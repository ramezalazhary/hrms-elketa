import { useNavigate, Link } from "react-router-dom";
import { useState } from "react";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/reduxHooks";
import { loginThunk } from "../store";
import { LogIn } from "lucide-react";

export function LoginPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);

  const isLoading = useAppSelector((state) => state.identity.isLoginPending);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setError(null);
      await dispatch(loginThunk({ email: email.trim(), password })).unwrap();
      navigate("/");
    } catch (err) {
    console.log(err)
      const msg =
        err?.error ||
        err?.message ||
        (typeof err === "string" ? err : null) ||
        "Sign in failed. Check your email and password.";
      setError(msg);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-zinc-50 items-center justify-center p-6 font-sans text-zinc-900">
      <div className="w-full max-w-[380px]">
        <div className="mb-8 text-center">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 bg-white shadow-card mb-4 mx-auto">
            <LogIn className="h-5 w-5 text-zinc-600" aria-hidden />
          </div>
          <h1 className="text-lg font-medium tracking-tight text-zinc-900">Sign in</h1>
          <p className="text-sm text-zinc-500 mt-1">Use your work account for HRMS.</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 bg-white p-6 rounded-lg border border-zinc-200 shadow-card"
        >
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-600 block">Email</label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-md text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 focus:border-zinc-400"
              placeholder="name@company.com"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-medium text-zinc-600 block">Password</label>
              <Link to="/forgot-password" className="text-xs text-zinc-500 hover:text-zinc-800 shrink-0">
                Forgot password?
              </Link>
            </div>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-md text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 focus:border-zinc-400"
              placeholder="••••••••"
            />
          </div>

          {error ? (
            <div className="p-2.5 rounded-md bg-zinc-50 text-zinc-700 text-xs border border-zinc-200" role="alert">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-3 mt-1 bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
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
                Signing in…
              </>
            ) : (
              "Sign in"
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-[11px] text-zinc-400 leading-relaxed">
          New or reset password? After an admin sets a temporary password, sign in here — you’ll be prompted to
          choose a new one.
        </p>
        <p className="mt-2 text-center text-[11px] text-zinc-400">&copy; {new Date().getFullYear()}</p>
      </div>
    </div>
  );
}
