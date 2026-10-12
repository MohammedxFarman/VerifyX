import { verifyProvenance } from "./provenance";
import sharp, { type Stats } from "sharp";
import exifr from "exifr";
import { createHash, randomUUID } from "node:crypto";
import type { Config } from "./config";
import { AppError, abortCheck } from "./errors";
import {
  reportSchema,
  type EvidenceReport,
  type Check,
} from "../shared/report";

sharp.cache({ memory: 32, files: 0, items: 20 });
sharp.concurrency(1);
export function decodeUpload(value: unknown, limit: number): Buffer {
  if (typeof value !== "string" || !value.length)
    throw new AppError(400, "Image bytes are required.", "invalid_input");
  if (value.length > Math.ceil(limit / 3) * 4)
    throw new AppError(
      413,
      "Image exceeds the 8 MB upload limit.",
      "upload_too_large",
    );
  if (value.length % 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value))
    throw new AppError(400, "Invalid base64 image.", "invalid_input");
  const bytes = Buffer.from(value, "base64");
  if (bytes.length > limit)
    throw new AppError(
      413,
      "Image exceeds the 8 MB upload limit.",
      "upload_too_large",
    );
  if (bytes.toString("base64") !== value)
    throw new AppError(400, "Invalid image encoding.", "invalid_input");
  return bytes;
}
export function sniffImage(bytes: Buffer): "jpeg" | "png" | "webp" {
  if (
    bytes.length >= 3 &&
    bytes[0] === 255 &&
    bytes[1] === 216 &&
    bytes[2] === 255
  )
    return "jpeg";
  if (
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return "png";
  if (
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  )
    return "webp";
  throw new AppError(
    415,
    "Unsupported file contents. Use a static JPEG, PNG or WebP image.",
    "unsupported_format",
  );
}
export async function validateImage(bytes: Buffer, config: Config) {
  if (bytes.length > config.maxImageBytes)
    throw new AppError(413, "Image exceeds 8 MB.", "upload_too_large");
  const format = sniffImage(bytes);
  try {
    const meta = await sharp(bytes, {
      limitInputPixels: config.maxPixels,
      failOn: "warning",
    }).metadata();
    if (
      !meta.width ||
      !meta.height ||
      meta.width * meta.height > config.maxPixels ||
      meta.width > 12000 ||
      meta.height > 12000
    )
      throw new AppError(
        413,
        "Image dimensions exceed the 20 megapixel / 12000px limits.",
        "dimension_limit",
      );
    if ((meta.pages || 1) > 1)
      throw new AppError(
        415,
        "Animated images are unsupported. Submit one original still image.",
        "unsupported_format",
      );
    if (meta.format !== format)
      throw new AppError(
        400,
        "Image header does not match decoded contents.",
        "invalid_input",
      );
    return meta;
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError(
      400,
      "Image could not be safely decoded; it may be corrupt or exceed dimension limits.",
      "invalid_input",
    );
  }
}
const unavailable = (method: string, message: string): Check => ({
  status: "unavailable",
  method,
  findings: [message],
  score: null,
});
export async function analyzeImage(
  bytes: Buffer,
  config: Config,
  signal?: AbortSignal,
): Promise<EvidenceReport> {
  abortCheck(signal);
  const meta = await validateImage(bytes, config);
  let stats: Stats;
  try {
    stats = await sharp(bytes, {
      limitInputPixels: config.maxPixels,
      failOn: "warning",
    }).stats();
  } catch {
    throw new AppError(
      400,
      "Image pixel data is malformed or truncated.",
      "invalid_input",
    );
  }
  abortCheck(signal);
  const measurements: Record<string, string | number | boolean | null> = {
    format: meta.format!,
    width: meta.width!,
    height: meta.height!,
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    exifPresent: !!meta.exif,
    embeddedColorProfile: !!meta.icc,
    colorSpace: meta.space,
    channels: meta.channels,
    hasAlpha: meta.hasAlpha,
    orientation: meta.orientation || 1,
  };
  const findings = [
    "Dimensions and format were read from the original file. Original bytes were not recompressed or saved to disk.",
  ];
  if (meta.exif) {
    try {
      const tags = await exifr.parse(bytes, {
        pick: [
          "Make",
          "Model",
          "DateTimeOriginal",
          "Software",
          "ModifyDate",
          "LensModel",
        ],
        gps: false,
      });
      for (const key of [
        "Make",
        "Model",
        "DateTimeOriginal",
        "Software",
        "ModifyDate",
        "LensModel",
      ])
        if (tags?.[key] != null)
          measurements[key] = String(tags[key]).slice(0, 300);
      findings.push(
        "EXIF fields are self-reported and can be edited. GPS coordinates and serial numbers are intentionally omitted.",
      );
    } catch {
      findings.push("EXIF data was present but could not be parsed.");
    }
  } else
    findings.push(
      "No EXIF block found. Missing metadata does not establish AI generation or manipulation.",
    );
  const insufficient =
    meta.width! < 32 ||
    meta.height! < 32 ||
    stats.channels.slice(0, 3).every((c) => c.stdev < 1) ||
    (stats.isOpaque === false && stats.channels.at(-1)?.max === 0);
  const analysis: EvidenceReport["analysis"] = {
    metadata: {
      status: "completed",
      method: "sharp/libvips + exifr (original bytes)",
      score: null,
      findings,
      measurements,
    },
    visual_information: {
      status: insufficient ? "inconclusive" : "completed",
      method: "decoded pixel dimensions and channel variance",
      score: null,
      findings: [
        insufficient
          ? "Insufficient visual information: the image is too small, transparent or nearly uniform. No origin assessment is possible."
          : "The file contains decodable visual information. This is not an authenticity finding.",
      ],
    },
    ai_generation: unavailable(
      "No validated AI-image detector installed",
      "AI-generation detection is unavailable. A visual language model is not used as proof of image origin.",
    ),
    manipulation: {
      ...unavailable(
        "No trained manipulation-localization model installed",
        "Splicing, face alteration and pixel-level manipulation localization are unavailable.",
      ),
      localizationAvailable: false,
    },
    provenance: await verifyProvenance(bytes, signal),
  };
  if (!insufficient) {
    const { data, info } = await sharp(bytes, {
      limitInputPixels: config.maxPixels,
    })
      .rotate()
      .resize({
        width: 512,
        height: 512,
        fit: "inside",
        withoutEnlargement: true,
      })
      .flatten({ background: "#fff" })
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const blocks = new Map<string, { x: number; y: number }>();
    let duplicates = 0,
      textured = 0;
    for (let y = 0; y + 16 <= info.height; y += 16)
      for (let x = 0; x + 16 <= info.width; x += 16) {
        const block = Buffer.alloc(256);
        let sum = 0,
          sumSq = 0;
        for (let j = 0; j < 16; j++)
          for (let i = 0; i < 16; i++) {
            const v = data[(y + j) * info.width + x + i];
            block[j * 16 + i] = v;
            sum += v;
            sumSq += v * v;
          }
        if (sumSq / 256 - (sum / 256) ** 2 < 100) continue;
        textured++;
        const hash = createHash("sha256").update(block).digest("hex");
        const prev = blocks.get(hash);
        if (prev && Math.hypot(prev.x - x, prev.y - y) >= 32) duplicates++;
        else if (!prev) blocks.set(hash, { x, y });
      }
    analysis.repeated_blocks = {
      status: "completed",
      method:
        "Exact matching of textured 16×16 grayscale blocks on a ≤512px derivative",
      score: null,
      measurements: { texturedBlocks: textured, repeatedBlocks: duplicates },
      findings: [
        duplicates
          ? "Repeated textured blocks were measured. Repeating designs can produce the same finding; this is not proof of copy-move forgery."
          : "No exact repeated textured blocks were found in this limited check. This does not rule out copying, transformed patches or manipulation.",
      ],
    };
    if (meta.format === "jpeg") {
      const sample = await sharp(bytes, { limitInputPixels: config.maxPixels })
        .rotate()
        .resize({
          width: 1024,
          height: 1024,
          fit: "inside",
          withoutEnlargement: true,
        })
        .removeAlpha()
        .toColourspace("srgb")
        .raw()
        .toBuffer({ resolveWithObject: true });
      const recompressed = await sharp(sample.data, { raw: sample.info })
        .jpeg({ quality: 90 })
        .toBuffer();
      const pixels = await sharp(recompressed)
        .removeAlpha()
        .toColourspace("srgb")
        .raw()
        .toBuffer();
      let total = 0;
      const hist = new Uint32Array(256);
      for (let i = 0; i < pixels.length; i++) {
        const d = Math.abs(pixels[i] - sample.data[i]);
        total += d;
        hist[d]++;
      }
      let n = 0,
        p95 = 0;
      for (; p95 < 255; p95++) {
        n += hist[p95];
        if (n >= pixels.length * 0.95) break;
      }
      analysis.recompression = {
        status: "completed",
        method:
          "JPEG quality-90 recompression residual on a ≤1024px derivative",
        score: null,
        measurements: {
          meanAbsoluteResidual: Number((total / pixels.length).toFixed(3)),
          p95Residual: p95,
        },
        findings: [
          "These are measured pixel differences after recompression, not manipulation probabilities. Texture, resizing and normal JPEG encoding affect them. No suspicious-region mask is inferred.",
        ],
      };
    } else
      analysis.recompression = {
        status: "unsupported",
        method: "JPEG recompression residual",
        score: null,
        findings: ["This check applies only to JPEG inputs."],
      };
  }
  abortCheck(signal);
  return reportSchema.parse({
    version: 1,
    id: randomUUID(),
    kind: "image",
    status: insufficient ? "inconclusive" : "partial",
    assessment: "inconclusive",
    summary: insufficient
      ? "This image does not contain enough visual information for an origin assessment."
      : "File properties and limited forensic diagnostics were measured. Whether this image is AI-generated or manipulated remains inconclusive.",
    createdAt: new Date().toISOString(),
    analysis,
    sources: [],
    limitations: [
      "No authenticity percentage is calculated.",
      "Classical diagnostics are not substitutes for trained AI-generation or localization detectors.",
      "Metadata can be removed or forged; camera tags do not authenticate an image.",
      "Original uploads are held in memory for the job and discarded afterward. No images are sent to an external provider by this pipeline.",
    ],
  });
}
