import { useNavigate, Link } from "react-router-dom";
import { useState } from "react";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/reduxHooks";
import { loginThunk } from "../store";
import { ArrowRight, LockKeyhole, Mail, ShieldCheck } from "lucide-react";

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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f5f5f7] px-6 py-10 font-sans text-zinc-900 dark:text-zinc-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-12rem] h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-white dark:bg-zinc-900/90 blur-3xl" />
        <div className="absolute bottom-[-10rem] left-[-6rem] h-[20rem] w-[20rem] rounded-full bg-sky-100/40 blur-3xl" />
        <div className="absolute bottom-[-8rem] right-[-4rem] h-[18rem] w-[18rem] rounded-full bg-indigo-100/40 blur-3xl" />
      </div>

      <div className="relative w-full max-w-[960px] overflow-hidden rounded-[32px] border border-white/70 bg-white dark:bg-zinc-900/85 shadow-[0_30px_80px_rgba(15,23,42,0.08)] backdrop-blur-xl">
        <div className="grid min-h-[680px] lg:grid-cols-[1.05fr_0.95fr]">
          <section className="hidden flex-col justify-between bg-[linear-gradient(180deg,#fbfbfd_0%,#f2f4f7_100%)] p-10 lg:flex">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/80 px-4 py-2 text-[11px] font-medium tracking-[0.18em] text-zinc-500 dark:text-zinc-400 uppercase">
                <ShieldCheck className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
                Elkheta HRMS
              </div>
              <div className="mt-12 max-w-md">
                <h1 className="text-4xl font-semibold tracking-[-0.04em] text-zinc-950">
                  Simple, calm access to your HR workspace.
                </h1>
                <p className="mt-5 text-[15px] leading-7 text-zinc-600 dark:text-zinc-400">
                  A cleaner sign-in experience inspired by Apple’s visual language:
                  generous spacing, soft depth, and focused content without noise.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {[
                "ابدأ يومك بالالتزام، فكل إنجاز صغير يصنع فرقًا كبيرًا في نجاح الفريق.",
                "الأمانة في العمل والاحترام في التعامل هما أساس الثقة والنمو المهني الحقيقي.",
                "اجعل حضورك، دقتك، وتعاونك انعكاسًا لأخلاقك قبل أن يكون مجرد أداء وظيفي.",
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-start gap-3 rounded-2xl border border-zinc-200/70 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/75 px-4 py-4 shadow-sm"
                >
                  <div className="mt-0.5 rounded-full bg-zinc-900 p-1 text-white">
                    <ShieldCheck className="h-3 w-3" />
                  </div>
                  <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">{item}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="flex items-center justify-center px-6 py-10 sm:px-10">
            <div className="w-full max-w-[380px]">
              <div className="mb-8">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-400">
                  Welcome Back
                </p>
                <h2 className="mt-3 text-[2rem] font-semibold tracking-[-0.04em] text-zinc-950">
                  Sign in to continue
                </h2>
                <p className="mt-3 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                  Enter your work email and password to access payroll, attendance, and employee operations.
                </p>
              </div>

              <form
                onSubmit={handleSubmit}
                className="space-y-5 rounded-[28px] border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/95 p-6 shadow-[0_20px_50px_rgba(15,23,42,0.06)] sm:p-7"
              >
                <div className="space-y-2">
                  <label className="block text-xs font-semibold tracking-wide text-zinc-600 dark:text-zinc-400">
                    Email address
                  </label>
                  <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-800/50 px-4 py-3 transition focus-within:border-zinc-300 focus-within:bg-white dark:bg-zinc-900 focus-within:ring-4 focus-within:ring-zinc-200/60">
                    <Mail className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full border-0 bg-transparent p-0 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 outline-none"
                      placeholder="name@company.com"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="block text-xs font-semibold tracking-wide text-zinc-600 dark:text-zinc-400">
                      Password
                    </label>
                    <Link
                      to="/forgot-password"
                      className="text-xs font-medium text-zinc-500 dark:text-zinc-400 transition hover:text-zinc-900 dark:hover:text-zinc-100"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-800/50 px-4 py-3 transition focus-within:border-zinc-300 focus-within:bg-white dark:bg-zinc-900 focus-within:ring-4 focus-within:ring-zinc-200/60">
                    <LockKeyhole className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
                    <input
                      type="password"
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full border-0 bg-transparent p-0 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 outline-none"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                {error ? (
                  <div
                    className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs leading-5 text-red-700"
                    role="alert"
                  >
                    {error}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-zinc-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <svg
                        className="h-4 w-4 animate-spin text-white"
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
                      Signing in...
                    </>
                  ) : (
                    <>
                      Sign in
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>

              <p className="mt-5 text-center text-[11px] tracking-wide text-zinc-400">
                Elkheta HR Department &copy; {new Date().getFullYear()}
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
