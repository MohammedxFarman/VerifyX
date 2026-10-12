import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { Loader2, ArrowRight, Search } from "lucide-react";
import { api, historyChanged } from "../lib/api";
import { reportSchema, type EvidenceReport } from "../shared/report";
import EvidenceView from "./EvidenceView";
const copy = {
  news: {
    title: "Claim & source review",
    description:
      "Retrieve relevant sources when search is configured. Read the evidence and distinguish source material from AI interpretation.",
    label: "Claim to investigate",
    placeholder: "Enter a specific claim, including names, dates and context.",
  },
  url: {
    title: "Website checks",
    description:
      "Inspect public DNS, HTTP responses and TLS. A successful connection does not mean a website is safe.",
    label: "Website URL",
    placeholder: "https://example.org",
  },
  profile: {
    title: "Social profile review",
    description:
      "Profile analysis requires authorized platform data. We never infer followers or engagement from a username.",
    label: "Profile handle",
    placeholder: "Enter a username",
  },
  plagiarism: {
    title: "Document comparison",
    description:
      "Compare your text with a supplied reference using exact five-word overlap. Matches are evidence of similarity, not proof of plagiarism.",
    label: "Your text",
    placeholder: "Paste the text you want to compare.",
  },
  "ai-content": {
    title: "AI-writing assessment",
    description:
      "Authorship cannot be reliably established from style alone. This feature reports detector availability without invented scores.",
    label: "Text to inspect",
    placeholder: "Paste the text you want to assess.",
  },
};
export default function VerificationForm({
  kind,
}: {
  kind: keyof typeof copy;
}) {
  const c = copy[kind];
  const [content, setContent] = useState(""),
    [reference, setReference] = useState(""),
    [platform, setPlatform] = useState("Instagram"),
    [report, setReport] = useState<EvidenceReport | null>(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const sequence = useRef(0),
    controller = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      sequence.current++;
      controller.current?.abort();
    },
    [],
  );
  const edit = () => {
    sequence.current++;
    controller.current?.abort();
    setLoading(false);
    setReport(null);
    setError("");
  };
  async function submit(e: FormEvent) {
    e.preventDefault();
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    const n = ++sequence.current;
    setLoading(true);
    setReport(null);
    setError("");
    try {
      const payload =
        kind === "url"
          ? { url: content }
          : kind === "profile"
            ? { username: content, platform }
            : { content, reference };
      const result = reportSchema.parse(
        await api("/api/verify/" + kind, {
          method: "POST",
          body: JSON.stringify(payload),
          signal: request.signal,
        }),
      );
      if (n === sequence.current) {
        setReport(result);
        historyChanged();
      }
    } catch (e) {
      if (n === sequence.current)
        setError(e instanceof Error ? e.message : "Analysis failed.");
    } finally {
      if (n === sequence.current) setLoading(false);
    }
  }
  return (
    <div className="space-y-6">
      <section className="panel">
        <p className="eyebrow">Evidence workspace</p>
        <h1 className="page-title">{c.title}</h1>
        <p className="description max-w-3xl">{c.description}</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label className="field-label" htmlFor="verification-input">
              {c.label}
            </label>
            {["url", "profile"].includes(kind) ? (
              <input
                id="verification-input"
                className="field"
                required
                type={kind === "url" ? "url" : "text"}
                maxLength={kind === "url" ? 2048 : 100}
                value={content}
                placeholder={c.placeholder}
                onChange={(e) => {
                  edit();
                  setContent(e.target.value);
                }}
              />
            ) : (
              <textarea
                id="verification-input"
                className="field min-h-36"
                required
                minLength={5}
                maxLength={20000}
                value={content}
                placeholder={c.placeholder}
                onChange={(e) => {
                  edit();
                  setContent(e.target.value);
                }}
              />
            )}
          </div>
          {kind === "profile" && (
            <div>
              <label className="field-label" htmlFor="platform">
                Platform
              </label>
              <select
                id="platform"
                className="field"
                value={platform}
                onChange={(e) => {
                  edit();
                  setPlatform(e.target.value);
                }}
              >
                {["Instagram", "X", "Facebook", "LinkedIn", "Other"].map(
                  (p) => (
                    <option key={p}>{p}</option>
                  ),
                )}
              </select>
            </div>
          )}
          {kind === "plagiarism" && (
            <div>
              <label className="field-label" htmlFor="reference">
                Reference text (required for comparison)
              </label>
              <textarea
                id="reference"
                className="field min-h-36"
                maxLength={20000}
                value={reference}
                onChange={(e) => {
                  edit();
                  setReference(e.target.value);
                }}
                placeholder="Paste the reference document. Only this text will be searched."
              />
            </div>
          )}
          <div className="flex flex-wrap justify-between items-center gap-3">
            <p className="text-xs text-slate-500">
              No fabricated scores. Unavailable checks are labeled.
            </p>
            <button className="button-primary" disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              {loading ? "Checking evidence…" : "Run check"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </form>
      </section>
      {error && (
        <div
          role="alert"
          className="panel border-amber-200 bg-amber-50 text-amber-900"
        >
          {error}
        </div>
      )}
      {report && <EvidenceView report={report} />}
    </div>
  );
}
