import { useState } from "react";
import { Copy, Sparkles, Loader2, AlertCircle, FileText, CheckCircle } from "lucide-react";
import { VerifyPlagiarismResponse } from "../types";

export default function PlagiarismView() {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<VerifyPlagiarismResponse | null>(null);
  const [error, setError] = useState("");

  const handleAudit = async () => {
    if (!content || content.trim().length < 10) {
      setError("Please key in a document that contains at least 10 alphabetical letters.");
      return;
    }
    setError("");
    setLoading(true);
    setReport(null);

    try {
      const response = await fetch("/api/verify/plagiarism", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Plagiarism trace failed.");
      }
      setReport(data);
    } catch (err: any) {
      setError(err.message || "Failed to reach plagiarism server.");
    } finally {
      setLoading(false);
    }
  };

  const loadSampleText = () => {
    setContent(
      "Digital literacy is the ability to find, evaluate, organize, share, and write content using information technologies and the Internet. It is essential for modern educational curriculum and professional growth, enabling citizens to avoid malicious phishing tricks, misinformation, and online banking scam claims circulating globally."
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-left">
      {/* Inputs left side */}
      <div className="lg:col-span-1 space-y-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center gap-2 text-blue-600 mb-3">
            <Copy className="h-4 w-4" />
            <span className="font-mono text-xs font-bold uppercase tracking-wider">Originality Checker</span>
          </div>
          <h2 className="text-lg font-black text-gray-900 tracking-tight leading-none mb-2">Plagiarism Scanner</h2>
          <p className="text-gray-500 text-xs leading-relaxed mb-4">
            Upload text components to detect duplication indexes, similar sources, and highlighted copied structures.
          </p>

          <button
            id="load-plagiarism-sample-btn"
            onClick={loadSampleText}
            className="w-full text-left bg-slate-50 hover:bg-blue-50 border border-gray-150 rounded-xl p-3 text-xs text-gray-500 font-semibold mb-3 flex items-center justify-between"
          >
            <span>Load duplicate essay sample...</span>
            <Sparkles className="h-3.5 w-3.5 text-blue-600 animate-pulse" />
          </button>

          <textarea
            id="plagiarism-input-textarea"
            className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-sans"
            rows={8}
            placeholder="Key in your content text or essays..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />

          {error && <p className="text-red-500 text-xs font-semibold mt-1">{error}</p>}

          <button
            id="plagiarism-scan-btn"
            onClick={handleAudit}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold text-sm py-2.5 rounded-xl transition-all shadow-xs mt-3 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Cross-checking public references...
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Audit Content Uniqueness
              </>
            )}
          </button>
        </div>
      </div>

      {/* Results right side */}
      <div className="lg:col-span-2">
        {loading ? (
          <div className="bg-white border border-gray-100 rounded-2xl p-10 shadow-xs h-full flex flex-col items-center justify-center animate-pulse">
            <Loader2 className="h-10 w-10 text-blue-600 animate-spin mb-4" />
            <h3 className="text-base font-bold text-gray-800">Hashing text index fingerprints</h3>
            <p className="text-xs text-gray-400 mt-1 max-w-sm text-center">
              Scanning indices for sentence duplication indices, matching snippets in global educational repositories, and calculating authenticity ranges...
            </p>
          </div>
        ) : report ? (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-xs overflow-hidden">
            {/* Header strip */}
            <div className={`p-6 border-b border-gray-150 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
              report.originalityScore < 60 ? 'bg-amber-50' : 'bg-green-50'
            }`}>
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-xl bg-white shadow-xs border ${
                  report.originalityScore < 60 ? 'text-amber-500 border-amber-100' : 'text-green-600 border-green-100'
                }`}>
                  <FileText className="h-6 w-6" />
                </div>
                <div>
                  <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-gray-400">Fingerprint similarity audit</span>
                  <h3 className="text-xl font-bold text-gray-900 tracking-tight mt-0.5">Originality Profile</h3>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="bg-white px-4 py-2 rounded-xl border border-gray-150 text-center">
                  <span className="text-[9px] uppercase font-mono font-bold text-gray-400 block -mb-0.5">Originality</span>
                  <span className={`text-xl font-black ${
                    report.originalityScore < 60 ? 'text-amber-500' : 'text-green-600'
                  }`}>{report.originalityScore}%</span>
                </div>
                <div className="bg-white px-4 py-2 rounded-xl border border-gray-150 text-center">
                  <span className="text-[9px] uppercase font-mono font-bold text-gray-400 block -mb-0.5">Similarity index</span>
                  <span className="text-xl font-black text-gray-800">{report.similarityScore}%</span>
                </div>
              </div>
            </div>

            {/* Results output view */}
            <div className="p-6 space-y-6">
              {/* Highlight sections */}
              <div>
                <h4 className="text-xs font-bold text-gray-400 font-mono uppercase mb-2">Originality Trace highlights</h4>
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-sm leading-relaxed text-gray-700">
                  {report.highlightedText.map((block, i) => (
                    <span key={i} className={block.isCopied ? "bg-amber-100 text-amber-900 px-1 py-0.5 rounded font-medium" : ""}>
                      {block.text}
                    </span>
                  ))}
                </div>
              </div>

              {/* Matched sources bibliography */}
              {report.matchedSources && report.matchedSources.length > 0 && (
                <div className="border-t border-gray-100 pt-5">
                  <h4 className="text-xs font-bold text-gray-400 font-mono uppercase mb-3">Top Duplication Matches</h4>
                  <div className="space-y-3">
                    {report.matchedSources.map((source, index) => (
                      <div key={index} className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-xs">
                        <div className="flex items-center justify-between font-semibold text-gray-700">
                          <span className="text-blue-600 truncate max-w-sm block hover:underline">{source.source}</span>
                          <span className="text-amber-600">{source.similarity}% Match</span>
                        </div>
                        <p className="text-gray-400 font-mono italic mt-1 leading-normal">
                          &quot;{source.snippet}&quot;
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 border-dashed rounded-2xl p-12 text-center text-gray-500 h-full flex flex-col items-center justify-center">
            <div className="h-12 w-12 rounded-xl bg-gray-50 border border-gray-100 text-gray-400 flex items-center justify-center mx-auto mb-4">
              <Copy className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-bold text-gray-800">No content scanned yet</h3>
            <p className="text-xs text-gray-400 max-w-sm mt-1 mx-auto leading-relaxed">
              Add your essays, articles, or books on the left. The compiler will compare content footprints and display similarity ranges.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
