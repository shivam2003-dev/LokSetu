import { existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";
import pino from "pino";
import { config } from "./config.js";
import { migrate } from "./db.js";
import { ingestDocuments } from "./ingestion.js";
import { RagDocumentInput } from "./types.js";

const logger = pino({ name: "loksetu-ingestion-worker" });

await migrate();

const sources = (process.env.RAG_INGEST_PATHS ?? "services/rag-api/fixtures/bihar/census-bihar-2011.md")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

const documents: RagDocumentInput[] = [];
for (const source of sources) {
  if (source.startsWith("gs://")) {
    documents.push({ source: "gcs", sourceUri: source, title: basename(source), metadata: { connector: "gcs" } });
    continue;
  }
  const path = resolve(source);
  if (!existsSync(path)) {
    logger.warn({ source }, "ingestion source does not exist");
    continue;
  }
  const info = await stat(path);
  if (!info.isFile()) continue;
  documents.push({
    source: sourceKind(path),
    sourceUri: path,
    sourceUrl: `file://${path}`,
    title: basename(path),
    metadata: { connector: "filesystem", ingestionSource: source, region: source.toLowerCase().includes("bihar") ? "Bihar" : undefined }
  });
}

if (documents.length) {
  const result = await ingestDocuments(documents, config().chunking);
  logger.info({ documents: result.documents.length, chunks: result.chunkCount, embedded: result.embeddedCount }, "ingestion complete");
} else {
  logger.warn({ sources }, "no ingestion documents found");
}

if (process.env.WORKER_RUN_ONCE !== "true") {
  setInterval(() => {
    logger.info("ingestion worker idle; batch sources are configured through RAG_INGEST_PATHS");
  }, Number(process.env.RAG_INGEST_INTERVAL_MS ?? 300_000));
}

function sourceKind(path: string): RagDocumentInput["source"] {
  const extension = extname(path).toLowerCase();
  if (extension === ".pdf") return "pdf";
  if (extension === ".docx") return "docx";
  if (extension === ".csv") return "csv";
  if (extension === ".json") return "json";
  if (extension === ".md") return "markdown";
  return "txt";
}
