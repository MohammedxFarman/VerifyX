import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
process.env.VERIFYX_TEST = "1";
const { loadConfig } = await import("../src/server/config");
const { createApp } = await import("../server");
const directory = await mkdtemp(path.join(os.tmpdir(), "verifyx-browser-"));
const config = loadConfig({
  NODE_ENV: "test",
  DATA_DIR: directory,
  PORT: "3199",
});
const instance = await createApp(config);
const server = instance.app.listen(3199, "127.0.0.1");
const stop = () =>
  server.close(
    () =>
      void instance
        .close()
        .then(() => rm(directory, { recursive: true, force: true }))
        .then(() => process.exit(0)),
  );
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
