import cors from "cors";
import express from "express";
import helmet from "helmet";
import pino from "pino";
import { z } from "zod";
import { config } from "./config.js";
import { assertReady, indexStats, listDocuments, migrate, softDeleteDocument } from "./db.js";
import { ingestDocuments } from "./ingestion.js";
import { registry, requestLatency } from "./metrics.js";
import { embedPendingChunks, queryRag } from "./pipeline.js";

const logger = pino({ name: "loksetu-rag-api" });
const cfg = config();
const app = express();

const documentInputSchema = z.object({
  tenantId: z.string().optional(),
  namespace: z.string().optional(),
  source: z.enum(["pdf", "docx", "txt", "markdown", "csv", "json", "gcs", "filesystem"]),
  sourceUri: z.string().optional(),
  sourceUrl: z.string().optional(),
  title: z.string().optional(),
  mediaType: z.string().optional(),
  content: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
}).refine((value) => value.content !== undefined || value.sourceUri, "content or sourceUri is required");

const ingestSchema = z.object({
  documents: z.array(documentInputSchema).min(1).max(100),
  chunking: z.object({
    chunkSize: z.number().int().min(100).max(3000).optional(),
    chunkOverlap: z.number().int().min(0).max(1000).optional(),
    semanticChunking: z.boolean().optional()
  }).optional()
});

const querySchema = z.object({
  tenantId: z.string().optional(),
  namespace: z.string().optional(),
  question: z.string().trim().min(1).max(4000),
  topK: z.number().int().min(1).max(30).optional(),
  similarityThreshold: z.number().min(0).max(1).optional(),
  minimumConfidence: z.number().min(0).max(1).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  requireCitations: z.boolean().optional()
});

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "25mb" }));
app.use((request, response, next) => {
  const started = Date.now();
  response.on("finish", () => {
    requestLatency.labels(request.path, String(response.statusCode)).observe(Date.now() - started);
    logger.info({ path: request.path, method: request.method, status: response.statusCode, latencyMs: Date.now() - started, traceparent: request.header("traceparent") }, "rag request");
  });
  next();
});

app.get("/health", async (_request, response) => {
  response.json({ ok: true, service: "rag-api", mode: "pgvector-hybrid", embeddingProvider: cfg.embeddingProvider });
});

app.get("/live", (_request, response) => response.json({ ok: true }));

app.get("/ready", async (_request, response) => {
  try {
    await assertReady();
    response.json({ ok: true });
  } catch (error) {
    response.status(503).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
});

app.get("/metrics", async (_request, response) => {
  response.setHeader("Content-Type", registry.contentType);
  response.send(await registry.metrics());
});

app.post("/ingest", async (request, response) => {
  const parsed = ingestSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: "Invalid ingest request", details: parsed.error.flatten() });
    return;
  }
  const chunking = { ...cfg.chunking, ...(parsed.data.chunking ?? {}) };
  const result = await ingestDocuments(parsed.data.documents, chunking);
  response.status(202).json({ status: "indexed", ...result });
});

app.post("/query", async (request, response) => {
  const parsed = querySchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: "Invalid query request", details: parsed.error.flatten() });
    return;
  }
  response.json(await queryRag(parsed.data));
});

app.post("/reindex", async (request, response) => {
  const limit = Number(request.body?.limit ?? 500);
  const embedded = await embedPendingChunks(limit);
  response.json({ status: "complete", embedded });
});

app.get("/documents", async (request, response) => {
  const tenantId = String(request.query.tenantId ?? cfg.tenantId);
  const namespace = String(request.query.namespace ?? cfg.namespace);
  response.json({ documents: await listDocuments(tenantId, namespace), stats: await indexStats(tenantId, namespace) });
});

app.delete("/documents/:id", async (request, response) => {
  const tenantId = String(request.query.tenantId ?? cfg.tenantId);
  const namespace = String(request.query.namespace ?? cfg.namespace);
  await softDeleteDocument(request.params.id, tenantId, namespace);
  response.status(204).send();
});

app.get("/stats", async (request, response) => {
  const tenantId = String(request.query.tenantId ?? cfg.tenantId);
  const namespace = String(request.query.namespace ?? cfg.namespace);
  response.json(await indexStats(tenantId, namespace));
});

await migrate();
app.listen(cfg.port, () => {
  logger.info({ port: cfg.port, embeddingProvider: cfg.embeddingProvider, embeddingModel: cfg.embeddingModel }, "rag-api started");
});
