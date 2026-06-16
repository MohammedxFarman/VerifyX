import { User, Clock, Trash2, Award } from "lucide-react";
import { VerificationHistory } from "../types";

interface UserProfileViewProps {
  user: any;
  history: VerificationHistory[];
  onDeleteHistory: (id: string) => void;
}

export default function UserProfileView({ user, history, onDeleteHistory }: UserProfileViewProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-left">
      {/* Settings inputs left side */}
      <div className="lg:col-span-1 space-y-4">
        {/* Profile Card */}
        <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
              <User className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-800 tracking-tight leading-none text-base">{user?.fullName || "Guest Auditor"}</h3>
              <p className="text-xs text-slate-400 mt-1">{user?.email || "guest@verifyx.org"}</p>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-bold font-mono tracking-wider">
            <span>AUDITOR INTEGRITY ROLE</span>
            <span className="font-bold text-blue-600 uppercase flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100/40">
              <Award className="h-3.5 w-3.5" /> SECURE ROOT
            </span>
          </div>
        </div>
      </div>

      {/* History trace trace right side */}
      <div className="lg:col-span-2">
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xs">
          <h3 className="text-sm font-bold text-gray-900 font-mono uppercase tracking-wider mb-4 text-left">
            Saved Reports & Audit Timeline
          </h3>

          {history.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Clock className="h-10 w-10 mx-auto text-gray-300 mb-3" />
              <p className="text-sm font-semibold text-gray-500">No trace history saved</p>
              <p className="text-xs text-gray-400 mt-1">Select check views above to record logs.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((record) => (
                <div key={record.id} className="border border-gray-150 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-gray-300 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-lg bg-slate-50 border border-gray-100 flex items-center justify-center text-slate-500 flex-shrink-0 mt-0.5">
                      <Clock className="h-4 w-4 text-slate-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-800 text-sm leading-tight">{record.title}</span>
                        <span className={`text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded-md ${
                          record.riskLevel === 'HIGH' ? 'bg-red-50 text-red-600 border border-red-100' :
                          record.riskLevel === 'MEDIUM' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                          'bg-green-50 text-green-600 border border-green-100'
                        }`}>
                          {record.riskLevel}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 font-medium mt-1">Audit target: {record.target}</p>
                      <span className="text-[10px] text-gray-400 font-mono tracking-tight block mt-1">
                        {new Date(record.timestamp).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <span className="font-mono text-xs font-black text-gray-600 bg-slate-50 px-2.5 py-1 rounded-lg border border-gray-150">
                      INDEX {record.score}/100
                    </span>
                    <button
                      id={`delete-prof-history-${record.id}`}
                      onClick={() => onDeleteHistory(record.id)}
                      className="text-gray-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                      title="Delete log"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
