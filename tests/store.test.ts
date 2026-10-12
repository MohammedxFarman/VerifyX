import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Store, type Scan } from "../src/server/store";
import { loadConfig } from "../src/server/config";
test("atomic writes survive concurrent requests, expire guests, recover interrupted jobs and preserve isolation", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "verifyx-store-"));
  const config = loadConfig({ NODE_ENV: "test", DATA_DIR: directory });
  const store = new Store(config);
  await store.init();
  try {
    await Promise.all(
      Array.from({ length: 12 }, (_, i) => {
        const s: Scan = {
          id: "job-" + i,
          userId: "user-a",
          type: "image",
          title: "test",
          target: "test",
          timestamp: new Date().toISOString(),
          status: i === 0 ? "processing" : "failed",
          ...(i === 1
            ? { expiresAt: new Date(Date.now() - 1000).toISOString() }
            : {}),
        };
        return store.put("scan", s.id, s.userId, s);
      }),
    );
    assert.equal((await store.history("user-a")).length, 11);
    assert.equal((await store.history("other")).length, 0);
    assert.equal(await store.remove("job-2", "other"), false);
    const restarted = new Store(config);
    await restarted.init();
    assert.equal((await restarted.get<Scan>("job-0"))?.status, "failed");
    assert.equal(await restarted.get("job-1"), undefined);
    assert.ok(
      JSON.parse(await readFile(config.dataFile, "utf8")).records.length === 11,
    );
    await restarted.close();
  } finally {
    await store.close();
    await rm(directory, { recursive: true, force: true });
  }
});
