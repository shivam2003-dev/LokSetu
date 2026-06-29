import pino from "pino";
import { config } from "./config.js";
import { migrate } from "./db.js";
import { embedPendingChunks } from "./pipeline.js";

const logger = pino({ name: "loksetu-embedding-worker" });
const intervalMs = Number(process.env.RAG_EMBEDDING_INTERVAL_MS ?? 60_000);

await migrate();

async function runOnce() {
  const embedded = await embedPendingChunks(Number(process.env.RAG_EMBEDDING_BATCH_SIZE ?? 500));
  logger.info({ embedded, provider: config().embeddingProvider, model: config().embeddingModel }, "embedding batch complete");
}

await runOnce();

if (process.env.WORKER_RUN_ONCE !== "true") {
  setInterval(() => {
    runOnce().catch((error) => logger.error({ error }, "embedding batch failed"));
  }, intervalMs);
}
