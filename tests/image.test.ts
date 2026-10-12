import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { analyzeImage, decodeUpload, validateImage } from "../src/server/image";
import { loadConfig } from "../src/server/config";
import { reportSchema } from "../src/shared/report";
const config = loadConfig({ NODE_ENV: "test" });
async function patterned(format: "png" | "jpeg" = "png") {
  const data = Buffer.alloc(96 * 96 * 3);
  for (let i = 0; i < data.length; i++)
    data[i] = (i * 37 + Math.floor(i / 96) * 13) % 256;
  return sharp(data, { raw: { width: 96, height: 96, channels: 3 } })
    [format]()
    .toBuffer();
}
test("original bytes, measured dimensions and absent metadata never produce authenticity scores", async () => {
  const bytes = await patterned();
  const before = Buffer.from(bytes);
  const r = await analyzeImage(bytes, config);
  assert.deepEqual(bytes, before);
  assert.equal(r.analysis.metadata.measurements?.width, 96);
  assert.equal(r.analysis.metadata.measurements?.exifPresent, false);
  assert.equal(r.assessment, "inconclusive");
  assert.equal(r.analysis.ai_generation.status, "unavailable");
  assert.equal(r.analysis.manipulation.localizationAvailable, false);
  assert.ok(
    ["completed", "unavailable"].includes(r.analysis.provenance.status),
  );
  assert.ok(Object.values(r.analysis).every((c) => c.score === null));
  reportSchema.parse(r);
});
test("tiny and uniform files are inconclusive", async () => {
  for (const size of [1, 64]) {
    const b = await sharp({
      create: { width: size, height: size, channels: 3, background: "#fff" },
    })
      .png()
      .toBuffer();
    const r = await analyzeImage(b, config);
    assert.equal(r.status, "inconclusive");
    assert.equal(r.analysis.visual_information.status, "inconclusive");
  }
});
test("invalid encoding, invalid pixels, unsupported format, byte and dimension limits", async () => {
  assert.throws(() => decodeUpload("not base64", 20));
  assert.throws(() => decodeUpload("AAAA".repeat(100), 10));
  await assert.rejects(
    () => analyzeImage(Buffer.from("<svg/>"), config),
    /Unsupported/,
  );
  await assert.rejects(
    () => analyzeImage(Buffer.from([255, 216, 255, 0, 0]), config),
    /decoded/,
  );
  const b = await patterned();
  await assert.rejects(
    () => analyzeImage(b, { ...config, maxImageBytes: 10 }),
    /8 MB/,
  );
  await assert.rejects(
    () => validateImage(b, { ...config, maxPixels: 100 }),
    /dimensions|decoded/,
  );
});
test("EXIF camera tags are extracted without authenticating the image", async () => {
  const b = await sharp(await patterned())
    .withExif({
      IFD0: { Make: "Test Camera", Model: "Fixture", Software: "Test editor" },
    })
    .jpeg()
    .toBuffer();
  const r = await analyzeImage(b, config);
  assert.equal(r.analysis.metadata.measurements?.Make, "Test Camera");
  assert.equal(r.analysis.metadata.measurements?.Software, "Test editor");
  assert.equal(r.assessment, "inconclusive");
});
test("resized and recompressed fixtures expose actual diagnostics only", async () => {
  const b = await sharp(await patterned())
    .resize(48, 48)
    .jpeg({ quality: 50 })
    .toBuffer();
  const r = await analyzeImage(b, config);
  assert.equal(r.analysis.metadata.measurements?.width, 48);
  assert.equal(r.analysis.recompression.status, "completed");
  assert.equal(
    typeof r.analysis.recompression.measurements?.meanAbsoluteResidual,
    "number",
  );
  assert.equal(r.analysis.recompression.score, null);
});
test("analysis is filename independent because filenames are not an analysis input", async () => {
  const b = await patterned();
  const a = await analyzeImage(b, config),
    c = await analyzeImage(b, config);
  assert.deepEqual(a.analysis, c.analysis);
});
test("aborted image analysis does not return a report", async () => {
  const abort = new AbortController();
  abort.abort();
  await assert.rejects(
    () => analyzeImage(Buffer.alloc(1), config, abort.signal),
    /canceled/,
  );
});
