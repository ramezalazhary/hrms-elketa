import { useEffect, useState } from "react";
import { Layout } from "@/shared/components/Layout";
import { DataTable } from "@/shared/components/DataTable";
import { useToast } from "@/shared/components/ToastProvider";
import { 
  getOnboardingLinksApi, 
  stopOnboardingLinkApi, 
  deleteOnboardingLinkApi, 
  generateOnboardingApi, 
  getOnboardingSubmissionsApi, 
  processOnboardingSubmissionApi 
} from "../api";
import { 
  CheckCircle, XCircle, Clock, Eye, AlertCircle, 
  ClipboardCheck, UserPlus, Link as LinkIcon, 
  Calendar, Copy, Plus, Trash2, StopCircle, Users,
  Save, Edit3, Layers
} from "lucide-react";

// Correction: I saw it in modules/departments/api.js
import { getDepartmentsApi as fetchDepts } from "../../departments/api";
import { getDocumentRequirementsApi as fetchPolicy } from "../../organization/api";
import { policyBranchDisplayName } from "@/shared/utils/policyWorkLocationBranches";

export function OnboardingApprovalsPage() {
  const { showToast } = useToast();
  const [links, setLinks] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [policy, setPolicy] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Review Modal State
  const [selectedSub, setSelectedSub] = useState(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [adminNotes, setAdminNotes] = useState("");
  const [tempData, setTempData] = useState({}); // For editing

  // Quick Generation State
  const [expiresHours, setExpiresHours] = useState("48");
  const [genDept, setGenDept] = useState("");
  const [genPos, setGenPos] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [linksData, subsData, deptsData, policyData] = await Promise.all([
        getOnboardingLinksApi(),
        getOnboardingSubmissionsApi(),
        fetchDepts(),
        fetchPolicy().catch(() => ({ workLocations: [] }))
      ]);
      setLinks(linksData);
      setSubmissions(subsData);
      setDepartments(deptsData);
      setPolicy(policyData);
    } catch (error) {
      showToast(error.error || "Failed to fetch data", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenReview = (sub) => {
    setSelectedSub(sub);
    setTempData({ ...sub.personalData });
    setAdminNotes(sub.adminNotes || "");
    setIsReviewModalOpen(true);
  };

  const handleProcess = async (status) => {
    if (!selectedSub) return;
    try {
      await processOnboardingSubmissionApi(selectedSub._id, { 
        status, 
        adminNotes,
        editedData: tempData // Send the (potentially) edited data
      });
      showToast(`Submission ${status.toLowerCase()} successfully`, "success");
      setIsReviewModalOpen(false);
      setSelectedSub(null);
      setAdminNotes("");
      fetchData();
    } catch (error) {
      showToast(error.error || `Failed to ${status.toLowerCase()} submission`, "error");
    }
  };

  const handleQuickGenerate = async () => {
    setIsGenerating(true);
    try {
      const result = await generateOnboardingApi({ 
        expiresHours,
        department: genDept,
        position: genPos 
      });
      await navigator.clipboard.writeText(result.url);
      showToast("Link generated and copied to clipboard!", "success");
      fetchData();
    } catch (error) {
      showToast(error.error || "Failed to generate link", "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStopLink = async (id) => {
    try {
      await stopOnboardingLinkApi(id);
      showToast("Link deactivated", "success");
      fetchData();
    } catch (error) {
       showToast(error.error || "Failed to stop link", "error");
    }
  };

  const handleDeleteLink = async (id) => {
    if (!window.confirm("Delete this link? This will stop future submissions.")) return;
    try {
      await deleteOnboardingLinkApi(id);
      showToast("Link deleted", "success");
      fetchData();
    } catch (error) {
      showToast(error.error || "Failed to delete link", "error");
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "APPROVED":
        return <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-bold text-green-600 border border-green-100"><CheckCircle className="h-3 w-3" /> Approved</span>;
      case "REJECTED":
        return <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-600 border border-red-100"><XCircle className="h-3 w-3" /> Rejected</span>;
      default:
        return <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-600 border border-amber-100"><Clock className="h-3 w-3" /> Pending</span>;
    }
  };

  return (
    <Layout
      title="Onboarding Workspace"
      description="Manage access links and review employee data submissions."
    >
      {/* Quick link generation */}
      <div className="relative mb-10 overflow-hidden rounded-[20px] bg-white p-6 shadow-sm ring-1 ring-zinc-950/[0.06] md:p-8">
        <div className="pointer-events-none absolute right-4 top-4 text-zinc-200">
          <LinkIcon className="h-24 w-24 rotate-12" />
        </div>
        <div className="relative z-10 flex flex-col justify-between gap-8 lg:flex-row lg:items-center">
          <div className="space-y-2">
            <h3 className="flex items-center gap-3 text-xl font-semibold tracking-tight text-zinc-900 md:text-2xl">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200/80">
                <Plus className="h-5 w-5" />
              </div>
              Create onboarding link
            </h3>
            <p className="max-w-md text-sm font-medium leading-relaxed text-zinc-500">
              Generate a secure, temporary URL for new hires. You can stop or delete links at any time.
            </p>
          </div>
          <div className="flex w-full shrink-0 flex-col items-stretch gap-3 rounded-2xl border border-zinc-200/80 bg-zinc-50/80 p-3 sm:flex-row sm:items-end">
            <div className="flex min-w-0 flex-1 flex-col gap-1 px-2 sm:border-r sm:border-zinc-200/80 sm:pr-3">
              <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Expiration</span>
              <select
                className="cursor-pointer rounded-lg border border-zinc-200 bg-white px-2 py-2 text-xs font-medium text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-200/80"
                value={expiresHours}
                onChange={(e) => setExpiresHours(e.target.value)}
              >
                <option value="24">24 hours</option>
                <option value="48">48 hours</option>
                <option value="72">72 hours</option>
                <option value="168">1 week</option>
              </select>
            </div>
            <div className="flex min-w-[140px] flex-1 flex-col gap-1 px-2 sm:border-r sm:border-zinc-200/80 sm:pr-3">
              <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Target department</span>
              <select
                className="cursor-pointer rounded-lg border border-zinc-200 bg-white px-2 py-2 text-xs font-medium text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-200/80"
                value={genDept}
                onChange={(e) => setGenDept(e.target.value)}
              >
                <option value="">Generic link</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex min-w-[140px] flex-1 flex-col gap-1 px-2">
              <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Target position</span>
              <input
                placeholder="Job title…"
                className="rounded-lg border border-zinc-200 bg-white px-2 py-2 text-xs font-medium text-zinc-900 outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-200/80"
                value={genPos}
                onChange={(e) => setGenPos(e.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={handleQuickGenerate}
              disabled={isGenerating}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-zinc-900 px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-zinc-800 active:scale-[0.98] disabled:opacity-50 motion-reduce:active:scale-100"
            >
              {isGenerating ? (
                "Processing…"
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Generate and copy
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-10">
        
        {/* 🔗 Table 1: Active Links & Metrics */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <div>
              <h4 className="text-lg font-black text-zinc-900 tracking-tight">Access Links</h4>
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Master Link Manager</p>
            </div>
            <div className="h-8 w-8 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-700 border border-zinc-200/80">
               <LinkIcon className="h-4 w-4" />
            </div>
          </div>
          
          <div className="overflow-hidden rounded-[20px] bg-white shadow-sm ring-1 ring-zinc-950/[0.06]">
            <DataTable
              columns={[
                {
                  key: "status",
                  header: "Status",
                  render: (row) => (
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${row.isActive ? 'bg-zinc-100 text-zinc-800 ring-1 ring-zinc-200/70' : 'bg-zinc-100 text-zinc-500'}`}>
                      {row.isActive ? 'Active' : 'Stopped'}
                    </span>
                  )
                },
                {
                  key: "usage",
                  header: "Submissions",
                  render: (row) => (
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-700 font-black text-xs">
                        {row.usageCount}
                      </div>
                      <span className="text-xs font-bold text-zinc-400">People</span>
                    </div>
                  )
                },
                {
                  key: "expiry",
                  header: "Link Expiry",
                  render: (row) => (
                    <span className="text-xs font-bold text-zinc-600 bg-zinc-50 px-3 py-1 rounded-lg">
                      {new Date(row.expiresAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                    </span>
                  )
                },
                {
                  key: "actions",
                  header: "Actions",
                  render: (row) => (
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => {
                          const url = `${window.location.origin}/welcome/${row.token}`;
                          navigator.clipboard.writeText(url);
                          showToast("Link copied!", "success");
                        }}
                        className="p-2 hover:bg-zinc-100 rounded-xl text-zinc-400 hover:text-zinc-700 transition"
                        title="Copy"
                      ><Copy className="h-4 w-4" /></button>
                      
                      {row.isActive && (
                        <button 
                          onClick={() => handleStopLink(row._id)}
                          className="p-2 hover:bg-amber-50 rounded-xl text-amber-400 hover:text-amber-600 transition"
                          title="Stop Link"
                        ><StopCircle className="h-4 w-4" /></button>
                      )}
                      
                      <button 
                        onClick={() => handleDeleteLink(row._id)}
                        className="p-2 hover:bg-red-50 rounded-xl text-red-400 hover:text-red-600 transition"
                        title="Delete"
                      ><Trash2 className="h-4 w-4" /></button>
                    </div>
                  )
                }
              ]}
              data={links}
              isLoading={isLoading}
              emptyText="No onboarding links available."
            />
          </div>
        </section>

        {/* 📝 Table 2: Submissions Review */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <div>
              <h4 className="text-lg font-black text-zinc-900 tracking-tight">Pending Approval</h4>
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Incoming Talent Pool</p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200/80 bg-zinc-100 text-sm font-semibold text-zinc-800">
               {submissions.filter(s => s.status === 'PENDING').length}
            </div>
          </div>
          
          <div className="overflow-hidden rounded-[20px] bg-white shadow-sm ring-1 ring-zinc-950/[0.06]">
            <DataTable
              columns={[
                {
                  key: "date",
                  header: "Sent On",
                  render: (row) => <div className="text-[11px] font-bold text-zinc-400 font-mono italic">{new Date(row.createdAt).toLocaleDateString()}</div>
                },
                {
                  key: "name",
                  header: "Full Name",
                  render: (row) => (
                    <div className="font-black text-zinc-900 leading-tight">
                      {row.personalData?.fullNameEng || "Incomplete Submission"}
                      <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-0.5">{row.personalData?.email}</div>
                    </div>
                  )
                },
                {
                  key: "status",
                  header: "Status",
                  render: (row) => getStatusBadge(row.status),
                },
                {
                  key: "actions",
                  header: "Review",
                  render: (row) => (
                    <button
                      onClick={() => handleOpenReview(row)}
                      className="inline-flex items-center gap-2 px-4 py-2 text-xs font-black text-white bg-zinc-900 rounded-xl hover:bg-zinc-800 transition shadow-lg shadow-zinc-900/15 active:scale-95"
                    >
                      <Eye className="h-3 w-3" /> Approve Data
                    </button>
                  ),
                },
              ]}
              data={submissions}
              isLoading={isLoading}
              emptyText="No submissions to review yet."
            />
          </div>
        </section>
      </div>

      {/* Review Modal */}
      {isReviewModalOpen && selectedSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/80 backdrop-blur-sm">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden transform transition-all animate-in fade-in zoom-in duration-300 flex flex-col border border-white/20">
            <div className="px-8 py-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
              <div className="flex items-center gap-3">
                 <div className="h-12 w-12 rounded-2xl bg-zinc-900 flex items-center justify-center shadow-xl shadow-zinc-200/80">
                    <Users className="h-6 w-6 text-white" />
                 </div>
                 <div>
                    <h3 className="text-xl font-black text-zinc-900 tracking-tight">Review Talent Profile</h3>
                    <div className="flex items-center gap-2 mt-1">
                       <LinkIcon className="h-3 w-3 text-zinc-400" />
                       <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{selectedSub.linkId?.token?.substring(0, 8)}...</span>
                    </div>
                 </div>
              </div>
              <button onClick={() => setIsReviewModalOpen(false)} className="h-10 w-10 rounded-2xl flex items-center justify-center bg-white border border-zinc-200 text-zinc-400 hover:text-zinc-600 shadow-sm transition-transform active:scale-90">
                <XCircle className="h-6 w-6" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-10 space-y-10">
              <div className="grid grid-cols-2 gap-4 bg-zinc-50 p-6 rounded-3xl border border-zinc-200/50">
                <div className="flex items-center gap-3 border-r border-zinc-200">
                  <div>
                    <label className="text-[10px] uppercase font-black text-zinc-400 tracking-widest">Workflow Status</label>
                    <div className="mt-1">{getStatusBadge(selectedSub.status)}</div>
                  </div>
                </div>
                <div className="text-right">
                  <label className="text-[10px] uppercase font-black text-zinc-400 tracking-widest">Entry Date</label>
                  <div className="mt-1 text-sm font-black text-zinc-700">{new Date(selectedSub.createdAt).toLocaleDateString()}</div>
                </div>
              </div>

              <section>
                <div className="flex items-center gap-3 mb-8">
                  <div className="h-2 w-8 bg-zinc-900 rounded-full"></div>
                  <h4 className="text-sm font-black text-zinc-900 uppercase tracking-[0.2em] flex items-center gap-2">
                    <Edit3 className="h-4 w-4" /> Editable Dossier
                  </h4>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
                  {/* EDITABLE FIELDS */}
                  <div>
                    <label className="block text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1.5 font-bold">Full Name (EN)</label>
                    <input 
                      className="w-full text-sm font-bold text-zinc-800 border-b border-zinc-200 focus:border-zinc-400 outline-none pb-1 bg-transparent"
                      value={tempData.fullNameEng || ""}
                      onChange={(e) => setTempData({...tempData, fullNameEng: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1.5 font-bold">Full Name (AR)</label>
                    <input 
                      className="w-full text-sm font-bold text-zinc-800 border-b border-zinc-200 focus:border-zinc-400 outline-none pb-1 bg-transparent"
                      value={tempData.fullNameAr || ""}
                      onChange={(e) => setTempData({...tempData, fullNameAr: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1.5 font-bold">Official Email</label>
                    <input 
                      className="w-full text-sm font-bold text-zinc-800 border-b border-zinc-200 focus:border-zinc-400 outline-none pb-1 bg-transparent"
                      value={tempData.email || ""}
                      onChange={(e) => setTempData({...tempData, email: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1.5 font-bold">Mobile Number</label>
                    <input 
                      className="w-full text-sm font-bold text-zinc-800 border-b border-zinc-200 focus:border-zinc-400 outline-none pb-1 bg-transparent"
                      value={tempData.phoneNumber || ""}
                      onChange={(e) => setTempData({...tempData, phoneNumber: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1.5 font-bold">Education Degree</label>
                    <input 
                      className="w-full text-sm font-bold text-zinc-800 border-b border-zinc-200 focus:border-zinc-400 outline-none pb-1 bg-transparent"
                      value={tempData.educationDegree || ""}
                      onChange={(e) => setTempData({...tempData, educationDegree: e.target.value})}
                    />
                  </div>
                  
                  {/* DEPARTMENT SELECT - CRITICAL FIX */}
                  <div className="col-span-full pt-4">
                    <label className="block text-[9px] font-black text-zinc-700 uppercase tracking-widest mb-2 font-bold flex items-center gap-1">
                      <Layers className="h-3 w-3" /> Assign Official Department
                    </label>
                    <select 
                      className="w-full text-sm font-black text-zinc-800 border-2 border-zinc-200/80 rounded-xl p-3 bg-zinc-100/30 focus:border-zinc-400 outline-none transition-all appearance-none cursor-pointer"
                      value={tempData.department || ""}
                      onChange={(e) => setTempData({...tempData, department: e.target.value})}
                    >
                      <option value="">-- Select Department --</option>
                      {departments.map(dept => (
                        <option key={dept.id} value={dept.name}>{dept.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* WORK LOCATION SELECTS */}
                  <div className="pt-2">
                    <label className="block text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1.5 font-bold">Work City</label>
                    <select 
                      className="w-full text-sm font-bold text-zinc-800 border-b border-zinc-200 focus:border-zinc-400 outline-none pb-1 bg-transparent appearance-none"
                      value={tempData.workPlaceDetails?.city || ""}
                      onChange={(e) => {
                        const city = e.target.value;
                        setTempData({
                          ...tempData, 
                          workPlaceDetails: { ...(tempData.workPlaceDetails || {}), city, branch: "" }
                        });
                      }}
                    >
                      <option value="">Select City</option>
                      {[
                        { city: "Alexandria" },
                        { city: "Desouk" },
                        ...(policy?.workLocations || [])
                      ].map((l, i) => (
                        <option key={i} value={l.city}>{l.city}</option>
                      ))}
                    </select>
                  </div>

                  <div className="pt-2">
                    <label className="block text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1.5 font-bold">Work Branch</label>
                    <select 
                      className="w-full text-sm font-bold text-zinc-800 border-b border-zinc-200 focus:border-zinc-400 outline-none pb-1 bg-transparent appearance-none"
                      value={tempData.workPlaceDetails?.branch || ""}
                      onChange={(e) => setTempData({
                        ...tempData, 
                        workPlaceDetails: { ...(tempData.workPlaceDetails || {}), branch: e.target.value }
                      })}
                    >
                      <option value="">Select Branch</option>
                      {(() => {
                        const city = tempData.workPlaceDetails?.city;
                        const defaults = [
                          { city: "Alexandria", branches: ["Janakless", "Saba Basha", "Gleem"] },
                          { city: "Desouk", branches: ["Location 1", "Location 2"] }
                        ];
                        const raw = (policy?.workLocations || []).find(l => l.city === city)?.branches || defaults.find(d => d.city === city)?.branches || [];
                        const branches = raw.map(policyBranchDisplayName).filter(Boolean);
                        return branches.map((b, i) => <option key={i} value={b}>{b}</option>);
                      })()}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1.5 font-bold">Target Position</label>
                    <input 
                      className="w-full text-sm font-bold text-zinc-800 border-b border-zinc-200 focus:border-zinc-400 outline-none pb-1 bg-transparent"
                      value={tempData.position || ""}
                      onChange={(e) => setTempData({...tempData, position: e.target.value})}
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1.5 font-bold">Nationality</label>
                    <input 
                      className="w-full text-sm font-bold text-zinc-800 border-b border-zinc-200 focus:border-zinc-400 outline-none pb-1 bg-transparent"
                      value={tempData.nationality || ""}
                      onChange={(e) => setTempData({...tempData, nationality: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1.5 font-bold">ID / Passport Number</label>
                    <input 
                      className="w-full text-sm font-bold text-zinc-800 border-b border-zinc-200 focus:border-zinc-400 outline-none pb-1 bg-transparent"
                      value={tempData.idNumber || ""}
                      onChange={(e) => setTempData({...tempData, idNumber: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1.5 font-bold">Gender</label>
                    <select 
                      className="w-full text-sm font-bold text-zinc-800 border-b border-zinc-200 focus:border-zinc-400 outline-none pb-1 bg-transparent"
                      value={tempData.gender || ""}
                      onChange={(e) => setTempData({...tempData, gender: e.target.value})}
                    >
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1.5 font-bold">Marital Status</label>
                    <select 
                      className="w-full text-sm font-bold text-zinc-800 border-b border-zinc-200 focus:border-zinc-400 outline-none pb-1 bg-transparent"
                      value={tempData.maritalStatus || ""}
                      onChange={(e) => setTempData({...tempData, maritalStatus: e.target.value})}
                    >
                      <option value="SINGLE">Single</option>
                      <option value="MARRIED">Married</option>
                      <option value="DIVORCED">Divorced</option>
                      <option value="WIDOWED">Widowed</option>
                    </select>
                  </div>
                </div>
              </section>

              {selectedSub.status === "PENDING" && (
                <section className="bg-zinc-100 p-8 rounded-[2rem] border border-zinc-200/80/50">
                  <h4 className="text-xs font-black text-zinc-900 mb-5 uppercase tracking-widest flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Administrative Review
                  </h4>
                  <textarea
                    placeholder="Provide context or instructions for this profile..."
                    className="w-full rounded-2xl border border-zinc-200/80 bg-white text-zinc-900 p-5 text-sm shadow-inner placeholder:text-zinc-300 focus:ring-4 focus:ring-zinc-200/80 outline-none min-h-[120px] mb-6 transition-all"
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                  />
                  <div className="flex gap-4">
                    <button
                      onClick={() => handleProcess("APPROVED")}
                      className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-zinc-900 py-4 font-semibold text-white shadow-xl transition hover:bg-zinc-800 active:scale-95 motion-reduce:active:scale-100"
                    >
                      <Save className="h-5 w-5" /> Save & Approve
                    </button>
                    <button
                      onClick={() => handleProcess("REJECTED")}
                      className="px-8 bg-white text-red-600 font-bold py-4 rounded-2xl border border-red-100 hover:bg-red-50 transition flex items-center justify-center gap-2 active:scale-95"
                    >
                      <XCircle className="h-5 w-5" /> Reject
                    </button>
                  </div>
                </section>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
