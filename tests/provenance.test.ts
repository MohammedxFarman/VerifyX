import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { verifyProvenance } from "../src/server/provenance";
test("installed native C2PA verifier distinguishes an unsigned image from proof of authenticity", async () => {
  const bytes = await sharp({
    create: { width: 64, height: 64, channels: 3, background: "#ccc" },
  })
    .jpeg()
    .toBuffer();
  const r = await verifyProvenance(bytes);
  assert.equal(r.status, "completed", JSON.stringify(r));
  assert.equal(r.measurements?.credentialStatus, "absent");
  assert.equal(r.score, null);
});
test("canceled native provenance worker returns unavailable, not validated", async () => {
  const c = new AbortController();
  c.abort();
  const r = await verifyProvenance(Buffer.alloc(1), c.signal);
  assert.equal(r.status, "unavailable");
});
