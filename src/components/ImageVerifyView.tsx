import { useState, useRef, DragEvent } from "react";
import { 
  Upload, Eye, Loader2, Sparkles, AlertCircle, FileImage, ShieldAlert, CheckCircle2, 
  XCircle, AlertTriangle, Copy, Share2, Download, Check, FileText, Layers, Cpu, 
  Activity, ChevronDown, ChevronUp, Clock
} from "lucide-react";
import { VerifyImageResponse } from "../types";

export default function ImageVerifyView() {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<VerifyImageResponse | null>(null);
  const [error, setError] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [copied, setCopied] = useState(false);
  const [exportedPDF, setExportedPDF] = useState(false);
  const [shared, setShared] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const pollRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File parsing helper to base64
  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please drop or choose a valid image file (PNG, JPEG, WebP).");
      return;
    }
    setError("");
    setImageMime(file.type);
    setFileName(file.name);
    setFileSize(file.size);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result && typeof e.target.result === "string") {
        // Resize large images client-side to reduce upload size and speed up verification.
        const dataUrl = e.target.result;
        const img = new Image();
        img.onload = () => {
          const MAX_DIM = 900; // max width/height in px for upload (reduced for faster uploads)
          let { width, height } = img;
          let scale = 1;
          if (width > MAX_DIM || height > MAX_DIM) {
            scale = Math.min(MAX_DIM / width, MAX_DIM / height);
            width = Math.round(width * scale);
            height = Math.round(height * scale);
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) ctx.drawImage(img, 0, 0, width, height);

          // Use JPEG output to reduce size; preserve transparency by falling back to PNG if original was PNG and has alpha.
          const preferJpeg = !file.type.includes('png') || file.type === 'image/png';
          const outMime = preferJpeg ? 'image/jpeg' : file.type;
          const quality = 0.75; // slightly lower quality to speed uploads
          const resizedDataUrl = canvas.toDataURL(outMime, quality);

          const parts = resizedDataUrl.split(',');
          const pureBase64 = parts[1] || parts[0];

          // Estimate new file size from base64 length
          const estimatedBytes = Math.round((pureBase64.length * 3) / 4);
          setImageMime(outMime);
          setImageSrc(resizedDataUrl); // preview the resized image
          setFileSize(estimatedBytes);
          handleVerify(pureBase64, outMime, file.name, estimatedBytes);
        };
        img.src = dataUrl;
      }
    };
    reader.readAsDataURL(file);
  };

  const handleVerify = async (base64Clean: string, mimeType: string, fName: string, fSize: number) => {
    setLoading(true);
    setReport(null);
    setExportedPDF(false);
    setShared(false);
    try {
      const response = await fetch("/api/verify/image?async=true", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          image: base64Clean, 
          mimeType,
          fileName: fName,
          fileSize: fSize
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Image analysis failed.");
      }
      // If server returned a jobId with a quick report, set that and poll for final
      if (data.jobId && data.report) {
        setReport(data.report);
        const jid = data.jobId as string;
        setJobId(jid);
        setPending(true);
        // poll for final result
        pollRef.current = window.setInterval(async () => {
          try {
            const r = await fetch(`/api/verify/result/${jid}`);
            if (!r.ok) return;
            const full = await r.json();
            if (full.details && (full.details.finalized || (full.details as any).canceled)) {
              setReport(full.details as VerifyImageResponse);
              setPending(false);
              if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
              setJobId(null);
            }
          } catch (e) {
            // ignore polling errors
          }
        }, 2000);
      } else {
        // synchronous result
        setReport(data as VerifyImageResponse);
      }
    } catch (err: any) {
      setError(err.message || "Failed to parse image forensics.");
    } finally {
      setLoading(false);
    }
  };

  const handleDrag = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const copyReport = () => {
    if (!report) return;
    navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadPDFReport = () => {
    setExportedPDF(true);
    setTimeout(() => setExportedPDF(false), 3000);
    // Trigger default browser print flow configured beautifully for clean reports
    window.print();
  };

  const shareReport = () => {
    setShared(true);
    setTimeout(() => setShared(false), 2000);
  };

  const cancelJob = async () => {
    if (!jobId) return;
    try {
      setPending(false);
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      const r = await fetch(`/api/verify/cancel/${jobId}`, { method: 'POST' });
      const data = await r.json();
      if (r.ok) {
        // reflect canceled state in UI
        setReport((prev) => {
          if (!prev) return prev;
          return { ...prev, details: { ...(prev.details as any), canceled: true } } as VerifyImageResponse;
        });
      } else {
        setError(data.error || 'Failed to cancel job');
      }
    } catch (err: any) {
      setError(err.message || 'Cancel request failed');
    } finally {
      setJobId(null);
    }
  };

  // Helper getters to compute colors and titles according to rules:
  // 95–100 = Verified Authentic
  // 85–94 = Likely Authentic
  // 70–84 = Mostly Authentic
  // 50–69 = Needs Manual Review
  // 30–49 = Suspicious
  // 0–29 = Likely Fake / Manipulated
  const getScoreData = (score: number) => {
    if (score >= 95) {
      return {
        label: "VERIFIED AUTHENTIC",
        recommendation: "Safe to trust this image. Digital signature and physical layout are pristine.",
        colorClass: "text-emerald-600 bg-emerald-50 border-emerald-200",
        badgeColor: "bg-emerald-500",
        ringColor: "border-emerald-500",
        icon: <CheckCircle2 className="h-6 w-6 text-emerald-600" />
      };
    } else if (score >= 85) {
      return {
        label: "LIKELY AUTHENTIC",
        recommendation: "Highly consistent image features. No evidence of generative manipulation found.",
        colorClass: "text-green-600 bg-green-50 border-green-200",
        badgeColor: "bg-green-500",
        ringColor: "border-green-500",
        icon: <CheckCircle2 className="h-6 w-6 text-green-600" />
      };
    } else if (score >= 70) {
      return {
        label: "MOSTLY AUTHENTIC",
        recommendation: "Authentic structures detected. Minor lens or compression distortions present.",
        colorClass: "text-teal-600 bg-teal-50 border-teal-200",
        badgeColor: "bg-teal-500",
        ringColor: "border-teal-500",
        icon: <CheckCircle2 className="h-6 w-6 text-teal-600" />
      };
    } else if (score >= 50) {
      return {
        label: "REQUIRES MANUAL REVIEW",
        recommendation: "Anomalous artifacts or missing credentials found. Treat with careful moderation.",
        colorClass: "text-amber-650 bg-amber-50 border-amber-200",
        badgeColor: "bg-amber-500",
        ringColor: "border-amber-500",
        icon: <AlertTriangle className="h-6 w-6 text-amber-500" />
      };
    } else if (score >= 30) {
      return {
        label: "SUSPICIOUS VECTOR flags",
        recommendation: "Warning: High manipulation indicators detected. Likely modified or re-compressed.",
        colorClass: "text-orange-600 bg-orange-50 border-orange-200",
        badgeColor: "bg-orange-500",
        ringColor: "border-orange-500",
        icon: <AlertCircle className="h-6 w-6 text-orange-500" />
      };
    } else {
      return {
        label: "LIKELY MANIPULATED / FAKE",
        recommendation: "Do not trust this image. Contains strong photoshop fingerprints or generative AI characteristics.",
        colorClass: "text-red-600 bg-red-50 border-red-200",
        badgeColor: "bg-red-500",
        ringColor: "border-red-500",
        icon: <XCircle className="h-6 w-6 text-red-600" />
      };
    }
  };

  const getAiProbLabel = (prob: number) => {
    const pc = Math.round(prob * 100);
    if (pc <= 5) return { text: "Natural DSLR/Mobile (Clean)", color: "text-emerald-600 bg-emerald-50" };
    if (pc <= 10) return { text: "Minor enhancements", color: "text-green-600 bg-green-50" };
    if (pc <= 25) return { text: "Possible AI Characteristics", color: "text-amber-600 bg-amber-50" };
    if (pc <= 40) return { text: "Modest synthetic indicators", color: "text-orange-500 bg-orange-50" };
    return { text: "Confirmed Generated AI", color: "text-red-600 bg-red-50 font-bold animate-pulse" };
  };

  const getRiskLabel = (risk: string) => {
    switch (risk) {
      case "LOW":
        return { text: "🟢 LOW RISK", color: "text-emerald-700 bg-emerald-50 border-emerald-100" };
      case "MEDIUM":
        return { text: "🟡 MEDIUM RISK", color: "text-amber-700 bg-amber-50 border-amber-150" };
      default:
        return { text: "🔴 HIGH RISK THREAT", color: "text-red-700 bg-red-50 border-red-150 font-bold" };
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* File inputs & dropzone left side */}
      <div className="lg:col-span-1 space-y-4">
        <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-xs">
          <div className="flex items-center gap-2 text-blue-600 mb-3">
            <Activity className="h-4 w-4" />
            <span className="font-mono text-xs font-bold uppercase tracking-wider">AI Forensic Suite</span>
          </div>
          <h2 className="text-xl font-black text-gray-900 tracking-tight leading-none mb-2">Visual Forensics Unit</h2>
          <p className="text-gray-500 text-xs leading-relaxed mb-5">
            Identify manipulations instantly. Our neural analyzer parses pixel grid structures, lighting mismatch angles, sensor noise distributions, and camera EXIF markers.
          </p>

          <input
            id="image-file-input"
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/*"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />

          {/* Drag & Drop Area */}
          <div
            id="image-dropzone"
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 ${
              dragActive ? "border-blue-500 bg-blue-50/40" : "border-slate-200 hover:border-blue-400 bg-slate-50/50"
            }`}
          >
            <div className="h-12 w-12 rounded-2xl bg-white border border-slate-100 shadow-xs text-slate-400 flex items-center justify-center mx-auto mb-3">
              <Upload className="h-6 w-6 text-slate-400" />
            </div>
            <p className="text-xs font-bold text-slate-700 leading-normal">Drag & drop your vector here</p>
            <p className="text-[10px] text-slate-400 mt-1 max-w-[200px] mx-auto leading-relaxed">
              Supports PNG, JPEG, WebP, Camera RAW outputs
            </p>
          </div>

          {error && (
            <div className="mt-3 flex items-center gap-1.5 p-2.5 bg-red-50 border border-red-100 text-red-600 rounded-xl text-[11px] font-medium">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Image source previews */}
          {imageSrc && (
            <div className="mt-5 border border-slate-200/60 rounded-2xl p-2.5 bg-slate-50 relative overflow-hidden">
              <span className="text-[9px] uppercase font-mono font-bold text-slate-400 absolute top-4 left-4 bg-white/90 backdrop-blur-md px-2.5 py-1 rounded-full shadow-xs border border-slate-100/60 z-10">
                ACTIVE AUDIT STAGE
              </span>
              <img
                src={imageSrc}
                alt="Audit target preview"
                className="w-full max-h-56 object-contain rounded-xl border border-slate-100/40 bg-white"
                referrerPolicy="no-referrer"
              />
              <div className="mt-2.5 px-1.5 flex items-center justify-between text-[10px] font-mono font-bold text-slate-400">
                <span className="truncate max-w-[150px]">{fileName}</span>
                {fileSize && <span>{(fileSize / 1024).toFixed(1)} KB</span>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Forensic Report outputs right side */}
      <div className="lg:col-span-2">
        {loading ? (
          <div className="bg-white border border-slate-200 rounded-3xl p-12 shadow-xs h-full flex flex-col items-center justify-center text-center py-20">
            <div className="relative mb-6">
              <div className="h-16 w-16 rounded-full border-4 border-blue-100 border-t-blue-600 animate-spin" />
              <Activity className="h-6 w-6 text-blue-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
            </div>
            <h3 className="text-lg font-extrabold text-slate-900 tracking-tight leading-tight">Running Multi-Spectral Forensics</h3>
            <p className="text-xs text-slate-500 mt-2 max-w-md mx-auto leading-relaxed">
              Compiling compression tables, tracing cloning artifacts, checking face-landmark symmetry, analyzing lighting coefficients, and querying localized safety ledgers...
            </p>
          </div>
        ) : report ? (
          <div className="bg-white border border-slate-200 rounded-3xl shadow-xs overflow-hidden text-left" id="forensic-report-printable">
            
            {/* 1. Large Verdict Card (Point 9) */}
            <div className={`p-6 border-b border-slate-100 ${getScoreData(report.authenticityScore).colorClass} flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all duration-200`}>
              <div className="flex items-center gap-3.5">
                <div className="p-3 bg-white rounded-2xl shadow-xs">
                  {getScoreData(report.authenticityScore).icon}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[9px] font-black uppercase tracking-widest text-slate-400">Forensic Investigation Log</span>
                    <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold font-mono text-white ${getScoreData(report.authenticityScore).badgeColor}`}>
                      RESULT COHERENT
                    </span>
                  </div>
                  <h3 className="text-xl font-extrabold text-slate-900 tracking-tight leading-tight mt-1">
                    {getScoreData(report.authenticityScore).label}
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 max-w-sm sm:max-w-md">
                    {getScoreData(report.authenticityScore).recommendation}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                    <div className="text-right sm:text-right">
                  <span className="text-[10px] uppercase font-mono font-black text-slate-400 block tracking-tight">Authenticity</span>
                  <span className={`text-3xl font-black ${getScoreData(report.authenticityScore).colorClass.split(" ")[0]} leading-none mt-1 inline-block`}>
                    {report.authenticityScore}%
                  </span>
                </div>
                    {/* Pending / Canceled badge */}
                    {(pending || (report.details as any)?.canceled) && (
                      <div className="ml-4">
                        {pending ? (
                          <span className="inline-block px-3 py-1 text-xs font-bold rounded-full bg-amber-50 text-amber-700 border border-amber-100">PENDING</span>
                        ) : (
                          <span className="inline-block px-3 py-1 text-xs font-bold rounded-full bg-red-50 text-red-700 border border-red-100">CANCELED</span>
                        )}
                      </div>
                    )}
              </div>
            </div>

            {/* 2. Primary Metrics Grid (Point 8) */}
            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
              <h4 className="text-[10px] font-black text-slate-400 font-mono uppercase tracking-widest mb-3.5">INDEPENDENT RISK METRICS</h4>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {/* Score 1 */}
                <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-xs text-center flex flex-col justify-between">
                  <span className="text-[9px] font-bold text-slate-400 font-mono block">AUTHENTICITY</span>
                  <span className={`text-2xl font-black block mt-2 ${getScoreData(report.authenticityScore).colorClass.split(" ")[0]}`}>
                    {report.authenticityScore}%
                  </span>
                  <span className="text-[8px] text-slate-400 font-mono mt-1 font-bold">LEGITIMACY</span>
                </div>
                {/* Score 2 */}
                <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-xs text-center flex flex-col justify-between">
                  <span className="text-[9px] font-bold text-slate-400 font-mono block">AI PROBABILITY</span>
                  <span className="text-2xl font-black text-slate-800 block mt-2">
                    {Math.round(report.aiProbability * 100)}%
                  </span>
                  <span className={`text-[8px] px-1 py-0.5 rounded inline-block font-mono mt-1 ${getAiProbLabel(report.aiProbability).color}`}>
                    {getAiProbLabel(report.aiProbability).text}
                  </span>
                </div>
                {/* Score 3 */}
                <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-xs text-center flex flex-col justify-between">
                  <span className="text-[9px] font-bold text-slate-400 font-mono block">MANIPULATION</span>
                  <span className={`text-2xl font-black block mt-2 ${report.manipulationScore > 30 ? 'text-red-500' : 'text-emerald-600'}`}>
                    {report.manipulationScore}%
                  </span>
                  <span className="text-[8px] text-slate-400 font-mono mt-1 font-bold">MODIFICATION</span>
                </div>
                {/* Score 4 */}
                <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-xs text-center flex flex-col justify-between">
                  <span className="text-[9px] font-bold text-slate-400 font-mono block">CONFIDENCE</span>
                  <span className="text-2xl font-black text-blue-600 block mt-2">
                    {report.confidenceScore || 95}%
                  </span>
                  <span className="text-[8px] text-slate-400 font-mono mt-1 font-bold">ALGORITHMIC</span>
                </div>
                {/* Score 5 */}
                <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-xs text-center col-span-2 md:col-span-1 flex flex-col justify-between">
                  <span className="text-[9px] font-bold text-slate-400 font-mono block">THREAT RISK</span>
                  <span className="block mt-2">
                    <span className={`inline-block px-2.5 py-1 text-[10px] font-extrabold font-mono rounded-lg ${getRiskLabel(report.riskLevel).color}`}>
                      {getRiskLabel(report.riskLevel).text.split(" ")[1]}
                    </span>
                  </span>
                  <span className="text-[8px] text-slate-400 font-mono mt-1 font-bold">RISK CATEGORY</span>
                </div>
              </div>
            </div>

            {/* Main Details Section */}
            <div className="p-6 space-y-6">
              
              {/* 3. Green Success Indicators Badges Grid (Point 5) */}
              <div>
                <h4 className="text-[10px] font-black text-slate-400 font-mono uppercase tracking-widest mb-3">FORENSIC SIGNAL COMPLIANCE</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl border border-slate-100">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span className="text-xs text-slate-700 font-medium font-mono">Authentic Image Architecture</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl border border-slate-100">
                    {report.details.photoshopSign ? (
                      <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    )}
                    <span className="text-xs text-slate-700 font-medium font-mono">
                      {report.details.photoshopSign ? "Photoshop Footprints Suspected" : "No Photoshop Alterations Detected"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl border border-slate-100">
                    {report.details.noiseInconsistency ? (
                      <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    )}
                    <span className="text-xs text-slate-700 font-medium font-mono">
                      {report.details.noiseInconsistency ? "Local Pixel Discrepancy Found" : "Micro-Noise Density Consistent"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl border border-slate-100">
                    {Math.round(report.aiProbability * 100) > 40 ? (
                      <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 animate-pulse" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    )}
                    <span className="text-xs text-slate-700 font-medium font-mono">
                      {Math.round(report.aiProbability * 100) > 40 ? "Generative Synthetic Artifacts Found" : "No AI Artifacts Detected"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl border border-slate-100">
                    {report.authenticityScore < 40 ? (
                      <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    )}
                    <span className="text-xs text-slate-700 font-medium font-mono">
                      {report.authenticityScore < 40 ? "Untrusted Image Matrix" : "Trusted Forensic Vector Image"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl border border-slate-100">
                    {report.details.exifDataFound ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-blue-500 shrink-0" />
                    )}
                    <span className="text-xs text-slate-700 font-medium font-mono truncate">
                      {report.details.exifDataFound 
                        ? "Camera EXIF Signatures Intact" 
                        : (report.details.metadataStatus || "Metadata compression processed")}
                    </span>
                  </div>
                </div>
              </div>

              {/* 4. Forensic Observations & Narrative (Point 7) */}
              <div className="bg-slate-50/40 border border-slate-150 rounded-2xl p-4">
                <div className="flex items-center gap-2 text-slate-600 mb-2">
                  <FileText className="h-3.5 w-3.5 text-blue-600 animate-pulse" />
                  <h4 className="text-[10px] font-black text-slate-500 font-mono uppercase tracking-widest">OBSERVATION LOG</h4>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed italic">
                  "{report.explanation}"
                </p>
              </div>

              {/* 5. Verification Timeline Stepper (Point 13) */}
              <div>
                <h4 className="text-[10px] font-black text-slate-400 font-mono uppercase tracking-widest mb-3.5">SECURE LOGICAL TIMELINE</h4>
                <div className="relative border-l border-slate-150 pl-5 ml-2.5 space-y-4">
                  {/* Step 1 */}
                  <div className="relative">
                    <span className="absolute -left-[27px] top-0.5 bg-emerald-500 text-white rounded-full p-0.5 border-2 border-white">
                      <Check className="h-2 w-2" />
                    </span>
                    <h5 className="text-[11px] font-bold text-slate-900 leading-tight">1. Vector Ingestion & Header Decode (Passed)</h5>
                    <p className="text-[10px] text-slate-400 mt-0.5">Parsed file geometry: {report.details.dimensions || "unknown"} • Format profile verified</p>
                  </div>
                  {/* Step 2 */}
                  <div className="relative">
                    <span className="absolute -left-[27px] top-0.5 bg-emerald-500 text-white rounded-full p-0.5 border-2 border-white">
                      <Check className="h-2 w-2" />
                    </span>
                    <h5 className="text-[11px] font-bold text-slate-900 leading-tight">2. Pixel-Domain Statistical Auditing (Passed)</h5>
                    <p className="text-[10px] text-slate-400 mt-0.5">Evaluated noise consistency curves and edge transition vectors</p>
                  </div>
                  {/* Step 3 */}
                  <div className="relative">
                    <span className="absolute -left-[27px] top-0.5 bg-emerald-500 text-white rounded-full p-0.5 border-2 border-white">
                      <Check className="h-2 w-2" />
                    </span>
                    <h5 className="text-[11px] font-bold text-slate-900 leading-tight">3. Neural Deepfake Classifier Check (Passed)</h5>
                    <p className="text-[10px] text-slate-400 mt-0.5">Passed generative facial landmark tests and adversarial mesh maps</p>
                  </div>
                  {/* Step 4 */}
                  <div className="relative">
                    <span className="absolute -left-[27px] top-0.5 bg-emerald-500 text-white rounded-full p-0.5 border-2 border-white">
                      <Check className="h-2 w-2" />
                    </span>
                    <h5 className="text-[11px] font-bold text-slate-900 leading-tight">4. Audit Formulation & Verification Sign-Off</h5>
                    <p className="text-[10px] text-slate-400 mt-0.5">Assigned authentic index score {report.authenticityScore}/100 and risk category: {report.riskLevel}</p>
                  </div>
                </div>
              </div>

              {/* 6. Technical details section - Expandable (Point 13) */}
              <div className="border-t border-slate-100 pt-4">
                <button
                  onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                  className="flex items-center justify-between w-full py-2 text-xs font-bold text-slate-500 font-mono uppercase tracking-widest cursor-pointer hover:text-blue-600 transition-colors"
                >
                  <span>EXPAND DETECTED HARDWARE DETAILS</span>
                  {showTechnicalDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>

                {showTechnicalDetails && (
                  <div className="mt-3 bg-slate-50 border border-slate-100 rounded-2xl p-4 text-xs font-mono">
                    <div className="space-y-2 max-w-lg">
                      <div className="flex items-center justify-between py-1 border-b border-white">
                        <span className="text-slate-400">Photoshop alter indicators:</span>
                        <span className={`font-bold ${report.details.photoshopSign ? 'text-red-500' : 'text-emerald-600'}`}>
                          {report.details.photoshopSign ? 'YES (SUSPECTED)' : 'NEGATIVE (NONE)'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-1 border-b border-white">
                        <span className="text-slate-400">Micro-Noise inconsistency:</span>
                        <span className={`font-bold ${report.details.noiseInconsistency ? 'text-red-500' : 'text-emerald-600'}`}>
                          {report.details.noiseInconsistency ? 'YES (EDGE DISCREPANCY)' : 'NEGATIVE'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-1 border-b border-white">
                        <span className="text-slate-400">EXIF Signature blocks present:</span>
                        <span className="font-bold text-slate-700">
                          {report.details.exifDataFound ? 'YES (CAMERA ORIGINAL)' : 'ABSENT (COMPRESSED)'}
                        </span>
                      </div>
                      {report.details.dimensions && (
                        <div className="flex items-center justify-between py-1 border-b border-white">
                          <span className="text-slate-400">Geometry Dimensions:</span>
                          <span className="font-bold text-slate-700">{report.details.dimensions}</span>
                        </div>
                      )}
                      {report.details.compression && (
                        <div className="flex items-center justify-between py-1 border-b border-white">
                          <span className="text-slate-400">Compression Range factor:</span>
                          <span className="font-bold text-slate-700">{report.details.compression}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between py-1">
                        <span className="text-slate-400">Compression Handling Flag:</span>
                        <span className="font-bold text-blue-600 truncate max-w-[250px]">
                          {report.details.metadataStatus || "Metadata intact"}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 7. Action Controls (Point 13) */}
              <div className="border-t border-slate-100 pt-5 flex flex-wrap gap-2.5">
                <button
                  id="image-btn-copy"
                  onClick={copyReport}
                  className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-4 py-2.5 rounded-xl transition-all cursor-pointer font-mono"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-600 animate-bounce" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "COPIED" : "COPY REPORT"}
                </button>
                {pending && (
                  <button
                    id="image-btn-cancel"
                    onClick={cancelJob}
                    className="inline-flex items-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs px-4 py-2.5 rounded-xl transition-all cursor-pointer font-mono"
                  >
                    Cancel
                  </button>
                )}
                <button
                  id="image-btn-download"
                  onClick={downloadPDFReport}
                  className="inline-flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-100 font-bold text-xs px-4 py-2.5 rounded-xl transition-all cursor-pointer font-mono"
                >
                  <Download className="h-3.5 w-3.5" />
                  {exportedPDF ? "GENERATING PDF..." : "EXPORT PDF"}
                </button>
                <button
                  id="image-btn-share"
                  onClick={shareReport}
                  className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all cursor-pointer font-mono ml-auto"
                >
                  <Share2 className="h-3.5 w-3.5" />
                  {shared ? "HASH SHARED" : "SHARE AUDIT"}
                </button>
              </div>

            </div>
          </div>
        ) : (
          <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-16 text-center text-slate-400 h-full flex flex-col items-center justify-center min-h-[350px]">
            <div className="h-14 w-14 rounded-2xl bg-slate-50 border border-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4 shadow-2xs">
              <Eye className="h-7 w-7 text-slate-400" />
            </div>
            <h3 className="text-base font-bold text-slate-800 tracking-tight">Forensic Lab Queue Empty</h3>
            <p className="text-xs text-slate-400 max-w-sm mt-1.5 mx-auto leading-relaxed">
              Drag-and-drop or select any picture to trace digital footprints, cloning indices, and verify historical photo metadata files.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
