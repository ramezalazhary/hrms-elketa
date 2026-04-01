import { useEffect, useState } from "react";
import { Trash2, Save } from "lucide-react";
import { Layout } from "@/shared/components/Layout";
import { useToast } from "@/shared/components/ToastProvider";
import { getDocumentRequirementsApi, updateDocumentRequirementsApi } from "../api";
import { EGYPT_GOVERNORATES, getCitiesForGovernorate } from "@/shared/data/egyptGovernorates";

export function OrganizationRulesPage() {
  const [requiredDocs, setRequiredDocs] = useState([]);
  const [workLocations, setWorkLocations] = useState([]);
  const [salaryIncreaseRules, setSalaryIncreaseRules] = useState([]);
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

  // Location Management Logic
  const addLocation = () => {
    setWorkLocations([...workLocations, { governorate: "", city: "", branches: [""] }]);
  };

  const updateLocation = (index, field, value) => {
    const newLocs = [...workLocations];
    if (field === "governorate") {
      newLocs[index].governorate = value;
      newLocs[index].city = ""; // Reset city when governorate changes
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

  // Salary Rules Management Logic
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

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDocumentRequirementsApi({
        documentRequirements: requiredDocs.filter(d => d.name),
        workLocations: workLocations.filter(loc => loc.governorate && loc.city),
        salaryIncreaseRules: salaryIncreaseRules.filter(r => r.type === "DEFAULT" ? true : r.target)
      });
      showToast("Organization settings updated successfully", "success");
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout
      title="Organization Rules"
      description="Define global policies and mandatory requirements for the entire company."
      actions={
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50"
        >
          <Save size={18} />
          {saving ? "Saving..." : "Save Policies"}
        </button>
      }
    >
      <div className="space-y-12 pb-20">
        {/* Section 1: Documents */}
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mb-6 flex items-center justify-between border-b pb-4">
            <div>
              <h3 className="text-xl font-bold text-slate-800 uppercase tracking-tight">Mandatory Document Needs</h3>
              <p className="text-sm text-slate-500 italic">These documents will be required from EVERY employee regardless of their department.</p>
            </div>
            <button
              onClick={addDoc}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              + Add Document Type
            </button>
          </div>

          {loading ? (
             <div className="py-10 text-center text-slate-400">Loading policy foundations...</div>
          ) : (
            <div className="space-y-4">
              {requiredDocs.map((doc, index) => (
                <div key={index} className="group relative flex flex-wrap items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50/50 p-6 transition hover:bg-white hover:shadow-md">
                  <button
                    onClick={() => removeDoc(index)}
                    className="absolute -right-2 -top-2 rounded-full border border-red-100 bg-white p-1.5 text-slate-300 shadow-sm transition hover:text-red-500 group-hover:opacity-100 opacity-0"
                  >
                    <Trash2 size={16} />
                  </button>
                  <div className="flex-1 min-w-[250px]">
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-400">Document Type Name</label>
                    <input
                      type="text"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
                      placeholder="e.g. Identity Card, Military Certificate"
                      value={doc.name}
                      onChange={(e) => updateDoc(index, "name", e.target.value)}
                    />
                  </div>
                  <div className="flex-[2] min-w-[300px]">
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-400">HR Notes / Instructions</label>
                    <input
                      type="text"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
                      placeholder="e.g. Must be a high-resolution scan of the original"
                      value={doc.description}
                      onChange={(e) => updateDoc(index, "description", e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-3 pt-5">
                    <input
                      type="checkbox"
                      id={`mand-${index}`}
                      className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      checked={doc.isMandatory}
                      onChange={(e) => updateDoc(index, "isMandatory", e.target.checked)}
                    />
                    <label htmlFor={`mand-${index}`} className="text-xs font-bold text-slate-600">Mandatory</label>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 2: Branch & Location Manager */}
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
           <div className="mb-6 flex items-center justify-between border-b pb-4">
            <div>
              <h3 className="text-xl font-bold text-slate-800 uppercase tracking-tight flex items-center gap-2">
                Branch & Location Manager
              </h3>
              <p className="text-sm text-slate-500 italic">Manage cities and their specific branches for the onboarding workplace selection.</p>
            </div>
            <button
              onClick={addLocation}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              + Add Workplace Location
            </button>
          </div>

          {!loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {workLocations.map((loc, cityIndex) => (
                <div key={cityIndex} className="p-6 rounded-3xl bg-slate-50 border border-slate-200 relative group">
                  <button
                    onClick={() => removeCity(cityIndex)}
                    className="absolute -right-2 -top-2 rounded-full border border-red-100 bg-white p-1.5 text-slate-300 shadow-sm transition hover:text-red-500 opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={16} />
                  </button>
                  
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <label className="mb-1 block text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">Governorate</label>
                      <select
                        className="w-full bg-white border-b-2 border-slate-200 focus:border-indigo-400 outline-none py-2 text-sm font-bold text-slate-800"
                        value={loc.governorate}
                        onChange={(e) => updateLocation(cityIndex, "governorate", e.target.value)}
                      >
                        <option value="">Select...</option>
                        {EGYPT_GOVERNORATES.map((g) => (
                          <option key={g.name} value={g.name}>{g.name} ({g.nameAr})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">City</label>
                      <select
                        className="w-full bg-white border-b-2 border-slate-200 focus:border-indigo-400 outline-none py-2 text-sm font-bold text-slate-800"
                        value={loc.city}
                        onChange={(e) => updateLocation(cityIndex, "city", e.target.value)}
                        disabled={!loc.governorate}
                      >
                        <option value="">Select...</option>
                        {loc.governorate && getCitiesForGovernorate(loc.governorate).map((city) => (
                          <option key={city} value={city}>{city}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                       <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 italic">Branches / Locations</label>
                       <button onClick={() => addBranch(cityIndex)} className="text-[10px] font-black text-indigo-600 hover:underline">+ Add Branch</button>
                    </div>
                    {loc.branches.map((branch, branchIndex) => (
                      <div key={branchIndex} className="flex items-center gap-2">
                        <input
                          type="text"
                          className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20"
                          placeholder="e.g. Heliopolis"
                          value={branch}
                          onChange={(e) => updateBranchName(cityIndex, branchIndex, e.target.value)}
                        />
                        <button onClick={() => removeBranch(cityIndex, branchIndex)} className="text-slate-300 hover:text-red-400"><Trash2 size={14}/></button>
                      </div>
                    ))}
                    {loc.branches.length === 0 && (
                      <p className="text-[10px] text-slate-400 text-center py-2">No branches added yet.</p>
                    )}
                  </div>
                </div>
              ))}
              {workLocations.length === 0 && (
                <div className="col-span-full rounded-2xl border-2 border-dashed border-slate-100 py-16 text-center">
                   <p className="text-slate-400 italic font-medium">No cities defined. Add the first one to start branch management.</p>
                </div>
              )}
            </div>
          )}
        </div>
        {/* Section 3: Salary Increase Rules */}
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
           <div className="mb-6 flex items-center justify-between border-b pb-4">
            <div>
              <h3 className="text-xl font-bold text-slate-800 uppercase tracking-tight flex items-center gap-2">
                Annual Salary Increase Rules
              </h3>
              <p className="text-sm text-slate-500 italic">Set default percentages for each year. Individual rules override departmental ones.</p>
            </div>
            <button
              onClick={addSalaryRule}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              + Add Rule
            </button>
          </div>

          {!loading && (
            <div className="space-y-4">
              {salaryIncreaseRules.length === 0 && (
                <div className="py-12 text-center border-2 border-dashed border-slate-100 rounded-2xl">
                  <p className="text-slate-400 italic">No salary rules defined yet. Create a default rule to start.</p>
                </div>
              )}
              {salaryIncreaseRules.map((rule, idx) => (
                <div key={idx} className="flex flex-wrap items-end gap-6 p-6 rounded-2xl bg-slate-50 border border-slate-200 relative group transition-all hover:bg-white hover:shadow-md">
                   <button
                    onClick={() => removeSalaryRule(idx)}
                    className="absolute -right-2 -top-2 rounded-full border border-red-100 bg-white p-1.5 text-slate-300 shadow-sm transition hover:text-red-500 opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={16} />
                  </button>

                  <div className="flex-1 min-w-[150px]">
                    <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-slate-400">Rule Type</label>
                    <select
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-800 shadow-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                      value={rule.type}
                      onChange={(e) => updateSalaryRule(idx, "type", e.target.value)}
                    >
                      <option value="DEFAULT">Global Default</option>
                      <option value="DEPARTMENT">Department-Wide</option>
                      <option value="EMPLOYEE">Specific Employee</option>
                    </select>
                  </div>

                  {rule.type !== "DEFAULT" && (
                    <div className="flex-[2] min-w-[200px]">
                      <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        {rule.type === "DEPARTMENT" ? "Department Name" : "Employee ID / Code"}
                      </label>
                      <input
                        type="text"
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-indigo-700 shadow-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                        placeholder={rule.type === "DEPARTMENT" ? "e.g. Sales, Marketing" : "e.g. EMP-001"}
                        value={rule.target}
                        onChange={(e) => updateSalaryRule(idx, "target", e.target.value)}
                      />
                    </div>
                  )}

                  <div className="w-32">
                    <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-slate-400">Percentage (%)</label>
                    <div className="relative">
                      <input
                        type="number"
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-800 shadow-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                        value={rule.percentage}
                        onChange={(e) => updateSalaryRule(idx, "percentage", Number(e.target.value))}
                      />
                      <span className="absolute right-3 top-2 text-xs font-bold text-slate-400">%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
