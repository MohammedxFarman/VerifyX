import type { FormEvent } from "react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  FileImage,
  FileText,
  Globe,
  User,
  Copy,
  MessageSquare,
  HelpCircle,
  Settings,
  PenLine,
  Loader2,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import Navbar from "./components/Navbar";
import { api, ensureSession, resetSession } from "./lib/api";
import type {
  DashboardStats,
  User as Account,
  VerificationHistory,
} from "./types";
const DashboardView = lazy(() => import("./components/DashboardView"));
const ImageVerifyView = lazy(() => import("./components/ImageVerifyView"));
const NewsScanView = lazy(() => import("./components/NewsScanView"));
const UrlScanView = lazy(() => import("./components/UrlScanView"));
const ProfileVerifyView = lazy(() => import("./components/ProfileVerifyView"));
const PlagiarismView = lazy(() => import("./components/PlagiarismView"));
const AiContentView = lazy(() => import("./components/AiContentView"));
const BuddyChatView = lazy(() => import("./components/BuddyChatView"));
const EmergencyCenterView = lazy(
  () => import("./components/EmergencyCenterView"),
);
const UserProfileView = lazy(() => import("./components/UserProfileView"));
const empty: DashboardStats = {
  totalVerifications: 0,
  partial: 0,
  inconclusive: 0,
  pending: 0,
  recentVerifications: [],
  byType: [],
  trends: [],
};
export default function App() {
  const { t } = useTranslation();
  const [tab, setTab] = useState("dashboard"),
    [user, setUser] = useState<Account | null>(null),
    [stats, setStats] = useState(empty),
    [history, setHistory] = useState<VerificationHistory[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [register, setRegister] = useState(false),
    [authError, setAuthError] = useState(""),
    [authBusy, setAuthBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null),
    generation = useRef(0);
  async function refresh() {
    const n = ++generation.current;
    try {
      await ensureSession();
      const [me, s, h] = await Promise.all([
        api<{ user: Account }>("/api/auth/me"),
        api<DashboardStats>("/api/dashboard/stats"),
        api<VerificationHistory[]>("/api/history"),
      ]);
      if (n === generation.current) {
        setUser(me.user);
        setStats(s);
        setHistory(h);
        setError("");
      }
    } catch (e) {
      if (n === generation.current)
        setError(e instanceof Error ? e.message : "Unable to load workspace.");
    } finally {
      if (n === generation.current) setLoading(false);
    }
  }
  useEffect(() => {
    void refresh();
    const listener = () => void refresh();
    window.addEventListener("verifyx-history", listener);
    return () => {
      generation.current++;
      window.removeEventListener("verifyx-history", listener);
    };
  }, []);
  async function logout() {
    try {
      const r = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!r.ok) throw new Error("Unable to clear session.");
      resetSession();
      setUser(null);
      setStats(empty);
      setHistory([]);
      setTab("dashboard");
      setLoading(true);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function authenticate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAuthBusy(true);
    setAuthError("");
    const fields = new FormData(e.currentTarget);
    try {
      await api("/api/auth/" + (register ? "register" : "login"), {
        method: "POST",
        body: JSON.stringify({
          email: fields.get("email"),
          password: fields.get("password"),
          fullName: fields.get("fullName"),
        }),
      });
      resetSession();
      dialog.current?.close();
      setStats(empty);
      setHistory([]);
      setTab("dashboard");
      await refresh();
    } catch (e) {
      setAuthError((e as Error).message);
    } finally {
      setAuthBusy(false);
    }
  }
  const nav = [
    { id: "dashboard", title: "Overview", Icon: LayoutDashboard },
    { id: "image", title: "Image evidence", Icon: FileImage },
    { id: "news", title: "Claim review", Icon: FileText },
    { id: "website", title: "Website checks", Icon: Globe },
    { id: "profile", title: "Social profiles", Icon: User },
    { id: "plagiarism", title: "Text comparison", Icon: Copy },
    { id: "ai-content", title: "AI writing", Icon: PenLine },
    { id: "chat", title: "Safety assistant", Icon: MessageSquare },
    { id: "emergency", title: "Helpline desk", Icon: HelpCircle },
    { id: "profile-keys", title: "History & settings", Icon: Settings },
  ];
  return (
    <div className="min-h-screen">
      <a className="sr-only focus:not-sr-only focus:block p-3" href="#main">
        Skip to main content
      </a>
      <Navbar
        user={user?.isGuest ? null : user}
        onLogout={() => void logout()}
        onOpenAuth={() => {
          setAuthError("");
          dialog.current?.showModal();
        }}
      />
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:flex gap-8">
        <aside className="lg:w-52 shrink-0">
          <p className="eyebrow hidden lg:block px-3 mb-4">Your workspace</p>
          <nav
            aria-label="Main navigation"
            className="flex lg:flex-col gap-1.5 overflow-x-auto pb-4 lg:pb-0"
          >
            {nav.map(({ id, title, Icon }) => (
              <button
                key={id}
                id={"tab-btn-" + id}
                onClick={() => setTab(id)}
                aria-current={tab === id ? "page" : undefined}
                className={
                  "flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm text-left whitespace-nowrap transition-colors " +
                  (tab === id
                    ? "bg-blue-50 text-blue-700 font-semibold"
                    : "text-slate-600 hover:bg-white")
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                {title}
              </button>
            ))}
          </nav>
          <div className="hidden lg:block text-xs leading-relaxed text-slate-500 px-3 mt-8 border-t border-slate-200 pt-5">
            Evidence first.
            <br />
            Uncertainty made visible.
          </div>
        </aside>
        <main id="main" className="min-w-0 flex-1">
          {error && (
            <div
              className="panel border-amber-200 bg-amber-50 mb-5"
              role="alert"
            >
              <p>{error}</p>
              <div className="flex gap-3 mt-3">
                <button
                  className="button-secondary"
                  onClick={() => void refresh()}
                >
                  Retry
                </button>
                <button
                  className="button-secondary"
                  onClick={() => void logout()}
                >
                  Reset session
                </button>
              </div>
            </div>
          )}
          {loading ? (
            <div className="panel text-center py-20" role="status">
              <Loader2 className="animate-spin mx-auto text-blue-600" />
              <p className="mt-4">Connecting to your workspace…</p>
              <p className="text-sm text-slate-500 mt-2">
                An idle hosting service may need time to wake.
              </p>
            </div>
          ) : (
            <Suspense
              fallback={
                <div className="panel" role="status">
                  Loading workspace…
                </div>
              }
            >
              <div key={user?.id || "guest"}>
                {tab === "dashboard" && (
                  <DashboardView stats={stats} onSelectTab={setTab} />
                )}{" "}
                {tab === "image" && <ImageVerifyView />}
                {tab === "news" && <NewsScanView />}
                {tab === "website" && <UrlScanView />}
                {tab === "profile" && <ProfileVerifyView />}
                {tab === "plagiarism" && <PlagiarismView />}
                {tab === "ai-content" && <AiContentView />}
                {tab === "chat" && <BuddyChatView />}
                {tab === "emergency" && <EmergencyCenterView />}
                {tab === "profile-keys" && (
                  <UserProfileView
                    user={user}
                    history={history}
                    onDeleteHistory={async (id) => {
                      try {
                        await api("/api/history/" + id, { method: "DELETE" });
                        await refresh();
                      } catch (e) {
                        setError((e as Error).message);
                      }
                    }}
                  />
                )}
              </div>
            </Suspense>
          )}
        </main>
      </div>
      <footer className="max-w-[1440px] mx-auto px-8 py-8 text-xs text-slate-500 border-t border-slate-200">
        VerifyX · Verification tools with transparent evidence and limitations.
        No automated result is proof of authenticity.
      </footer>
      <dialog
        ref={dialog}
        className="rounded-2xl p-0 w-[min(440px,calc(100%-32px))] backdrop:bg-slate-900/30"
      >
        <div className="p-7">
          <div className="flex justify-between gap-3 items-center">
            <h2 className="text-xl font-semibold">
              {register ? "Create your account" : "Welcome back"}
            </h2>
            <button
              aria-label="Close sign in"
              className="p-2"
              onClick={() => dialog.current?.close()}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="text-sm text-slate-500 mt-2">
            Save reports in your own private workspace.
          </p>
          <form className="space-y-4 mt-6" onSubmit={authenticate}>
            {register && (
              <label className="field-label">
                Full name
                <input
                  name="fullName"
                  className="field mt-2"
                  required
                  maxLength={100}
                  autoComplete="name"
                />
              </label>
            )}
            <label className="field-label">
              Email
              <input
                name="email"
                className="field mt-2"
                type="email"
                required
                autoComplete="email"
              />
            </label>
            <label className="field-label">
              Password
              <input
                name="password"
                className="field mt-2"
                type="password"
                required
                minLength={register ? 12 : 1}
                maxLength={72}
                autoComplete={register ? "new-password" : "current-password"}
              />
            </label>
            {register && (
              <p className="text-xs text-slate-500">
                Use at least 12 characters. Guest history is separate from
                account history.
              </p>
            )}
            {authError && (
              <p className="text-sm text-red-700" role="alert">
                {authError}
              </p>
            )}
            <button
              className="button-primary w-full justify-center"
              disabled={authBusy}
            >
              {authBusy
                ? "Please wait…"
                : register
                  ? "Create account"
                  : "Sign in"}
            </button>
          </form>
          <button
            className="text-sm text-blue-700 mt-5"
            onClick={() => {
              setRegister(!register);
              setAuthError("");
            }}
          >
            {register ? "Already registered? Sign in" : "Create an account"}
          </button>
          <p className="text-xs text-slate-500 mt-4">
            Email password recovery is not configured. No reset emails can be
            sent.
          </p>
        </div>
      </dialog>
    </div>
  );
}
