import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";
import os from "node:os";
import assert from "node:assert/strict";
import sharp from "sharp";
const dir = await mkdtemp(path.join(os.tmpdir(), "verifyx-production-"));
const port = 3298,
  base = "http://127.0.0.1:" + port;
const child = spawn(
  process.execPath,
  ["--require", "./scripts/production.cjs", "build/server.cjs"],
  {
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      VERIFYX_TEST: "0",
      JWT_SECRET: randomBytes(48).toString("hex"),
      DATABASE_URL: "",
      DATA_DIR: dir,
      DB_FILE: "",
      PORT: String(port),
      GEMINI_API_KEY: "",
      BRAVE_SEARCH_API_KEY: "",
      APP_ORIGIN: base,
    },
  },
);
let output = "";
child.stdout.on("data", (c) => (output += c));
child.stderr.on("data", (c) => (output += c));
try {
  let ready = false;
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(base + "/api/health")).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 150));
  }
  assert.ok(ready, "Production process did not start: " + output);
  const home = await fetch(base + "/");
  const html = await home.text();
  assert.equal(home.status, 200);
  assert.ok(html.includes("/assets/"));
  assert.ok(!html.includes("/@vite/client"));
  assert.ok(home.headers.get("content-security-policy"));
  const source = await fetch(base + "/server.cjs");
  assert.ok(
    (source.headers.get("content-type") || "").includes("text/html"),
    "Backend source must not be served.",
  );
  const session = await fetch(base + "/api/session");
  assert.ok(session.headers.get("set-cookie").includes("Secure"));
  assert.ok(session.headers.get("set-cookie").includes("HttpOnly"));
  const { sessionToken } = await session.json();
  const headers = {
    "Content-Type": "application/json",
    Authorization: "Bearer " + sessionToken,
  };
  const image = (
    await sharp({
      create: { width: 1, height: 1, channels: 3, background: "#fff" },
    })
      .png()
      .toBuffer()
  ).toString("base64");
  const start = await fetch(base + "/api/verify/image", {
    method: "POST",
    headers,
    body: JSON.stringify({ image }),
  });
  assert.equal(start.status, 202);
  const job = await start.json();
  assert.equal(job.report, undefined);
  let result;
  for (let i = 0; i < 80; i++) {
    result = await (
      await fetch(base + "/api/verify/result/" + job.job_id, { headers })
    ).json();
    if (result.status === "completed") break;
    assert.notEqual(result.status, "failed", result.error);
    await new Promise((r) => setTimeout(r, 150));
  }
  assert.equal(result.status, "completed");
  assert.equal(result.report.assessment, "inconclusive");
  assert.equal(result.report.analysis.metadata.measurements.width, 1);
  const news = await (
    await fetch(base + "/api/verify/news", {
      method: "POST",
      headers,
      body: JSON.stringify({
        content: "A claim requiring independent source evidence.",
      }),
    })
  ).json();
  assert.equal(news.status, "unavailable");
  console.log(
    "PASS: production startup, static assets, CSP, source isolation, secure session cookie, async image result, missing-provider behavior.",
  );
} finally {
  child.kill();
  await new Promise((resolve) => child.once("close", resolve));
  await rm(dir, { recursive: true, force: true });
}
