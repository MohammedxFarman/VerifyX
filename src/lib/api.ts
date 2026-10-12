let session: Promise<void> | undefined;
export function resetSession() {
  session = undefined;
  localStorage.removeItem("token");
}
export function ensureSession() {
  return (session ||= fetch("/api/session", {
    credentials: "same-origin",
    signal: AbortSignal.timeout(15000),
  })
    .then(async (r) => {
      if (!r.ok)
        throw new Error(
          "Your session expired. Use Sign out / reset session, then try again.",
        );
    })
    .catch((e) => {
      session = undefined;
      throw e;
    }));
}
export async function api<T = unknown>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  await ensureSession();
  const r = await fetch(url, {
    ...options,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...options.headers },
    signal: AbortSignal.any([
      options.signal || new AbortController().signal,
      AbortSignal.timeout(35000),
    ]),
  });
  const data = await r.json();
  if (!r.ok)
    throw new Error(data.error || "Request failed. No result was produced.");
  return data;
}
export async function uploadImage(
  image: string,
  signal: AbortSignal,
  onProgress: (n: number) => void,
): Promise<unknown> {
  await ensureSession();
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/verify/image?async=true");
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.timeout = 35000;
    const abort = () => xhr.abort();
    signal.addEventListener("abort", abort, { once: true });
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable)
        onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      try {
        const d = JSON.parse(xhr.responseText);
        if (xhr.status < 200 || xhr.status >= 300)
          throw new Error(d.error || "Upload failed.");
        resolve(d);
      } catch (e) {
        reject(e);
      }
    };
    xhr.onerror = () => reject(new Error("Network error while uploading."));
    xhr.ontimeout = () => reject(new Error("Upload timed out."));
    xhr.onabort = () => reject(new DOMException("Canceled", "AbortError"));
    xhr.onloadend = () => signal.removeEventListener("abort", abort);
    xhr.send(JSON.stringify({ image }));
  });
}
export function historyChanged() {
  window.dispatchEvent(new Event("verifyx-history"));
}
