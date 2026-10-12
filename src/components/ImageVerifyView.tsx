import { useEffect, useRef, useState } from "react";
import { Upload, FileImage, Loader2, X } from "lucide-react";
import { api, uploadImage, historyChanged } from "../lib/api";
import { jobSchema, type EvidenceReport } from "../shared/report";
import EvidenceView from "./EvidenceView";
export default function ImageVerifyView() {
  const [preview, setPreview] = useState(""),
    [name, setName] = useState(""),
    [progress, setProgress] = useState(0),
    [phase, setPhase] = useState(""),
    [error, setError] = useState(""),
    [report, setReport] = useState<EvidenceReport | null>(null);
  const current = useRef(0),
    controller = useRef<AbortController | null>(null),
    job = useRef<string | null>(null),
    previewRef = useRef(""),
    input = useRef<HTMLInputElement>(null);
  async function cancelRemote() {
    const id = job.current;
    job.current = null;
    if (id)
      await api("/api/verify/cancel/" + id, {
        method: "POST",
        body: "{}",
      }).catch(() => {});
  }
  useEffect(
    () => () => {
      current.current++;
      controller.current?.abort();
      void cancelRemote();
      URL.revokeObjectURL(previewRef.current);
    },
    [],
  );
  const cancel = async () => {
    current.current++;
    controller.current?.abort();
    setPhase("");
    setReport(null);
    setError("Analysis canceled. No verdict was produced.");
    await cancelRemote();
    historyChanged();
  };
  async function select(file: File) {
    const generation = ++current.current;
    controller.current?.abort();
    await cancelRemote();
    if (generation !== current.current) return;
    const request = new AbortController();
    controller.current = request;
    setReport(null);
    setError("");
    setProgress(0);
    setPhase("");
    setName(file.name);
    URL.revokeObjectURL(previewRef.current);
    previewRef.current = "";
    setPreview("");
    if (file.size > 8 * 1024 * 1024) {
      setError("Maximum upload size is 8 MB.");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Choose a static JPEG, PNG or WebP image.");
      return;
    }
    const url = URL.createObjectURL(file);
    previewRef.current = url;
    setPreview(url);
    setPhase("Reading original file");
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      request.signal.throwIfAborted();
      let binary = "";
      for (let i = 0; i < bytes.length; i += 8192)
        binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      setPhase("Uploading original bytes");
      const initial = jobSchema.parse(
        await uploadImage(btoa(binary), request.signal, (n) => {
          if (generation === current.current) setProgress(n);
        }),
      );
      if (generation !== current.current) {
        void api("/api/verify/cancel/" + initial.job_id, {
          method: "POST",
          body: "{}",
        }).catch(() => {});
        return;
      }
      job.current = initial.job_id;
      setPhase("Analyzing file evidence");
      historyChanged();
      const deadline = Date.now() + 65000;
      while (Date.now() < deadline) {
        await new Promise<void>((resolve, reject) => {
          const stop = () => {
            clearTimeout(timer);
            reject(new DOMException("Canceled", "AbortError"));
          };
          const timer = setTimeout(() => {
            request.signal.removeEventListener("abort", stop);
            resolve();
          }, 1000);
          request.signal.addEventListener("abort", stop, { once: true });
          if (request.signal.aborted) stop();
        });
        const result = jobSchema.parse(
          await api("/api/verify/result/" + initial.job_id, {
            signal: request.signal,
          }),
        );
        if (generation !== current.current) return;
        if (result.status === "failed")
          throw new Error(
            result.error || "Analysis failed. No verdict was produced.",
          );
        if (result.status === "canceled") throw new Error("Analysis canceled.");
        if (result.status === "completed") {
          if (!result.report)
            throw new Error("Server returned an incomplete report.");
          setReport(result.report);
          setPhase("");
          job.current = null;
          historyChanged();
          return;
        }
      }
      throw new Error(
        "Analysis exceeded the polling deadline. Please try again.",
      );
    } catch (e) {
      if (generation !== current.current) return;
      setError(e instanceof Error ? e.message : "Analysis failed.");
      setPhase("");
      setReport(null);
      await cancelRemote();
      historyChanged();
    }
  }
  return (
    <div className="grid gap-6 xl:grid-cols-[310px_minmax(0,1fr)]">
      <section className="space-y-5">
        <div className="panel">
          <p className="eyebrow">Original-file analysis</p>
          <h1 className="page-title">Image evidence</h1>
          <p className="description">
            Inspect file metadata and limited forensic diagnostics. AI origin
            and manipulation may remain inconclusive.
          </p>
          <input
            aria-label="Choose image"
            ref={input}
            className="sr-only"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => {
              if (e.target.files?.[0]) void select(e.target.files[0]);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            className="mt-6 w-full rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/40 p-7 text-center hover:border-blue-500 focus-visible:outline-blue-600"
            onClick={() => input.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files[0]) void select(e.dataTransfer.files[0]);
            }}
          >
            <Upload className="mx-auto h-7 w-7 text-blue-600" />
            <span className="block font-semibold mt-3">
              Choose or drop an image
            </span>
            <span className="block text-xs text-slate-500 mt-2">
              JPEG, PNG, WebP · up to 8 MB / 20 MP
            </span>
          </button>
          <p className="mt-4 text-xs text-slate-500 leading-relaxed">
            Original bytes are analyzed in memory and discarded after
            processing. Metadata in the saved report excludes GPS and device
            serial numbers.
          </p>
        </div>
        {preview && (
          <div className="panel">
            <img
              className="max-h-72 w-full object-contain rounded-xl"
              src={preview}
              alt="Original uploaded image preview"
            />
            <p className="text-xs text-slate-500 break-all mt-3">{name}</p>
          </div>
        )}
      </section>
      <div>
        {phase ? (
          <div className="panel py-16 text-center" role="status">
            <Loader2 className="animate-spin mx-auto text-blue-600 h-8 w-8" />
            <h2 className="font-semibold mt-5">{phase}</h2>
            <p className="text-sm text-slate-500 mt-2">
              A verdict will appear only after processing finishes.
            </p>
            {phase.startsWith("Uploading") && (
              <>
                <progress
                  className="w-full max-w-xs mt-5"
                  max={100}
                  value={progress}
                />
                <p className="text-xs">{progress}% uploaded</p>
              </>
            )}
            <button
              onClick={() => void cancel()}
              className="button-secondary mx-auto mt-6"
            >
              <X className="h-4 w-4" /> Cancel analysis
            </button>
          </div>
        ) : error ? (
          <div
            className="panel border-amber-200 bg-amber-50 text-amber-900"
            role="alert"
          >
            {error}
          </div>
        ) : report ? (
          <EvidenceView report={report} />
        ) : (
          <div className="panel min-h-80 flex flex-col justify-center items-center text-center">
            <FileImage className="h-12 w-12 text-blue-200" />
            <h2 className="font-semibold text-xl mt-5">
              Start with the original image
            </h2>
            <p className="description max-w-md">
              You’ll see measured file properties, available checks and their
              limitations. No placeholder verdicts or invented confidence
              scores.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
