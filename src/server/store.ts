import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import type { EvidenceReport } from "../shared/report";
import type { Config } from "./config";

export interface Account {
  id: string;
  email: string;
  fullName: string;
  createdAt: string;
  passwordHash: string;
}
export interface Scan {
  id: string;
  userId: string;
  type: EvidenceReport["kind"];
  title: string;
  target: string;
  timestamp: string;
  status:
    "queued" | "processing" | "completed" | "failed" | "canceled" | "legacy";
  report?: EvidenceReport;
  error?: string;
  expiresAt?: string;
}
type RecordData = Account | Scan;
type Entry = {
  id: string;
  owner: string;
  kind: "user" | "scan";
  data: RecordData;
};
export class Store {
  private pool?: Pool;
  private rows: Entry[] = [];
  private tail: Promise<unknown> = Promise.resolve();
  constructor(private config: Config) {
    if (config.databaseUrl)
      this.pool = new Pool({
        connectionString: config.databaseUrl,
        max: 5,
        connectionTimeoutMillis: 5000,
        statement_timeout: 5000,
      });
  }
  async init() {
    if (this.pool) {
      await this.pool.query(
        "CREATE TABLE IF NOT EXISTS verifyx_records (id text PRIMARY KEY, owner text NOT NULL, kind text NOT NULL, data jsonb NOT NULL)",
      );
      await this.pool.query(
        "CREATE UNIQUE INDEX IF NOT EXISTS verifyx_email_unique ON verifyx_records ((data->>'email')) WHERE kind='user'",
      );
      await this.pool.query(
        "CREATE INDEX IF NOT EXISTS verifyx_owner_idx ON verifyx_records(owner, kind)",
      );
    } else {
      await fs.mkdir(path.dirname(this.config.dataFile), { recursive: true });
      try {
        const state = JSON.parse(
          await fs.readFile(this.config.dataFile, "utf8"),
        );
        if (!Array.isArray(state.records))
          throw new Error("Invalid database format; refusing to overwrite.");
        this.rows = state.records;
      } catch (e: any) {
        if (e.code !== "ENOENT") throw e;
        await this.persist([]);
      }
    }
    // In-process jobs cannot resume after a restart. Never leave an old placeholder pending.
    for (const row of await this.listAll())
      if (row.kind === "scan") {
        const scan = row.data as Scan;
        if (["queued", "processing"].includes(scan.status))
          await this.put("scan", scan.id, scan.userId, {
            ...scan,
            status: "failed",
            error:
              "Service restarted before analysis completed. Please submit again.",
          });
      }
    await this.prune();
  }
  private async persist(rows: Entry[]) {
    const temp = this.config.dataFile + "." + randomUUID() + ".tmp";
    try {
      await fs.writeFile(temp, JSON.stringify({ version: 1, records: rows }), {
        mode: 0o600,
      });
      await fs.rename(temp, this.config.dataFile);
    } finally {
      await fs.rm(temp, { force: true }).catch(() => {});
    }
  }
  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const task = this.tail.then(fn);
    this.tail = task.catch(() => {});
    return task;
  }
  private async listAll(): Promise<Entry[]> {
    return this.pool
      ? (
          await this.pool.query(
            "SELECT id, owner, kind, data FROM verifyx_records",
          )
        ).rows
      : structuredClone(this.rows);
  }
  async get<T extends RecordData>(id: string): Promise<T | undefined> {
    if (this.pool)
      return (
        await this.pool.query("SELECT data FROM verifyx_records WHERE id=$1", [
          id,
        ])
      ).rows[0]?.data;
    return structuredClone(this.rows.find((r) => r.id === id)?.data) as
      T | undefined;
  }
  async userByEmail(email: string): Promise<Account | undefined> {
    if (this.pool)
      return (
        await this.pool.query(
          "SELECT data FROM verifyx_records WHERE kind='user' AND data->>'email'=$1",
          [email],
        )
      ).rows[0]?.data;
    return structuredClone(
      this.rows.find(
        (r) => r.kind === "user" && (r.data as Account).email === email,
      )?.data,
    ) as Account | undefined;
  }
  async createUser(user: Account) {
    if (this.pool) {
      await this.pool.query(
        "INSERT INTO verifyx_records(id,owner,kind,data) VALUES($1,$1,'user',$2)",
        [user.id, user],
      );
      return;
    }
    await this.serial(async () => {
      if (
        this.rows.some(
          (r) => r.kind === "user" && (r.data as Account).email === user.email,
        )
      )
        throw new Error("duplicate_user");
      const next = [
        ...this.rows,
        { id: user.id, owner: user.id, kind: "user" as const, data: user },
      ];
      await this.persist(next);
      this.rows = next;
    });
  }
  async put(kind: Entry["kind"], id: string, owner: string, data: RecordData) {
    if (this.pool) {
      await this.pool.query(
        "INSERT INTO verifyx_records(id,owner,kind,data) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data",
        [id, owner, kind, data],
      );
      return;
    }
    await this.serial(async () => {
      const next = this.rows.filter((r) => r.id !== id);
      next.push({ id, owner, kind, data: structuredClone(data) });
      await this.persist(next);
      this.rows = next;
    });
  }
  async history(owner: string): Promise<Scan[]> {
    const rows: Entry[] = this.pool
      ? (
          await this.pool.query(
            "SELECT data FROM verifyx_records WHERE owner=$1 AND kind='scan'",
            [owner],
          )
        ).rows
      : this.rows.filter((r) => r.owner === owner && r.kind === "scan");
    return rows
      .map((r) => structuredClone(r.data) as Scan)
      .filter((r) => !r.expiresAt || Date.parse(r.expiresAt) > Date.now())
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }
  async remove(id: string, owner: string) {
    if (this.pool) {
      return (
        (
          await this.pool.query(
            "DELETE FROM verifyx_records WHERE id=$1 AND owner=$2 AND kind='scan'",
            [id, owner],
          )
        ).rowCount === 1
      );
    }
    return this.serial(async () => {
      const next = this.rows.filter(
        (r) => !(r.id === id && r.owner === owner && r.kind === "scan"),
      );
      if (next.length === this.rows.length) return false;
      await this.persist(next);
      this.rows = next;
      return true;
    });
  }
  async prune() {
    for (const row of await this.listAll())
      if (
        row.kind === "scan" &&
        (row.data as Scan).expiresAt &&
        Date.parse((row.data as Scan).expiresAt!) <= Date.now()
      )
        await this.remove(row.id, row.owner);
  }
  async close() {
    await this.tail;
    await this.pool?.end();
  }
}
export const publicUser = (u: Account) => ({
  id: u.id,
  email: u.email,
  fullName: u.fullName,
  createdAt: u.createdAt,
});
