import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { loadConfig } from "../src/server/config";
import { Store, type Account, type Scan } from "../src/server/store";
// Default dry run. Never modifies the source file and never imports old provider keys.
const source = process.argv[2] || "src/db/data.json";
const legacy = JSON.parse(await readFile(source, "utf8"));
const users = (Array.isArray(legacy.users) ? legacy.users : []).filter(
  (u: any) =>
    typeof u.id === "string" &&
    typeof u.email === "string" &&
    typeof legacy.passwords?.[u.id] === "string" &&
    /^\$2[aby]\$/.test(legacy.passwords[u.id]),
);
console.log(
  "Eligible registered accounts:",
  users.length,
  "; shared guest and demo reports will not be imported.",
);
if (!process.argv.includes("--apply")) {
  console.log(
    "Dry run only. Add --apply after backing up both source and destination.",
  );
} else {
  const store = new Store(loadConfig());
  await store.init();
  try {
    for (const old of users) {
      if (await store.userByEmail(old.email.toLowerCase())) continue;
      const user: Account = {
        id: "u_" + randomUUID(),
        email: old.email.toLowerCase(),
        fullName: String(old.fullName || "Imported user").slice(0, 100),
        createdAt: old.createdAt || new Date().toISOString(),
        passwordHash: legacy.passwords[old.id],
      };
      await store.createUser(user);
      for (const history of legacy.history || []) {
        if (history.userId !== old.id) continue;
        const scan: Scan = {
          id: randomUUID(),
          userId: user.id,
          type: [
            "image",
            "news",
            "website",
            "profile",
            "plagiarism",
            "ai-content",
          ].includes(history.type)
            ? history.type
            : "news",
          title: "Legacy report — unverified",
          target: String(history.target || "").slice(0, 200),
          timestamp: history.timestamp || new Date().toISOString(),
          status: "legacy",
          error:
            "Archived from the previous implementation. Previous scores and evidence are not trusted; submit again for current checks.",
        };
        await store.put("scan", scan.id, user.id, scan);
      }
    }
  } finally {
    await store.close();
  }
}
