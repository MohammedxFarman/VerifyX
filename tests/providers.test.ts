import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../src/server/config";
import { askGemini } from "../src/services/geminiService";
import {
  verifyNews,
  compareDocuments,
  unavailableReport,
} from "../src/server/verification";
import { reportSchema } from "../src/shared/report";
import {
  parsePublicUrl,
  publicAddress,
  boundedJson,
} from "../src/server/network";
const config = loadConfig({ NODE_ENV: "test" });
test("missing providers produce unavailable states, never fake scores", async () => {
  await assert.rejects(() => askGemini(config, "hello"), /not configured/);
  assert.equal(
    (await verifyNews("A test claim", config)).status,
    "unavailable",
  );
  assert.equal(unavailableReport("profile", "alice").status, "unavailable");
  assert.equal(
    unavailableReport("ai-content", "some words").status,
    "unavailable",
  );
});
test("provider schema rejects missing fields, non-JSON, excessive and malformed output", async () => {
  for (const value of [
    {},
    { candidates: [{ content: { parts: [{ text: "not json" }] } }] },
    {
      candidates: [
        { content: { parts: [{ text: '{"summary":"","score":99}' }] } },
      ],
    },
  ])
    await assert.rejects(
      () =>
        askGemini(
          { ...config, geminiKey: "test" },
          "test",
          undefined,
          async () => new Response(JSON.stringify(value)),
        ),
      /validated|contract|malformed/,
    );
  await assert.rejects(
    () => boundedJson(new Response("x".repeat(100)), 5),
    /size limit/,
  );
  assert.equal(
    reportSchema.safeParse({ version: 1, analysis: { a: { score: 9 } } })
      .success,
    false,
  );
});
test("provider timeout is explicit", async () => {
  await assert.rejects(
    () =>
      askGemini(
        { ...config, geminiKey: "test" },
        "test",
        undefined,
        async () => {
          throw new DOMException("Timed out", "TimeoutError");
        },
      ),
    /timed out/,
  );
});
test("valid provider response preserves actual summary without invented evidence", async () => {
  const r = await askGemini(
    { ...config, geminiKey: "test" },
    "test",
    undefined,
    async () =>
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      summary: "Evidence is insufficient.",
                    }),
                  },
                ],
              },
            },
          ],
        }),
      ),
  );
  assert.equal(r, "Evidence is insufficient.");
});
test("reference comparison measures exact overlap, not originality", () => {
  const r = compareDocuments(
    "one two three four five six",
    "one two three four five six",
  );
  assert.equal(r.analysis.comparison.score, 1);
  assert.equal(r.status, "completed");
  assert.equal(
    compareDocuments("one two three four five", "").status,
    "unavailable",
  );
  assert.equal(compareDocuments("one two", "one two").status, "inconclusive");
});
test("URL parser blocks local, private, metadata, credential and non-HTTP destinations", () => {
  for (const url of [
    "file:///etc/passwd",
    "ftp://example.com",
    "http://localhost",
    "http://127.1",
    "http://2130706433",
    "http://169.254.169.254",
    "http://10.0.0.1",
    "http://[::1]",
    "http://[::ffff:127.0.0.1]",
    "https://user:pass@example.com",
    "https://example.com:8443",
    "https://service.internal",
  ])
    assert.throws(() => parsePublicUrl(url), url);
  assert.equal(parsePublicUrl("https://example.org").hostname, "example.org");
  for (const ip of [
    "127.0.0.1",
    "192.168.1.1",
    "10.0.0.1",
    "169.254.169.254",
    "::1",
    "fc00::1",
    "::ffff:10.0.0.1",
    "224.0.0.1",
    "100.64.0.1",
  ])
    assert.equal(publicAddress(ip), false, ip);
  assert.equal(publicAddress("1.1.1.1"), true);
});
test("production refuses absent secrets and unconfigured persistence", () => {
  assert.throws(() => loadConfig({ NODE_ENV: "production" }), /JWT_SECRET/);
  assert.throws(
    () => loadConfig({ NODE_ENV: "production", JWT_SECRET: "x".repeat(48) }),
    /DATABASE_URL/,
  );
});
