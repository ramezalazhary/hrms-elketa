import { Layout } from "@/shared/components/Layout";
import { useAppSelector } from "@/shared/hooks/reduxHooks";

export function HomePage() {
  const currentUser = useAppSelector((state) => state.identity.currentUser);
  const roleDisplay = currentUser?.role?.replace("_", " ") || "Member";

  return (
    <Layout
      title={`Welcome back, ${currentUser?.email?.split("@")[0] || "User"}`}
      description="Your personal HR hub and profile overview."
    >
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Personal Profile Card */}
        <article className="rounded-3xl border border-white/40 bg-white/60 backdrop-blur-xl p-8 shadow-sm flex flex-col items-center col-span-1 lg:col-span-1 relative overflow-hidden group">
          <div className="absolute inset-x-0 top-0 h-2 bg-gradient-to-r from-blue-400 to-indigo-500"></div>
          <div className="h-28 w-28 rounded-full bg-indigo-100 mb-5 shadow-inner flex items-center justify-center text-indigo-600 text-4xl font-bold">
            {currentUser?.email?.[0]?.toUpperCase() || "U"}
          </div>
          <h2 className="text-xl font-bold text-slate-800">{currentUser?.email || "User"}</h2>
          <span className="mt-2 inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-700/10 uppercase tracking-widest">
            {roleDisplay}
          </span>

          <div className="mt-8 w-full space-y-3">
            <div className="flex justify-between text-sm py-2 border-b border-slate-100">
              <span className="text-slate-500 font-medium">Joined Profile</span>
              <span className="text-slate-900 font-semibold">{new Date(currentUser?.createdAt || Date.now()).toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between text-sm py-2 border-b border-slate-100">
               <span className="text-slate-500 font-medium">Status</span>
               <span className="text-emerald-600 font-bold">Active</span>
            </div>
          </div>
        </article>

        {/* Informational Widget */}
        <article className="rounded-3xl border border-white/40 bg-white/60 backdrop-blur-xl p-8 shadow-sm col-span-1 lg:col-span-2 relative overflow-hidden flex flex-col justify-center">
            <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600 text-2xl animate-pulse">
                    🚀
                </div>
                <div>
                    <h3 className="text-lg font-bold text-slate-800">Your HR Dashboard is Ready</h3>
                    <p className="text-sm text-slate-500">View your team and manage company resources.</p>
                </div>
            </div>

            <p className="text-slate-600 leading-relaxed max-w-lg mb-8">
              Access common HR tasks like checking your profile data, managing your team visibility, or reviewing organizational structures from the sidebar links.
            </p>

            <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Upcoming</p>
                    <p className="text-sm font-semibold text-slate-700">Payroll Activation</p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Next Review</p>
                    <p className="text-sm font-semibold text-slate-700">Annual Evaluation</p>
                </div>
            </div>
        </article>
      </div>
    </Layout>
  );
}
