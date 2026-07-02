import { z } from "zod";

export type ExternalSignal = {
  id: string;
  source: "x" | "gdelt" | "news";
  url?: string;
  title?: string;
  text: string;
  author?: string;
  publishedAt?: string;
  language?: string;
  state?: string;
  district?: string;
  ward?: string;
};

export type ExternalSignalRun = {
  provider: string;
  query: string;
  fetched: number;
  accepted: number;
  signals: ExternalSignal[];
  mode: "live" | "fallback" | "disabled";
};

const xResponseSchema = z.object({
  data: z.array(z.object({
    id: z.string(),
    text: z.string(),
    author_id: z.string().optional(),
    lang: z.string().optional(),
    created_at: z.string().optional()
  })).optional()
});

const gdeltResponseSchema = z.object({
  articles: z.array(z.object({
    url: z.string().optional(),
    title: z.string().optional(),
    seendate: z.string().optional(),
    language: z.string().optional(),
    sourcecountry: z.string().optional()
  })).optional()
});

const newsApiResponseSchema = z.object({
  status: z.string(),
  totalResults: z.number().optional(),
  articles: z.array(z.object({
    source: z.object({ id: z.string().nullable().optional(), name: z.string().optional() }).optional(),
    author: z.string().nullable().optional(),
    title: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    url: z.string().optional(),
    publishedAt: z.string().optional()
  })).optional()
});

export async function fetchXSignals(query: string, bearerToken = process.env.X_BEARER_TOKEN): Promise<ExternalSignalRun> {
  if (!bearerToken) return fallbackRun("x", query);
  const params = new URLSearchParams({
    query,
    max_results: "10",
    "tweet.fields": "created_at,lang,author_id"
  });
  const response = await fetch(`https://api.x.com/2/tweets/search/recent?${params.toString()}`, {
    headers: { Authorization: `Bearer ${bearerToken}` },
    signal: AbortSignal.timeout(8000)
  });
  if (!response.ok) throw new Error(`X recent search failed: ${response.status}`);
  const parsed = xResponseSchema.parse(await response.json());
  const signals = (parsed.data ?? []).map((post) => normalizeSignal({
    id: `x-${post.id}`,
    source: "x",
    text: post.text,
    author: post.author_id,
    language: post.lang,
    publishedAt: post.created_at
  }));
  return { provider: "x", query, fetched: parsed.data?.length ?? 0, accepted: signals.length, signals, mode: "live" };
}

export async function fetchGdeltSignals(query: string): Promise<ExternalSignalRun> {
  const params = new URLSearchParams({
    query,
    mode: "ArtList",
    format: "json",
    maxrecords: "10",
    sort: "hybridrel"
  });
  const response = await fetch(`https://api.gdeltproject.org/api/v2/doc/doc?${params.toString()}`, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`GDELT DOC API failed: ${response.status}`);
  const parsed = gdeltResponseSchema.parse(await response.json());
  const signals = (parsed.articles ?? []).map((article, index) => normalizeSignal({
    id: `gdelt-${hash(article.url ?? article.title ?? String(index))}`,
    source: "gdelt",
    url: article.url,
    title: article.title,
    text: article.title ?? article.url ?? "Untitled news signal",
    language: article.language,
    publishedAt: article.seendate
  }));
  return { provider: "gdelt", query, fetched: parsed.articles?.length ?? 0, accepted: signals.length, signals, mode: "live" };
}

export async function fetchNewsSignals(query: string, apiKey = process.env.NEWS_API_KEY): Promise<ExternalSignalRun> {
  if (!apiKey) return fallbackRun("news", query);
  const params = new URLSearchParams({
    q: query,
    language: "en",
    pageSize: "10",
    sortBy: "publishedAt"
  });
  const response = await fetch(`https://newsapi.org/v2/everything?${params.toString()}`, {
    headers: { "X-Api-Key": apiKey },
    signal: AbortSignal.timeout(8000)
  });
  if (!response.ok) throw new Error(`NewsAPI everything failed: ${response.status}`);
  const parsed = newsApiResponseSchema.parse(await response.json());
  const signals = (parsed.articles ?? []).map((article, index) => normalizeSignal({
    id: `news-${hash(article.url ?? article.title ?? String(index))}`,
    source: "news",
    url: article.url,
    title: article.title ?? undefined,
    text: [article.title, article.description].filter(Boolean).join(". ") || article.url || "Untitled news signal",
    author: article.author ?? article.source?.name,
    publishedAt: article.publishedAt
  }));
  return { provider: "news", query, fetched: parsed.articles?.length ?? 0, accepted: signals.length, signals, mode: "live" };
}

export function fallbackRun(provider: "x" | "gdelt" | "news", query: string): ExternalSignalRun {
  const source = provider;
  const signals = [
    normalizeSignal({
      id: `${provider}-fixture-1`,
      source,
      title: provider === "x" ? undefined : "Local media reports school flooding and road damage",
      text: "Local reports mention school flooding, broken roads, drainage overflow, and water supply problems in civic wards.",
      language: "en",
      state: "Delhi",
      district: "Central Delhi",
      ward: "Kalindi Nagar"
    })
  ];
  return { provider, query, fetched: signals.length, accepted: signals.length, signals, mode: "fallback" };
}

function normalizeSignal(signal: ExternalSignal): ExternalSignal {
  const text = signal.text.replace(/\s+/g, " ").trim();
  return {
    ...signal,
    text,
    state: signal.state ?? inferPlace(text).state,
    district: signal.district ?? inferPlace(text).district,
    ward: signal.ward ?? inferPlace(text).ward
  };
}

function inferPlace(text: string) {
  const lower = text.toLowerCase();
  if (lower.includes("lucknow")) return { state: "Uttar Pradesh", district: "Lucknow", ward: "Aminabad Basti" };
  if (lower.includes("chennai")) return { state: "Tamil Nadu", district: "Chennai", ward: "Perambur School Zone" };
  if (lower.includes("kolkata")) return { state: "West Bengal", district: "Kolkata", ward: "Beliaghata Clinic Zone" };
  return { state: "Delhi", district: "Central Delhi", ward: "Kalindi Nagar" };
}

function hash(value: string) {
  let output = 0;
  for (const char of value) output = (output * 31 + char.charCodeAt(0)) >>> 0;
  return output.toString(16);
}
