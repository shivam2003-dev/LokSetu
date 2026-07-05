import { Pool } from "pg";
import { pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
import { seedSubmissions } from "./data.js";
import { AuthUser, BatchRun, RawIntakePayload, RawIntakeRecord, Submission, UserRole } from "./types.js";

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL
    })
  : null;

export async function initDatabase(): Promise<void> {
  if (!pool) return;

  await pool.query(`
    create table if not exists submissions (
      id text primary key,
      payload jsonb not null,
      created_at timestamptz not null
    )
  `);

  await pool.query(`
    create table if not exists raw_intake (
      id text primary key,
      payload jsonb not null,
      status text not null default 'pending',
      attempts integer not null default 0,
      error text,
      created_at timestamptz not null,
      processed_at timestamptz
    )
  `);

  await pool.query(`
    create table if not exists batch_runs (
      id text primary key,
      started_at timestamptz not null,
      finished_at timestamptz,
      status text not null,
      processed integer not null default 0,
      discarded integer not null default 0,
      failed integer not null default 0,
      error text
    )
  `);

  await pool.query("alter table batch_runs add column if not exists discarded integer not null default 0");

  await pool.query(`
    create table if not exists app_users (
      id text primary key,
      username text not null unique,
      password_hash text not null,
      role text not null,
      display_name text not null,
      created_at timestamptz not null
    )
  `);

  for (const submission of seedSubmissions) {
    await insertSubmission(submission);
  }
}

export async function listSubmissions(): Promise<Submission[]> {
  if (!pool) return [...seedSubmissions];
  const result = await pool.query<{ payload: Submission }>("select payload from submissions order by created_at asc");
  return result.rows.map((row) => row.payload);
}

export async function insertSubmission(submission: Submission): Promise<void> {
  if (!pool) return;
  await pool.query(
    `insert into submissions (id, payload, created_at)
     values ($1, $2, $3)
     on conflict (id) do update set payload = excluded.payload`,
    [submission.id, submission, submission.createdAt]
  );
}

export async function insertRawIntake(payload: RawIntakePayload): Promise<RawIntakeRecord> {
  const record: RawIntakeRecord = {
    id: crypto.randomUUID(),
    payload,
    status: "pending",
    attempts: 0,
    createdAt: new Date().toISOString()
  };
  if (!pool) return record;
  await pool.query(
    `insert into raw_intake (id, payload, status, attempts, created_at)
     values ($1, $2, $3, $4, $5)`,
    [record.id, record.payload, record.status, record.attempts, record.createdAt]
  );
  return record;
}

export async function listPendingRawIntakes(limit: number): Promise<RawIntakeRecord[]> {
  if (!pool) return [];
  const result = await pool.query<{
    id: string;
    payload: RawIntakePayload;
    status: RawIntakeRecord["status"];
    attempts: number;
    error: string | null;
    created_at: Date;
    processed_at: Date | null;
  }>(
    `select id, payload, status, attempts, error, created_at, processed_at
     from raw_intake
     where status in ('pending', 'failed') and attempts < 3
     order by created_at asc
     limit $1`,
    [limit]
  );
  return result.rows.map(rawRecordFromRow);
}

export async function countRawIntakesByStatus(): Promise<Record<string, number>> {
  if (!pool) return {};
  const result = await pool.query<{ status: string; count: string }>(
    "select status, count(*) from raw_intake group by status order by status"
  );
  return Object.fromEntries(result.rows.map((row) => [row.status, Number(row.count)]));
}

export async function countRawIntakesByAadhaarHash(aadhaarHash: string): Promise<Record<string, number>> {
  if (!pool) return {};
  const result = await pool.query<{ status: string; count: string }>(
    `select status, count(*)
     from raw_intake
     where payload->>'aadhaarHash' = $1 and status not in ('processed', 'discarded')
     group by status
     order by status`,
    [aadhaarHash]
  );
  return Object.fromEntries(result.rows.map((row) => [row.status, Number(row.count)]));
}

export async function findRawIntakesByReceiptPrefix(prefix: string): Promise<RawIntakeRecord[]> {
  if (!pool) return [];
  const result = await pool.query<{
    id: string;
    payload: RawIntakePayload;
    status: RawIntakeRecord["status"];
    attempts: number;
    error: string | null;
    created_at: Date;
    processed_at: Date | null;
  }>(
    `select id, payload, status, attempts, error, created_at, processed_at
     from raw_intake
     where id like $1
     order by created_at desc
     limit 2`,
    [`${prefix}%`]
  );
  return result.rows.map(rawRecordFromRow);
}

export async function listRecentRawIntakes(limit = 25): Promise<RawIntakeRecord[]> {
  if (!pool) return [];
  const result = await pool.query<{
    id: string;
    payload: RawIntakePayload;
    status: RawIntakeRecord["status"];
    attempts: number;
    error: string | null;
    created_at: Date;
    processed_at: Date | null;
  }>(
    `select id, payload, status, attempts, error, created_at, processed_at
     from raw_intake
     order by created_at desc
     limit $1`,
    [limit]
  );
  return result.rows.map(rawRecordFromRow);
}

export async function markRawIntakeProcessing(id: string): Promise<void> {
  if (!pool) return;
  await pool.query(
    `update raw_intake
     set status = 'processing', attempts = attempts + 1, error = null
     where id = $1`,
    [id]
  );
}

export async function markRawIntakeProcessed(id: string, submission: Submission): Promise<void> {
  if (!pool) return;
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(
      `insert into submissions (id, payload, created_at)
       values ($1, $2, $3)
       on conflict (id) do update set payload = excluded.payload`,
      [submission.id, submission, submission.createdAt]
    );
    await client.query(
      `update raw_intake
       set status = 'processed', processed_at = $2, error = null
       where id = $1`,
      [id, submission.processedAt ?? new Date().toISOString()]
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function markRawIntakeDiscarded(id: string, payload: RawIntakePayload, reason: string): Promise<void> {
  if (!pool) return;
  await pool.query(
    `update raw_intake
     set status = 'discarded', payload = $2, processed_at = $3, error = $4
     where id = $1`,
    [id, payload, payload.discardedAt ?? new Date().toISOString(), reason]
  );
}

export async function markRawIntakeFailed(id: string, error: unknown): Promise<void> {
  if (!pool) return;
  await pool.query(
    `update raw_intake
     set status = 'failed', error = $2
     where id = $1`,
    [id, error instanceof Error ? error.message : String(error)]
  );
}

export async function insertBatchRun(run: BatchRun): Promise<void> {
  if (!pool) return;
  await pool.query(
    `insert into batch_runs (id, started_at, finished_at, status, processed, discarded, failed, error)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     on conflict (id) do update set
       finished_at = excluded.finished_at,
       status = excluded.status,
       processed = excluded.processed,
       discarded = excluded.discarded,
       failed = excluded.failed,
       error = excluded.error`,
    [run.id, run.startedAt, run.finishedAt, run.status, run.processed, run.discarded, run.failed, run.error]
  );
}

export async function listRecentBatchRuns(limit = 10): Promise<BatchRun[]> {
  if (!pool) return [];
  const result = await pool.query<{
    id: string;
    started_at: Date;
    finished_at: Date | null;
    status: BatchRun["status"];
    processed: number;
    discarded: number;
    failed: number;
    error: string | null;
  }>(
    `select id, started_at, finished_at, status, processed, discarded, failed, error
     from batch_runs
     order by started_at desc
     limit $1`,
    [limit]
  );
  return result.rows.map((row) => ({
    id: row.id,
    startedAt: row.started_at.toISOString(),
    finishedAt: row.finished_at?.toISOString(),
    status: row.status,
    processed: row.processed,
    discarded: row.discarded,
    failed: row.failed,
    error: row.error ?? undefined
  }));
}

export async function ensureAuthUser(input: {
  id: string;
  username: string;
  password: string;
  role: UserRole;
  displayName: string;
}): Promise<void> {
  if (!pool || !input.password.trim()) return;
  const existing = await findAuthUserByUsername(input.username);
  if (existing) return;
  await pool.query(
    `insert into app_users (id, username, password_hash, role, display_name, created_at)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (username) do nothing`,
    [input.id, input.username, hashPassword(input.password), input.role, input.displayName, new Date().toISOString()]
  );
}

export async function upsertAuthUser(input: {
  username: string;
  password: string;
  role: UserRole;
  displayName: string;
}): Promise<AuthUser | null> {
  const now = new Date().toISOString();
  const record: AuthUser = {
    id: crypto.randomUUID(),
    username: input.username,
    passwordHash: hashPassword(input.password),
    role: input.role,
    displayName: input.displayName,
    createdAt: now
  };
  if (!pool) return record;
  const result = await pool.query<{
    id: string;
    username: string;
    password_hash: string;
    role: UserRole;
    display_name: string;
    created_at: Date;
  }>(
    `insert into app_users (id, username, password_hash, role, display_name, created_at)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (username) do update set
       password_hash = excluded.password_hash,
       role = excluded.role,
       display_name = excluded.display_name
     returning id, username, password_hash, role, display_name, created_at`,
    [record.id, record.username, record.passwordHash, record.role, record.displayName, record.createdAt]
  );
  return authUserFromRow(result.rows[0]);
}

export async function findAuthUserByUsername(username: string): Promise<AuthUser | null> {
  if (!pool) return null;
  const result = await pool.query<{
    id: string;
    username: string;
    password_hash: string;
    role: UserRole;
    display_name: string;
    created_at: Date;
  }>(
    `select id, username, password_hash, role, display_name, created_at
     from app_users
     where lower(username) = lower($1)
     limit 1`,
    [username.trim()]
  );
  return authUserFromRow(result.rows[0]);
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const digest = pbkdf2Sync(password, salt, 120_000, 32, "sha256").toString("hex");
  return `pbkdf2_sha256$120000$${salt}$${digest}`;
}

export function verifyPassword(password: string, passwordHash: string): boolean {
  const [scheme, iterationsText, salt, digest] = passwordHash.split("$");
  if (scheme !== "pbkdf2_sha256" || !iterationsText || !salt || !digest) return false;
  const iterations = Number(iterationsText);
  if (!Number.isFinite(iterations) || iterations < 1) return false;
  const candidate = pbkdf2Sync(password, salt, iterations, 32, "sha256").toString("hex");
  const candidateBuffer = Buffer.from(candidate, "hex");
  const digestBuffer = Buffer.from(digest, "hex");
  return candidateBuffer.length === digestBuffer.length && timingSafeEqual(candidateBuffer, digestBuffer);
}

export function isDatabaseEnabled(): boolean {
  return Boolean(pool);
}

function authUserFromRow(row?: {
  id: string;
  username: string;
  password_hash: string;
  role: UserRole;
  display_name: string;
  created_at: Date;
}): AuthUser | null {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    passwordHash: row.password_hash,
    role: row.role,
    displayName: row.display_name,
    createdAt: row.created_at.toISOString()
  };
}

function rawRecordFromRow(row: {
  id: string;
  payload: RawIntakePayload;
  status: RawIntakeRecord["status"];
  attempts: number;
  error: string | null;
  created_at: Date;
  processed_at: Date | null;
}): RawIntakeRecord {
  return {
    id: row.id,
    payload: row.payload,
    status: row.status,
    attempts: row.attempts,
    error: row.error ?? undefined,
    createdAt: row.created_at.toISOString(),
    processedAt: row.processed_at?.toISOString()
  };
}
