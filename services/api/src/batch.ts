import pino from "pino";
import { fileURLToPath } from "url";
import {
  initDatabase,
  insertBatchRun,
  isDatabaseEnabled,
  listPendingRawIntakes,
  markRawIntakeFailed,
  markRawIntakeProcessed,
  markRawIntakeProcessing
} from "./db.js";
import { processIntake } from "./intake.js";
import { indexSubmissionInRag } from "./ragIndexer.js";
import { BatchRun } from "./types.js";

const logger = pino({ name: "people-priority-batch" });

export async function runBatch(limit = Number(process.env.BATCH_LIMIT ?? 100)): Promise<BatchRun> {
  const run: BatchRun = {
    id: crypto.randomUUID(),
    startedAt: new Date().toISOString(),
    status: "running",
    processed: 0,
    failed: 0
  };
  await insertBatchRun(run);

  try {
    const records = await listPendingRawIntakes(limit);
    logger.info({ batchId: run.id, count: records.length }, "batch started");

    for (const record of records) {
      try {
        await markRawIntakeProcessing(record.id);
        const { submission } = await processIntake(record.payload, { rawIntakeId: record.id, batchId: run.id });
        await markRawIntakeProcessed(record.id, submission);
        await indexSubmissionInRag(submission);
        run.processed += 1;
      } catch (error) {
        run.failed += 1;
        await markRawIntakeFailed(record.id, error);
        logger.error({ error, rawIntakeId: record.id }, "raw intake failed");
      }
    }

    run.status = run.failed > 0 ? "failed" : "succeeded";
    run.finishedAt = new Date().toISOString();
    await insertBatchRun(run);
    logger.info(run, "batch finished");
    return run;
  } catch (error) {
    run.status = "failed";
    run.finishedAt = new Date().toISOString();
    run.error = error instanceof Error ? error.message : String(error);
    await insertBatchRun(run);
    throw error;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await initDatabase();
  if (!isDatabaseEnabled()) {
    logger.warn("DATABASE_URL is not set; batch processing requires Postgres");
    process.exit(0);
  }
  await runBatch();
}
