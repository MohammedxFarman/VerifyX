import { useEffect, useState } from "react";
import { Trash2, ChevronDown } from "lucide-react";
import type { User, VerificationHistory } from "../types";
import { api } from "../lib/api";
import EvidenceView from "./EvidenceView";
export default function UserProfileView({
  user,
  history,
  onDeleteHistory,
}: {
  user: User | null;
  history: VerificationHistory[];
  onDeleteHistory: (id: string) => void;
}) {
  const [cap, setCap] = useState<Record<string, unknown>>({}),
    [error, setError] = useState("");
  useEffect(() => {
    const c = new AbortController();
    api<Record<string, unknown>>("/api/capabilities", { signal: c.signal })
      .then(setCap)
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, []);
  return (
    <div className="space-y-6">
      <section className="panel">
        <p className="eyebrow">Workspace settings</p>
        <h1 className="page-title">Account & history</h1>
        <p className="description">
          {user?.fullName || "Guest"}
          {user?.email ? " · " + user.email : " · Isolated guest session"}
        </p>
        <p className="text-sm text-slate-600 mt-4">
          Guest reports expire after 24 hours. Registered reports remain until
          deleted. Provider keys are configured on the server and are never
          shown here.
        </p>
      </section>
      <section className="panel">
        <h2 className="font-semibold">Available capabilities</h2>
        {error && <p role="alert">{error}</p>}
        <dl className="grid sm:grid-cols-2 gap-3 mt-4">
          {Object.entries(cap).map(([key, value]) => (
            <div
              key={key}
              className="flex justify-between gap-3 text-sm border-b border-slate-100 py-2"
            >
              <dt>{key.replace(/([A-Z])/g, " $1")}</dt>
              <dd className="text-slate-500">
                {typeof value === "boolean"
                  ? value
                    ? "Available"
                    : "Not configured"
                  : String(value)}
              </dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="panel">
        <h2 className="font-semibold text-lg">Saved reports</h2>
        {history.length ? (
          <div className="space-y-4 mt-4">
            {history.map((r) => (
              <details
                className="border border-slate-200 rounded-xl p-4"
                key={r.id}
              >
                <summary className="cursor-pointer flex flex-wrap items-center gap-3">
                  <ChevronDown className="w-4 h-4" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium capitalize">
                      {r.type} report
                    </span>
                    <span className="block text-xs text-slate-500 mt-1">
                      {new Date(r.timestamp).toLocaleString()}
                    </span>
                  </span>
                  <span className="status">
                    {r.status === "completed" ? r.report?.status : r.status}
                  </span>
                </summary>
                <p className="text-sm text-slate-500 break-words mt-4 mb-4">
                  {r.target}
                </p>
                {r.report && <EvidenceView report={r.report} />}{" "}
                {r.error && <p role="alert">{r.error}</p>}
                <button
                  disabled={["processing", "queued"].includes(r.status)}
                  className="button-secondary mt-4 text-red-700"
                  onClick={() => onDeleteHistory(r.id)}
                >
                  <Trash2 className="h-4 w-4" /> Delete report
                </button>
              </details>
            ))}
          </div>
        ) : (
          <p className="text-slate-500 py-8">
            No reports saved in this session.
          </p>
        )}
      </section>
    </div>
  );
}
