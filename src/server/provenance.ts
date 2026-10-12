import { spawn } from "node:child_process";
import path from "node:path";
import { checkSchema, type Check } from "../shared/report";
export function verifyProvenance(
  bytes: Buffer,
  signal?: AbortSignal,
): Promise<Check> {
  return new Promise((resolve) => {
    let settled = false;
    const chunks: Buffer[] = [];
    let size = 0;
    const unavailable = (reason: string): Check => ({
      status: "unavailable",
      method: "Isolated C2PA native verifier",
      score: null,
      findings: [reason],
      measurements: { credentialStatus: "unavailable" },
    });
    const child = spawn(
      process.execPath,
      [path.join(process.cwd(), "scripts", "c2pa-worker.mjs")],
      {
        windowsHide: true,
        stdio: ["pipe", "pipe", "ignore"],
        env: {
          PATH: process.env.PATH,
          SystemRoot: process.env.SystemRoot,
          C2PA_TRUST_ANCHORS: process.env.C2PA_TRUST_ANCHORS,
        },
      },
    );
    const finish = (check: Check) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      child.kill();
      resolve(check);
    };
    const abort = () =>
      finish(unavailable("Provenance verification was canceled."));
    const timer = setTimeout(
      () =>
        finish(
          unavailable("Provenance verifier exceeded its 8 second time limit."),
        ),
      8000,
    );
    child.stdout.on("data", (c: Buffer) => {
      size += c.length;
      if (size > 64 * 1024)
        finish(unavailable("Provenance response exceeded the size limit."));
      else chunks.push(c);
    });
    child.once("error", () =>
      finish(unavailable("Provenance verifier could not start.")),
    );
    child.stdin.on("error", () => {});
    child.once("close", () => {
      try {
        finish(
          checkSchema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8"))),
        );
      } catch {
        finish(
          unavailable("Provenance verifier returned an invalid response."),
        );
      }
    });
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    else child.stdin.end(bytes);
  });
}
