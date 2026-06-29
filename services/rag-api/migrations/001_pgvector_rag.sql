create extension if not exists vector;
create extension if not exists pgcrypto;

create table if not exists rag_documents (
  id text primary key,
  tenant_id text not null,
  namespace text not null,
  source text not null,
  source_uri text,
  source_url text,
  title text not null,
  media_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  checksum text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, namespace, source, checksum)
);

create table if not exists rag_chunks (
  id text primary key,
  document_id text not null references rag_documents(id) on delete cascade,
  tenant_id text not null,
  namespace text not null,
  source text not null,
  source_uri text,
  source_url text,
  title text not null,
  page integer,
  section text,
  chunk_index integer not null,
  content text not null,
  content_tsv tsvector generated always as (to_tsvector('english', content || ' ' || title || ' ' || coalesce(section, ''))) stored,
  metadata jsonb not null default '{}'::jsonb,
  checksum text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (document_id, chunk_index),
  unique (tenant_id, namespace, checksum)
);

create table if not exists rag_embeddings (
  chunk_id text primary key references rag_chunks(id) on delete cascade,
  tenant_id text not null,
  namespace text not null,
  provider text not null,
  model text not null,
  dimensions integer not null,
  embedding vector(768) not null,
  content_checksum text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists rag_ingestion_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  namespace text not null,
  status text not null,
  source text not null,
  document_count integer not null default 0,
  chunk_count integer not null default 0,
  embedded_count integer not null default 0,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists rag_eval_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  namespace text not null,
  dataset text not null,
  recall_at_k numeric not null,
  precision_at_k numeric not null,
  mrr numeric not null,
  groundedness numeric not null,
  citation_accuracy numeric not null,
  hallucination_rate numeric not null,
  latency_p95_ms numeric not null,
  created_at timestamptz not null default now()
);

create index if not exists rag_documents_tenant_namespace_idx on rag_documents (tenant_id, namespace) where deleted_at is null;
create index if not exists rag_chunks_tenant_namespace_idx on rag_chunks (tenant_id, namespace);
create index if not exists rag_chunks_metadata_gin_idx on rag_chunks using gin (metadata);
create index if not exists rag_chunks_tsv_gin_idx on rag_chunks using gin (content_tsv);
create index if not exists rag_embeddings_tenant_namespace_idx on rag_embeddings (tenant_id, namespace);
create index if not exists rag_embeddings_hnsw_cosine_idx on rag_embeddings using hnsw (embedding vector_cosine_ops);
