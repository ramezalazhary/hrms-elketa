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
      console.log(err);
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
        <div className="mb-8 text-center flex flex-col justify-center animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="inline-flex h-12 w-12 mx-auto items-center justify-center rounded-2xl bg-indigo-50 border border-indigo-100 shadow-sm mb-4  rotate-3 hover:rotate-0 transition-transform duration-300">
            <LogIn className="h-6 w-6 text-indigo-600" aria-hidden />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
            Sign in
          </h1>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-5 bg-white p-8 rounded-3xl border border-zinc-200 shadow-xl shadow-zinc-200/50"
        >
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-700 ml-1 block uppercase tracking-wider">
              Email Address
            </label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-zinc-50/50 border border-zinc-200 rounded-xl text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              placeholder="name@company.com"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 px-1">
              <label className="text-xs font-semibold text-zinc-700 block uppercase tracking-wider">
                Password
              </label>
              <Link
                to="/forgot-password"
                className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
              >
                Forgot password?
              </Link>
            </div>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-zinc-50/50 border border-zinc-200 rounded-xl text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              placeholder="••••••••"
            />
          </div>

          {error ? (
            <div
              className="p-3 rounded-xl bg-red-50 text-red-700 text-xs border border-red-100"
              role="alert"
            >
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 px-4 mt-2 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-sm font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <svg
                  className="animate-spin h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Processing…
              </>
            ) : (
              "Sign in"
            )}
          </button>
        </form>
        
        <p className="mt-2 text-center text-[11px] text-zinc-400">
         Elkheta HR Department &copy; {new Date().getFullYear()}
        </p>
        
      </div>
    </div>
  );
}
