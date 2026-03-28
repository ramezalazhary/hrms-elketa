import { useState } from "react";
import { Link } from "react-router-dom";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus("loading");
    setError(null);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit request");
      }

      setStatus("success");
    } catch (err) {
      setError(err.message || "An unexpected error occurred.");
      setStatus("idle");
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-slate-50 font-sans text-slate-900 selection:bg-slate-200">
      <div className="w-full flex items-center justify-center p-6 sm:p-12 relative">
        <div className="w-full max-w-[400px]">
          
          <div className="mb-10 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-slate-900 mb-6 shadow-sm">
               <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
               </svg>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
            <p className="text-sm text-slate-500 mt-2">Enter your email to request an admin override.</p>
          </div>

          {status === "success" ? (
            <div className="bg-emerald-50 p-8 rounded-2xl shadow-sm border border-emerald-100 text-center animate-in fade-in zoom-in duration-300">
                <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-emerald-900 mb-2">Request Submitted</h3>
                <p className="text-sm text-emerald-700 leading-relaxed mb-6">
                  If an account exists for <strong>{email}</strong>, a secure request has been sent to the Database Administrator to force a password reset.
                </p>
                <Link to="/login" className="text-sm font-medium text-emerald-700 hover:text-emerald-800 underline">
                  Return to sign in
                </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5 bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 block">Work Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition-colors sm:text-sm"
                  placeholder="name@company.com"
                />
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm border border-red-100">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={status === "loading"}
                className="w-full py-2.5 px-4 mt-6 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 sm:text-sm"
              >
                {status === "loading" ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Sending Request...
                  </>
                ) : (
                  "Submit File Request"
                )}
              </button>

              <div className="mt-4 text-center">
                 <Link to="/login" className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">
                    Back to login
                 </Link>
              </div>
            </form>
          )}
          
          <div className="mt-8 text-center">
            <p className="text-xs text-slate-400">&copy; {new Date().getFullYear()} Antigravity Systems.</p>
          </div>
          
        </div>
      </div>
    </div>
  );
}
