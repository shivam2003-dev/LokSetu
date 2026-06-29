import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import { parse as parseCsv } from "csv-parse/sync";
import mammoth from "mammoth";
import pdfParse from "pdf-parse";
import { config } from "./config.js";
import { replaceChunks, upsertDocument } from "./db.js";
import { embedPendingChunks } from "./pipeline.js";
import { ChunkingOptions, RagChunk, RagDocument, RagDocumentInput } from "./types.js";

type ParsedDocument = {
  bytes: Buffer;
  text: string;
  mediaType: string;
  title: string;
  pageCount?: number;
};

export async function ingestDocuments(inputs: RagDocumentInput[], options = config().chunking) {
  const documents: RagDocument[] = [];
  let chunkCount = 0;
  let embeddedCount = 0;

  for (const input of inputs) {
    const parsed = await parseDocument(input);
    const now = new Date().toISOString();
    const tenantId = input.tenantId ?? config().tenantId;
    const namespace = input.namespace ?? config().namespace;
    const checksum = sha256(parsed.bytes);
    const document: RagDocument = {
      id: stableId([tenantId, namespace, input.source, checksum]),
      tenantId,
      namespace,
      source: input.source,
      sourceUri: input.sourceUri,
      sourceUrl: input.sourceUrl,
      title: input.title ?? parsed.title,
      mediaType: input.mediaType ?? parsed.mediaType,
      metadata: {
        ...(input.metadata ?? {}),
        pageCount: parsed.pageCount,
        connector: input.source,
        sourceUri: input.sourceUri,
        sourceUrl: input.sourceUrl
      },
      checksum,
      createdAt: now,
      updatedAt: now
    };
    const chunks = chunkDocument(document, parsed.text, options);
    await upsertDocument(document);
    await replaceChunks(document.id, chunks);
    documents.push(document);
    chunkCount += chunks.length;
    embeddedCount += await embedPendingChunks(500);
  }

  return { documents, chunkCount, embeddedCount };
}

export async function parseDocument(input: RagDocumentInput): Promise<ParsedDocument> {
  const bytes = await readBytes(input);
  const extension = extname(input.sourceUri ?? input.title ?? "").toLowerCase();
  const title = input.title ?? (input.sourceUri ? basename(input.sourceUri) : `${input.source}-${sha256(bytes).slice(0, 8)}`);
  const mediaType = input.mediaType ?? mediaTypeFor(input.source, extension);

  if (input.source === "pdf" || extension === ".pdf") {
    const parsed = await pdfParse(bytes);
    return { bytes, text: normalize(parsed.text), mediaType: "application/pdf", title, pageCount: parsed.numpages };
  }

  if (input.source === "docx" || extension === ".docx") {
    const parsed = await mammoth.extractRawText({ buffer: bytes });
    return { bytes, text: normalize(parsed.value), mediaType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", title };
  }

  if (input.source === "csv" || extension === ".csv") {
    const rows = parseCsv(bytes.toString("utf8"), { columns: true, skip_empty_lines: true });
    return { bytes, text: normalize(JSON.stringify(rows, null, 2)), mediaType: "text/csv", title };
  }

  if (input.source === "json" || extension === ".json") {
    return { bytes, text: normalize(JSON.stringify(JSON.parse(bytes.toString("utf8")), null, 2)), mediaType: "application/json", title };
  }

  return { bytes, text: normalize(bytes.toString("utf8")), mediaType, title };
}

export function chunkDocument(document: RagDocument, text: string, options: ChunkingOptions): RagChunk[] {
  const sections = options.semanticChunking ? semanticSections(text) : [{ section: undefined as string | undefined, text }];
  const chunks: RagChunk[] = [];
  let chunkIndex = 0;

  for (const section of sections) {
    const words = section.text.split(/\s+/).filter(Boolean);
    const step = Math.max(1, options.chunkSize - options.chunkOverlap);
    for (let start = 0; start < words.length; start += step) {
      const content = words.slice(start, start + options.chunkSize).join(" ").trim();
      if (!content) continue;
      const checksum = sha256(Buffer.from(`${document.id}:${chunkIndex}:${content}`));
      chunks.push({
        id: stableId([document.id, String(chunkIndex), checksum]),
        documentId: document.id,
        tenantId: document.tenantId,
        namespace: document.namespace,
        source: document.source,
        sourceUri: document.sourceUri,
        sourceUrl: document.sourceUrl,
        title: document.title,
        page: estimatePage(start, options.chunkSize),
        section: section.section,
        chunkIndex,
        content,
        metadata: {
          ...document.metadata,
          documentTitle: document.title,
          chunkSize: options.chunkSize,
          chunkOverlap: options.chunkOverlap,
          section: section.section
        },
        checksum,
        createdAt: document.createdAt,
        updatedAt: document.updatedAt
      });
      chunkIndex += 1;
    }
  }

  return chunks;
}

async function readBytes(input: RagDocumentInput) {
  if (input.content !== undefined) return Buffer.from(input.content, "utf8");
  if (!input.sourceUri) throw new Error("sourceUri or content is required");

  if (input.source === "gcs" || input.sourceUri.startsWith("gs://")) {
    const match = input.sourceUri.match(/^gs:\/\/([^/]+)\/(.+)$/);
    if (!match) throw new Error(`invalid GCS URI: ${input.sourceUri}`);
    const objectPath = match[2]!.split("/").map((part) => encodeURIComponent(part)).join("/");
    const response = await fetch(`https://storage.googleapis.com/${match[1]}/${objectPath}`, {
      headers: process.env.GOOGLE_OAUTH_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.GOOGLE_OAUTH_ACCESS_TOKEN}` } : undefined
    });
    if (!response.ok) throw new Error(`failed to read GCS object ${input.sourceUri}: ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  }

  return readFile(input.sourceUri);
}

function mediaTypeFor(source: RagDocumentInput["source"], extension: string) {
  if (source === "markdown" || extension === ".md") return "text/markdown";
  if (source === "txt" || extension === ".txt") return "text/plain";
  return "text/plain";
}

function semanticSections(text: string) {
  const sections: Array<{ section?: string; text: string }> = [];
  const parts = text.split(/\n(?=#{1,6}\s+|[A-Z][^\n]{2,80}\n[-=]{3,})/g);
  for (const part of parts) {
    const heading = part.match(/^(#{1,6}\s+(.+)|([A-Z][^\n]{2,80})\n[-=]{3,})/);
    sections.push({ section: heading?.[2] ?? heading?.[3], text: part });
  }
  return sections.length ? sections : [{ text }];
}

function estimatePage(wordStart: number, chunkSize: number) {
  return Math.floor(wordStart / Math.max(chunkSize * 2, 1)) + 1;
}

function normalize(value: string) {
  return value.replace(/\r/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

export function sha256(value: Buffer | string) {
  return createHash("sha256").update(value).digest("hex");
}

function stableId(parts: string[]) {
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 32);
}
