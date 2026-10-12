import {
  ArrowUpRight,
  FileImage,
  Globe,
  FileText,
  Clock,
  ArrowRight,
} from "lucide-react";
import type { DashboardStats } from "../types";
import { humanize } from "./EvidenceView";
export default function DashboardView({
  stats,
  onSelectTab,
}: {
  stats: DashboardStats;
  onSelectTab: (id: string) => void;
  onDeleteItem?: (id: string) => void;
}) {
  return (
    <div className="space-y-6">
      <section className="panel bg-white relative overflow-hidden">
        <p className="eyebrow">Verify Everything. Trust Confidently.</p>
        <h1 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight max-w-xl leading-tight">
          Look closer.
          <br />
          <span className="text-blue-600">Understand the evidence.</span>
        </h1>
        <p className="description max-w-xl mt-4">
          A workspace for image forensics, source review and website checks. See
          what was measured, what is missing and where uncertainty remains.
        </p>
        <button
          className="button-primary mt-6"
          onClick={() => onSelectTab("image")}
        >
          Inspect an image <ArrowRight className="h-4 w-4" />
        </button>
      </section>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          [stats.totalVerifications, "Reports with measured checks"],
          [stats.partial, "Partial analyses"],
          [stats.inconclusive, "Inconclusive assessments"],
          [stats.pending, "Processing now"],
        ].map(([value, label]) => (
          <div className="panel !p-5" key={label}>
            <p className="text-3xl font-semibold tabular-nums">{value}</p>
            <p className="text-xs text-slate-600 mt-2">{label}</p>
          </div>
        ))}
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        {[
          {
            id: "image",
            title: "Image evidence",
            text: "Original metadata and forensic diagnostics",
            Icon: FileImage,
          },
          {
            id: "news",
            title: "Claim review",
            text: "Source retrieval and transparent limitations",
            Icon: FileText,
          },
          {
            id: "website",
            title: "Website checks",
            text: "DNS, connection and certificate observations",
            Icon: Globe,
          },
        ].map(({ id, title, text, Icon }) => (
          <button
            key={id}
            onClick={() => onSelectTab(id)}
            className="panel text-left hover:border-blue-300 transition-colors"
          >
            <div className="flex justify-between">
              <Icon className="text-blue-600 h-6 w-6" />
              <ArrowUpRight className="h-4 w-4 text-slate-400" />
            </div>
            <h2 className="font-semibold mt-5">{title}</h2>
            <p className="text-sm text-slate-500 mt-2">{text}</p>
          </button>
        ))}
      </div>
      <section className="panel">
        <div className="flex justify-between items-center">
          <h2 className="font-semibold text-lg">Recent activity</h2>
          <button
            className="text-blue-700 text-sm"
            onClick={() => onSelectTab("profile-keys")}
          >
            View history →
          </button>
        </div>
        {stats.recentVerifications.length ? (
          <ul className="divide-y divide-slate-100 mt-4">
            {stats.recentVerifications.map((r) => (
              <li key={r.id} className="py-4 flex gap-3 items-start">
                <Clock className="w-4 h-4 text-slate-400 mt-1" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm capitalize">
                    {humanize(r.type)} check
                  </p>
                  <p className="text-sm text-slate-500 truncate mt-1">
                    {r.target}
                  </p>
                </div>
                <span className="status">
                  {r.status === "completed" ? r.report?.status : r.status}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="py-10 text-center text-slate-500">
            <Clock className="mx-auto h-7 w-7 text-slate-300" />
            <p className="mt-3">Your first report will appear here.</p>
            <p className="text-sm mt-1">Only your own activity is shown.</p>
          </div>
        )}
      </section>
      <section className="panel">
        <h2 className="font-semibold">Last seven days</h2>
        <p className="text-xs text-slate-500 mt-1">
          UTC · reports with completed or partial measured checks
        </p>
        <div className="grid grid-cols-7 gap-2 mt-5">
          {stats.trends.map((day) => (
            <div key={day.date} className="text-center">
              <div className="h-16 flex items-end justify-center">
                <div
                  className="w-6 rounded-t bg-blue-200"
                  style={{
                    height: day.count
                      ? Math.max(
                          8,
                          (day.count /
                            Math.max(...stats.trends.map((d) => d.count), 1)) *
                            64,
                        )
                      : 0,
                  }}
                />
              </div>
              <p className="text-xs mt-2">{day.count}</p>
              <p className="text-[10px] text-slate-500 mt-1">
                {day.date.slice(5)}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
