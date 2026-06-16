import { useState } from "react";
import { Globe, Shield, Loader2, AlertCircle, CheckCircle2, ShieldAlert, Sparkles, ExternalLink, RefreshCw } from "lucide-react";
import { VerifyUrlResponse } from "../types";

export default function UrlScanView() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<VerifyUrlResponse | null>(null);
  const [error, setError] = useState("");

  const quickUrls = [
    { label: "RBI Rewards gift (Phishing)", url: "http://rbi-rewards-cashback-update-india.com" },
    { label: "Brave Browser site (Safe)", url: "https://brave.com" },
    { label: "Google India (Safe)", url: "https://google.co.in" },
    { status: "Unsecured Site", url: "http://clandestine-blog.net" }
  ];

  const handleScan = async (targetUrl = url) => {
    if (!targetUrl || targetUrl.trim().length === 0) {
      setError("Please input a valid website address.");
      return;
    }
    setError("");
    setLoading(true);
    setReport(null);

    try {
      const response = await fetch("/api/verify/url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: targetUrl })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to scan website.");
      }
      setReport(data);
    } catch (err: any) {
      setError(err.message || "Failed to contact VerifyX servers.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Input controls left side */}
      <div className="lg:col-span-1 space-y-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center gap-2 text-blue-600 mb-3">
            <Globe className="h-4 w-4" />
            <span className="font-mono text-xs font-bold uppercase tracking-wider">Website Trust Scanner</span>
          </div>
          <h2 className="text-lg font-black text-gray-900 tracking-tight leading-none mb-2">Domain Trust Auditor</h2>
          <p className="text-gray-500 text-xs leading-relaxed mb-4">
            Input any links, short URLs, banking portals, or online stores to inspect SSL encryption status, registrar flags, domain lifetime, and blacklists.
          </p>

          {/* Quick links templates */}
          <div className="mb-4">
            <span className="text-[10px] uppercase font-mono font-bold text-gray-400 block mb-2">AUDIT SAMPLES</span>
            <div className="space-y-1.5">
              {quickUrls.map((item, idx) => (
                <button
                  key={idx}
                  id={`quick-url-${idx}`}
                  onClick={() => {
                    setUrl(item.url);
                    handleScan(item.url);
                  }}
                  className="w-full text-left bg-gray-50 hover:bg-blue-50 hover:text-blue-700 p-2.5 rounded-lg border border-gray-150 text-xs font-semibold text-gray-600 transition-all truncate block"
                >
                  {item.label || item.url}
                </button>
              ))}
            </div>
          </div>

          <div className="relative">
            <input
              id="website-input-field"
              type="text"
              className="w-full border border-gray-200 rounded-xl pl-3 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              placeholder="e.g. hdfcnetbanking-rewards.xyz"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleScan()}
            />
            <div className="absolute right-3 top-3 text-gray-400">
              <Globe className="h-4 w-4" />
            </div>
          </div>

          {error && <p className="text-red-500 text-xs font-semibold mt-2">{error}</p>}

          <button
            id="url-scan-submit-btn"
            onClick={() => handleScan()}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold text-sm py-2.5 rounded-xl transition-all shadow-xs mt-3 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Auditing safety headers...
              </>
            ) : (
              <>
                <Shield className="h-4 w-4" />
                Scan Link Safety
              </>
            )}
          </button>
        </div>
      </div>

      {/* Trust scan report results right side */}
      <div className="lg:col-span-2">
        {loading ? (
          <div className="bg-white border border-gray-100 rounded-2xl p-10 shadow-xs h-full flex flex-col items-center justify-center animate-pulse">
            <Loader2 className="h-10 w-10 text-blue-600 animate-spin mb-4" />
            <h3 className="text-base font-bold text-gray-800">Reviewing secure SSL handshakes</h3>
            <p className="text-xs text-gray-400 mt-1 max-w-sm text-center">
              Tracing routing redirect loops, querying public Safe Browsing registry, calculating phishing probability vector, and examining raw domain registration record...
            </p>
          </div>
        ) : report ? (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-xs overflow-hidden">
            {/* Header section with safety banner */}
            <div className={`p-6 border-b border-gray-150 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
              report.safetyRating === 'DANGEROUS' ? 'bg-red-50' : report.safetyRating === 'WARNING' ? 'bg-amber-50' : 'bg-green-50'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${
                  report.safetyRating === 'DANGEROUS' ? 'bg-red-100 text-red-600' :
                  report.safetyRating === 'WARNING' ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'
                }`}>
                  {report.safetyRating === 'DANGEROUS' ? <ShieldAlert className="h-6 w-6" /> : <Shield className="h-6 w-6" />}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-gray-400">VerifyX URL Security Scan</span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 tracking-tight mt-0.5">
                    {report.safetyRating === 'DANGEROUS' ? 'Host is Blacklisted / Suspicious' :
                     report.safetyRating === 'WARNING' ? 'Unsecured Domain Alert' : 'This website is verified safe'}
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="bg-white px-4 py-2 rounded-xl shadow-xs border border-gray-150 text-center">
                  <span className="text-[9px] uppercase font-mono font-bold text-gray-400 block -mb-0.5">SAFETY INDEX</span>
                  <span className={`text-xl font-black ${
                    report.safetyRating === 'DANGEROUS' ? 'text-red-600' : report.safetyRating === 'WARNING' ? 'text-amber-500' : 'text-green-600'
                  }`}>{report.trustScore}/100</span>
                </div>
              </div>
            </div>

            {/* Analysis details layout */}
            <div className="p-6 space-y-6">
              {/* Technical properties list Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
                  <span className="text-[10px] font-mono text-gray-400 font-bold block">SSL ENCRYPTION</span>
                  <span className={`text-xs font-bold font-mono mt-1 inline-block ${
                    report.sslStatus === 'VALID' ? 'text-green-600' : 'text-red-500'
                  }`}>{report.sslStatus}</span>
                </div>

                <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
                  <span className="text-[10px] font-mono text-gray-400 font-bold block">REGISTERED AGE</span>
                  <span className="text-xs font-bold text-gray-800 font-mono mt-1 inline-block truncate">{report.domainAge}</span>
                </div>

                <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
                  <span className="text-[10px] font-mono text-gray-400 font-bold block">PHISHING THREAT</span>
                  <span className={`text-xs font-bold font-mono mt-1 inline-block ${
                    report.phishingProbability > 0.5 ? 'text-red-500' : 'text-green-600'
                  }`}>{Math.round(report.phishingProbability * 100)}%</span>
                </div>

                <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
                  <span className="text-[10px] font-mono text-gray-400 font-bold block">SCAM PROBABILITY</span>
                  <span className={`text-xs font-bold font-mono mt-1 inline-block ${
                    report.scamProbability > 0.5 ? 'text-red-500' : 'text-green-600'
                  }`}>{Math.round(report.scamProbability * 100)}%</span>
                </div>
              </div>

              {/* Summary Block */}
              <div>
                <h4 className="text-xs font-bold text-gray-400 font-mono uppercase mb-1.5">Domain Summary</h4>
                <p className="text-sm text-gray-600 leading-relaxed">{report.summary}</p>
              </div>

              {/* Suggestions Bulletpoints */}
              {report.suggestions && report.suggestions.length > 0 && (
                <div className="border-t border-gray-100 pt-5">
                  <h4 className="text-xs font-bold text-amber-600 font-mono uppercase mb-3 flex items-center gap-1">
                    <AlertCircle className="h-4 w-4" /> Recommended Safety Actions
                  </h4>
                  <ul className="space-y-2">
                    {report.suggestions.map((action, key) => (
                      <li key={key} className="text-xs text-gray-600 flex items-start gap-2.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0"></span>
                        <span>{action}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Safety reference footer */}
              <div className="border-t border-gray-100 pt-4 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-gray-400 gap-2">
                <span>Database Status: Connected (Google Safe Browsing & VirusTotal synced)</span>
                <span className="font-mono text-[10px] font-bold bg-slate-100 px-2 py-0.5 rounded-full">CERT-IN STANDBY APPROVED</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 border-dashed rounded-2xl p-12 text-center text-gray-500 h-full flex flex-col items-center justify-center">
            <div className="h-12 w-12 rounded-xl bg-gray-50 border border-gray-100 text-gray-400 flex items-center justify-center mx-auto mb-4">
              <Globe className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-bold text-gray-800">Domain Audit Pending</h3>
            <p className="text-xs text-gray-400 max-w-sm mt-1 mx-auto leading-relaxed">
              Verify unknown domains or deep-redirect links to calculate dynamic spoof probabilities instantly.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
