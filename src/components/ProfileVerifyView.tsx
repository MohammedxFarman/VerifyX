import { useState } from "react";
import { User, Shield, Loader2, Sparkles, AlertTriangle, AlertCircle, CheckCircle } from "lucide-react";
import { VerifyProfileResponse } from "../types";

export default function ProfileVerifyView() {
  const [username, setUsername] = useState("");
  const [platform, setPlatform] = useState("X (Twitter)");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<VerifyProfileResponse | null>(null);
  const [error, setError] = useState("");

  const platforms = [
    "X (Twitter)",
    "Instagram",
    "Facebook",
    "LinkedIn",
    "Telegram",
    "YouTube"
  ];

  const quickHandles = [
    { label: "Normal Account (A. R. Rahman)", user: "arrahman", platform: "X (Twitter)" },
    { label: "Suspected Crypto Bot", user: "crypto_gift_giveaway349", platform: "X (Twitter)" },
    { label: "Suspected Fake Brand Impersonation", user: "support_hdfc_bank_alerts", platform: "Instagram" }
  ];

  const handleScan = async (name = username, plat = platform) => {
    if (!name || name.trim().length === 0) {
      setError("Please input a valid user handle of the target social platform.");
      return;
    }
    setError("");
    setLoading(true);
    setReport(null);

    try {
      const response = await fetch("/api/verify/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: name, platform: plat })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Profile check failed.");
      }
      setReport(data);
    } catch (err: any) {
      setError(err.message || "Failed to scan profile parameters.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Inputs left side */}
      <div className="lg:col-span-1 space-y-4 text-left">
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center gap-2 text-blue-600 mb-3">
            <User className="h-4 w-4" />
            <span className="font-mono text-xs font-bold uppercase tracking-wider">Fake Account detection</span>
          </div>
          <h2 className="text-lg font-black text-gray-900 tracking-tight leading-none mb-2">Social Persona Auditor</h2>
          <p className="text-gray-500 text-xs leading-relaxed mb-4">
            Spot bots, troll profiles, fake campaigns, or identity harvesters replicating regional officials or corporations.
          </p>

          {/* Quick handle samples */}
          <div className="mb-4">
            <span className="text-[10px] uppercase font-mono font-bold text-gray-400 block mb-2">SELECT TRACE EXAMPLES</span>
            <div className="space-y-1.5 flex flex-col">
              {quickHandles.map((h, i) => (
                <button
                  key={i}
                  id={`quick-profile-${i}`}
                  onClick={() => {
                    setUsername(h.user);
                    setPlatform(h.platform);
                    handleScan(h.user, h.platform);
                  }}
                  className="text-left bg-gray-50 hover:bg-blue-50 hover:text-blue-700 p-2 text-xs font-semibold text-gray-600 border border-gray-150 rounded-lg transition-all truncate block"
                >
                  {h.label} (@{h.user})
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2.5">
            <div>
              <label className="text-[10px] font-mono font-bold text-gray-400 uppercase block mb-1">Target Platform</label>
              <select
                id="profile-platform-select"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
              >
                {platforms.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-mono font-bold text-gray-400 uppercase block mb-1">Social Username / Handle</label>
              <div className="relative">
                <input
                  id="profile-username-input"
                  type="text"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  placeholder="e.g. narendramodi or hdfc_help"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleScan()}
                />
              </div>
            </div>
          </div>

          {error && <p className="text-red-500 text-xs font-semibold mt-2">{error}</p>}

          <button
            id="profile-scan-submit-btn"
            onClick={() => handleScan()}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold text-sm py-2.5 rounded-xl transition-all shadow-xs mt-4 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Querying handle behavior...
              </>
            ) : (
              <>
                <Shield className="h-4 w-4" />
                Check Profile
              </>
            )}
          </button>
        </div>
      </div>

      {/* Results panel right side */}
      <div className="lg:col-span-2">
        {loading ? (
          <div className="bg-white border border-gray-100 rounded-2xl p-10 shadow-xs h-full flex flex-col items-center justify-center animate-pulse">
            <Loader2 className="h-10 w-10 text-blue-600 animate-spin mb-4" />
            <h3 className="text-base font-bold text-gray-800">Reviewing public API meta indicators</h3>
            <p className="text-xs text-gray-400 mt-1 max-w-sm text-center">
              Testing profile pictures, analyzing account biography parameters, checking historical posting patterns, and tracking bot-follower engagement vectors...
            </p>
          </div>
        ) : report ? (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-xs overflow-hidden">
            {/* Header block */}
            <div className={`p-6 border-b border-gray-150 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
              report.trustScore < 40 ? 'bg-red-50' : 'bg-green-50'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${
                  report.trustScore < 40 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'
                }`}>
                  <User className="h-6 w-6" />
                </div>
                <div>
                  <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-gray-400">Account Legitimacy assessment</span>
                  <h3 className="text-xl font-bold text-gray-900 tracking-tight mt-0.5">@{username} on {platform}</h3>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="bg-white px-4 py-2 rounded-xl border border-gray-150 text-center">
                  <span className="text-[9px] uppercase font-mono font-bold text-gray-400 block -mb-0.5">Trust Score</span>
                  <span className={`text-xl font-black ${
                    report.trustScore < 40 ? 'text-red-600' : 'text-green-600'
                  }`}>{report.trustScore}/100</span>
                </div>
              </div>
            </div>

            {/* Assessment outputs */}
            <div className="p-6 space-y-6 text-left">
              {/* Properties strip */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
                  <span className="text-[10px] font-mono text-gray-400 font-bold block">VERIFIED EMBLEM</span>
                  <span className="text-xs font-bold text-gray-800 font-mono mt-1">
                    {report.isVerifiedAccount ? 'YES (Accredited badge found)' : 'NO / STANDBY'}
                  </span>
                </div>

                <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
                  <span className="text-[10px] font-mono text-gray-400 font-bold block">BOT PROBABILITY</span>
                  <span className={`text-xs font-bold font-mono mt-1 ${
                    report.botProbability > 0.5 ? 'text-red-500' : 'text-green-600'
                  }`}>
                    {Math.round(report.botProbability * 100)}% Likelihood
                  </span>
                </div>

                <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 col-span-2 sm:col-span-1">
                  <span className="text-[10px] font-mono text-gray-400 font-bold block">ENGAGEMENT QUALITY</span>
                  <span className="text-xs font-bold text-gray-800 font-mono mt-1">
                    {report.engagementQuality}
                  </span>
                </div>
              </div>

              {/* Assessment explanation text */}
              <div>
                <h4 className="text-xs font-bold text-gray-400 font-mono uppercase mb-1.5">VerifyX behavioral explanation</h4>
                <p className="text-sm text-gray-600 leading-relaxed">{report.explanation}</p>
              </div>

              {/* Red flags */}
              {report.redFlags && report.redFlags.length > 0 && (
                <div className="border-t border-gray-100 pt-5">
                  <h4 className="text-xs font-bold text-red-600 font-mono uppercase mb-3 flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4" /> Detected behavioral anomalies
                  </h4>
                  <ul className="space-y-2">
                    {report.redFlags.map((flag, key) => (
                      <li key={key} className="text-xs text-gray-600 flex items-start gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-500 mt-1.5 flex-shrink-0"></span>
                        <span>{flag}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 border-dashed rounded-2xl p-12 text-center text-gray-500 h-full flex flex-col items-center justify-center">
            <div className="h-12 w-12 rounded-xl bg-gray-50 border border-gray-100 text-gray-400 flex items-center justify-center mx-auto mb-4">
              <User className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-bold text-gray-800">Handle Scan Pending</h3>
            <p className="text-xs text-gray-400 max-w-sm mt-1 mx-auto leading-relaxed">
              Input a username and platform selection on the left to review social media impersonation vectors or automated troll behavior.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
