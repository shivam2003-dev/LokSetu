import { Pool } from "pg";
import { seedSubmissions } from "./data.js";
import { BatchRun, RawIntakePayload, RawIntakeRecord, Submission } from "./types.js";

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
      failed integer not null default 0,
      error text
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
    `insert into batch_runs (id, started_at, finished_at, status, processed, failed, error)
     values ($1, $2, $3, $4, $5, $6, $7)
     on conflict (id) do update set
       finished_at = excluded.finished_at,
       status = excluded.status,
       processed = excluded.processed,
       failed = excluded.failed,
       error = excluded.error`,
    [run.id, run.startedAt, run.finishedAt, run.status, run.processed, run.failed, run.error]
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
    failed: number;
    error: string | null;
  }>(
    `select id, started_at, finished_at, status, processed, failed, error
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
    failed: row.failed,
    error: row.error ?? undefined
  }));
}

export function isDatabaseEnabled(): boolean {
  return Boolean(pool);
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
