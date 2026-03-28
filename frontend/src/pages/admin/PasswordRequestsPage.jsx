import { useEffect, useState } from "react";
import { Layout } from "@/shared/components/Layout";
import { useToast } from "@/shared/components/ToastProvider";
import { getPasswordRequestsApi, forceResetPasswordApi } from "@/modules/users/api";

export function PasswordRequestsPage() {
  const { showToast } = useToast();
  const [requests, setRequests] = useState([]);
  const [isLoading, setLoading] = useState(false);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const data = await getPasswordRequestsApi();
      setRequests(data);
    } catch (err) {
      console.error(err);
      showToast("Failed to load password requests", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleReset = async (email, requestId) => {
    try {
      await forceResetPasswordApi(email, "Welcome123!");
      setRequests((prev) => prev.filter((r) => r._id !== requestId));
      showToast(`Password for ${email} reset to Welcome123!`, "success");
    } catch (err) {
      console.error(err);
      showToast(err.error || "Failed to reset password", "error");
    }
  };

  return (
    <Layout
      title="Password Reset Requests"
      description="Manage incoming password reset requests from employees. Use the reset button to authorize a temporary password."
    >
      <div className="space-y-6">
        {isLoading && (
          <div className="flex items-center justify-center p-12 bg-white/40 backdrop-blur rounded-3xl border border-white/40 shadow-sm animate-pulse">
             <p className="text-slate-500 font-medium">Scanning for recent requests...</p>
          </div>
        )}

        {!isLoading && requests.length === 0 && (
          <div className="flex flex-col items-center justify-center p-20 bg-white/40 backdrop-blur rounded-3xl border border-white/40 shadow-sm text-center">
             <div className="bg-emerald-50 p-4 rounded-full mb-4 text-emerald-500 text-3xl">✅</div>
             <h3 className="text-xl font-bold text-slate-800">No Pending Requests</h3>
             <p className="text-slate-500 mt-2">All employee access issues have been resolved.</p>
          </div>
        )}

        <div className="grid gap-4">
          {requests.map((req) => (
            <article
              key={req._id}
              className="flex flex-wrap items-center justify-between gap-6 bg-white/70 backdrop-blur-xl p-6 rounded-3xl border border-white/50 shadow-sm hover:shadow-md transition-all duration-300 group"
            >
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center text-xl font-bold group-hover:bg-red-600 group-hover:text-white transition-colors duration-500">
                  {req.email[0].toUpperCase()}
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-lg">{req.email}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-red-400 animate-pulse"></span>
                    <p className="text-sm text-slate-500 font-medium tracking-tight">
                      Requested {new Date(req.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                 <div className="hidden lg:block text-right mr-4">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Action</p>
                    <p className="text-sm font-semibold text-slate-700">Authorise Temporary Key</p>
                 </div>
                 <button
                    type="button"
                    onClick={() => handleReset(req.email, req._id)}
                    className="relative overflow-hidden px-8 py-3 bg-slate-900 hover:bg-red-600 text-white text-sm font-extrabold rounded-2xl shadow-lg hover:shadow-red-200 transition-all duration-500 active:scale-95"
                  >
                    Reset & Resolve
                  </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </Layout>
  );
}
