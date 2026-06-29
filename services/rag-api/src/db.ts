import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { config } from "./config.js";
import { RagChunk, RagDocument, RetrievalResult } from "./types.js";

const cfg = config();
export const pool = cfg.databaseUrl ? new Pool({ connectionString: cfg.databaseUrl }) : null;

export async function migrate() {
  if (!pool) throw new Error("RAG_DATABASE_URL or DATABASE_URL is required for production RAG.");
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const sql = await readFile(resolve(root, "migrations", "001_pgvector_rag.sql"), "utf8");
  await pool.query(sql);
}

export async function assertReady() {
  if (!pool) throw new Error("database not configured");
  await pool.query("select 1");
}

export async function upsertDocument(document: RagDocument) {
  if (!pool) throw new Error("database not configured");
  await pool.query(
    `insert into rag_documents
      (id, tenant_id, namespace, source, source_uri, source_url, title, media_type, metadata, checksum, created_at, updated_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     on conflict (tenant_id, namespace, source, checksum)
     do update set
       source_uri = excluded.source_uri,
       source_url = excluded.source_url,
       title = excluded.title,
       media_type = excluded.media_type,
       metadata = excluded.metadata,
       updated_at = excluded.updated_at,
       deleted_at = null`,
    [
      document.id,
      document.tenantId,
      document.namespace,
      document.source,
      document.sourceUri,
      document.sourceUrl,
      document.title,
      document.mediaType,
      document.metadata,
      document.checksum,
      document.createdAt,
      document.updatedAt
    ]
  );
}

export async function replaceChunks(documentId: string, chunks: RagChunk[]) {
  if (!pool) throw new Error("database not configured");
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("delete from rag_chunks where document_id = $1", [documentId]);
    for (const chunk of chunks) {
      await client.query(
        `insert into rag_chunks
          (id, document_id, tenant_id, namespace, source, source_uri, source_url, title, page, section, chunk_index, content, metadata, checksum, created_at, updated_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
         on conflict (tenant_id, namespace, checksum) do nothing`,
        [
          chunk.id,
          chunk.documentId,
          chunk.tenantId,
          chunk.namespace,
          chunk.source,
          chunk.sourceUri,
          chunk.sourceUrl,
          chunk.title,
          chunk.page,
          chunk.section,
          chunk.chunkIndex,
          chunk.content,
          chunk.metadata,
          chunk.checksum,
          chunk.createdAt,
          chunk.updatedAt
        ]
      );
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function chunksNeedingEmbeddings(provider: string, model: string, limit = 200): Promise<RagChunk[]> {
  if (!pool) throw new Error("database not configured");
  const result = await pool.query<RagChunkRow>(
    `select c.*
     from rag_chunks c
     left join rag_embeddings e on e.chunk_id = c.id and e.provider = $1 and e.model = $2 and e.content_checksum = c.checksum
     where e.chunk_id is null
     order by c.created_at asc
     limit $3`,
    [provider, model, limit]
  );
  return result.rows.map(chunkFromRow);
}

export async function upsertEmbedding(input: {
  chunkId: string;
  tenantId: string;
  namespace: string;
  provider: string;
  model: string;
  dimensions: number;
  embedding: number[];
  contentChecksum: string;
}) {
  if (!pool) throw new Error("database not configured");
  await pool.query(
    `insert into rag_embeddings (chunk_id, tenant_id, namespace, provider, model, dimensions, embedding, content_checksum, created_at, updated_at)
     values ($1,$2,$3,$4,$5,$6,$7::vector,$8,now(),now())
     on conflict (chunk_id) do update set
       provider = excluded.provider,
       model = excluded.model,
       dimensions = excluded.dimensions,
       embedding = excluded.embedding,
       content_checksum = excluded.content_checksum,
       updated_at = now()`,
    [
      input.chunkId,
      input.tenantId,
      input.namespace,
      input.provider,
      input.model,
      input.dimensions,
      vectorLiteral(input.embedding),
      input.contentChecksum
    ]
  );
}

export async function vectorSearch(input: {
  tenantId: string;
  namespace: string;
  embedding: number[];
  topK: number;
  metadata: Record<string, unknown>;
}): Promise<RetrievalResult[]> {
  if (!pool) throw new Error("database not configured");
  const result = await pool.query<RetrievalRow>(
    `select c.*, 1 - (e.embedding <=> $3::vector) as vector_score, 0::float8 as keyword_score,
            greatest(0, 1 - extract(epoch from (now() - c.updated_at)) / 31536000) as recency_score
     from rag_embeddings e
     join rag_chunks c on c.id = e.chunk_id
     where e.tenant_id = $1
       and e.namespace = $2
       and ($4::jsonb = '{}'::jsonb or c.metadata @> $4::jsonb)
     order by e.embedding <=> $3::vector
     limit $5`,
    [input.tenantId, input.namespace, vectorLiteral(input.embedding), input.metadata, input.topK]
  );
  return result.rows.map(retrievalFromRow);
}

export async function keywordSearch(input: {
  tenantId: string;
  namespace: string;
  query: string;
  topK: number;
  metadata: Record<string, unknown>;
}): Promise<RetrievalResult[]> {
  if (!pool) throw new Error("database not configured");
  const result = await pool.query<RetrievalRow>(
    `select c.*, 0::float8 as vector_score,
            ts_rank_cd(c.content_tsv, plainto_tsquery('english', $3)) as keyword_score,
            greatest(0, 1 - extract(epoch from (now() - c.updated_at)) / 31536000) as recency_score
     from rag_chunks c
     where c.tenant_id = $1
       and c.namespace = $2
       and c.content_tsv @@ plainto_tsquery('english', $3)
       and ($4::jsonb = '{}'::jsonb or c.metadata @> $4::jsonb)
     order by keyword_score desc
     limit $5`,
    [input.tenantId, input.namespace, input.query, input.metadata, input.topK]
  );
  return result.rows.map(retrievalFromRow);
}

export async function listDocuments(tenantId: string, namespace: string): Promise<RagDocument[]> {
  if (!pool) throw new Error("database not configured");
  const result = await pool.query<DocumentRow>(
    `select * from rag_documents where tenant_id = $1 and namespace = $2 and deleted_at is null order by updated_at desc`,
    [tenantId, namespace]
  );
  return result.rows.map(documentFromRow);
}

export async function softDeleteDocument(id: string, tenantId: string, namespace: string) {
  if (!pool) throw new Error("database not configured");
  await pool.query(
    "update rag_documents set deleted_at = now(), updated_at = now() where id = $1 and tenant_id = $2 and namespace = $3",
    [id, tenantId, namespace]
  );
}

export async function indexStats(tenantId: string, namespace: string) {
  if (!pool) throw new Error("database not configured");
  const result = await pool.query<{ documents: string; chunks: string; embeddings: string }>(
    `select
      (select count(*) from rag_documents where tenant_id = $1 and namespace = $2 and deleted_at is null) as documents,
      (select count(*) from rag_chunks where tenant_id = $1 and namespace = $2) as chunks,
      (select count(*) from rag_embeddings where tenant_id = $1 and namespace = $2) as embeddings`,
    [tenantId, namespace]
  );
  const row = result.rows[0] ?? { documents: "0", chunks: "0", embeddings: "0" };
  return { documents: Number(row.documents), chunks: Number(row.chunks), embeddings: Number(row.embeddings) };
}

export function vectorLiteral(values: number[]) {
  return `[${values.map((value) => Number.isFinite(value) ? value.toFixed(8) : "0").join(",")}]`;
}

type DocumentRow = {
  id: string;
  tenant_id: string;
  namespace: string;
  source: string;
  source_uri: string | null;
  source_url: string | null;
  title: string;
  media_type: string;
  metadata: Record<string, unknown>;
  checksum: string;
  created_at: Date;
  updated_at: Date;
};

type RagChunkRow = {
  id: string;
  document_id: string;
  tenant_id: string;
  namespace: string;
  source: string;
  source_uri: string | null;
  source_url: string | null;
  title: string;
  page: number | null;
  section: string | null;
  chunk_index: number;
  content: string;
  metadata: Record<string, unknown>;
  checksum: string;
  created_at: Date;
  updated_at: Date;
};

type RetrievalRow = RagChunkRow & {
  vector_score: number;
  keyword_score: number;
  recency_score: number;
};

function documentFromRow(row: DocumentRow): RagDocument {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    namespace: row.namespace,
    source: row.source,
    sourceUri: row.source_uri ?? undefined,
    sourceUrl: row.source_url ?? undefined,
    title: row.title,
    mediaType: row.media_type,
    metadata: row.metadata,
    checksum: row.checksum,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

function chunkFromRow(row: RagChunkRow): RagChunk {
  return {
    id: row.id,
    documentId: row.document_id,
    tenantId: row.tenant_id,
    namespace: row.namespace,
    source: row.source,
    sourceUri: row.source_uri ?? undefined,
    sourceUrl: row.source_url ?? undefined,
    title: row.title,
    page: row.page ?? undefined,
    section: row.section ?? undefined,
    chunkIndex: row.chunk_index,
    content: row.content,
    metadata: row.metadata,
    checksum: row.checksum,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

function retrievalFromRow(row: RetrievalRow): RetrievalResult {
  const vectorScore = Number(row.vector_score) || 0;
  const keywordScore = Number(row.keyword_score) || 0;
  const recencyScore = Number(row.recency_score) || 0;
  return {
    ...chunkFromRow(row),
    vectorScore,
    keywordScore,
    recencyScore,
    confidence: vectorScore * 0.72 + Math.min(keywordScore, 1) * 0.22 + recencyScore * 0.06
  };
}
