// Isolated native parser: no uploaded paths, remote manifests, OCSP, or trust-list fetches.
import { readFile } from "node:fs/promises";
const output = (value) => process.stdout.write(JSON.stringify(value));
let sdk;
try {
  sdk = await import("@contentauth/c2pa-node");
} catch {
  output({
    status: "unavailable",
    method: "Optional C2PA native SDK",
    score: null,
    findings: [
      "The optional native verifier could not be loaded. Credential presence and validity were not determined.",
    ],
    measurements: { credentialStatus: "unavailable" },
  });
  process.exit(0);
}
try {
  const chunks = [];
  let size = 0;
  for await (const c of process.stdin) {
    size += c.length;
    if (size > 8 * 1024 * 1024) throw new Error("size");
    chunks.push(c);
  }
  const bytes = Buffer.concat(chunks);
  const format =
    bytes[0] === 255
      ? "image/jpeg"
      : bytes[0] === 137
        ? "image/png"
        : "image/webp";
  const configuredAnchors = process.env.C2PA_TRUST_ANCHORS;
  const trustAnchors = configuredAnchors
    ? configuredAnchors.includes("-----BEGIN CERTIFICATE-----")
      ? configuredAnchors
      : await readFile(configuredAnchors, "utf8")
    : undefined;
  const context = new sdk.Context({
    verify: {
      verifyAfterReading: true,
      verifyTrust: true,
      verifyTimestampTrust: true,
      ocspFetch: false,
      remoteManifestFetch: false,
    },
    ...(trustAnchors ? { trust: { verifyTrustList: true, trustAnchors } } : {}),
  });
  const reader = await sdk.Reader.fromAsset(
    { buffer: bytes, mimeType: format },
    context,
  );
  if (!reader)
    output({
      status: "completed",
      method: "C2PA native SDK; offline embedded-credential validation",
      score: null,
      findings: [
        "No embedded Content Credentials were found. Their absence says nothing about authenticity. Remote credentials are not fetched.",
      ],
      measurements: { credentialStatus: "absent" },
    });
  else {
    const store = reader.json();
    const state = store.validation_state;
    const active = reader.getActive();
    const codes = (store.validation_status || [])
      .map((v) => v.code)
      .filter((c) => typeof c === "string")
      .slice(0, 20);
    const credentialStatus =
      state === "Trusted"
        ? "validated"
        : state === "Invalid"
          ? "invalid"
          : state === "Valid"
            ? "untrusted"
            : "unavailable";
    output({
      status: credentialStatus === "unavailable" ? "inconclusive" : "completed",
      method: "C2PA native SDK; offline embedded-credential validation",
      score: null,
      findings: [
        credentialStatus === "validated"
          ? "Embedded credentials passed the configured signature, integrity and trust checks. This does not prove the depicted event is true."
          : credentialStatus === "invalid"
            ? "Embedded credentials failed validation. This alone does not identify AI generation."
            : credentialStatus === "untrusted"
              ? "Embedded credentials were parsed and their integrity validated, but signer trust was not established."
              : "Credentials were found but the SDK did not provide a supported validation state.",
        ...codes.map((c) => "Validation code: " + c),
        "Remote manifests, live revocation checks and universal watermark detection are not supported.",
      ],
      measurements: {
        credentialStatus,
        validationState: state || "unknown",
        embedded: reader.isEmbedded(),
        claimGenerator: String(
          active?.claim_generator ||
            active?.claim_generator_info?.map((c) => c.name).join(", ") ||
            "Not recorded",
        ).slice(0, 300),
      },
    });
  }
  bytes.fill(0);
} catch (e) {
  const remote = /remote|fetch/i.test(String(e?.message));
  output({
    status: remote ? "unsupported" : "failed",
    method: "C2PA native SDK",
    score: null,
    findings: [
      remote
        ? "Remote-only credentials are unsupported; no external manifest was fetched."
        : "Credential parsing or validation failed. No provenance verdict was produced.",
    ],
    measurements: { credentialStatus: remote ? "unsupported" : "unavailable" },
  });
}
