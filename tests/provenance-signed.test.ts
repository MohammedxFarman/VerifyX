import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, writeFile, rm, access } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { verifyProvenance } from "../src/server/provenance";
const run = promisify(execFile);
test("actual locally signed C2PA credential validates with explicit test anchor and detects tampering", async (t) => {
  const openssl =
    process.env.OPENSSL_BIN ||
    (os.platform() === "win32"
      ? "C:/Program Files/Git/usr/bin/openssl.exe"
      : "openssl");
  try {
    await run(openssl, ["version"]);
  } catch {
    t.skip("OpenSSL unavailable; unsigned/cancellation checks still run.");
    return;
  }
  const dir = await mkdtemp(path.join(os.tmpdir(), "verifyx-cert-"));
  const old = process.env.C2PA_TRUST_ANCHORS;
  try {
    await run(openssl, [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-keyout",
      path.join(dir, "root.key"),
      "-out",
      path.join(dir, "root.pem"),
      "-days",
      "2",
      "-subj",
      "/CN=VerifyX ephemeral test root",
      "-addext",
      "basicConstraints=critical,CA:TRUE",
      "-addext",
      "keyUsage=critical,keyCertSign,cRLSign",
    ]);
    await run(openssl, [
      "req",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-keyout",
      path.join(dir, "leaf.key"),
      "-out",
      path.join(dir, "leaf.csr"),
      "-subj",
      "/CN=VerifyX test signer",
    ]);
    await writeFile(
      path.join(dir, "leaf.ext"),
      "basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature\nextendedKeyUsage=emailProtection\nsubjectKeyIdentifier=hash\nauthorityKeyIdentifier=keyid,issuer\n",
    );
    await run(openssl, [
      "x509",
      "-req",
      "-in",
      path.join(dir, "leaf.csr"),
      "-CA",
      path.join(dir, "root.pem"),
      "-CAkey",
      path.join(dir, "root.key"),
      "-CAcreateserial",
      "-out",
      path.join(dir, "leaf.pem"),
      "-days",
      "1",
      "-extfile",
      path.join(dir, "leaf.ext"),
    ]);
    const { Builder, Context, LocalSigner } =
      await import("@contentauth/c2pa-node");
    const signer = LocalSigner.newSigner(
      Buffer.concat([
        await readFile(path.join(dir, "leaf.pem")),
        await readFile(path.join(dir, "root.pem")),
      ]),
      await readFile(path.join(dir, "leaf.key")),
      "ps256",
    );
    const builder = await Builder.withJsonAsync(
      {
        claim_generator_info: [{ name: "VerifyX test" }],
        title: "Synthetic test fixture",
        format: "image/jpeg",
      },
      new Context({
        verify: {
          verifyAfterSign: false,
          ocspFetch: false,
          remoteManifestFetch: false,
        },
      }),
    );
    builder.setIntent({
      create: "http://cv.iptc.org/newscodes/digitalsourcetype/digitalCapture",
    });
    const input = await sharp({
      create: { width: 64, height: 64, channels: 3, background: "#123456" },
    })
      .jpeg()
      .toBuffer();
    builder.sign(
      signer,
      { buffer: input, mimeType: "image/jpeg" },
      { path: path.join(dir, "signed.jpg") },
    );
    const signed = await readFile(path.join(dir, "signed.jpg"));
    process.env.C2PA_TRUST_ANCHORS = path.join(dir, "root.pem");
    const valid = await verifyProvenance(signed);
    assert.equal(
      valid.measurements?.credentialStatus,
      "validated",
      JSON.stringify(valid),
    );
    const tampered = Buffer.from(signed);
    const dqt = tampered.indexOf(Buffer.from([255, 219]));
    assert.ok(dqt >= 0);
    tampered[dqt + 5] = tampered[dqt + 5] === 1 ? 2 : 1;
    const invalid = await verifyProvenance(tampered);
    assert.equal(
      invalid.measurements?.credentialStatus,
      "invalid",
      JSON.stringify(invalid),
    );
  } finally {
    if (old === undefined) delete process.env.C2PA_TRUST_ANCHORS;
    else process.env.C2PA_TRUST_ANCHORS = old;
    await rm(dir, { recursive: true, force: true });
  }
});
