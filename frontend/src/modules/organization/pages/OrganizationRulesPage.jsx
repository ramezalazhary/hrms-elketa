import { useEffect, useState } from "react";
import { Trash2, Save } from "lucide-react";
import { Layout } from "@/shared/components/Layout";
import { useToast } from "@/shared/components/ToastProvider";
import { getDocumentRequirementsApi, updateDocumentRequirementsApi } from "../api";

export function OrganizationRulesPage() {
  const [requiredDocs, setRequiredDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    async function load() {
      try {
        const data = await getDocumentRequirementsApi();
        setRequiredDocs(data.documentRequirements || []);
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

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDocumentRequirementsApi(requiredDocs.filter(d => d.name));
      showToast("Rules updated successfully", "success");
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
      <div className="space-y-8">
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
             <div className="py-20 text-center text-slate-400">Loading policy foundations...</div>
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
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                      placeholder="e.g. Identity Card, Military Certificate"
                      value={doc.name}
                      onChange={(e) => updateDoc(index, "name", e.target.value)}
                    />
                  </div>
                  <div className="flex-[2] min-w-[300px]">
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-400">HR Notes / Instructions</label>
                    <input
                      type="text"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
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
              {requiredDocs.length === 0 && (
                <div className="rounded-2xl border-2 border-dashed border-slate-100 py-16 text-center">
                  <p className="text-slate-400 italic font-medium">No document requirements defined yet. Add the first one above.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
