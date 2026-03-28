import React, { useState } from "react";
import { useAppDispatch } from "@/shared/hooks/reduxHooks";
import attendanceApi from "../api";
import { FileSpreadsheet, Upload, CheckCircle2, AlertCircle, RefreshCw, Layers, ShieldCheck, HelpCircle } from "lucide-react";

const ImportPage = () => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const resp = await attendanceApi.importEvents(formData);
      setResult(resp.data);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-[1200px] mx-auto p-4 space-y-12">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-8 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2 text-blue-600 mb-2">
            <Layers className="w-5 h-5 font-bold" />
            <span className="text-sm font-black uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded">Data Integration</span>
          </div>
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tighter">Event Synchronization</h1>
          <p className="text-slate-500 mt-2 font-medium">Batch import check-in/out records from external devices and excel logs.</p>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
           <div className="p-3 bg-slate-50 rounded-2xl">
             <ShieldCheck className="w-6 h-6 text-emerald-500" />
           </div>
           <div>
             <span className="text-[10px] font-black uppercase text-slate-400 block tracking-widest">Protocol Verifier</span>
             <span className="text-sm font-extrabold text-slate-800">UTF-8 / XLSX / ISO-8601</span>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        <div className="space-y-6">
          <div 
             className={`relative group bg-white border-2 border-dashed rounded-[3rem] p-16 transition-all flex flex-col items-center justify-center text-center cursor-pointer ${
               file ? "bg-emerald-50/20 border-emerald-300" : "bg-slate-50/30 border-slate-200 hover:border-blue-400 hover:bg-blue-50/10"
             }`}
             onDragOver={(e) => e.preventDefault()}
             onDrop={(e) => {
               e.preventDefault();
               setFile(e.dataTransfer.files[0]);
             }}
          >
             <input type="file" onChange={(e) => setFile(e.target.files[0])} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
             
             <div className={`p-8 rounded-[2.5rem] mb-6 shadow-sm transition-transform group-hover:scale-110 ${
               file ? "bg-emerald-500 text-white" : "bg-white text-slate-400"
             }`}>
               {file ? <CheckCircle2 className="w-12 h-12" /> : <Upload className="w-12 h-12" />}
             </div>
             
             {file ? (
               <div className="space-y-2">
                 <h3 className="text-xl font-black text-slate-800 tracking-tight">{file.name}</h3>
                 <p className="text-sm font-bold text-emerald-600">File attached and ready for processing</p>
               </div>
             ) : (
               <div className="space-y-2">
                 <h3 className="text-xl font-black text-slate-800 tracking-tight">Drop data log here</h3>
                 <p className="text-sm font-bold text-slate-400">Supported formats: .xlsx, .xls</p>
               </div>
             )}
          </div>

          <button 
             onClick={handleUpload}
             disabled={!file || loading}
             className={`w-full py-5 rounded-[2.5rem] font-black uppercase tracking-widest text-sm transition-all shadow-xl flex items-center justify-center gap-3 ${
               !file || loading 
               ? "bg-slate-100 text-slate-400 cursor-not-allowed shadow-none" 
               : "bg-slate-900 text-white hover:bg-black hover:translate-y-[-4px] active:translate-y-0"
             }`}
          >
            {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <FileSpreadsheet className="w-5 h-5" />}
            {loading ? "Decrypting Buffer..." : "Sync Records Now"}
          </button>

          {error && (
            <div className="bg-rose-50 border border-rose-100 p-6 rounded-3xl flex items-start gap-4">
               <AlertCircle className="w-6 h-6 text-rose-500 mt-1 flex-shrink-0" />
               <div>
                  <h4 className="font-black text-rose-900 text-sm">Synchronization Error</h4>
                  <p className="text-xs font-bold text-rose-600 mt-1">{error}</p>
               </div>
            </div>
          )}
        </div>

        <div className="space-y-8">
           <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm relative overflow-hidden">
             <div className="absolute top-0 right-0 p-8 text-slate-50 select-none">
               <HelpCircle className="w-24 h-24" />
             </div>
             <h3 className="text-lg font-black text-slate-800 mb-6 relative z-10">Formatting Specs</h3>
             <div className="space-y-6 relative z-10">
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500">1</div>
                  <div>
                    <h4 className="text-sm font-black text-slate-800">Column: EmployeeCode</h4>
                    <p className="text-xs font-medium text-slate-400">Primary unique identifier (Must match record code).</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500">2</div>
                  <div>
                    <h4 className="text-sm font-black text-slate-800">Column: Date</h4>
                    <p className="text-xs font-medium text-slate-400">YYYY-MM-DD format (ISO-8601 preferred).</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500">3</div>
                  <div>
                    <h4 className="text-sm font-black text-slate-800">Column: CheckIn / CheckOut</h4>
                    <p className="text-xs font-medium text-slate-400">HH:mm format (24H notation).</p>
                  </div>
                </div>
             </div>
           </div>

           {result && (
             <div className="bg-emerald-500 p-10 rounded-[3rem] shadow-xl shadow-emerald-100 text-white animate-in zoom-in slide-in-from-bottom duration-500">
               <div className="flex justify-between items-start mb-8">
                 <CheckCircle2 className="w-12 h-12" />
                 <div className="text-right">
                   <span className="text-[10px] font-black uppercase text-emerald-200 block tracking-widest">BATCH ID</span>
                   <span className="text-xs font-mono font-bold text-emerald-100">{result.batchId}</span>
                 </div>
               </div>
               <div className="grid grid-cols-2 gap-8">
                 <div>
                   <span className="text-[10px] font-black uppercase text-emerald-200 block tracking-widest">Records Uploaded</span>
                   <span className="text-4xl font-black">{result.imported}</span>
                 </div>
                 <div>
                   <span className="text-[10px] font-black uppercase text-emerald-200 block tracking-widest">Failures / Skips</span>
                   <span className="text-4xl font-black">{result.skipped}</span>
                 </div>
               </div>
               {result.errors.length > 0 && (
                 <div className="mt-8 pt-6 border-t border-emerald-400 text-emerald-100 space-y-2">
                    <p className="text-xs font-black uppercase tracking-widest">Integrity Log Snippet</p>
                    {result.errors.slice(0, 3).map((err, i) => (
                      <p key={i} className="text-[10px] font-bold">Row {err.row}: {err.reason}</p>
                    ))}
                 </div>
               )}
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default ImportPage;
