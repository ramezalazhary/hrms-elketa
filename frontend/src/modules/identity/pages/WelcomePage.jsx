import { useParams } from "react-router-dom";
import { useToast } from "@/shared/components/ToastProvider";
import { useState, useEffect, useMemo } from "react";
import { verifyOnboardingTokenApi, submitOnboardingApi } from "@/modules/employees/api";
import { getDocumentRequirementsApi } from "@/modules/organization/api";
import {
  User,
  Phone,
  Briefcase,
  ChevronRight,
  ChevronLeft,
  CheckCircle,
  Loader2,
  AlertTriangle,
  Sparkles,
  MapPin,
  Mail,
  Shield,
  GraduationCap,
} from "lucide-react";
import { EGYPT_GOVERNORATES, getCitiesForGovernorate } from "@/shared/data/egyptGovernorates";
import { policyBranchDisplayName } from "@/shared/utils/policyWorkLocationBranches";

const STEPS = [
  { id: 1, label: "Personal", icon: User },
  { id: 2, label: "Contact", icon: Phone },
  { id: 3, label: "Professional", icon: Briefcase },
];

export function WelcomePage() {
  const { token } = useParams();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [initialData, setInitialData] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [policy, setPolicy] = useState(null);
  const [currentStep, setCurrentStep] = useState(1);

  // Form values
  const [values, setValues] = useState({
    fullNameEng: "",
    fullNameAr: "",
    dateOfBirth: "",
    gender: "",
    maritalStatus: "",
    nationality: "",
    idNumber: "",
    educationDegree: "",
    email: "",
    phoneNumber: "",
    emergencyPhoneNumber: "",
    governorate: "",
    city: "",
    workCity: "",
    workBranch: "",
    address: "",
    department: "",
    position: "",
    team: "",
    employeeCode: "",
    baseSalary: "",
  });

  const [fieldErrors, setFieldErrors] = useState({});

  const LOCATIONS = useMemo(() => {
    const defaults = [
      { city: "Alexandria", branches: ["Janakless", "Saba Basha", "Gleem"] },
      { city: "Desouk", branches: ["Location 1", "Location 2"] },
    ];
    if (!policy?.workLocations) return defaults;
    const merged = [...defaults];
    const labels = (branches) =>
      (branches || []).map(policyBranchDisplayName).filter(Boolean);
    policy.workLocations.forEach((loc) => {
      const nextLabels = labels(loc.branches);
      const existing = merged.find(
        (m) => m.city.toLowerCase() === loc.city.toLowerCase()
      );
      if (existing) {
        existing.branches = [...new Set([...labels(existing.branches), ...nextLabels])];
      } else {
        merged.push({ city: loc.city, branches: nextLabels });
      }
    });
    return merged;
  }, [policy]);

  const cityOptions = useMemo(() => {
    return getCitiesForGovernorate(values.governorate).map((c) => ({ label: c, value: c }));
  }, [values.governorate]);

  const selectedBranches =
    LOCATIONS.find((l) => l.city === values.workCity)?.branches || [];

  useEffect(() => {
    if (!token) {
      setError("No onboarding token provided.");
      setLoading(false);
      return;
    }
    const loadData = async () => {
      try {
        const [tokenRes, policyRes] = await Promise.all([
          verifyOnboardingTokenApi(token),
          getDocumentRequirementsApi().catch(() => ({ workLocations: [] })),
        ]);
        if (tokenRes.valid) {
          // Check if this browser previously submitted for this token
          if (localStorage.getItem(`onboarding_done_${token}`)) {
            setSubmitted(true);
            setLoading(false);
            return;
          }
          const pre = tokenRes.prefilledData || {};
          setInitialData(pre);
          setValues((prev) => ({ ...prev, ...pre }));
        }
        setPolicy(policyRes);
      } catch (err) {
        setError(err.error || "Invalid or expired onboarding link.");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [token]);

  const updateField = (name, value) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  // Validation per step
  const validateStep = (step) => {
    const errors = {};
    if (step === 1) {
      if (!values.fullNameEng?.trim()) errors.fullNameEng = "Full name (English) is required";
      if (!values.fullNameAr?.trim()) errors.fullNameAr = "Full name (Arabic) is required";
      if (!values.dateOfBirth) errors.dateOfBirth = "Date of birth is required";
      if (!values.gender) errors.gender = "Gender is required";
      if (!values.maritalStatus) errors.maritalStatus = "Marital status is required";
      if (!values.nationality?.trim()) errors.nationality = "Nationality is required";
      if (!values.idNumber?.trim()) errors.idNumber = "ID/Passport number is required";
      if (!values.educationDegree?.trim()) errors.educationDegree = "Education degree is required";
    } else if (step === 2) {
      if (!values.email?.trim()) errors.email = "Email is required";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) errors.email = "Invalid email format";
      if (!values.phoneNumber?.trim()) errors.phoneNumber = "Phone number is required";
      if (!values.governorate) errors.governorate = "Governorate is required";
      if (!values.city) errors.city = "City is required";
      if (!values.workCity) errors.workCity = "Work city is required";
      if (!values.workBranch) errors.workBranch = "Work branch is required";
      if (!values.address?.trim()) errors.address = "Address is required";
    }
    // Step 3 has optional fields (department & position may be prefilled)
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, 3));
    } else {
      showToast("Please fill all required fields", "error");
    }
  };

  const handleBack = () => setCurrentStep((prev) => Math.max(prev - 1, 1));

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) {
      showToast("Please fill all required fields", "error");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        ...values,
        workPlaceDetails: {
          city: values.workCity,
          branch: values.workBranch,
        },
      };
      delete payload.workCity;
      delete payload.workBranch;
      if (payload.dateOfBirth === "") delete payload.dateOfBirth;

      await submitOnboardingApi(token, payload);
      // Persist completion status locally to restrict re-sending from this browser
      localStorage.setItem(`onboarding_done_${token}`, "true");
      showToast("Information submitted successfully", "success");
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      const msg = err?.error || err?.message || "Failed to submit information";
      showToast(msg, "error");
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Loading ──────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-zinc-50">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-16 w-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
              <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
            </div>
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-zinc-900">Verifying your link</p>
            <p className="text-xs text-zinc-400 mt-1">This only takes a moment...</p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Error ────────────────────────────────────────
  if (error) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-zinc-50 p-6">
        <div className="w-full max-w-md text-center">
          <div className="bg-white rounded-3xl border border-zinc-200 shadow-xl shadow-zinc-200/50 p-10">
            <div className="h-16 w-16 mx-auto rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center mb-6">
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-zinc-900 mb-2">Access Denied</h2>
            <p className="text-sm text-zinc-500 leading-relaxed">{error}</p>
            <div className="mt-6 pt-6 border-t border-zinc-100">
              <p className="text-xs text-zinc-400">
                Please contact your HR representative for a new onboarding link.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Success ──────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-zinc-50 p-6">
        <div className="w-full max-w-lg text-center">
          <div className="bg-white rounded-3xl border border-zinc-200 shadow-xl shadow-zinc-200/50 p-12">
            <div className="relative mx-auto mb-8">
              <div className="h-20 w-20 mx-auto rounded-3xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-200 animate-bounce">
                <CheckCircle className="h-10 w-10 text-white" />
              </div>
              <div className="absolute -top-2 -right-4 w-8 h-8">
                <Sparkles className="h-6 w-6 text-amber-400 animate-pulse" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-zinc-900 mb-3">You're All Set!</h2>
            <p className="text-sm text-zinc-500 leading-relaxed max-w-sm mx-auto">
              Your information has been successfully submitted for review by our HR team.
            </p>
            <div className="mt-8 bg-zinc-50 rounded-2xl border border-zinc-100 p-6 text-left space-y-3">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">What happens next?</h3>
              {[
                "Our HR team will review your submitted data",
                "Once approved, your employee profile will be created",
                "You'll receive an email with your login credentials",
              ].map((text, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="mt-0.5 h-5 w-5 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-indigo-600">{i + 1}</span>
                  </div>
                  <p className="text-sm text-zinc-600">{text}</p>
                </div>
              ))}
            </div>
          </div>
          <p className="mt-4 text-[11px] text-zinc-400">
            Elkheta HR Department &copy; {new Date().getFullYear()}
          </p>
        </div>
      </div>
    );
  }

  // ─── Form Wizard ──────────────────────────────────
  const inputClass =
    "w-full px-4 py-3 bg-zinc-50/50 border border-zinc-200 rounded-xl text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed";

  const selectClass = `${inputClass} appearance-none cursor-pointer`;

  const labelClass = "text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5 block";

  const errorClass = "text-[11px] text-red-500 mt-1 font-medium";

  const renderField = (name, label, type, opts = {}) => (
    <div className={opts.fullWidth ? "col-span-full" : ""}>
      <label className={labelClass}>
        {label}
        {opts.required !== false && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {type === "select" ? (
        <select
          className={selectClass}
          value={values[name] || ""}
          disabled={opts.disabled}
          onChange={(e) => {
            updateField(name, e.target.value);
            opts.onChange?.(e.target.value);
          }}
        >
          <option value="">Select...</option>
          {(opts.options || []).map((o, i) => (
            <option key={i} value={o.value}>{o.label}</option>
          ))}
        </select>
      ) : (
        <input
          className={inputClass}
          type={type}
          value={values[name] || ""}
          disabled={opts.disabled}
          placeholder={opts.placeholder}
          onChange={(e) => updateField(name, e.target.value)}
        />
      )}
      {fieldErrors[name] ? <p className={errorClass}>{fieldErrors[name]}</p> : null}
    </div>
  );

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-start bg-zinc-50 font-sans text-zinc-900 py-10 px-4">
      {/* Header */}
      <div className="w-full max-w-2xl mb-8 text-center">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 border border-indigo-100 shadow-sm mb-4 rotate-3 hover:rotate-0 transition-transform duration-300">
          <Sparkles className="h-7 w-7 text-indigo-600" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Welcome to the Team!</h1>
        <p className="text-sm text-zinc-500 mt-2 max-w-md mx-auto">
          We're excited to have you join us. Please fill in your details to help us set up your professional profile.
        </p>
      </div>

      {/* Step Indicator */}
      <div className="w-full max-w-2xl mb-8">
        <div className="flex items-center justify-between relative">
          {/* Connection line */}
          <div className="absolute top-5 left-0 right-0 h-[2px] bg-zinc-200 mx-12" />
          <div
            className="absolute top-5 left-0 h-[2px] bg-indigo-500 mx-12 transition-all duration-500 ease-out"
            style={{ width: `${((currentStep - 1) / (STEPS.length - 1)) * (100 - 15)}%` }}
          />
          {STEPS.map((step) => {
            const Icon = step.icon;
            const isActive = currentStep === step.id;
            const isCompleted = currentStep > step.id;
            return (
              <div key={step.id} className="relative z-10 flex flex-col items-center">
                <div
                  className={`h-10 w-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
                    isCompleted
                      ? "bg-indigo-600 shadow-lg shadow-indigo-200"
                      : isActive
                      ? "bg-white border-2 border-indigo-500 shadow-lg shadow-indigo-100"
                      : "bg-white border-2 border-zinc-200"
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle className="h-5 w-5 text-white" />
                  ) : (
                    <Icon
                      className={`h-5 w-5 ${isActive ? "text-indigo-600" : "text-zinc-400"}`}
                    />
                  )}
                </div>
                <span
                  className={`mt-2 text-[11px] font-bold uppercase tracking-wider ${
                    isActive ? "text-indigo-600" : isCompleted ? "text-zinc-600" : "text-zinc-400"
                  }`}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Form Card */}
      <div className="w-full max-w-2xl bg-white rounded-3xl border border-zinc-200 shadow-xl shadow-zinc-200/50 overflow-hidden">
        <div className="p-8 space-y-6">
          {/* Step 1: Personal */}
          {currentStep === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                  <User className="h-4 w-4 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-zinc-900">Personal Information</h2>
                  <p className="text-xs text-zinc-400">Tell us about yourself</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                {renderField("fullNameEng", "Full Name (English)", "text", {
                  placeholder: "e.g. John Doe",
                })}
                {renderField("fullNameAr", "Full Name (Arabic)", "text", {
                  placeholder: "مثال: محمد أحمد",
                })}
                {renderField("dateOfBirth", "Date of Birth", "date")}
                {renderField("gender", "Gender", "select", {
                  options: [
                    { label: "Male", value: "MALE" },
                    { label: "Female", value: "FEMALE" },
                  ],
                })}
                {renderField("maritalStatus", "Marital Status", "select", {
                  options: [
                    { label: "Single", value: "SINGLE" },
                    { label: "Married", value: "MARRIED" },
                    { label: "Divorced", value: "DIVORCED" },
                    { label: "Widowed", value: "WIDOWED" },
                  ],
                })}
                {renderField("nationality", "Nationality", "text", {
                  placeholder: "e.g. Egyptian",
                })}
                {renderField("idNumber", "ID / Passport Number", "text", {
                  placeholder: "National ID or Passport",
                })}
                {renderField("educationDegree", "Education Degree", "text", {
                  placeholder: "e.g. Bachelor of Computer Science",
                })}
              </div>
            </div>
          )}

          {/* Step 2: Contact & Location */}
          {currentStep === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <MapPin className="h-4 w-4 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-zinc-900">Contact & Location</h2>
                  <p className="text-xs text-zinc-400">How can we reach you?</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                {renderField("email", "Personal Email", "email", {
                  placeholder: "your.email@example.com",
                })}
                {renderField("phoneNumber", "Phone Number", "tel", {
                  placeholder: "+20 1XX XXX XXXX",
                })}
                {renderField("emergencyPhoneNumber", "Emergency Contact Number", "tel", {
                  required: false,
                  placeholder: "+20 1XX XXX XXXX",
                })}
                {renderField("governorate", "Residential Governorate", "select", {
                  options: EGYPT_GOVERNORATES.map((g) => ({ label: `${g.name} (${g.nameAr})`, value: g.name })),
                  onChange: () => updateField("city", ""),
                })}
                {renderField("city", "Residential City", "select", {
                  disabled: !values.governorate,
                  options: cityOptions,
                })}
                {renderField("workCity", "Work City", "select", {
                  options: LOCATIONS.map((l) => ({ label: l.city, value: l.city })),
                  onChange: () => updateField("workBranch", ""),
                })}
                {renderField("workBranch", "Work Branch / Location", "select", {
                  disabled: !values.workCity,
                  options: selectedBranches.map((b) => ({ label: b, value: b })),
                })}
                {renderField("address", "Current Residence Address", "text", {
                  fullWidth: true,
                  placeholder: "Full address",
                })}
              </div>
            </div>
          )}

          {/* Step 3: Professional */}
          {currentStep === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-8 w-8 rounded-lg bg-amber-50 flex items-center justify-center">
                  <Briefcase className="h-4 w-4 text-amber-600" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-zinc-900">Professional Details</h2>
                  <p className="text-xs text-zinc-400">
                    These may be prefilled by HR. Review and confirm.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                {renderField("department", "Department", "text", {
                  required: false,
                  disabled: !!initialData.department,
                  placeholder: initialData.department ? "" : "e.g. Engineering",
                })}
                {renderField("position", "Proposed Job Title", "text", {
                  required: false,
                  disabled: !!initialData.position,
                  placeholder: initialData.position ? "" : "e.g. Software Engineer",
                })}
                {renderField("team", "Assigned Team", "text", {
                   required: false,
                   disabled: !!initialData.team,
                   placeholder: initialData.team ? "" : "N/A",
                })}
                {renderField("employeeCode", "Employee ID Code", "text", {
                   required: false,
                   disabled: !!initialData.employeeCode,
                   placeholder: initialData.employeeCode ? "" : "N/A",
                })}
                {renderField("baseSalary", "Contract Base Salary (EGP)", "number", {
                   required: false,
                   disabled: !!initialData.baseSalary,
                   placeholder: initialData.baseSalary ? "" : "0.00",
                })}
              </div>

              {/* Summary Panel */}
              <div className="mt-6 bg-zinc-50 rounded-2xl border border-zinc-100 p-6 space-y-3">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                  <Shield className="h-3.5 w-3.5" />
                  Submission Summary
                </h3>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-zinc-400">Name (EN)</span>
                    <p className="font-semibold text-zinc-800">{values.fullNameEng || "—"}</p>
                  </div>
                  <div>
                    <span className="text-zinc-400">Name (AR)</span>
                    <p className="font-semibold text-zinc-800">{values.fullNameAr || "—"}</p>
                  </div>
                  <div>
                    <span className="text-zinc-400">Email</span>
                    <p className="font-semibold text-zinc-800">{values.email || "—"}</p>
                  </div>
                  <div>
                    <span className="text-zinc-400">Phone</span>
                    <p className="font-semibold text-zinc-800">{values.phoneNumber || "—"}</p>
                  </div>
                  <div>
                    <span className="text-zinc-400">Department</span>
                    <p className="font-semibold text-zinc-800">{values.department || "To be assigned"}</p>
                  </div>
                  <div>
                    <span className="text-zinc-400">Position</span>
                    <p className="font-semibold text-zinc-800">{values.position || "To be assigned"}</p>
                  </div>
                  <div>
                    <span className="text-zinc-400">Team</span>
                    <p className="font-semibold text-zinc-800">{values.team || "General"}</p>
                  </div>
                  <div>
                    <span className="text-zinc-400">Salary (EGP)</span>
                    <p className="font-semibold text-zinc-800">{values.baseSalary || "0.00"}</p>
                  </div>
                  <div className="col-span-full pt-1 border-t border-zinc-100">
                    <span className="text-zinc-400 italic">Code: </span>
                    <span className="font-bold text-indigo-700">{values.employeeCode || "To be generated"}</span>
                  </div>
                  <div className="col-span-full pt-1 border-t border-zinc-100">
                    <span className="text-zinc-400 italic">Residence: </span>
                    <span className="font-semibold text-zinc-700">{values.city}, {values.governorate}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Footer */}
        <div className="px-8 py-5 bg-zinc-50/80 border-t border-zinc-100 flex items-center justify-between">
          <div>
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={handleBack}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-zinc-600 bg-white border border-zinc-200 rounded-xl hover:bg-zinc-50 transition active:scale-[0.97]"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </button>
            ) : (
              <span className="text-xs text-zinc-400">Step {currentStep} of {STEPS.length}</span>
            )}
          </div>
          <div>
            {currentStep < 3 ? (
              <button
                type="button"
                onClick={handleNext}
                className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition active:scale-[0.97]"
              >
                Continue
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="flex items-center gap-2 px-8 py-3 text-sm font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Complete Onboarding
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      <p className="mt-6 text-[11px] text-zinc-400">
        Elkheta HR Department &copy; {new Date().getFullYear()}
      </p>
    </div>
  );
}
