import express, { type RequestHandler } from "express";
import path from "node:path";
import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { loadConfig, type Config } from "./src/server/config";
import { Store, publicUser, type Account, type Scan } from "./src/server/store";
import { AppError } from "./src/server/errors";
import { analyzeImage, decodeUpload, validateImage } from "./src/server/image";
import {
  verifyNews,
  verifyUrl,
  compareDocuments,
  unavailableReport,
} from "./src/server/verification";
import { askGemini } from "./src/services/geminiService";
import { reportSchema, type EvidenceReport } from "./src/shared/report";

const wrap =
  (fn: (req: any, res: express.Response) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res)).catch(next);
  };
const text = z.string().trim().min(5).max(20000);
export async function createApp(
  config: Config = loadConfig(),
  options: {
    store?: Store;
    imageAnalyzer?: typeof analyzeImage;
    staticFiles?: boolean;
  } = {},
) {
  const store = options.store || new Store(config);
  await store.init();
  const app = express();
  app.disable("x-powered-by");
  // Trust exactly Render's ingress hop, never arbitrary client-forwarded chains.
  if (process.env.RENDER === "true") app.set("trust proxy", 1);
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Frame-Options", "DENY");
    if (req.path.startsWith("/api/"))
      res.setHeader("Cache-Control", "no-store");
    if (config.production)
      res.setHeader(
        "Content-Security-Policy",
        "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; font-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
      );
    next();
  });
  app.get("/api/health", (_req, res) => res.json({ status: "ok", version: 1 }));
  app.use(
    "/api",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 600,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      message: { error: "Too many requests. Try again later." },
    }),
  );
  app.use("/api", (req, res, next) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      const origin = req.get("origin");
      const expected =
        config.allowOrigin || req.protocol + "://" + req.get("host");
      if (origin && origin !== expected && !req.get("authorization"))
        return res
          .status(403)
          .json({
            error: "Cross-origin writes require an explicit session token.",
          });
      if (req.method !== "DELETE" && !req.is("application/json"))
        return res.status(415).json({ error: "Use application/json." });
    }
    next();
  });
  const ipQuota = rateLimit({
    windowMs: 3600000,
    limit: 60,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Network analysis quota reached. Try later." },
  });
  app.use("/api/verify", (req, res, next) =>
    req.method === "POST" && !req.path.startsWith("/cancel/")
      ? ipQuota(req, res, next)
      : next(),
  );
  app.use("/api/verify/image", express.json({ limit: "12mb" }));
  app.use(express.json({ limit: "100kb" }));
  const cookieName = "verifyx_session";
  function issue(res: express.Response, id: string, guest: boolean) {
    const token = jwt.sign({ sub: id, guest }, config.secret, {
      algorithm: "HS256",
      expiresIn: guest ? "24h" : "7d",
      issuer: "verifyx",
      audience: "verifyx-app",
    });
    res.cookie(cookieName, token, {
      httpOnly: true,
      secure: config.production,
      sameSite: "lax",
      maxAge: guest ? config.guestLifetimeMs : 7 * 86400000,
      path: "/",
    });
    return token;
  }
  const authenticate: RequestHandler = (req, res, next) => {
    const originalNext = (error?: unknown) => next(error);
    // Run dedicated async identity resolver through a response-free callback.
    Promise.resolve(
      (async () => {
        const bearer = req.get("authorization");
        const cookie = req.headers.cookie
          ?.split(";")
          .map((s) => s.trim())
          .find((s) => s.startsWith(cookieName + "="))
          ?.slice(cookieName.length + 1);
        const token = bearer
          ? bearer.startsWith("Bearer ")
            ? bearer.slice(7)
            : "invalid"
          : cookie;
        const request = req as any;
        if (!token) {
          request.identity = { id: "g_" + randomUUID(), guest: true };
          request.newSession = issue(res, request.identity.id, true);
          return;
        }
        try {
          const p = jwt.verify(token, config.secret, {
            algorithms: ["HS256"],
            issuer: "verifyx",
            audience: "verifyx-app",
          });
          if (
            typeof p === "string" ||
            typeof p.sub !== "string" ||
            typeof p.guest !== "boolean" ||
            (!p.guest && !(await store.get<Account>(p.sub)))
          )
            throw new Error();
          request.identity = { id: p.sub, guest: p.guest };
          request.sessionToken = token;
        } catch {
          throw new AppError(
            401,
            "Your session is invalid or expired. Sign in again.",
            "invalid_session",
          );
        }
      })(),
    ).then(() => next(), originalNext);
  };
  const authLimit = rateLimit({
    windowMs: 15 * 60000,
    limit: 20,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Too many authentication attempts. Try later." },
  });
  app.post("/api/auth/logout", (_req, res) => {
    res.clearCookie(cookieName, {
      httpOnly: true,
      secure: config.production,
      sameSite: "lax",
      path: "/",
    });
    res.json({ success: true });
  });
  app.post(
    "/api/auth/register",
    authLimit,
    wrap(async (req, res) => {
      const input = z
        .object({
          email: z
            .string()
            .email()
            .max(254)
            .transform((s) => s.toLowerCase()),
          fullName: z.string().trim().min(1).max(100),
          password: z
            .string()
            .min(12)
            .max(72)
            .refine(
              (s) => Buffer.byteLength(s) <= 72,
              "Password must fit within 72 UTF-8 bytes.",
            ),
        })
        .parse(req.body);
      if (await store.userByEmail(input.email))
        throw new AppError(409, "An account with this email already exists.");
      const user: Account = {
        id: "u_" + randomUUID(),
        email: input.email,
        fullName: input.fullName,
        passwordHash: await bcrypt.hash(input.password, 12),
        createdAt: new Date().toISOString(),
      };
      try {
        await store.createUser(user);
      } catch (e: any) {
        if (e.code === "23505" || e.message === "duplicate_user")
          throw new AppError(409, "An account with this email already exists.");
        throw e;
      }
      issue(res, user.id, false);
      res.status(201).json({ user: publicUser(user) });
    }),
  );
  app.post(
    "/api/auth/login",
    authLimit,
    wrap(async (req, res) => {
      const input = z
        .object({
          email: z
            .string()
            .email()
            .max(254)
            .transform((s) => s.toLowerCase()),
          password: z.string().min(1).max(72),
        })
        .parse(req.body);
      const user = await store.userByEmail(input.email);
      const valid = await bcrypt.compare(
        input.password,
        user?.passwordHash ||
          "$2b$12$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy",
      );
      if (!user || !valid)
        throw new AppError(401, "Invalid email or password.");
      issue(res, user.id, false);
      res.json({ user: publicUser(user) });
    }),
  );
  app.post("/api/auth/forgot-password", authLimit, (_req, res) =>
    res
      .status(503)
      .json({
        error:
          "Email password recovery is not configured. No email has been sent.",
      }),
  );
  app.use("/api", authenticate);
  app.get("/api/session", (req: any, res) =>
    res.json({
      sessionToken: req.newSession || req.sessionToken,
      isGuest: req.identity.guest,
    }),
  );
  app.get(
    "/api/auth/me",
    wrap(async (req, res) =>
      res.json({
        user: req.identity.guest
          ? { id: req.identity.id, fullName: "Guest", isGuest: true }
          : publicUser((await store.get<Account>(req.identity.id))!),
        isGuest: req.identity.guest,
      }),
    ),
  );
  app.post("/api/auth/update-key", (_req, res) =>
    res
      .status(403)
      .json({
        error:
          "Provider keys are managed through server environment secrets only.",
      }),
  );
  app.get("/api/capabilities", (_req, res) =>
    res.json({
      imageMetadata: true,
      classicalImageDiagnostics: true,
      aiImageDetector: false,
      localization: false,
      c2pa: "Optional offline embedded-credential verifier",
      newsSearch: !!config.searchKey,
      gemini: !!config.geminiKey,
      profileApi: false,
      aiWritingDetector: false,
      documentComparison: true,
      persistence: config.databaseUrl
        ? "postgresql"
        : config.production
          ? "configured-disk"
          : "local-file",
    }),
  );
  const quota = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 30,
    keyGenerator: (req: any) => req.identity.id,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Session analysis quota reached (30/hour)." },
  });
  app.use("/api/verify", (req, res, next) =>
    req.method === "POST" && !req.path.startsWith("/cancel/")
      ? quota(req, res, next)
      : next(),
  );
  app.use("/api/chat", quota);
  const active = new Map<
    string,
    { controller: AbortController; owner: string; tail: Promise<unknown> }
  >();
  const mutateJob = async (id: string, fn: (scan: Scan) => Promise<void>) => {
    const job = active.get(id);
    if (!job) return;
    const task = job.tail.then(async () => {
      const scan = await store.get<Scan>(id);
      if (scan) await fn(scan);
    });
    job.tail = task.catch(() => {});
    await task;
  };
  async function record(req: any, report: EvidenceReport, target: string) {
    const scan: Scan = {
      id: report.id,
      userId: req.identity.id,
      type: report.kind,
      title:
        report.kind === "image"
          ? "Image evidence report"
          : report.kind + " report",
      target: target.slice(0, 200),
      timestamp: report.createdAt,
      status: "completed",
      report,
      ...(req.identity.guest
        ? {
            expiresAt: new Date(
              Date.now() + config.guestLifetimeMs,
            ).toISOString(),
          }
        : {}),
    };
    await store.put("scan", scan.id, scan.userId, scan);
    return scan;
  }
  app.post(
    "/api/verify/image",
    wrap(async (req, res) => {
      if (active.size >= 2)
        throw new AppError(
          429,
          "Image workers are busy. Try again shortly.",
          "busy",
        );
      if ([...active.values()].some((j) => j.owner === req.identity.id))
        throw new AppError(
          429,
          "One image can be processed per session at a time. Cancel or finish the current job.",
          "busy",
        );
      const id = randomUUID(),
        controller = new AbortController();
      active.set(id, {
        controller,
        owner: req.identity.id,
        tail: Promise.resolve(),
      });
      let bytes: Buffer;
      try {
        bytes = decodeUpload(req.body.image, config.maxImageBytes);
        await validateImage(bytes, config);
      } catch (e) {
        active.delete(id);
        throw e;
      }
      const scan: Scan = {
        id,
        userId: req.identity.id,
        type: "image",
        title: "Image evidence report",
        target: "Uploaded image",
        timestamp: new Date().toISOString(),
        status: "queued",
        ...(req.identity.guest
          ? {
              expiresAt: new Date(
                Date.now() + config.guestLifetimeMs,
              ).toISOString(),
            }
          : {}),
      };
      try {
        await store.put("scan", id, scan.userId, scan);
      } catch (e) {
        active.delete(id);
        bytes.fill(0);
        throw e;
      }
      res.status(202).json({ job_id: id, status: "queued" });
      setImmediate(async () => {
        const timer = setTimeout(() => controller.abort(), config.jobTimeoutMs);
        try {
          await mutateJob(id, async (current) => {
            if (current.status === "canceled") return;
            await store.put("scan", id, current.userId, {
              ...current,
              status: "processing",
            });
          });
          controller.signal.throwIfAborted();
          const report = reportSchema.parse(
            await (options.imageAnalyzer || analyzeImage)(
              bytes,
              config,
              controller.signal,
            ),
          );
          report.id = id;
          await mutateJob(id, async (current) => {
            if (current.status === "canceled") return;
            if (controller.signal.aborted)
              throw new AppError(408, "Analysis exceeded its time limit.");
            await store.put("scan", id, current.userId, {
              ...current,
              status: "completed",
              report,
            });
          });
        } catch (error) {
          try {
            await mutateJob(id, async (current) => {
              if (current.status !== "canceled")
                await store.put("scan", id, current.userId, {
                  ...current,
                  status: "failed",
                  report: undefined,
                  error:
                    error instanceof AppError
                      ? error.message
                      : controller.signal.aborted
                        ? "Analysis timed out. Please retry."
                        : "Image analysis failed. No verdict was produced.",
                });
            });
          } catch {
            console.error("Failed to persist image job state.");
          }
        } finally {
          clearTimeout(timer);
          active.delete(id);
          bytes.fill(0);
        }
      });
    }),
  );
  const owned = async (req: any) => {
    const scan = await store.get<Scan>(req.params.id);
    if (
      !scan ||
      scan.userId !== req.identity.id ||
      (scan.expiresAt && Date.parse(scan.expiresAt) <= Date.now())
    )
      throw new AppError(404, "Report not found.");
    return scan;
  };
  app.get(
    "/api/verify/result/:id",
    wrap(async (req, res) => {
      const s = await owned(req);
      res.json({
        job_id: s.id,
        status: s.status,
        ...(s.status === "completed" ? { report: s.report } : {}),
        ...(s.status === "failed" ? { error: s.error } : {}),
      });
    }),
  );
  app.post(
    "/api/verify/cancel/:id",
    wrap(async (req, res) => {
      const s = await owned(req);
      if (!["queued", "processing"].includes(s.status))
        return res
          .status(409)
          .json({ error: "Only a pending job can be canceled." });
      active.get(s.id)?.controller.abort();
      await mutateJob(s.id, async (current) => {
        if (["queued", "processing"].includes(current.status))
          await store.put("scan", s.id, s.userId, {
            ...current,
            status: "canceled",
            report: undefined,
          });
      });
      res.json({ job_id: s.id, status: "canceled" });
    }),
  );
  for (const kind of [
    "news",
    "url",
    "profile",
    "plagiarism",
    "ai-content",
  ] as const)
    app.post(
      "/api/verify/" + kind,
      wrap(async (req, res) => {
        const signal = AbortSignal.timeout(30000);
        let report: EvidenceReport, target: string;
        if (kind === "url") {
          target = z.string().max(2048).parse(req.body.url);
          report = await verifyUrl(target, signal);
        } else if (kind === "profile") {
          const data = z
            .object({
              username: z.string().trim().min(1).max(100),
              platform: z.string().trim().min(1).max(50),
            })
            .parse(req.body);
          target = data.username + " on " + data.platform;
          report = unavailableReport("profile", target);
        } else {
          target = text.parse(req.body.content);
          report =
            kind === "news"
              ? await verifyNews(target, config, signal)
              : kind === "plagiarism"
                ? compareDocuments(
                    target,
                    z.string().max(20000).default("").parse(req.body.reference),
                  )
                : unavailableReport("ai-content", target);
        }
        report = reportSchema.parse(report);
        await record(req, report, target);
        res.json(report);
      }),
    );
  app.post(
    "/api/chat",
    wrap(async (req, res) =>
      res.json({
        reply: await askGemini(config, text.parse(req.body.message)),
      }),
    ),
  );
  app.get(
    "/api/history",
    wrap(async (req, res) => res.json(await store.history(req.identity.id))),
  );
  app.delete(
    "/api/history/:id",
    wrap(async (req, res) => {
      const s = await owned(req);
      if (["queued", "processing"].includes(s.status))
        throw new AppError(409, "Cancel this job before deleting it.");
      res.json({ success: await store.remove(s.id, req.identity.id) });
    }),
  );
  app.get(
    "/api/dashboard/stats",
    wrap(async (req, res) => {
      const all = await store.history(req.identity.id);
      const completed = all.filter(
        (s) =>
          s.status === "completed" &&
          s.report &&
          ["completed", "partial"].includes(s.report.status),
      );
      const days = Array.from({ length: 7 }, (_, i) =>
        new Date(Date.now() - (6 - i) * 86400000).toISOString().slice(0, 10),
      );
      res.json({
        totalVerifications: completed.length,
        partial: completed.filter((s) => s.report?.status === "partial").length,
        inconclusive: all.filter(
          (s) =>
            s.status === "completed" && s.report?.assessment === "inconclusive",
        ).length,
        pending: all.filter((s) => ["queued", "processing"].includes(s.status))
          .length,
        recentVerifications: all.slice(0, 5),
        byType: [
          "news",
          "website",
          "image",
          "profile",
          "plagiarism",
          "ai-content",
        ].map((name) => ({
          name,
          value: completed.filter((s) => s.type === name).length,
        })),
        trends: days.map((date) => ({
          date,
          count: completed.filter((s) => s.timestamp.startsWith(date)).length,
        })),
      });
    }),
  );
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "API route not found." }),
  );
  if (options.staticFiles !== false) {
    if (config.production) {
      const dist = path.join(process.cwd(), "dist");
      app.use(express.static(dist));
      app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));
    } else {
      const { createServer } = await import("vite");
      const vite = await createServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
      app.locals.vite = vite;
    }
  }
  app.use(
    (
      err: any,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      if (res.headersSent) return;
      if (err instanceof z.ZodError)
        return res
          .status(400)
          .json({
            error: "Invalid request or response data.",
            code: "validation_error",
          });
      if (err instanceof AppError)
        return res
          .status(err.status)
          .json({ error: err.message, code: err.code });
      if (err.type === "entity.too.large")
        return res
          .status(413)
          .json({
            error: "Request exceeds the upload limit.",
            code: "upload_too_large",
          });
      if (err.name === "TimeoutError" || err.name === "AbortError")
        return res
          .status(504)
          .json({
            error: "Analysis timed out. No verdict was produced.",
            code: "provider_timeout",
          });
      if (err.type === "entity.parse.failed")
        return res.status(400).json({ error: "Malformed JSON." });
      console.error("Request failed:", err?.name || "Error");
      res
        .status(500)
        .json({
          error: "Request failed. No verification result was generated.",
        });
    },
  );
  const cleanup = setInterval(
    () =>
      store.prune().catch(() => console.error("History expiration failed.")),
    60 * 60000,
  );
  cleanup.unref();
  return {
    app,
    store,
    close: async () => {
      clearInterval(cleanup);
      for (const job of active.values()) job.controller.abort();
      await app.locals.vite?.close();
      await store.close();
    },
  };
}
if (process.env.VERIFYX_TEST !== "1") {
  createApp()
    .then(({ app, close }) => {
      const server = app.listen(
        Number(process.env.PORT || 3000),
        "0.0.0.0",
        () =>
          console.log(
            "VerifyX listening on port " + (process.env.PORT || 3000),
          ),
      );
      server.requestTimeout = 60000;
      server.headersTimeout = 15000;
      process.once("SIGTERM", () => {
        server.close(() => {
          void close().then(() => process.exit(0));
        });
        setTimeout(() => process.exit(1), 10000).unref();
      });
    })
    .catch(() => {
      console.error(
        "Startup failed. Check JWT_SECRET, persistence configuration and database connectivity.",
      );
      process.exitCode = 1;
    });
}
