import { useState } from "react";
import { Shield, Sparkles, Loader2, AlertTriangle, CheckCircle, FileText, Share2, Clipboard, Printer, ExternalLink } from "lucide-react";
import { VerifyNewsResponse } from "../types";

export default function NewsScanView() {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<VerifyNewsResponse | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  // Pre-seed quick tests
  const quickTexts = [
    {
      label: "Health Claim (Lemon cure)",
      text: "URGENT HEALTH ALERT: Dr. Gupta from Mumbai confirms that drinking boiled lemon water with bicarbonate of soda cures COVID, cancer, and electronic mobile radiation instantly. Pass this message to all family groups before tonight!"
    },
    {
      label: "Government Subsidy (Scam link)",
      text: "Under the new PM-Gift Yojana 2026 scheme, every citizen carrying an Android phone qualifies for an immediate INR 50,000 cash aid due to successful national tax collection. Check if your phone number fits and register at: https://secure-pm-rewards-gov.xyz"
    },
    {
      label: "Factual Space News",
      text: "The Indian Space Research Organisation (ISRO) successfully launched its next-generation meteorological satellite using the GSLV rocket from Sriharikota. The mission aims to capture extreme weather anomalies across the subcontinent."
    }
  ];

  const handleVerify = async (textToVerify = content) => {
    if (!textToVerify || textToVerify.trim().length < 5) {
      setError("Please paste or type content that is at least 5 characters long.");
      return;
    }
    setError("");
    setLoading(true);
    setReport(null);

    try {
      const response = await fetch("/api/verify/news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: textToVerify })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Verification server failed.");
      }
      setReport(data);
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const copyReport = () => {
    if (!report) return;
    const shareText = `VerifyX Public Trust Assessment Report:
------------------------------------------
Title: Factual Integrity Audit
Trust Score: ${report.trustScore}/100 
Risk Level: ${report.riskLevel}
Summary: ${report.factCheckSummary}
Evidence: 
${report.supportingEvidence.map(e => `* ${e}`).join("\n")}
------------------------------------------
Verified via VerifyX Platform.`;
    navigator.clipboard.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const printReport = () => {
    window.print();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Input panel left side */}
      <div className="lg:col-span-1 space-y-4">
        <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-xs">
          <div className="flex items-center gap-2 text-blue-600 mb-3">
            <Sparkles className="h-4 w-4" />
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider">AI Fake News Detector</span>
          </div>
          <h2 className="text-lg font-extrabold text-slate-900 tracking-tight leading-none mb-2">Claim Fact-Checker</h2>
          <p className="text-slate-400 text-xs leading-relaxed mb-4">
            Verify viral WhatsApp broadcasts, social media clips, news articles, or emails inside the Gemini AI core.
          </p>

          {/* Quick templates */}
          <div className="mb-4">
            <span className="text-[10px] uppercase font-mono font-bold text-slate-400 block mb-2 tracking-wider">QUICK TEST TEMPLATES</span>
            <div className="space-y-1.5">
              {quickTexts.map((item, id) => (
                <button
                  key={id}
                  id={`quick-news-${id}`}
                  onClick={() => {
                    setContent(item.text);
                    handleVerify(item.text);
                  }}
                  className="w-full text-left bg-slate-50 hover:bg-blue-50/50 hover:text-blue-700 p-2.5 rounded-xl border border-slate-100 text-xs font-semibold text-slate-600 transition-all truncate block"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <textarea
            id="news-input-textarea"
            className="w-full border border-slate-100 rounded-xl p-3 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 font-sans text-slate-700 min-h-[140px]"
            rows={6}
            placeholder="Paste text contents here (Article, SMS, post, or claim)..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />

          {error && <p className="text-red-500 text-xs font-semibold mt-2">{error}</p>}

          <button
            id="submit-news-verify-btn"
            onClick={() => handleVerify()}
            disabled={loading}
            className="w-full trust-gradient hover:opacity-95 text-white font-bold text-xs py-3 rounded-xl transition-all shadow-md shadow-blue-200/50 mt-3 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Scanning claim context...
              </>
            ) : (
              <>
                <Shield className="h-4 w-4" />
                Run Verification
              </>
            )}
          </button>
        </div>
      </div>

      {/* Results panel right side */}
      <div className="lg:col-span-2">
        {loading ? (
          <div className="bg-white border border-slate-50 rounded-2xl p-10 shadow-xs h-full flex flex-col items-center justify-center animate-pulse">
            <Loader2 className="h-10 w-10 text-blue-600 animate-spin mb-4" />
            <h3 className="text-base font-bold text-slate-800">VerifyX AI Analysis Model booting</h3>
            <p className="text-xs text-slate-450 mt-1 max-w-sm text-center">
              Testing language semantics, comparing claim parameters with accredited fact check agencies, and performing truth probability calculation.
            </p>
          </div>
        ) : report ? (
          <div className="bg-white border border-slate-100 rounded-2xl shadow-xs overflow-hidden" id="printable-report">
            {/* Header score strip */}
            <div className={`p-6 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
              report.trustScore < 40 ? 'bg-red-50' : report.trustScore < 75 ? 'bg-amber-50' : 'bg-green-50'
            }`}>
              <div>
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full inline-block ${
                    report.trustScore < 40 ? 'bg-red-500 animate-pulse' : report.trustScore < 75 ? 'bg-amber-500' : 'bg-green-500'
                  }`}></span>
                  <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">Claims forensic status report</span>
                </div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight mt-0.5">Verified Trust Report</h3>
              </div>

              <div className="flex items-center gap-3">
                <div className="bg-white px-4 py-2 rounded-xl shadow-xs border border-slate-100">
                  <span className="text-[9px] uppercase font-mono font-bold text-slate-400 block -mb-0.5">VerifyX INDEX</span>
                  <span className={`text-2xl font-black ${
                    report.trustScore < 40 ? 'text-red-600' : report.trustScore < 75 ? 'text-amber-500' : 'text-green-600'
                  }`}>{report.trustScore}<span className="text-xs text-slate-400">/100</span></span>
                </div>
                <div className="bg-white px-4 py-2 rounded-xl shadow-xs border border-slate-100 text-center">
                  <span className="text-[9px] uppercase font-mono font-bold text-slate-400 block -mb-0.5">Risk Rating</span>
                  <span className={`text-xs ml-0.5 font-black uppercase text-left tracking-wider ${
                    report.riskLevel === 'HIGH' ? 'text-red-600' : report.riskLevel === 'MEDIUM' ? 'text-amber-500' : 'text-green-600'
                  }`}>{report.riskLevel}</span>
                </div>
              </div>
            </div>

            {/* Content body */}
            <div className="p-6 space-y-6">
              {/* Summary box */}
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex items-start gap-3">
                <div className={`p-2 rounded-lg ${report.trustScore < 40 ? 'bg-red-100 text-red-600' : 'bg-green-100/80 text-green-700'}`}>
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-400 font-mono uppercase">Fact Check Summary</h4>
                  <p className="text-sm font-semibold text-slate-800 mt-1 leading-relaxed">{report.factCheckSummary}</p>
                </div>
              </div>

              {/* Detailed Explanation */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 font-mono uppercase mb-2">VerifyX AI Forensic Findings</h4>
                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{report.explanation}</p>
              </div>

              {/* Supporting evidence */}
              {report.supportingEvidence && report.supportingEvidence.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-slate-400 font-mono uppercase mb-2.5">Detailed Audit Trail</h4>
                  <ul className="space-y-2">
                    {report.supportingEvidence.map((ev, index) => (
                      <li key={index} className="text-xs text-slate-600 flex items-start gap-2.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-500 mt-1.5 flex-shrink-0"></span>
                        <span>{ev}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Verified references */}
              {report.trustedReferences && report.trustedReferences.length > 0 && (
                <div className="border-t border-slate-100 pt-5">
                  <h4 className="text-xs font-bold text-slate-400 font-mono uppercase mb-3">Accredited fact check networks</h4>
                  <div className="flex flex-wrap gap-2">
                    {report.trustedReferences.map((ref, idx) => (
                      <span key={idx} className="bg-blue-50 text-blue-700 border border-blue-100 text-[10px] font-bold font-mono px-2.5 py-1 rounded-md">
                        {ref}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Verified source links */}
              {report.sourceLinks && report.sourceLinks.length > 0 && (
                <div className="border-t border-slate-100 pt-5">
                  <h4 className="text-xs font-bold text-slate-400 font-mono uppercase mb-3 text-left">Official Safety Channels</h4>
                  <div className="space-y-2">
                    {report.sourceLinks.map((link, idx) => (
                      <a
                          key={idx}
                          href={link}
                          target="_blank"
                          rel="noopener referrer"
                          className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 hover:underline"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          {link}
                        </a>
                      ))}
                  </div>
                </div>
              )}

              {/* Share actions */}
              <div className="border-t border-slate-100 pt-6 flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-slate-400 font-medium font-mono">VerifyX System Certificate ID: VX-{Math.random().toString(36).substr(2, 6).toUpperCase()}</span>
                <div className="flex items-center gap-2">
                  <button
                    id="copy-news-report-btn"
                    onClick={copyReport}
                    className="flex items-center gap-1.5 px-3.5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    <Clipboard className="h-3.5 w-3.5 text-slate-400" />
                    {copied ? "Copied!" : "Copy Report"}
                  </button>
                  <button
                    id="print-news-report-btn"
                    onClick={printReport}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-50 hover:bg-blue-100/80 text-blue-700 text-xs font-semibold rounded-lg transition-colors border border-blue-100 cursor-pointer"
                  >
                    <Printer className="h-3.5 w-3.5 text-blue-500" />
                    Print / Save PDF
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-slate-100 border-dashed rounded-2xl p-12 text-center text-slate-400 h-full flex flex-col items-center justify-center">
            <div className="h-12 w-12 rounded-xl bg-slate-50 border border-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4">
              <Shield className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">Verification Pending</h3>
            <p className="text-xs text-slate-400 max-w-sm mt-1 mx-auto leading-relaxed">
              Paste viral posts, messaging chains, or local government announcements on the left to generate an accredited authenticity index.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
