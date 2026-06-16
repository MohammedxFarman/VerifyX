import { ShieldAlert, Activity, CheckCircle, Clock, Trash2, ArrowRight, Share2, Award, Zap } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useTranslation } from "react-i18next";
import { DashboardStats } from "../types";

interface DashboardViewProps {
  stats: DashboardStats;
  onSelectTab: (tab: string) => void;
  onDeleteItem: (id: string) => void;
}

export default function DashboardView({ stats, onSelectTab, onDeleteItem }: DashboardViewProps) {
  const { t } = useTranslation();
  const latestScans = stats.recentVerifications || [];

  return (
    <div className="space-y-6">
      {/* Banner Card */}
      <div className="trust-gradient text-white rounded-3xl p-8 relative overflow-hidden shadow-lg shadow-blue-250/20">
        <div className="max-w-2xl relative z-10">
          <div className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-md text-white text-[10px] font-mono px-3 py-1 rounded-full font-bold mb-4 tracking-wider uppercase">
            <Zap className="h-3 w-3" /> {t("dashboard.enterprise_public_trust")}
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight leading-tight">
            {t("dashboard.title")}
          </h1>
          <p className="text-blue-50 mt-2.5 text-xs md:text-sm max-w-lg leading-relaxed">
            {t("dashboard.description")}
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              id="dash-launch-news-btn"
              onClick={() => onSelectTab('news')}
              className="bg-white text-blue-700 hover:bg-slate-50 font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-md shadow-black/5 hover:-translate-y-[0.5px] cursor-pointer"
            >
              {t("dashboard.check_news")}
            </button>
            <button
              id="dash-launch-url-btn"
              onClick={() => onSelectTab('website')}
              className="bg-white/10 hover:bg-white/18 text-white border border-white/20 font-bold text-xs px-5 py-2.5 rounded-xl transition-all hover:-translate-y-[0.5px] cursor-pointer"
            >
              {t("dashboard.scan_scams")}
            </button>
          </div>
        </div>

        {/* Floating visual balance node */}
        <div className="absolute right-0 bottom-0 top-0 w-1/3 opacity-15 pointer-events-none hidden md:block">
          <svg viewBox="0 0 100 100" className="h-full w-full stroke-white stroke-1 fill-none">
            <circle cx="50" cy="50" r="30" />
            <circle cx="50" cy="50" r="45" className="animate-pulse" />
            <line x1="10" y1="50" x2="90" y2="50" />
            <line x1="50" y1="10" x2="50" y2="90" />
          </svg>
        </div>
      </div>

      {/* Grid of Micro-KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs flex items-center justify-between hover:border-slate-200/80 transition-all">
          <div>
            <span className="text-[10px] font-bold text-slate-400 font-mono tracking-wider block">{t("dashboard.kpi_scans")}</span>
            <span className="text-3xl font-extrabold text-slate-900 leading-none mt-1.5 inline-block">{stats.totalVerifications}</span>
          </div>
          <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100/60 shadow-xs">
            <Activity className="h-5 w-5" />
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs flex items-center justify-between hover:border-slate-200/80 transition-all">
          <div>
            <span className="text-[10px] font-bold text-slate-400 font-mono tracking-wider block">{t("dashboard.kpi_trust_value")}</span>
            <span className="text-3xl font-extrabold text-slate-900 leading-none mt-1.5 inline-block">{stats.trustScoreAvg}/100</span>
          </div>
          <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100/60 shadow-xs">
            <Award className="h-5 w-5" />
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs flex items-center justify-between hover:border-slate-200/80 transition-all">
          <div>
            <span className="text-[10px] font-bold text-slate-400 font-mono tracking-wider block">{t("dashboard.kpi_detected_threats")}</span>
            <span className="text-2xl font-extrabold text-slate-900 leading-tight mt-1.5 inline-block">
              {stats.recentVerifications.filter(h => h.riskLevel === 'HIGH').length} {t("dashboard.kpi_actionable")}
            </span>
          </div>
          <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100/60 shadow-xs">
            <ShieldAlert className="h-5 w-5" />
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs flex items-center justify-between hover:border-slate-200/80 transition-all">
          <div>
            <span className="text-[10px] font-bold text-slate-400 font-mono tracking-wider block">{t("dashboard.kpi_telemetry")}</span>
            <span className="text-3xl font-extrabold text-blue-600 leading-none mt-1.5 inline-block">{t("dashboard.kpi_active")}</span>
          </div>
          <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center border border-blue-100/60 shadow-xs">
            <CheckCircle className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Visual Charts Block using Recharts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly Scan Velocity */}
        <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-xs lg:col-span-2">
          <h3 className="text-xs font-bold text-slate-900 tracking-wider font-mono uppercase mb-4 text-left">
            {t("dashboard.trends_title")}
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.trends}>
                <defs>
                  <linearGradient id="colorTrust" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorScam" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f8fafc" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #f1f5f9', fontFamily: 'Inter', fontSize: '11px' }} />
                <Area type="monotone" dataKey="Trust" stroke="#2563eb" strokeWidth={2} fillOpacity={1} fill="url(#colorTrust)" name="Trust Index" />
                <Area type="monotone" dataKey="Scams" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorScam)" name="Threat Counters" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Verified Classifications via PieChart */}
        <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <h3 className="text-xs font-bold text-slate-900 tracking-wider font-mono uppercase mb-4 text-left">
            {t("dashboard.distribution_title")}
          </h3>
          <div className="h-44 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.byRisk}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={75}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {stats.byRisk.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1.5 mt-4">
            {stats.byRisk.map((risk, idx) => (
              <div key={idx} className="flex items-center justify-between text-[11px] text-slate-600 border-t border-slate-50 pt-1.5 first:border-0 first:pt-0">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full inline-block" style={{ backgroundColor: risk.color }}></span>
                  <span className="font-semibold">{risk.name}</span>
                </div>
                <span className="font-mono text-slate-400 font-bold">{risk.value} files</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recents audit logs */}
      <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-xs">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-4">
          <div>
            <h3 className="text-sm font-bold text-gray-900 tracking-tight font-mono uppercase">
              {t("dashboard.recent_audit_logs")}
            </h3>
            <p className="text-xs text-gray-400">{t("dashboard.recent_desc")}</p>
          </div>
        </div>

        {latestScans.length === 0 ? (
          <div className="text-center py-10">
            <div className="h-12 w-12 rounded-xl bg-gray-50 flex items-center justify-center text-gray-300 mx-auto border border-gray-100">
              <Clock className="h-6 w-6" />
            </div>
            <p className="text-sm text-gray-500 font-semibold mt-3">No scans saved yet</p>
            <p className="text-xs text-gray-400 mt-1">Upload an image or paste a message above to verify.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 whitespace-nowrap text-left text-sm">
              <thead>
                <tr className="text-xs font-mono text-gray-400 uppercase">
                  <th className="py-2.5 px-4 font-bold">DATE</th>
                  <th className="py-2.5 px-4 font-bold">TYPE</th>
                  <th className="py-2.5 px-4 font-bold">TARGET DATA / DETAILS</th>
                  <th className="py-2.5 px-4 font-bold">TRUST INDEX</th>
                  <th className="py-2.5 px-4 font-bold text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-gray-700">
                {latestScans.map((scan) => (
                  <tr key={scan.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 font-mono text-xs text-gray-400">
                      {new Date(scan.timestamp).toLocaleDateString()} {new Date(scan.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-3 px-4 uppercase text-xs font-semibold">
                      <span className={`px-2 py-0.5 rounded-md ${
                        scan.type === 'news' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' :
                        scan.type === 'website' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                        scan.type === 'image' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                        'bg-teal-50 text-teal-700 border border-teal-100'
                      }`}>
                        {scan.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 max-w-[280px] truncate">
                      <div className="font-semibold text-gray-800 truncate">{scan.title}</div>
                      <div className="text-xs text-gray-400 truncate mt-0.5">{scan.target}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className={`inline-block h-2 w-2 rounded-full ${
                          scan.score < 40 ? 'bg-red-500' : scan.score < 75 ? 'bg-amber-500' : 'bg-green-500'
                        }`}></span>
                        <span className="font-mono font-bold text-sm text-gray-800">{scan.score}/100</span>
                        <span className="text-xs font-mono font-bold text-gray-400">({scan.riskLevel})</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        id={`delete-history-${scan.id}`}
                        onClick={() => onDeleteItem(scan.id)}
                        className="text-gray-400 hover:text-red-500 px-2 py-1.5 transition-colors inline-block"
                        title="Delete Trace"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
