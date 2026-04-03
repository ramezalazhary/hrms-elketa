import { useEffect, useMemo, useState } from "react";
import {
  Trash2,
  Save,
  FileStack,
  MapPinned,
  Percent,
  Plus,
  Loader2,
  ShieldCheck,
  Building2,
  User,
  Plane,
} from "lucide-react";
import { Layout } from "@/shared/components/Layout";
import { useToast } from "@/shared/components/ToastProvider";
import { getDocumentRequirementsApi, updateDocumentRequirementsApi } from "../api";
import { EGYPT_GOVERNORATES, getCitiesForGovernorate } from "@/shared/data/egyptGovernorates";

function SkeletonBlock() {
  return (
    <div className="animate-pulse space-y-4 rounded-2xl border border-zinc-200/80 bg-white p-6">
      <div className="h-5 w-40 rounded-md bg-zinc-200" />
      <div className="h-24 rounded-xl bg-zinc-100" />
      <div className="h-24 rounded-xl bg-zinc-100" />
    </div>
  );
}

function ruleBadge(type) {
  const styles = {
    DEFAULT: "bg-emerald-50 text-emerald-800 ring-emerald-200/60",
    DEPARTMENT: "bg-sky-50 text-sky-800 ring-sky-200/60",
    EMPLOYEE: "bg-violet-50 text-violet-800 ring-violet-200/60",
  };
  const labels = {
    DEFAULT: "Global default",
    DEPARTMENT: "Department",
    EMPLOYEE: "Employee",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${styles[type] || "bg-zinc-100 text-zinc-700 ring-zinc-200"}`}
    >
      {labels[type] || type}
    </span>
  );
}

export function OrganizationRulesPage() {
  const [requiredDocs, setRequiredDocs] = useState([]);
  const [workLocations, setWorkLocations] = useState([]);
  const [salaryIncreaseRules, setSalaryIncreaseRules] = useState([]);
  const [companyTimezone, setCompanyTimezone] = useState("Africa/Cairo");
  const [leavePolicies, setLeavePolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    async function load() {
      try {
        const data = await getDocumentRequirementsApi();
        setRequiredDocs(data.documentRequirements || []);
        setWorkLocations(data.workLocations || []);
        setSalaryIncreaseRules(data.salaryIncreaseRules || []);
        setCompanyTimezone(data.companyTimezone || "Africa/Cairo");
        setLeavePolicies(Array.isArray(data.leavePolicies) ? data.leavePolicies : []);
      } catch (error) {
        showToast(error.message, "error");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [showToast]);

  const addDoc = () => {
    setRequiredDocs([...requiredDocs, { name: "", isMandatory: true, description: "" }]);
  };

  const updateDoc = (index, field, value) => {
    const newDocs = [...requiredDocs];
    newDocs[index][field] = value;
    setRequiredDocs(newDocs);
  };

  const removeDoc = (index) => {
    setRequiredDocs(requiredDocs.filter((_, i) => i !== index));
  };

  const addLocation = () => {
    setWorkLocations([...workLocations, { governorate: "", city: "", branches: [""] }]);
  };

  const updateLocation = (index, field, value) => {
    const newLocs = [...workLocations];
    if (field === "governorate") {
      newLocs[index].governorate = value;
      newLocs[index].city = "";
    } else {
      newLocs[index][field] = value;
    }
    setWorkLocations(newLocs);
  };

  const addBranch = (cityIndex) => {
    const newLocs = [...workLocations];
    newLocs[cityIndex].branches.push("");
    setWorkLocations(newLocs);
  };

  const updateBranchName = (cityIndex, branchIndex, name) => {
    const newLocs = [...workLocations];
    newLocs[cityIndex].branches[branchIndex] = name;
    setWorkLocations(newLocs);
  };

  const removeCity = (cityIndex) => {
    setWorkLocations(workLocations.filter((_, i) => i !== cityIndex));
  };

  const removeBranch = (cityIndex, branchIndex) => {
    const newLocs = [...workLocations];
    newLocs[cityIndex].branches = newLocs[cityIndex].branches.filter((_, i) => i !== branchIndex);
    setWorkLocations(newLocs);
  };

  const addSalaryRule = () => {
    setSalaryIncreaseRules([...salaryIncreaseRules, { type: "DEPARTMENT", target: "", percentage: 10 }]);
  };

  const updateSalaryRule = (index, field, value) => {
    const newRules = [...salaryIncreaseRules];
    newRules[index][field] = value;
    setSalaryIncreaseRules(newRules);
  };

  const removeSalaryRule = (index) => {
    setSalaryIncreaseRules(salaryIncreaseRules.filter((_, i) => i !== index));
  };

  const addLeavePolicy = () => {
    const nextV =
      (leavePolicies.reduce((m, x) => Math.max(m, Number(x.version) || 0), 0) || 0) + 1;
    setLeavePolicies([
      ...leavePolicies,
      {
        version: nextV,
        vacationRules: {
          annualDays: 21,
          maxConsecutiveDays: 365,
          minDaysAfterHire: 0,
        },
        excuseRules: {
          maxHoursPerExcuse: 8,
          maxExcusesPerPeriod: 0,
          excuseLimitPeriod: "MONTH",
          roundingMinutes: 15,
          minDaysAfterHire: 0,
        },
      },
    ]);
  };

  const updateLeavePolicy = (index, patch) => {
    const next = [...leavePolicies];
    next[index] = { ...next[index], ...patch };
    setLeavePolicies(next);
  };

  const updateLeavePolicyNested = (index, key, field, value) => {
    const next = [...leavePolicies];
    next[index] = {
      ...next[index],
      [key]: { ...(next[index][key] || {}), [field]: value },
    };
    setLeavePolicies(next);
  };

  const removeLeavePolicy = (index) => {
    setLeavePolicies(leavePolicies.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDocumentRequirementsApi({
        documentRequirements: requiredDocs.filter((d) => d.name),
        workLocations: workLocations.filter((loc) => loc.governorate && loc.city),
        salaryIncreaseRules: salaryIncreaseRules.filter((r) =>
          r.type === "DEFAULT" ? true : r.target,
        ),
        companyTimezone: companyTimezone.trim() || "Africa/Cairo",
        leavePolicies: leavePolicies.map((p) => ({
          version: Number(p.version) || 1,
          vacationRules: p.vacationRules || {},
          excuseRules: p.excuseRules || {},
        })),
      });
      showToast("Organization settings updated successfully", "success");
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const stats = useMemo(() => {
    const filledDocs = requiredDocs.filter((d) => d.name?.trim()).length;
    const filledLocs = workLocations.filter((l) => l.governorate && l.city).length;
    const branchCount = workLocations.reduce((n, l) => n + (l.branches?.filter(Boolean).length || 0), 0);
    const validRules = salaryIncreaseRules.filter((r) => (r.type === "DEFAULT" ? true : r.target)).length;
    return { filledDocs, filledLocs, branchCount, validRules };
  }, [requiredDocs, workLocations, salaryIncreaseRules]);

  return (
    <Layout
      title="Organization rules"
      description="Company-wide documents, workplaces, salary defaults, leave/excuse policy versions, and timezone for time-off logic."
      actions={
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 disabled:pointer-events-none disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Saving…" : "Save changes"}
        </button>
      }
    >
      <div className="space-y-8 pb-16">
        {/* At-a-glance summary */}
        {!loading && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-zinc-200/90 bg-white px-4 py-3 shadow-sm">
              <p className="text-xs font-medium text-zinc-500">Documents</p>
              <p className="mt-0.5 text-2xl font-semibold tabular-nums text-zinc-900">{stats.filledDocs}</p>
              <p className="text-[11px] text-zinc-400">Named & saved</p>
            </div>
            <div className="rounded-xl border border-zinc-200/90 bg-white px-4 py-3 shadow-sm">
              <p className="text-xs font-medium text-zinc-500">Workplaces</p>
              <p className="mt-0.5 text-2xl font-semibold tabular-nums text-zinc-900">{stats.filledLocs}</p>
              <p className="text-[11px] text-zinc-400">{stats.branchCount} branches total</p>
            </div>
            <div className="rounded-xl border border-zinc-200/90 bg-white px-4 py-3 shadow-sm">
              <p className="text-xs font-medium text-zinc-500">Salary rules</p>
              <p className="mt-0.5 text-2xl font-semibold tabular-nums text-zinc-900">{stats.validRules}</p>
              <p className="text-[11px] text-zinc-400">Valid for save</p>
            </div>
            <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/50 px-4 py-3 shadow-sm">
              <p className="text-xs font-medium text-emerald-800/80">Tip</p>
              <p className="mt-1 text-sm leading-snug text-emerald-900/90">
                Empty document rows are ignored on save. Add at least one global default salary rule if you use
                increases.
              </p>
            </div>
          </div>
        )}

        {/* Documents */}
        <section className="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-zinc-100 bg-zinc-50/50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-zinc-200/80">
                <FileStack className="h-5 w-5 text-zinc-600" aria-hidden />
              </div>
              <div>
                <h2 className="text-base font-semibold text-zinc-900">Required documents</h2>
                <p className="mt-0.5 max-w-xl text-sm text-zinc-500">
                  Shown to employees in checklists. Mark items as mandatory to flag missing uploads.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={addDoc}
              className="inline-flex items-center justify-center gap-1.5 self-start rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 sm:self-auto"
            >
              <Plus className="h-4 w-4" />
              Add document
            </button>
          </div>

          <div className="p-5 sm:p-6">
            {loading ? (
              <SkeletonBlock />
            ) : requiredDocs.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50/30 py-14 text-center">
                <FileStack className="h-10 w-10 text-zinc-300" aria-hidden />
                <p className="mt-3 text-sm font-medium text-zinc-600">No document types yet</p>
                <p className="mt-1 max-w-sm text-sm text-zinc-500">Add national ID, contract, or any file your HR team must collect.</p>
                <button
                  type="button"
                  onClick={addDoc}
                  className="mt-4 text-sm font-medium text-zinc-900 underline underline-offset-2 hover:text-zinc-600"
                >
                  Add the first document
                </button>
              </div>
            ) : (
              <ul className="space-y-3">
                {requiredDocs.map((doc, index) => (
                  <li
                    key={index}
                    className={`relative rounded-xl border transition-shadow hover:shadow-md ${
                      doc.isMandatory
                        ? "border-teal-200/70 bg-gradient-to-r from-teal-50/40 to-white"
                        : "border-zinc-200/90 bg-white"
                    }`}
                  >
                    <div className="flex flex-col gap-4 p-4 sm:flex-row sm:flex-wrap sm:items-end">
                      <div className="min-w-0 flex-1 sm:min-w-[200px]">
                        <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-zinc-500">
                          <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded bg-zinc-200/80 px-1 text-[10px] font-semibold text-zinc-700">
                            {index + 1}
                          </span>
                          Name
                        </label>
                        <input
                          type="text"
                          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-400/20 transition focus:border-zinc-400 focus:ring-2"
                          placeholder="e.g. National ID, employment contract"
                          value={doc.name}
                          onChange={(e) => updateDoc(index, "name", e.target.value)}
                        />
                      </div>
                      <div className="min-w-0 flex-[2] sm:min-w-[280px]">
                        <label className="mb-1 block text-xs font-medium text-zinc-500">Instructions for HR</label>
                        <input
                          type="text"
                          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-400/20 transition focus:border-zinc-400 focus:ring-2"
                          placeholder="Optional — e.g. must be a clear color scan"
                          value={doc.description}
                          onChange={(e) => updateDoc(index, "description", e.target.value)}
                        />
                      </div>
                      <div className="flex items-center gap-3 border-t border-zinc-100 pt-3 sm:border-0 sm:pt-0">
                        <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-700">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-zinc-300 text-teal-600 focus:ring-teal-500/30"
                            checked={doc.isMandatory}
                            onChange={(e) => updateDoc(index, "isMandatory", e.target.checked)}
                          />
                          <span className="flex items-center gap-1 font-medium">
                            {doc.isMandatory ? (
                              <ShieldCheck className="h-4 w-4 text-teal-600" aria-hidden />
                            ) : null}
                            Mandatory
                          </span>
                        </label>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeDoc(index)}
                        className="absolute right-3 top-3 rounded-lg p-2 text-zinc-400 opacity-70 transition hover:bg-red-50 hover:text-red-600 sm:static sm:ml-auto sm:self-center sm:opacity-100"
                        aria-label={`Remove document row ${index + 1}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Work locations */}
        <section className="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-zinc-100 bg-zinc-50/50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-zinc-200/80">
                <MapPinned className="h-5 w-5 text-zinc-600" aria-hidden />
              </div>
              <div>
                <h2 className="text-base font-semibold text-zinc-900">Workplaces & branches</h2>
                <p className="mt-0.5 max-w-xl text-sm text-zinc-500">
                  Governorates and cities power onboarding workplace pickers; branches are the selectable offices.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={addLocation}
              className="inline-flex items-center justify-center gap-1.5 self-start rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 sm:self-auto"
            >
              <Plus className="h-4 w-4" />
              Add location
            </button>
          </div>

          <div className="p-5 sm:p-6">
            {loading ? (
              <SkeletonBlock />
            ) : (
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                {workLocations.map((loc, cityIndex) => {
                  const filledBranches = (loc.branches || []).filter(Boolean).length;
                  return (
                    <div
                      key={cityIndex}
                      className="relative rounded-2xl border border-zinc-200/90 bg-zinc-50/40 p-5 ring-1 ring-zinc-100 transition hover:bg-white hover:shadow-md"
                    >
                      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Area</p>
                          <p className="text-sm font-semibold text-zinc-900">
                            {loc.governorate && loc.city
                              ? `${loc.city}, ${loc.governorate}`
                              : "New location — select governorate & city"}
                          </p>
                          {filledBranches > 0 && (
                            <p className="mt-1 text-xs text-zinc-500">{filledBranches} branch label(s)</p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeCity(cityIndex)}
                          className="rounded-lg p-2 text-zinc-400 transition hover:bg-red-50 hover:text-red-600"
                          aria-label={`Remove location ${cityIndex + 1}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-zinc-500">Governorate</label>
                          <select
                            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-400/20"
                            value={loc.governorate}
                            onChange={(e) => updateLocation(cityIndex, "governorate", e.target.value)}
                          >
                            <option value="">Choose…</option>
                            {EGYPT_GOVERNORATES.map((g) => (
                              <option key={g.name} value={g.name}>
                                {g.name} ({g.nameAr})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-zinc-500">City</label>
                          <select
                            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-400/20 disabled:bg-zinc-50 disabled:text-zinc-400"
                            value={loc.city}
                            onChange={(e) => updateLocation(cityIndex, "city", e.target.value)}
                            disabled={!loc.governorate}
                          >
                            <option value="">Choose…</option>
                            {loc.governorate &&
                              getCitiesForGovernorate(loc.governorate).map((city) => (
                                <option key={city} value={city}>
                                  {city}
                                </option>
                              ))}
                          </select>
                        </div>
                      </div>

                      <div className="mt-5 border-t border-zinc-200/80 pt-4">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-xs font-medium text-zinc-500">Branches</span>
                          <button
                            type="button"
                            onClick={() => addBranch(cityIndex)}
                            className="text-xs font-medium text-zinc-700 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-900"
                          >
                            + Add branch
                          </button>
                        </div>
                        <div className="space-y-2">
                          {loc.branches.map((branch, branchIndex) => (
                            <div key={branchIndex} className="flex items-center gap-2">
                              <input
                                type="text"
                                className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-400/20"
                                placeholder="Branch or site name"
                                value={branch}
                                onChange={(e) => updateBranchName(cityIndex, branchIndex, e.target.value)}
                              />
                              <button
                                type="button"
                                onClick={() => removeBranch(cityIndex, branchIndex)}
                                className="shrink-0 rounded-lg p-2 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                                aria-label="Remove branch"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                        {loc.branches.length === 0 && (
                          <p className="py-3 text-center text-xs text-zinc-400">No branches — add at least one label.</p>
                        )}
                      </div>
                    </div>
                  );
                })}
                {workLocations.length === 0 && (
                  <div className="col-span-full flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50/30 py-14 text-center">
                    <MapPinned className="h-10 w-10 text-zinc-300" aria-hidden />
                    <p className="mt-3 text-sm font-medium text-zinc-600">No workplaces configured</p>
                    <p className="mt-1 max-w-md text-sm text-zinc-500">
                      Add Cairo HQ, regional hubs, or remote options so new hires can pick where they work.
                    </p>
                    <button
                      type="button"
                      onClick={addLocation}
                      className="mt-4 text-sm font-medium text-zinc-900 underline underline-offset-2 hover:text-zinc-600"
                    >
                      Add first location
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Leave & excuse policy */}
        <section className="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-zinc-100 bg-zinc-50/50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-zinc-200/80">
                <Plane className="h-5 w-5 text-teal-600" aria-hidden />
              </div>
              <div>
                <h2 className="text-base font-semibold text-zinc-900">Leave &amp; excuse policies</h2>
                <p className="mt-0.5 max-w-xl text-sm text-zinc-500">
                  Rules by version number — the highest version applies to new requests. Company timezone is used for time-off logic.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={addLeavePolicy}
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50"
            >
              <Plus className="h-4 w-4" />
              Add policy version
            </button>
          </div>
          <div className="p-5 sm:p-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Company timezone (IANA)</label>
              <input
                type="text"
                value={companyTimezone}
                onChange={(e) => setCompanyTimezone(e.target.value)}
                className="w-full max-w-md rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                placeholder="Africa/Cairo"
              />
            </div>
            {leavePolicies.length === 0 ? (
              <p className="text-sm text-zinc-500 py-4">
                No versions yet — defaults apply until you add one (annual 21 days, excuse limits from server defaults).
              </p>
            ) : (
              <div className="space-y-4">
                {leavePolicies.map((p, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-zinc-200 bg-zinc-50/40 p-4 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-zinc-800">Version {p.version}</span>
                      <button
                        type="button"
                        onClick={() => removeLeavePolicy(idx)}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="max-w-xs">
                      <label className="text-xs text-zinc-500">Version # (highest wins)</label>
                      <input
                        type="number"
                        className="mt-0.5 w-full rounded-lg border border-zinc-200 px-2 py-1.5 text-sm"
                        value={p.version}
                        onChange={(e) =>
                          updateLeavePolicy(idx, { version: Number(e.target.value) })
                        }
                      />
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="rounded-lg border border-zinc-200 bg-white p-3 space-y-2">
                        <p className="text-xs font-semibold text-zinc-700">Vacation</p>
                        <label className="text-xs text-zinc-500">Annual days</label>
                        <input
                          type="number"
                          className="w-full rounded border border-zinc-200 px-2 py-1 text-sm"
                          value={p.vacationRules?.annualDays ?? 21}
                          onChange={(e) =>
                            updateLeavePolicyNested(
                              idx,
                              "vacationRules",
                              "annualDays",
                              Number(e.target.value),
                            )
                          }
                        />
                        <label className="text-xs text-zinc-500">Max consecutive days</label>
                        <input
                          type="number"
                          className="w-full rounded border border-zinc-200 px-2 py-1 text-sm"
                          value={p.vacationRules?.maxConsecutiveDays ?? 365}
                          onChange={(e) =>
                            updateLeavePolicyNested(
                              idx,
                              "vacationRules",
                              "maxConsecutiveDays",
                              Number(e.target.value),
                            )
                          }
                        />
                        <label className="text-xs text-zinc-500">
                          Min. calendar days after hire (vacation)
                        </label>
                        <p className="text-[11px] text-zinc-400 -mt-1">
                          0 = eligible from hire day. Each employee uses their own date of hire.
                        </p>
                        <input
                          type="number"
                          min={0}
                          className="w-full rounded border border-zinc-200 px-2 py-1 text-sm"
                          value={p.vacationRules?.minDaysAfterHire ?? 0}
                          onChange={(e) =>
                            updateLeavePolicyNested(
                              idx,
                              "vacationRules",
                              "minDaysAfterHire",
                              Number(e.target.value),
                            )
                          }
                        />
                      </div>
                      <div className="rounded-lg border border-zinc-200 bg-white p-3 space-y-2">
                        <p className="text-xs font-semibold text-zinc-700">Excuse</p>
                        <label className="text-xs text-zinc-500">Max hours per excuse (one time)</label>
                        <input
                          type="number"
                          min={0.25}
                          step={0.25}
                          className="w-full rounded border border-zinc-200 px-2 py-1 text-sm"
                          value={p.excuseRules?.maxHoursPerExcuse ?? 8}
                          onChange={(e) =>
                            updateLeavePolicyNested(
                              idx,
                              "excuseRules",
                              "maxHoursPerExcuse",
                              Number(e.target.value),
                            )
                          }
                        />
                        <label className="text-xs text-zinc-500">Max excuses per period</label>
                        <p className="text-[11px] text-zinc-400 -mt-1">
                          0 = unlimited. Counts pending + approved in the same week, month, or year (UTC).
                        </p>
                        <input
                          type="number"
                          min={0}
                          className="w-full rounded border border-zinc-200 px-2 py-1 text-sm"
                          value={p.excuseRules?.maxExcusesPerPeriod ?? 0}
                          onChange={(e) =>
                            updateLeavePolicyNested(
                              idx,
                              "excuseRules",
                              "maxExcusesPerPeriod",
                              Number(e.target.value),
                            )
                          }
                        />
                        <label className="text-xs text-zinc-500">Period for limit</label>
                        <select
                          className="w-full rounded border border-zinc-200 px-2 py-1.5 text-sm"
                          value={p.excuseRules?.excuseLimitPeriod ?? "MONTH"}
                          onChange={(e) =>
                            updateLeavePolicyNested(
                              idx,
                              "excuseRules",
                              "excuseLimitPeriod",
                              e.target.value,
                            )
                          }
                        >
                          <option value="WEEK">Week (starts Monday, UTC)</option>
                          <option value="MONTH">Month</option>
                          <option value="YEAR">Year</option>
                        </select>
                        <label className="text-xs text-zinc-500">Rounding (minutes)</label>
                        <input
                          type="number"
                          className="w-full rounded border border-zinc-200 px-2 py-1 text-sm"
                          value={p.excuseRules?.roundingMinutes ?? 15}
                          onChange={(e) =>
                            updateLeavePolicyNested(
                              idx,
                              "excuseRules",
                              "roundingMinutes",
                              Number(e.target.value),
                            )
                          }
                        />
                        <label className="text-xs text-zinc-500">
                          Min. calendar days after hire (excuse)
                        </label>
                        <p className="text-[11px] text-zinc-400 -mt-1">
                          Can differ from vacation. 0 = from hire day.
                        </p>
                        <input
                          type="number"
                          min={0}
                          className="w-full rounded border border-zinc-200 px-2 py-1 text-sm"
                          value={p.excuseRules?.minDaysAfterHire ?? 0}
                          onChange={(e) =>
                            updateLeavePolicyNested(
                              idx,
                              "excuseRules",
                              "minDaysAfterHire",
                              Number(e.target.value),
                            )
                          }
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Salary rules */}
        <section className="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-zinc-100 bg-zinc-50/50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-zinc-200/80">
                <Percent className="h-5 w-5 text-zinc-600" aria-hidden />
              </div>
              <div>
                <h2 className="text-base font-semibold text-zinc-900">Annual salary increases</h2>
                <p className="mt-0.5 max-w-xl text-sm text-zinc-500">
                  Default and overrides for processing increases. Department and employee rules take precedence over the
                  global default where applicable.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={addSalaryRule}
              className="inline-flex items-center justify-center gap-1.5 self-start rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 sm:self-auto"
            >
              <Plus className="h-4 w-4" />
              Add rule
            </button>
          </div>

          <div className="p-5 sm:p-6">
            {loading ? (
              <SkeletonBlock />
            ) : salaryIncreaseRules.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50/30 py-14 text-center">
                <Percent className="h-10 w-10 text-zinc-300" aria-hidden />
                <p className="mt-3 text-sm font-medium text-zinc-600">No salary rules</p>
                <p className="mt-1 max-w-sm text-sm text-zinc-500">Start with one &quot;Global default&quot; percentage, then add department overrides.</p>
                <button
                  type="button"
                  onClick={addSalaryRule}
                  className="mt-4 text-sm font-medium text-zinc-900 underline underline-offset-2 hover:text-zinc-600"
                >
                  Add a rule
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-zinc-200/90">
                <table className="min-w-full divide-y divide-zinc-200 text-sm">
                  <thead className="bg-zinc-50/90 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                    <tr>
                      <th className="whitespace-nowrap px-4 py-3">Type</th>
                      <th className="whitespace-nowrap px-4 py-3">Applies to</th>
                      <th className="whitespace-nowrap px-4 py-3 text-right">Rate</th>
                      <th className="w-10 px-2 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 bg-white">
                    {salaryIncreaseRules.map((rule, idx) => (
                      <tr key={idx} className="align-top transition hover:bg-zinc-50/80">
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            {ruleBadge(rule.type)}
                            <select
                              className="min-w-[10rem] rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs font-medium text-zinc-900"
                              value={rule.type}
                              onChange={(e) => updateSalaryRule(idx, "type", e.target.value)}
                              aria-label="Rule type"
                            >
                              <option value="DEFAULT">Global default</option>
                              <option value="DEPARTMENT">Department</option>
                              <option value="EMPLOYEE">Employee</option>
                            </select>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {rule.type === "DEFAULT" ? (
                            <span className="inline-flex items-center gap-1.5 text-zinc-600">
                              <Building2 className="h-3.5 w-3.5 shrink-0 text-zinc-400" aria-hidden />
                              All departments (fallback)
                            </span>
                          ) : rule.type === "DEPARTMENT" ? (
                            <div className="flex items-start gap-2">
                              <Building2 className="mt-1 h-3.5 w-3.5 shrink-0 text-zinc-400" aria-hidden />
                              <input
                                type="text"
                                className="w-full min-w-[8rem] rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-400/20"
                                placeholder="e.g. Sales, Engineering"
                                value={rule.target}
                                onChange={(e) => updateSalaryRule(idx, "target", e.target.value)}
                              />
                            </div>
                          ) : (
                            <div className="flex items-start gap-2">
                              <User className="mt-1 h-3.5 w-3.5 shrink-0 text-zinc-400" aria-hidden />
                              <input
                                type="text"
                                className="w-full min-w-[8rem] rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-400/20"
                                placeholder="Employee code or ID"
                                value={rule.target}
                                onChange={(e) => updateSalaryRule(idx, "target", e.target.value)}
                              />
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center justify-end gap-1">
                            <input
                              type="number"
                              className="w-20 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-right text-sm font-semibold tabular-nums text-zinc-900 outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-400/20"
                              value={rule.percentage}
                              onChange={(e) => updateSalaryRule(idx, "percentage", Number(e.target.value))}
                              min={0}
                              aria-label="Percentage"
                            />
                            <span className="text-xs font-medium text-zinc-400">%</span>
                          </div>
                        </td>
                        <td className="px-2 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => removeSalaryRule(idx)}
                            className="rounded-lg p-2 text-zinc-400 transition hover:bg-red-50 hover:text-red-600"
                            aria-label="Remove rule"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="border-t border-zinc-100 bg-zinc-50/50 px-4 py-2 text-xs text-zinc-500">
                  Rows without a target (non-default) are excluded when you save.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </Layout>
  );
}
