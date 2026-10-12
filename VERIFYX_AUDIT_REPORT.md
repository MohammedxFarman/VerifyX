# VerifyX repository and live deployment audit
Date: 12 October 2026
Live target: https://verifyx-fue5.onrender.com/

## Conclusion
The current application cannot support its claims of verified authenticity. Confirmed code paths generate fabricated scores, evidence, and metadata without analyzing the input. These are exposed as real reports. A working Gemini response does not solve the additional problems of unsupported certainty and missing evidence collection.

Scope: repository inventory, backend routes, verification service, image upload/polling, authentication/storage, remaining feature request paths, extension, and build configuration. Live checks: homepage and one tiny image submission with initial and final job reads. No browser visual review, full build, dependency vulnerability scan, or representative accuracy benchmark was run. The user's failing image was not supplied. No application code or deployment settings were changed. One audit job was created in guest history: rec_q4zoip2ba, filename audit-one-pixel.png. The accompanying probe script submits a new job if rerun.

## Confirmed image failures
1. CRITICAL: Mock output replaces real analysis when the key is absent or a model/JSON request fails. src/services/geminiService.ts:14, 190, 263, 560. No explicit mock/provider/error status is returned. Failure can therefore look like a successful, confident authenticity result.
2. CRITICAL: getMockImageVerification receives only filename and size, never pixels. Names containing fake/edit/photoshop/etc. yield authenticity 15–27 and high risk. Small files below 250000 bytes and screenshot/messenger names yield 88–96 and low risk. Ordinary names yield 96–99 and low risk. Scores vary randomly. EXIF, dimensions, noise findings and explanations are fabricated. A normal ChatGPT image filename does not trigger the fake branch.
3. CRITICAL: Every async image request receives this mock first, even with a working provider. server.ts:190–241 and src/components/ImageVerifyView.tsx:88–123. The UI displays the report with a small pending badge rather than withholding the verdict. Canceled requests can retain the placeholder verdict.
4. HIGH: Client preprocessing resizes to 900px and re-encodes through canvas at JPEG quality 0.75 (ImageVerifyView.tsx:41–74). It loses original metadata and can degrade useful image features. The PNG condition also selects JPEG despite a comment promising transparency preservation. Sending the newly compressed size makes the small-file mock branch more likely.
5. HIGH: The real path asks a general visual model for authenticity, probability, EXIF and dimensions. There is no implemented original-file metadata parser, signature verifier, provenance validator or calibrated detector. JSON is parsed and asserted as a TypeScript type without runtime checks. No benchmark supports the displayed probabilities. Absence of visible artifacts is insufficient evidence for Verified Authentic.
6. HIGH: UI language exceeds the evidence. Score >=95 becomes VERIFIED AUTHENTIC and Safe to trust this image; AI probability over 40% becomes Confirmed Generated AI (ImageVerifyView.tsx:203, 261). The interface claims digital signature verification without corresponding implementation.
7. MEDIUM: Polling has no deadline/unmount cleanup, suppresses errors, and does not isolate successive uploads. Old results can overwrite a newer image. Error-shaped finalized responses are cast to reports. Background jobs have no persistent queue or request cancellation.

## Reproductions
Local execution of the extracted image fallback, with no image bytes supplied: photo.png -> 96 authenticity; fake.png -> 23; ChatGPT Image.png -> 98; screenshot.png -> 89. Scores are random within the code's fixed ranges. This proves filename-based behavior, not detector accuracy.

Live homepage: HTTP 200, time to first byte 0.792481 seconds, total 0.792539 seconds from this test environment. Earlier requests may have warmed the service, so this is not a cold-start measurement.

One 1x1 PNG submitted to /api/verify/image?async=true returned after ~1.08 seconds: authenticity 95, AI probability 0.01, confidence 94, LOW risk, alleged realistic skin textures and dimensions 1200x900. At ~4.51 seconds the record was still pending. A later read returned finalized=true: it recognized the 1x1 image and lack of meaningful visual data, but still returned authenticity 95 and confidence 100. The initial result demonstrably contained invented evidence. The final path failed to classify insufficient evidence as inconclusive. This does not prove the live deployment lacks an API key; its final response differed meaningfully from the fallback. Provider identity, logs, exact inference duration and deployed commit remain unverified.

## Other verification modules
- News fallback uses keyword matching and fixed confidence 0.91; references/evidence are hardcoded. Real news calls have no search/grounding tool configured. Sources are model-written strings, not retrieved and checked evidence (geminiService.ts:94, 454).
- URL fallback fabricates domain age and SSL status; ordinary HTTPS URLs default to SAFE. Real calls send the URL as text, with no implemented DNS/TLS/RDAP/reputation lookup or page retrieval (lines 144, 511).
- Profile analysis supplies only username/platform, with no retrieved profile activity. Fallback invents engagement history and uses handle keywords/digits (lines 278, 641).
- Plagiarism fallback bases originality on character-count parity: 92 for even, 45 for odd. It fabricates a Wikipedia match. No search corpus comparison is implemented in the real path (lines 324, 675).
- AI-writing fallback derives its score from word count modulo 3 and returns confidence 0.94 (line 693).
- Extension never calls the backend. Selected text always gets 18/100; URLs get fixed 12 or 91 from keywords after a timer. Manifest icon files are absent. Untrusted page text/title/URL is inserted using innerHTML (extension/popup.js:18, 44; manifest.json:17).
- Dashboard weekly trends are mostly hardcoded, seed entries are mixed with actual scans, and low-risk counts are forced to at least one. Pending/error/canceled scores are not excluded (server.ts:388–443; fileDb.ts).

## Security, accounts and persistence
- Missing/invalid tokens all become the same guest identity. Scanner components omit Authorization headers, so logged-in scans also use shared guest storage. Guest results and deletion rights are shared (server.ts:20–38; component fetch calls).
- JWT signing falls back to a secret hardcoded in source; dangerous if deployment does not override it (server.ts:11).
- Guest-accessible update-key writes the process-wide Gemini key, while the AI client caches its first key. Keys are stored as plaintext user fields and can be returned in user responses. Key updates can affect other users and may not refresh the client (server.ts:114; fileDb.ts:124; geminiService.ts:14).
- No application rate limiting, tight image validation or per-user inference quotas; JSON body limit is 50MB.
- JSON database writes synchronously rewrite all state; write errors are logged without informing callers. This blocks the event loop as history grows and lacks multi-process coordination.
- Default database path is local src/db/data.json. Free Render files disappear on restart/redeploy/spin-down, losing accounts/history. Current checked-out data contains zero users/passwords/keys; do not infer a credential leak from that file.
- Forgot-password only displays a message saying email was sent; no reset flow exists. Image Share only toggles UI state. Chat accepts history but does not pass it into the provider chat.

## Render startup and latency
Render documents free-service sleep after 15 idle minutes and approximately one minute to spin back up: https://render.com/docs/free#spinning-down-on-idle . This is a likely explanation if this service uses Free compute; the actual plan/logs were not accessible. A warm response under one second does not disprove an idle-start delay.

Repository contributors: app selects Vite development middleware unless NODE_ENV=production; package start does not itself set that variable. Gemini calls can attempt the primary twice and then fallback, with no application-level total deadline. Initial dashboard requests run sequentially. Whole-file synchronous persistence adds load. README points to a different live URL and recommends .env.local, but backend code does not explicitly load that file before reading process.env.

Deployment review should verify NODE_ENV=production, build npm ci && npm run build, start npm start, PORT binding, valid provider configuration, and an explicit lightweight health/readiness endpoint. Build dependencies must be available during build. Bind to PORT already exists. A static frontend can show immediately while the API wakes; an always-on paid service removes Free idle spin-down. Neither option fixes verification correctness. No plan change is required to remove fabricated reports.

## Priority repair plan
P0: Remove automatic mock fallbacks from production. Return explicit unavailable/failed/inconclusive states without numeric verdicts. Async requests should return 202 plus job ID/status only. Display scores only on validated completed results. Label any retained demo mode clearly.
P0: Correct unsupported certainty; a blank/uninformative image must be inconclusive. Treat AI generation, manipulation, provenance and factual truth separately.
P1: Preserve original files for metadata/provenance checks; use resized copies only for visual inspection. Add schema/range validation, safe source handling, provider/method reporting, request deadlines and job lifecycle cleanup.
P1: Fix guest isolation, auth headers, invalid-token rejection, secret/key handling, quotas and durable database storage.
P1: Replace fabricated module evidence with actual relevant retrieval/checks, and do not report fields that were not measured.
P2: Test known camera photos and AI-generated samples with documented provenance, including resized/recompressed variants. Measure confusion matrix and false-real/false-fake rates. Verify filename invariance, missing key, timeout, invalid provider JSON, pending/error/cancel states and successive uploads. No percentage-accuracy claim is defensible before this validation.

No tests/test script or Render blueprint were found in this checkout. The package has a TypeScript lint command and build command, neither executed for this report. This audit identifies confirmed implementation defects; it does not claim exhaustive security assurance or reliable AI-image detection after a prompt-only fix.
