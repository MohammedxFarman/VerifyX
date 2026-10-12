import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { loadConfig } from "../src/server/config";
import { analyzeImage } from "../src/server/image";
import { Store } from "../src/server/store";
process.env.VERIFYX_TEST = "1";
const { createApp } = await import("../server");

test("API integration: sessions, accounts, jobs, history, limits and redaction", async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "verifyx-test-"));
  const config = loadConfig({ NODE_ENV: "test", DATA_DIR: dir });
  let behavior = "normal";
  const instance = await createApp(config, {
    staticFiles: false,
    imageAnalyzer: async (b, c, s) => {
      if (behavior === "fail") throw new Error("secret=do-not-expose");
      if (behavior === "malformed") return {} as any;
      if (behavior === "wait")
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, 1000);
          s?.addEventListener(
            "abort",
            () => {
              clearTimeout(timer);
              reject(new Error("aborted"));
            },
            { once: true },
          );
        });
      return analyzeImage(b, c, s);
    },
  });
  const server = instance.app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const base = "http://127.0.0.1:" + (server.address() as any).port;
  const request = async (
    route: string,
    token?: string,
    body?: unknown,
    method = body ? "POST" : "GET",
  ) => {
    const r = await fetch(base + route, {
      method,
      headers: {
        ...(token ? { Authorization: "Bearer " + token } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, data: await r.json(), headers: r.headers };
  };
  const a = (await request("/api/session")).data.sessionToken,
    b = (await request("/api/session")).data.sessionToken;
  const image = (
    await sharp({
      create: { width: 1, height: 1, channels: 3, background: "#fff" },
    })
      .png()
      .toBuffer()
  ).toString("base64");
  async function finish(id: string) {
    for (let i = 0; i < 100; i++) {
      const r = await request("/api/verify/result/" + id, a);
      if (!["queued", "processing"].includes(r.data.status)) return r.data;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error("Job did not finish");
  }
  try {
    await t.test(
      "invalid JWT rejected and distinct guests cannot share history",
      async () => {
        assert.notEqual(a, b);
        assert.equal((await request("/api/history", "garbage")).status, 401);
        assert.deepEqual((await request("/api/history", b)).data, []);
      },
    );
    await t.test(
      "async response exposes no placeholder and tiny image finishes inconclusive",
      async () => {
        const start = await request("/api/verify/image", a, {
          image,
          fileName: "fake.png",
        });
        assert.equal(start.status, 202);
        assert.deepEqual(Object.keys(start.data).sort(), ["job_id", "status"]);
        assert.equal(
          (await request("/api/verify/result/" + start.data.job_id, b)).status,
          404,
        );
        assert.equal(
          (
            await request(
              "/api/history/" + start.data.job_id,
              b,
              undefined,
              "DELETE",
            )
          ).status,
          404,
        );
        const result = await finish(start.data.job_id);
        assert.equal(result.status, "completed");
        assert.equal(result.report.status, "inconclusive");
        assert.equal(result.report.analysis.metadata.measurements.width, 1);
        assert.equal(
          (await request("/api/dashboard/stats", a)).data.totalVerifications,
          0,
        );
      },
    );
    await t.test(
      "failed and invalid analyzer output never become completed reports",
      async () => {
        for (const value of ["fail", "malformed"]) {
          behavior = value;
          const start = await request("/api/verify/image", a, { image });
          const result = await finish(start.data.job_id);
          assert.equal(result.status, "failed");
          assert.equal(result.report, undefined);
          assert.ok(!JSON.stringify(result).includes("do-not-expose"));
        }
        behavior = "normal";
      },
    );
    await t.test(
      "cancel stops report publication and ownership is enforced",
      async () => {
        behavior = "wait";
        const start = await request("/api/verify/image", a, { image });
        assert.equal(
          (await request("/api/verify/cancel/" + start.data.job_id, b, {}))
            .status,
          404,
        );
        assert.equal(
          (await request("/api/verify/cancel/" + start.data.job_id, a, {})).data
            .status,
          "canceled",
        );
        const result = await finish(start.data.job_id);
        assert.equal(result.status, "canceled");
        assert.equal(result.report, undefined);
        behavior = "normal";
      },
    );
    await t.test(
      "invalid, unsupported and excessive uploads fail",
      async () => {
        assert.equal(
          (await request("/api/verify/image", a, { image: "not base64" }))
            .status,
          400,
        );
        assert.equal(
          (
            await request("/api/verify/image", a, {
              image: Buffer.from("<svg/>").toString("base64"),
            })
          ).status,
          415,
        );
        assert.equal(
          (
            await request("/api/verify/image", a, {
              image: Buffer.alloc(config.maxImageBytes + 1).toString("base64"),
            })
          ).status,
          413,
        );
      },
    );
    await t.test(
      "URL SSRF and process-wide key mutation are rejected",
      async () => {
        assert.equal(
          (
            await request("/api/verify/url", a, {
              url: "http://169.254.169.254",
            })
          ).status,
          400,
        );
        assert.equal(
          (await request("/api/auth/update-key", a, { apiKey: "no" })).status,
          403,
        );
      },
    );
    await t.test(
      "unconfigured features remain visible and unavailable",
      async () => {
        for (const kind of ["news", "ai-content"]) {
          const result = await request("/api/verify/" + kind, a, {
            content: "A sufficiently long test claim.",
          });
          assert.equal(result.data.status, "unavailable");
          assert.ok(!JSON.stringify(result.data).includes("trustScore"));
        }
        const comparison = await request("/api/verify/plagiarism", a, {
          content: "one two three four five six",
          reference: "one two three four five six",
        });
        assert.equal(comparison.data.analysis.comparison.score, 1);
        assert.equal(
          (await request("/api/dashboard/stats", a)).data.totalVerifications,
          1,
        );
      },
    );
    await t.test(
      "registration hashes passwords; signed-in history remains separate; API secrets absent",
      async () => {
        const registration = await request("/api/auth/register", undefined, {
          email: "audit@example.org",
          fullName: "Test User",
          password: "test-long-password-123",
        });
        assert.equal(registration.status, 201);
        assert.equal(registration.data.user.passwordHash, undefined);
        assert.equal(registration.data.user.apiKey, undefined);
        const cookie = registration.headers.get("set-cookie")!.split(";")[0];
        const session = await fetch(base + "/api/session", {
          headers: { Cookie: cookie },
        });
        const token = (await session.json()).sessionToken;
        const report = await request("/api/verify/plagiarism", token, {
          content: "one two three four five six",
          reference: "one two three four five six",
        });
        assert.equal(report.status, 200);
        assert.equal((await request("/api/history", token)).data.length, 1);
        assert.equal(
          (await request("/api/verify/result/" + report.data.id, a)).status,
          404,
        );
        const raw = await readFile(config.dataFile, "utf8");
        assert.ok(!raw.includes("test-long-password-123"));
        assert.ok(raw.includes("$2b$"));
        assert.equal(
          (
            await request("/api/auth/login", undefined, {
              email: "audit@example.org",
              password: "wrong",
            })
          ).status,
          401,
        );
        assert.equal(
          (
            await request("/api/auth/login", undefined, {
              email: "audit@example.org",
              password: "test-long-password-123",
            })
          ).status,
          200,
        );
      },
    );
    await t.test(
      "same bytes under different names produce identical findings",
      async () => {
        const reports = [];
        for (const fileName of ["camera.jpg", "fake-ai-image.png"]) {
          const start = await request("/api/verify/image", a, {
            image,
            fileName,
          });
          const result = await finish(start.data.job_id);
          reports.push(result.report.analysis);
        }
        assert.deepEqual(reports[0], reports[1]);
      },
    );
    await t.test(
      "legacy seeds are absent and actual history survives reopening storage",
      async () => {
        const reopened = new Store(config);
        await reopened.init();
        assert.ok((await reopened.history("guest-user-1")).length === 0);
        assert.ok(
          (
            await reopened.history(
              (await request("/api/auth/me", a)).data.user.id,
            )
          ).length > 0,
        );
        await reopened.close();
      },
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await instance.close();
    await rm(dir, { recursive: true, force: true });
  }
});
