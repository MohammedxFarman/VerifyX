# VerifyX

Verify Everything. Trust Confidently.

VerifyX is the existing React/TypeScript + Express application repaired to report measured evidence and explicit uncertainty. It is not a validated universal fake-image detector.

## Run locally

Requirements: Node.js 22.12+ and npm. No Python, GPU or model download is needed.

1. Run npm ci --include=dev.
2. Copy .env.example to .env. Set a private random JWT_SECRET of at least 32 characters. Generate with: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))". Never commit that value.
3. For development DATA_DIR=./data is sufficient. Run npm run dev and open http://localhost:3000.
4. Production: npm run lint, npm run build, then npm start. Configure durable storage first. npm start always enforces production mode.

Development generates an ephemeral signing secret if omitted, invalidating sessions after restart. Production refuses to start without an explicit secret and DATABASE_URL or DATA_DIR. A directory setting alone is not durable storage: on Render it must point to a persistent mounted disk.

## Implemented capabilities

| Module | Actual behavior | Limitation |
| --- | --- | --- |
| Image | Original-byte validation, bounded decode, dimensions, selected EXIF, SHA-256, exact repeated textured blocks and JPEG recompression residuals | No trained AI-origin or manipulation/localization model; no authenticity score or mask |
| Provenance | Optional official C2PA native verifier in an isolated subprocess; offline embedded-credential validation | Native package must load; remote manifests and live revocation checks disabled; trust depends on anchors |
| News | Brave Search, bounded source retrieval, optional Gemini comparison of retrieved excerpts | Search key required; snippets and model summaries clearly distinguished from independent evidence |
| URL | Syntax, public DNS, address-pinned HTTP HEAD, restricted redirects, actual TLS certificate validation | No threat-intelligence or registration-age integration; HTTPS does not mean safe |
| Profiles | Explicit unavailable state | No authorized platform API connected |
| Text comparison | Exact five-word overlap against supplied reference | Not internet-wide plagiarism detection or proof of plagiarism |
| AI writing | Explicit unavailable state | No validated authorship detector installed |
| Assistant | Gemini response with runtime-validated JSON and timeout | Key required; no fallback-generated answers |
| Dashboard/history | Owned records and real counts | Unavailable, failed, pending and canceled jobs excluded from measured-completion totals |
| Extension | Real backend URL/claim calls, isolated guest token and safe text rendering | Requires the repaired backend API |

Production mock generators were removed. No demo mode is enabled. Original legacy data.json is preserved but not served or counted.

## Environment

See .env.example for all settings.

- JWT_SECRET: high-entropy signing secret, mandatory in production.
- DATABASE_URL: durable PostgreSQL connection string. Creates its own table/indexes without dropping existing tables. Use the provider's TLS/CA settings; never disable certificate checks.
- DATA_DIR: alternative single-process file storage. Use a mounted persistent disk in production. Writes are serialized and atomically renamed. Do not share a file store between instances.
- DB_FILE: optional new-format JSON file override. Do not point it to the old src/db/data.json; use migration.
- PORT: default 3000; supplied by Render.
- APP_ORIGIN: canonical public origin, such as https://verifyx-fue5.onrender.com.
- BRAVE_SEARCH_API_KEY: optional real source search; without it news analysis is unavailable.
- GEMINI_API_KEY and GEMINI_MODEL: optional source comparison and assistant. Default identifier gemini-2.5-flash; confirm availability for your account. Errors never produce mock reports.
- C2PA_TRUST_ANCHORS: optional operator-curated PEM file/path or inline PEM. Never use user uploads or test certificates as production trust anchors.
- PLAYWRIGHT_CHANNEL: defaults to installed Chrome. Use chromium with a separately installed Playwright browser in CI.

Provider keys cannot be changed via the public API and are never returned in user objects. The image pipeline does not send uploads to Gemini. Search sends claims to Brave; configured source comparison sends claims and excerpts to Gemini. Avoid confidential content in those modules.

## Limits and lifecycle

- JPEG, PNG, WebP still images only; 8 MB, 20 megapixels and 12000px per dimension limits. Actual bytes are validated. Animated or malformed inputs are rejected.
- Originals stay in memory and are overwritten/released after processing. Only reports are persisted. GPS and device serials are omitted.
- Tiny, transparent or nearly uniform images are inconclusive.
- Maximum two image jobs per process, one per session. Application deadline 45 seconds; native C2PA worker deadline 8 seconds. Sharp work is bounded by input size and checked for cancellation between stages, but native decoding cannot be interrupted mid-operation.
- Initial image response is HTTP 202 with job_id/status only. Poll /api/verify/result/:id. Only completed jobs expose a report. Cancel through POST /api/verify/cancel/:id.
- Frontend clears old results, guards successive uploads, cancels on unmount and limits polling to 65 seconds. Restarted unfinished jobs are marked failed.
- Signed HttpOnly SameSite cookies isolate sessions; production cookies are Secure. Extension bearer tokens identify isolated guests. Guest reports expire after 24 hours; registered reports remain until deletion.
- Invalid JWTs are rejected. Authentication, IP usage and session inference are rate-limited. Limits and job workers are in-process; use one instance.
- bcrypt hashes passwords. Email recovery is explicitly unavailable until a real mail/reset flow is configured.

## Verification commands

    npm run lint
    npm test
    npm run build
    npm run test:production
    npm run test:browser
    npm audit

Browser tests start an isolated backend and exercise desktop/mobile Chrome. Unit/API tests generate fixtures and use test doubles for providers without calling paid APIs. Those test doubles are never production fallback paths. Generated image fixtures are not an accuracy benchmark. No model accuracy percentage has been measured.

The backend bundle is in build/, separate from publicly served dist/. Production smoke checks use the built server. Browser screenshots/traces go into ignored test-results/. An optional external smoke check, node --import tsx scripts/network-smoke.ts, performs a real public DNS/HTTP/TLS check against example.com.

## Render deployment

render.yaml is a template, not evidence that the existing service has been deployed.

1. Back up existing accounts/history before redeploying. The old service's local disk may be ephemeral.
2. Configure durable PostgreSQL with DATABASE_URL, or a paid mounted disk through DATA_DIR. Free Render services have no persistent disks.
3. Set NODE_ENV=production, stable JWT_SECRET, APP_ORIGIN and optional provider keys in Render secrets. Replacing the signing secret logs users out.
4. Build: npm ci --include=dev && npm run lint && npm run build.
5. Start: npm start. Health: /api/health. Keep a single instance; PostgreSQL does not turn the local runner into a distributed queue.
6. Deploy a reviewed commit. Verify health, capabilities, account login, isolated history, image job completion and C2PA package loading on Linux.
7. Configure the extension backend origin and grant its requested host permission.

Free Render services sleep after 15 idle minutes and can take about one minute to wake: https://render.com/docs/free#spinning-down-on-idle . An always-on compute plan removes that free-tier idle behavior. No hosting plan or infrastructure was changed automatically.

Live PostgreSQL, configured external providers, Linux native binaries and actual production deployment still need environment-specific validation. A successful local build does not make the service production-ready.

## Legacy data

The original src/db/data.json remains unchanged. Mock/seed reports are never mixed with new analytics. The new store starts separately.

Inspect with npm run migrate:legacy -- path/to/old/data.json (dry run). After backing up both stores, add --apply. The importer preserves eligible registered accounts and bcrypt hashes, marks old owned reports legacy/unverified, excludes shared guests/seeds and never imports old API keys. The source is not modified. Existing matching accounts are skipped. Migration is not a cross-store transaction; inspect partial results before retrying after failure.

## Extension

Load extension/ unpacked in Chromium. Manifest V3 and context menus are preserved. The popup uses the real URL/news APIs, session-scoped tokens and textContent for untrusted input. Backend origin is configurable with optional host permission. The popup reports backend errors rather than fallback scores. Actual extension installation is separate from the main web-app browser suite.

## Model feasibility and limitations

The inspected runtime has Node 22, Python 3.13, about 7 GB RAM, and no PyTorch/ONNX runtime. No compatible weights or labeled camera/AI/manipulated dataset was supplied. No large model was downloaded or trained.

- CAT-Net uses an older PyTorch/CUDA setup and separately hosted checkpoints: https://github.com/mjkwon2021/CAT-Net . It is not integrated.
- MVSS-Net is a potential localization model requiring separate runtime/weight evaluation: https://github.com/dong03/MVSS-Net . It is not integrated.
- umm-maybe/AI-image-detector targets older artistic generator outputs and warns about screenshots/general imagery. Its model card has differing license labels requiring clarification: https://huggingface.co/umm-maybe/AI-image-detector . It is not adopted here.
- C2PA SDK: https://github.com/contentauth/c2pa-js/tree/main/packages/c2pa-node . Provenance is distinct from AI-image classification; trusted credentials do not prove a scene is true. No universal watermark detection is claimed.

Future detector work needs licensed weights, measured hosting memory/latency, labeled camera/AI/manipulated examples and testing across crops, compression and unseen generators. Add localization only from actual model masks. Metadata and classical diagnostics are not substitutes for those models.
