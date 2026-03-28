import { useNavigate, Link } from "react-router-dom";
import { useState } from "react";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/reduxHooks";
import { loginThunk } from "../store";

export function LoginPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  
  const loginStatus = useAppSelector((state) =>
    state.identity.isRefreshing ? "loading" : null,
  );
  const isLoading = loginStatus === "loading";

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setError(null);
      await dispatch(loginThunk({ email, password })).unwrap();
      navigate("/");
    } catch (err) {
      setError(err.error || "Login failed. Please check your credentials.");
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-slate-50 font-sans text-slate-900 selection:bg-slate-200">
      <div className="w-full flex items-center justify-center p-6 sm:p-12 relative">
        <div className="w-full max-w-[400px]">
          
          <div className="mb-10 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-slate-900 mb-6 shadow-sm">
               <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
               </svg>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Log in to your account</h1>
            <p className="text-sm text-slate-500 mt-2">Welcome back to Antigravity HR</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 block">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition-colors sm:text-sm"
                placeholder="name@company.com"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                 <label className="text-sm font-medium text-slate-700 block">Password</label>
                 <Link to="/forgot-password" className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">Forgot?</Link>
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition-colors sm:text-sm"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm border border-red-100">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 mt-6 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 sm:text-sm"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Signing in...
                </>
              ) : (
                "Continue"
              )}
            </button>
          </form>
          
          <div className="mt-8 text-center">
            <p className="text-xs text-slate-400">&copy; {new Date().getFullYear()} Antigravity Systems.</p>
          </div>
          
        </div>
      </div>
    </div>
  );
}
