import { useState, useEffect } from "react";
import { 
  Shield, BarChart, FileText, Globe, Image, User, 
  MessageSquare, Copy, HelpCircle, Lock, Mail, ChevronRight, 
  Settings, Key, Eye, EyeOff, CheckCircle2, ShieldAlert
} from "lucide-react";
import { useTranslation } from "react-i18next";
import Navbar from "./components/Navbar";
import DashboardView from "./components/DashboardView";
import NewsScanView from "./components/NewsScanView";
import UrlScanView from "./components/UrlScanView";
import ImageVerifyView from "./components/ImageVerifyView";
import ProfileVerifyView from "./components/ProfileVerifyView";
import PlagiarismView from "./components/PlagiarismView";
import BuddyChatView from "./components/BuddyChatView";
import EmergencyCenterView from "./components/EmergencyCenterView";
import UserProfileView from "./components/UserProfileView";
import { VerificationHistory, DashboardStats } from "./types";

export default function App() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [user, setUser] = useState<any>(null);
  const [history, setHistory] = useState<VerificationHistory[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    trustScoreAvg: 80,
    totalVerifications: 3,
    recentVerifications: [],
    byRisk: [],
    byType: [],
    trends: []
  });

  // Auth Modal details
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [authError, setAuthError] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Settings Key Modal
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [apiKey, setApiKey] = useState("");

  // Load active user and statistics
  const fetchMeAndStats = async () => {
    try {
      const token = localStorage.getItem("token");
      const headers: HeadersInit = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      // Me
      const userRes = await fetch("/api/auth/me", { headers });
      const userData = await userRes.json();
      if (userRes.ok && userData.user) {
        setUser(userData.user);
      }

      // Stats
      const statsRes = await fetch("/api/dashboard/stats", { headers });
      const statsData = await statsRes.json();
      if (statsRes.ok) {
        setStats(statsData);
      }

      // History
      const histRes = await fetch("/api/history", { headers });
      const histData = await histRes.json();
      if (histRes.ok) {
        setHistory(histData);
      }
    } catch (e) {
      console.error("Dashboard metrics failed to load. Operating in safe local mode:", e);
    }
  };

  useEffect(() => {
    fetchMeAndStats();
  }, []);

  const handleAuth = async (e: any) => {
    e.preventDefault();
    setAuthError("");

    const endpoint = isRegister ? "/api/auth/register" : "/api/auth/login";
    const body: any = { email: authEmail, password: authPassword };
    if (isRegister) {
      body.fullName = authName;
    }

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Authentication error.");
      }

      if (data.token) {
        localStorage.setItem("token", data.token);
        setUser(data.user);
        setShowAuthModal(false);
        setAuthEmail("");
        setAuthPassword("");
        setAuthName("");
        fetchMeAndStats();
      }
    } catch (err: any) {
      setAuthError(err.message || "Failed to process auth credentials.");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setUser(null);
    fetchMeAndStats();
  };

  const handleDeleteHistory = async (id: string) => {
    try {
      const token = localStorage.getItem("token");
      const headers: HeadersInit = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      await fetch(`/api/history/${id}`, { method: "DELETE", headers });
      fetchMeAndStats();
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateApiKey = async (key: string) => {
    const token = localStorage.getItem("token");
    const headers: HeadersInit = { "Content-Type": "application/json" };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    const res = await fetch("/api/auth/update-key", {
      method: "POST",
      headers,
      body: JSON.stringify({ apiKey: key })
    });
    if (!res.ok) {
      throw new Error("Failed to configure secret key.");
    }
    fetchMeAndStats();
  };

  const navigationItems = [
    { id: "dashboard", label: "Dashboard", icon: BarChart },
    { id: "news", label: "AI Fake News", icon: FileText },
    { id: "website", label: "Website Scan", icon: Globe },
    { id: "image", label: "AI Image Unit", icon: Image },
    { id: "profile", label: "Social Persona", icon: User },
    { id: "plagiarism", label: "Plagiarism Unit", icon: Copy },
    { id: "chat", label: "AI Support Buddy", icon: MessageSquare },
    { id: "emergency", label: "Helpline Desk (IND)", icon: HelpCircle },
    { id: "profile-keys", label: "Settings & Trace", icon: Settings }
  ];

  const handleForgotPass = () => {
    alert("Instructions to reset your audit credentials have been dispatched to your email address.");
  };

  return (
    <div className="min-h-screen bg-slate-50/50 text-gray-800 flex flex-col font-sans">
      {/* Top sticky Navigation Header */}
      <Navbar 
        user={user} 
        onLogout={handleLogout} 
        onOpenAuth={() => {
          setIsRegister(false);
          setShowAuthModal(true);
        }}
      />

      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col lg:flex-row gap-6">
        
        {/* Dynamic Top Tabs / Left Rail Segment */}
        <aside className="lg:w-64 flex-shrink-0 flex flex-row lg:flex-col overflow-x-auto lg:overflow-visible gap-1.5 pb-2 lg:pb-0 border-b lg:border-b-0 border-gray-150">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`tab-btn-${item.id}`}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl font-medium text-xs whitespace-nowrap transition-all border outline-none ${
                  isActive
                    ? "bg-[#EFF6FF] border-[#EFF6FF] text-[#1D4ED8] lg:border-r-4 lg:border-r-[#3B82F6] lg:rounded-r-none lg:rounded-l-xl font-bold shadow-xs"
                    : "bg-white border-slate-100 text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <Icon className="h-4 w-4" />
                {t(`tabs.${item.id.replace("-", "_")}`)}
              </button>
            );
          })}
        </aside>

        {/* Primary View Area */}
        <main className="flex-1 min-w-0">
          <div className="bg-white/40 rounded-2xl">
            {activeTab === "dashboard" && (
              <DashboardView 
                stats={stats} 
                onSelectTab={setActiveTab} 
                onDeleteItem={handleDeleteHistory}
              />
            )}
            {activeTab === "news" && <NewsScanView />}
            {activeTab === "website" && <UrlScanView />}
            {activeTab === "image" && <ImageVerifyView />}
            {activeTab === "profile" && <ProfileVerifyView />}
            {activeTab === "plagiarism" && <PlagiarismView />}
            {activeTab === "chat" && <BuddyChatView />}
            {activeTab === "emergency" && <EmergencyCenterView />}
            {activeTab === "profile-keys" && (
              <UserProfileView 
                user={user} 
                history={history} 
                onDeleteHistory={handleDeleteHistory} 
              />
            )}
          </div>
        </main>
      </div>

      {/* FOOTER */}
      <footer className="bg-white border-t border-gray-100 py-6 text-center text-xs text-gray-400 mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 font-bold text-gray-800">
            <Shield className="h-4 w-4 text-blue-600" /> {t("footer.platform")}
          </div>
          <p className="font-medium">{t("footer.copyright")}</p>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-md border border-emerald-150">{t("footer.secure_shell")}</span>
          </div>
        </div>
      </footer>

      {/* AUTH DIALOG MODAL */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-gray-200 rounded-2xl max-w-sm w-full p-6 shadow-xl relative text-left">
            <h3 className="text-lg font-black text-gray-900 tracking-tight leading-none mb-1">
              {isRegister ? "Auditor Registration" : "Account Identity Verification"}
            </h3>
            <p className="text-gray-400 text-xs mb-4">
              Enter your credential parameters below to safely load your history profile.
            </p>

            <form onSubmit={handleAuth} className="space-y-3">
              {isRegister && (
                <div>
                  <label className="text-[10px] uppercase font-mono font-bold text-gray-400 block mb-1">Full Name</label>
                  <input
                    id="auth-name-input"
                    type="text"
                    required
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="e.g. Inspector Deshmukh"
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                  />
                </div>
              )}

              <div>
                <label className="text-[10px] uppercase font-mono font-bold text-gray-400 block mb-1">E-mail Address</label>
                <div className="relative">
                  <input
                    id="auth-email-input"
                    type="email"
                    required
                    className="w-full border border-gray-200 rounded-xl pl-8 pr-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="name@verifyx.org"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                  />
                  <div className="absolute left-2.5 top-2.5 text-gray-400">
                    <Mail className="h-3.5 w-3.5" />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase font-mono font-bold text-gray-400 block mb-1">Passphrase</label>
                <div className="relative">
                  <input
                    id="auth-password-input"
                    type={showPassword ? "text" : "password"}
                    required
                    className="w-full border border-gray-200 rounded-xl pl-8 pr-10 py-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                    placeholder="••••••••••••"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                  />
                  <div className="absolute left-2.5 top-2.5 text-gray-400">
                    <Lock className="h-3.5 w-3.5" />
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              {/* Remember Me & Forgot Password option rows */}
              <div className="flex items-center justify-between text-[11px] font-semibold text-gray-500 py-1">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={rememberMe} 
                    onChange={() => setRememberMe(!rememberMe)} 
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" 
                  />
                  Remember Me
                </label>
                <button 
                  type="button" 
                  id="forgot-password-trigger"
                  onClick={handleForgotPass} 
                  className="text-blue-500 hover:underline"
                >
                  Forgot Passcode?
                </button>
              </div>

              {authError && <p className="text-red-500 text-[11px] font-semibold">{authError}</p>}

              <button
                type="submit"
                id="submit-auth-form-btn"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs py-2.5 rounded-xl transition-all shadow-sm"
              >
                {isRegister ? "Initiate Identity Registration" : "Authenticate Signature"}
              </button>
            </form>

            <div className="mt-4 pt-3 border-t border-gray-100 text-center">
              <button
                type="button"
                id="toggle-auth-mode-btn"
                onClick={() => {
                  setIsRegister(!isRegister);
                  setAuthError("");
                }}
                className="text-xs font-semibold text-blue-600 hover:underline"
              >
                {isRegister ? "Already registered? Login here" : "Create new auditor credentials"}
              </button>
            </div>

            <button
              onClick={() => setShowAuthModal(false)}
              className="absolute right-3 top-3 text-gray-400 hover:text-gray-700 font-mono text-sm"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
