import { Pool } from "pg";
import { seedSubmissions } from "./data.js";
import { Submission } from "./types.js";

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

  const existing = await pool.query<{ count: string }>("select count(*) from submissions");
  if (Number(existing.rows[0]?.count ?? 0) === 0) {
    for (const submission of seedSubmissions) {
      await insertSubmission(submission);
    }
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

export function isDatabaseEnabled(): boolean {
  return Boolean(pool);
}
