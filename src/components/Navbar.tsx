import { Shield, User, LogOut, LogIn, AlertCircle, Globe } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

interface NavbarProps {
  user: any;
  onLogout: () => void;
  onOpenAuth: () => void;
}

export default function Navbar({ user, onLogout, onOpenAuth }: NavbarProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const { t, i18n } = useTranslation();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  return (
    <nav className="bg-white/85 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl trust-gradient flex items-center justify-center text-white shadow-md shadow-blue-200/50">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <span className="font-extrabold text-xl text-slate-900 tracking-tight">Verify<span className="text-blue-600">X</span></span>
                <p className="text-[9px] text-slate-400 font-mono tracking-wider uppercase -mt-0.5 font-bold">{t("nav.digital_trust_core")}</p>
              </div>
            </div>
          </div>

          {/* Quick Stats or Profile details */}
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-1.5 text-[10px] font-bold font-mono text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200/60 shadow-xs">
              <span className="inline-block h-1.5 w-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
              {t("nav.cyber_safety_portal_live")}
            </div>

            {/* Language Switcher */}
            <div className="flex items-center gap-1 bg-slate-100/80 border border-slate-200/60 rounded-xl p-1 ml-1 shadow-xs">
              <Globe className="h-3.5 w-3.5 text-slate-400 ml-1 block" />
              <div className="flex items-center bg-white/60 rounded-lg p-0.5 border border-slate-150/40">
                <button
                  id="lang-btn-en"
                  onClick={() => changeLanguage("en")}
                  className={`px-2 py-0.5 text-[9px] font-bold rounded-md transition-all cursor-pointer ${
                    i18n.language === "en"
                      ? "bg-white text-blue-600 shadow-xs"
                      : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  EN
                </button>
                <button
                  id="lang-btn-hi"
                  onClick={() => changeLanguage("hi")}
                  className={`px-2 py-0.5 text-[9px] font-bold rounded-md transition-all cursor-pointer ${
                    i18n.language === "hi"
                      ? "bg-white text-blue-600 shadow-xs"
                      : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  हिन्दी
                </button>
              </div>
            </div>

            {user ? (
              <div className="relative">
                <button
                  id="user-profile-menu-btn"
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-full px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors focus:outline-none"
                >
                  <User className="h-3.5 w-3.5 text-slate-500" />
                  <span className="max-w-[100px] truncate">{user.fullName}</span>
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white border border-slate-200 shadow-xl py-1.5 z-50 text-xs">
                    <div className="px-4 py-2.5 border-b border-slate-100">
                      <p className="font-bold text-slate-900 truncate">{user.fullName}</p>
                      <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
                    </div>
                    
                    <button
                      id="nav-logout-btn"
                      onClick={() => {
                        onLogout();
                        setDropdownOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-red-50 flex items-center gap-2 text-red-600 transition-colors"
                    >
                      <LogOut className="h-4 w-4 text-red-400" />
                      {t("nav.logout")}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                id="get-started-nav-btn"
                onClick={onOpenAuth}
                className="flex items-center gap-2 trust-gradient hover:opacity-95 text-white rounded-xl px-4 py-2 font-bold text-xs transition-all shadow-md shadow-blue-200/50 hover:-translate-y-[1px]"
              >
                <LogIn className="h-3.5 w-3.5" />
                {t("nav.get_started")}
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
