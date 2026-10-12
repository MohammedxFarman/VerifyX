import "dotenv/config";
import { randomBytes } from "node:crypto";
import path from "node:path";

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const production = env.NODE_ENV === "production";
  const secret =
    env.JWT_SECRET || (!production ? randomBytes(48).toString("hex") : "");
  if (secret.length < 32)
    throw new Error("JWT_SECRET must contain at least 32 characters.");
  if (production && !env.DATABASE_URL && !env.DATA_DIR)
    throw new Error("Configure DATABASE_URL or DATA_DIR on a persistent disk.");
  return {
    production,
    secret,
    port: Number(env.PORT || 3000),
    databaseUrl: env.DATABASE_URL,
    dataFile:
      env.DB_FILE ||
      path.join(
        env.DATA_DIR || path.join(process.cwd(), "data"),
        "verifyx.json",
      ),
    geminiKey: env.GEMINI_API_KEY || "",
    geminiModel: env.GEMINI_MODEL || "gemini-2.5-flash",
    searchKey: env.BRAVE_SEARCH_API_KEY || "",
    maxImageBytes: 8 * 1024 * 1024,
    maxPixels: 20_000_000,
    jobTimeoutMs: 45_000,
    guestLifetimeMs: 24 * 60 * 60 * 1000,
    allowOrigin: env.APP_ORIGIN || "",
  };
}
export type Config = ReturnType<typeof loadConfig>;
