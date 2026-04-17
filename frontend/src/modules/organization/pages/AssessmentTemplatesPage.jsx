import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { 
  ArrowLeft, Star, Plus, GripVertical, Trash2, Edit2, Archive, PlayCircle
} from "lucide-react";
import { useToast } from "@/shared/components/ToastProvider";
import { Layout } from "@/shared/components/Layout";
import { API_URL } from "@/shared/api/apiBase";
import { fetchWithAuth } from "@/shared/api/fetchWithAuth";
import { useAppSelector } from "@/shared/hooks/reduxHooks";
import { canManageOrganizationRules } from "@/shared/utils/accessControl";

export function AssessmentTemplatesPage() {
  const user = useAppSelector(state => state.identity.currentUser);
  const { showToast } = useToast();
  const canManage = canManageOrganizationRules(user);

  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  
  const load = async () => {
    try {
      setLoading(true);
      const res = await fetchWithAuth(`${API_URL}/assessment-templates`);
      if (!res.ok) throw new Error("Failed to load templates");
      const data = await res.json();
      setTemplates(Array.isArray(data) ? data : []);
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleArchive = async (id) => {
     if (!window.confirm("Are you sure you want to archive this template?")) return;
     try {
       const res = await fetchWithAuth(`${API_URL}/assessment-templates/${id}`, { method: "DELETE" });
       if (!res.ok) throw new Error("Failed to archive");
       showToast("Template archived", "success");
       load();
     } catch (err) {
       showToast(err.message, "error");
     }
  };

  const handleSetDefault = async (t) => {
     try {
       const res = await fetchWithAuth(`${API_URL}/assessment-templates/${t.id}`, {
         method: "PUT",
         body: JSON.stringify({ ...t, isDefault: true })
       });
       if (!res.ok) throw new Error("Failed to set default");
       showToast("Default template updated", "success");
       load();
     } catch (err) {
       showToast(err.message, "error");
     }
  };

  return (
    <Layout
      title="Assessment Templates"
      headerContent={
        <div className="flex items-center gap-3">
          <Link
            to="/organization"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800/80 text-zinc-600 dark:text-zinc-400 shadow-sm transition hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          {canManage && (
            <button
              onClick={() => { setEditingTemplate(null); setShowModal(true); }}
              className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800"
            >
              <Plus className="h-4 w-4" />
              New Template
            </button>
          )}
        </div>
      }
    >
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="rounded-[20px] bg-white dark:bg-zinc-900 p-6 shadow-sm ring-1 ring-zinc-950/[0.06] dark:ring-zinc-800 md:p-8">
           <div className="mb-6 border-b border-zinc-100 dark:border-zinc-800/50 pb-4">
             <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Performance Evaluation Criteria</h2>
             <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Define the metrics used by managers to evaluate employee performance.</p>
           </div>
           
           {loading ? (
             <div className="flex justify-center p-12">
               <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-600 border-t-transparent"/>
             </div>
           ) : templates.length === 0 ? (
             <div className="rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 py-16 text-center">
                <Star className="mx-auto mb-4 h-10 w-10 text-zinc-300" />
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">No Assessment Templates</h3>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 mb-4">Create your first dynamic evaluation template.</p>
                {canManage && (
                  <button onClick={() => { setEditingTemplate(null); setShowModal(true); }} className="mx-auto inline-flex items-center rounded-lg bg-white dark:bg-zinc-900 px-4 py-2 text-xs font-semibold shadow-sm ring-1 ring-inset ring-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                    Create Template
                  </button>
                )}
             </div>
           ) : (
             <div className="space-y-4">
                {templates.map(t => (
                  <div key={t.id} className="relative rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/30 dark:bg-zinc-800/50 p-5 transition-shadow hover:shadow-sm">
                    <div className="flex items-start justify-between">
                       <div>
                         <div className="flex items-center gap-2">
                           <h3 className="font-bold text-zinc-900 dark:text-zinc-100">{t.name}</h3>
                           {t.isDefault && <span className="rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-[10px] uppercase font-bold tracking-widest border border-amber-200">Default</span>}
                           {t.status === "ARCHIVED" && <span className="rounded-full bg-zinc-200 text-zinc-600 dark:text-zinc-400 px-2 py-0.5 text-[10px] uppercase font-bold tracking-widest">Archived</span>}
                         </div>
                         <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{t.description}</p>
                       </div>
                       {canManage && t.status !== "ARCHIVED" && (
                         <div className="flex items-center gap-2">
                           {!t.isDefault && (
                             <button onClick={() => handleSetDefault(t)} title="Set as default" className="p-1.5 text-zinc-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg">
                               <PlayCircle size={16} />
                             </button>
                           )}
                           <button onClick={() => { setEditingTemplate(t); setShowModal(true); }} className="p-1.5 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                             <Edit2 size={16} />
                           </button>
                           <button onClick={() => handleArchive(t.id)} className="p-1.5 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg">
                             <Archive size={16} />
                           </button>
                         </div>
                       )}
                    </div>
                    
                    <div className="mt-4 pt-4 border-t border-zinc-200/60 dark:border-zinc-800/80">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2">Metrics ({t.criteria.length})</p>
                      <div className="flex flex-wrap gap-2">
                        {t.criteria.map((c, i) => (
                           <span key={i} className="inline-flex rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-2 py-1 text-xs font-semibold text-zinc-700 dark:text-zinc-300 shadow-sm">
                             {c.title} <span className="ml-1.5 text-[10px] text-zinc-400 font-medium border-l border-zinc-200 dark:border-zinc-800 pl-1.5">w:{c.weight}</span>
                           </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
             </div>
           )}
        </div>
      </div>

      {showModal && (
        <TemplateModal 
          template={editingTemplate} 
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); load(); }}
        />
      )}
    </Layout>
  )
}

function TemplateModal({ template, onClose, onSuccess }) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: template?.name || "",
    description: template?.description || "",
    isDefault: template?.isDefault || false,
    criteria: template?.criteria || [
      { title: "Commitment", weight: 1, type: "RATING_5" },
      { title: "Attitude", weight: 1, type: "RATING_5" },
      { title: "Quality", weight: 1, type: "RATING_5" }
    ]
  });

  const addCriterion = () => {
    setFormData(s => ({
      ...s,
      criteria: [...s.criteria, { title: "", weight: 1, type: "RATING_5" }]
    }));
  };

  const removeCriterion = (idx) => {
    setFormData(s => ({
      ...s,
      criteria: s.criteria.filter((_, i) => i !== idx)
    }));
  };

  const updateCriterion = (idx, field, value) => {
    setFormData(s => {
      const clone = [...s.criteria];
      clone[idx][field] = value;
      return { ...s, criteria: clone };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name) return showToast("Template name is required", "error");
    if (formData.criteria.length === 0) return showToast("At least one metric is required", "error");
    if (formData.criteria.some(c => !c.title)) return showToast("All metrics must have a title", "error");

    try {
      setLoading(true);
      const url = template 
        ? `${API_URL}/assessment-templates/${template.id}`
        : `${API_URL}/assessment-templates`;
        
      const res = await fetchWithAuth(url, {
        method: template ? "PUT" : "POST",
        body: JSON.stringify(formData)
      });
      
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "Operation failed");
      
      showToast(template ? "Template updated" : "Template created", "success");
      onSuccess();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-sm animate-in fade-in duration-200">
      <form onSubmit={handleSubmit} className="w-full max-w-xl max-h-[90vh] flex flex-col bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800">
        <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800/50 flex items-center justify-between">
          <h2 className="font-bold text-zinc-900 dark:text-zinc-100">{template ? "Edit Template" : "New Template"}</h2>
        </div>
        
        <div className="p-6 overflow-y-auto space-y-5">
           <div>
             <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Template Name</label>
             <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500" placeholder="e.g. Sales Department Review" />
           </div>
           <div>
             <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Description (Optional)</label>
             <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} rows={2} className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500" placeholder="Guidelines for this assessment..." />
           </div>

           <div>
              <div className="flex items-center justify-between mb-3 border-b border-zinc-100 dark:border-zinc-800/50 pb-2">
                 <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Evaluation Metrics</h4>
                 <button type="button" onClick={addCriterion} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                   <Plus size={14}/> Add Metric
                 </button>
              </div>
              
              <div className="space-y-3">
                 {formData.criteria.map((c, idx) => (
                    <div key={idx} className="flex items-center gap-3 bg-zinc-50 dark:bg-zinc-800/50 p-2 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80">
                      <GripVertical size={16} className="text-zinc-300 cursor-grab active:cursor-grabbing" />
                      <input 
                         required 
                         value={c.title} 
                         onChange={e => updateCriterion(idx, "title", e.target.value)}
                         placeholder="Metric (e.g. Code Quality)"
                         className="flex-1 rounded border border-zinc-300 px-2 py-1.5 text-sm"
                      />
                      <div className="flex flex-col">
                        <input 
                           type="number" min="0" step="0.1"
                           value={c.weight}
                           onChange={e => updateCriterion(idx, "weight", Number(e.target.value))}
                           title="Weight multiplier"
                           className="w-16 rounded border border-zinc-300 px-2 py-1.5 text-sm font-mono text-center"
                        />
                      </div>
                      <button type="button" onClick={() => removeCriterion(idx)} className="p-1.5 text-zinc-400 hover:text-rose-600">
                         <Trash2 size={16}/>
                      </button>
                    </div>
                 ))}
                 {formData.criteria.length === 0 && (
                   <p className="text-sm text-zinc-400 italic">No metrics added.</p>
                 )}
              </div>
           </div>
           
           <div className="flex items-center gap-2 pt-2">
             <input type="checkbox" id="isDefault" checked={formData.isDefault} onChange={e => setFormData({...formData, isDefault: e.target.checked})} className="rounded text-zinc-900 dark:text-zinc-100 focus:ring-zinc-900" />
             <label htmlFor="isDefault" className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Set as Organization Default Template</label>
           </div>
        </div>

        <div className="px-6 py-4 border-t border-zinc-100 dark:border-zinc-800/50 flex justify-end gap-3 bg-zinc-50/50 dark:bg-zinc-800/50 rounded-b-2xl">
          <button type="button" disabled={loading} onClick={onClose} className="px-4 py-2 font-semibold text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg">Cancel</button>
          <button type="submit" disabled={loading} className="px-5 py-2 font-semibold text-sm text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg shadow-sm">
            {loading ? "Saving..." : "Save Template"}
          </button>
        </div>
      </form>
    </div>
  )
}
