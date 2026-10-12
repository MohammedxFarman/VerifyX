import { FileCheck2, Info, Download, ExternalLink } from "lucide-react";
import type { EvidenceReport } from "../shared/report";
export const humanize = (value: string) => value.replaceAll("_", " ");
export default function EvidenceView({ report }: { report: EvidenceReport }) {
  const download = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "verifyx-" + report.id + ".json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <section
      className="space-y-5"
      aria-label="Evidence report"
      aria-live="polite"
    >
      <div className="panel border-blue-100 bg-blue-50/50">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">
              Overall assessment · {humanize(report.status)}
            </p>
            <h2 className="text-2xl font-semibold mt-2 capitalize">
              {humanize(report.assessment)}
            </h2>
          </div>
          <FileCheck2 className="text-blue-600 shrink-0" />
        </div>
        <p className="mt-3 text-slate-700 leading-relaxed">{report.summary}</p>
        <p className="text-xs text-slate-500 mt-4">
          {new Date(report.createdAt).toLocaleString()} · No combined
          authenticity score
        </p>
      </div>
      {Object.entries(report.analysis).map(([name, check]) => (
        <article className="panel" key={name}>
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold capitalize">{humanize(name)}</h3>
            <span
              className={
                "status " + (check.status === "failed" ? "status-error" : "")
              }
            >
              {humanize(check.status)}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-2">Method: {check.method}</p>
          <ul className="mt-4 space-y-2 text-sm text-slate-700">
            {check.findings.map((f, i) => (
              <li key={i} className="leading-relaxed whitespace-pre-wrap">
                {f}
              </li>
            ))}
          </ul>
          {check.score !== null && (
            <div className="mt-4 text-sm">
              <strong>
                {(check.score * 100).toFixed(1)}% measured overlap / model
                output
              </strong>
              <p className="text-slate-600">
                {check.scoreMeaning ||
                  "Raw output; not a calibrated confidence probability."}
              </p>
            </div>
          )}
          {check.measurements && (
            <dl className="mt-4 grid gap-x-5 gap-y-3 sm:grid-cols-2 border-t border-slate-100 pt-4">
              {Object.entries(check.measurements).map(([key, value]) => (
                <div key={key} className="min-w-0">
                  <dt className="text-xs text-slate-500">{key}</dt>
                  <dd className="text-sm break-all mt-1">
                    {value === null ? "Not recorded" : String(value)}
                  </dd>
                </div>
              ))}
            </dl>
          )}
          {check.localizationAvailable === false && (
            <p className="mt-3 text-xs text-slate-500">
              No localization model is available. No mask or overlay was
              generated.
            </p>
          )}
        </article>
      ))}
      {!!report.sources.length && (
        <div className="panel">
          <h3 className="font-semibold">Retrieved sources</h3>
          <div className="space-y-5 mt-4">
            {report.sources.map((s, i) => (
              <article key={i}>
                <span className="status">{humanize(s.retrieval)}</span>
                {/^https?:\/\//i.test(s.url) ? (
                  <a
                    className="mt-2 block text-blue-700 font-medium break-words"
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {s.title} <ExternalLink className="inline h-3 w-3" />
                  </a>
                ) : (
                  <p>{s.title}</p>
                )}
                <p className="text-sm text-slate-600 mt-2 whitespace-pre-wrap">
                  {s.excerpt}
                </p>
              </article>
            ))}
          </div>
        </div>
      )}
      {!!report.limitations.length && (
        <div className="panel bg-slate-50">
          <h3 className="font-semibold flex gap-2 items-center">
            <Info className="h-4 w-4" /> Limitations
          </h3>
          <ul className="list-disc pl-5 mt-3 space-y-2 text-sm text-slate-600">
            {report.limitations.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>
      )}
      <button className="button-secondary" onClick={download}>
        <Download className="h-4 w-4" /> Download evidence JSON
      </button>
    </section>
  );
}
