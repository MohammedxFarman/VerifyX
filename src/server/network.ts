import http from "node:http";
import https from "node:https";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { TLSSocket } from "node:tls";
import ipaddr from "ipaddr.js";
import { AppError } from "./errors";

export function publicAddress(address: string) {
  try {
    return ipaddr.process(address).range() === "unicast";
  } catch {
    return false;
  }
}
export function parsePublicUrl(input: string) {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new AppError(
      400,
      "Enter a complete http:// or https:// URL.",
      "invalid_url",
    );
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    (url.port && !["80", "443"].includes(url.port))
  )
    throw new AppError(
      400,
      "Only HTTP(S) URLs on standard ports without credentials are supported.",
      "invalid_url",
    );
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (
    !host ||
    host.endsWith(".") ||
    host === "localhost" ||
    /\.(localhost|local|internal|test|invalid|example)$/.test(host) ||
    (!host.includes(".") && !isIP(host)) ||
    (isIP(host) && !publicAddress(host))
  )
    throw new AppError(
      400,
      "Local, private and reserved destinations are not allowed.",
      "restricted_url",
    );
  url.hash = "";
  return url;
}
export async function resolvePublic(host: string) {
  const answers = isIP(host)
    ? [{ address: host, family: isIP(host) }]
    : await lookup(host, { all: true, verbatim: true });
  if (!answers.length || answers.some((a) => !publicAddress(a.address)))
    throw new AppError(
      400,
      "Destination resolves to a private or reserved network.",
      "restricted_url",
    );
  return answers;
}
export interface PageResponse {
  url: string;
  status: number;
  body: string;
  contentType: string;
  addresses: string[];
  redirects: string[];
  tls?: { authorized: boolean; validTo: string; issuer: string };
}
export async function safeRequest(
  input: string,
  options: {
    signal?: AbortSignal;
    method?: "GET" | "HEAD";
    maxBytes?: number;
  } = {},
  redirects: string[] = [],
): Promise<PageResponse> {
  const url = parsePublicUrl(input);
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const signal = AbortSignal.any([
    options.signal || new AbortController().signal,
    AbortSignal.timeout(8000),
  ]);
  const answers = await Promise.race([
    resolvePublic(host),
    new Promise<never>((_, reject) => {
      if (signal.aborted) reject(new AppError(504, "Network check timed out."));
      else
        signal.addEventListener(
          "abort",
          () => reject(new AppError(504, "Network check timed out.")),
          { once: true },
        );
    }),
  ]);
  signal.throwIfAborted();
  const address = answers[0];
  const page = await new Promise<PageResponse & { location?: string }>(
    (resolve, reject) => {
      const transport = url.protocol === "https:" ? https : http;
      const req = transport.request(
        url,
        {
          method: options.method || "GET",
          signal,
          agent: false,
          family: address.family,
          lookup: ((_h: any, _o: any, cb: any) =>
            cb(null, address.address, address.family)) as any,
          headers: {
            "User-Agent": "VerifyX/1.0 (evidence check)",
            Accept: "text/html,text/plain;q=0.9",
            "Accept-Encoding": "identity",
          },
        },
        (res) => {
          let size = 0;
          const chunks: Buffer[] = [];
          const socket = res.socket as TLSSocket;
          const cert =
            url.protocol === "https:" ? socket.getPeerCertificate() : undefined;
          const tls = cert
            ? {
                authorized: socket.authorized,
                validTo: cert.valid_to || "",
                issuer: typeof cert.issuer?.O === "string" ? cert.issuer.O : "",
              }
            : undefined;
          res.on("data", (chunk: Buffer) => {
            size += chunk.length;
            if (size > (options.maxBytes || 128 * 1024)) {
              req.destroy(
                new AppError(413, "Remote page exceeds the retrieval limit."),
              );
              return;
            }
            chunks.push(chunk);
          });
          res.on("error", reject);
          res.on("end", () =>
            resolve({
              url: url.href,
              status: res.statusCode || 0,
              body: Buffer.concat(chunks).toString("utf8"),
              contentType: String(res.headers["content-type"] || ""),
              addresses: answers.map((a) => a.address),
              redirects,
              tls,
              location: res.headers.location,
            }),
          );
        },
      );
      req.on("error", reject);
      req.end();
    },
  );
  if ([301, 302, 303, 307, 308].includes(page.status) && page.location) {
    if (redirects.length >= 3)
      throw new AppError(400, "Redirect limit exceeded.");
    return safeRequest(new URL(page.location, url).href, options, [
      ...redirects,
      url.href,
    ]);
  }
  return page;
}
export async function boundedJson(
  response: Response,
  maxBytes = 256 * 1024,
): Promise<unknown> {
  if (!response.ok) {
    await response.body?.cancel();
    throw new AppError(
      503,
      "Configured provider returned an error.",
      "provider_unavailable",
    );
  }
  const reader = response.body?.getReader();
  if (!reader)
    throw new AppError(
      502,
      "Provider returned an empty response.",
      "invalid_provider_response",
    );
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > maxBytes)
        throw new AppError(
          502,
          "Provider response exceeded the size limit.",
          "invalid_provider_response",
        );
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (e) {
    await reader.cancel().catch(() => {});
    if (e instanceof AppError) throw e;
    throw new AppError(
      502,
      "Provider returned invalid JSON.",
      "invalid_provider_response",
    );
  }
}
