import cors from "cors";
import express from "express";
import helmet from "helmet";
import pino from "pino";
import { z } from "zod";
import { mpProfiles, seedSubmissions, seedUsers } from "./data.js";
import { initDatabase, insertSubmission, isDatabaseEnabled, listSubmissions } from "./db.js";
import { resolveLocation } from "./geo.js";
import { buildDashboard, normalizeSubmission } from "./pipeline.js";
import { Submission } from "./types.js";
import {
  analyzeImageWithVertexAi,
  analyzeWithVertexAi,
  transcribeWithVertexAi,
  VertexMediaAnalysis,
  VertexTextAnalysis
} from "./vertexAi.js";

const logger = pino({ name: "people-priority-api" });
const app = express();
const port = Number(process.env.PORT ?? 8080);
let memorySubmissions = [...seedSubmissions];

const aiEnabled = Boolean(process.env.VERTEX_AI_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT);

// Unified intake schema. The simple citizen app and the dashboard share it.
// text OR media must be present; ward/lat/lng drive location resolution.
const intakeSchema = z
  .object({
    channel: z.enum(["text", "voice", "photo", "whatsapp"]),
    language: z.string().min(2).max(64).optional(),
    userId: z.string().min(2).max(96).default("guest"),
    username: z.string().min(1).max(64).default("citizen"),
    privacyMode: z.coerce.boolean().default(true),
    state: z.string().min(2).max(96).optional(),
    district: z.string().min(2).max(96).optional(),
    ward: z.string().min(2).max(96).optional(),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    urgency: z.coerce.number().min(1).max(5).default(3),
    rating: z.coerce.number().min(1).max(5).default(4),
    text: z.string().max(4000).optional(),
    // data URL: "data:image/jpeg;base64,..." or "data:audio/webm;base64,..."
    media: z.string().max(14_000_000).optional()
  })
  .refine((value) => Boolean(value.text?.trim()) || Boolean(value.media), {
    message: "Provide text or media"
  });

type Intake = z.infer<typeof intakeSchema>;

const dashboardQuerySchema = z.object({
  scope: z.enum(["local", "global", "mp"]).optional(),
  mpId: z.string().optional(),
  state: z.string().optional(),
  district: z.string().optional(),
  ward: z.string().optional(),
  q: z.string().optional()
});

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "20mb" }));

app.get("/healthz", (_request, response) => {
  response.json({
    ok: true,
    service: "people-priority-api",
    database: isDatabaseEnabled() ? "postgres" : "memory",
    ai: aiEnabled ? "vertex-ai" : "fallback"
  });
});

app.get("/api/context", (_request, response) => {
  response.json({
    mps: mpProfiles,
    users: seedUsers,
    states: [...new Set(mpProfiles.map((mp) => mp.state))],
    districts: [...new Set(mpProfiles.map((mp) => mp.district))],
    wards: [...new Set(mpProfiles.flatMap((mp) => mp.wards))]
  });
});

app.get("/api/regions", (_request, response) => {
  response.json({
    coverage: {
      statesReady: 28,
      unionTerritoriesReady: 8,
      lokSabhaConstituenciesTarget: 543,
      districtsTarget: 700,
      wardModel: "urban ward, gram panchayat, assembly segment, polling area"
    },
    onboardingStates: [
      { state: "Delhi", districts: 11, constituencies: 7, readiness: 92 },
      { state: "Maharashtra", districts: 36, constituencies: 48, readiness: 71 },
      { state: "Tamil Nadu", districts: 38, constituencies: 39, readiness: 66 },
      { state: "West Bengal", districts: 23, constituencies: 42, readiness: 63 },
      { state: "Uttar Pradesh", districts: 75, constituencies: 80, readiness: 58 }
    ]
  });
});

app.get("/api/analytics", async (_request, response) => {
  const submissions = await getSubmissions();
  const dashboard = buildDashboard(submissions, { scope: "global" });
  response.json({
    summary: dashboard.totals,
    topProjects: dashboard.projects.slice(0, 5),
    signals: [
      { name: "Language normalization", value: `${dashboard.totals.languages} active languages`, trend: "+2 this week" },
      { name: "Privacy adoption", value: `${Math.round((submissions.filter((item) => item.privacyMode).length / Math.max(1, submissions.length)) * 100)}%`, trend: "citizens choosing aliases" },
      { name: "MP action queue", value: dashboard.projects.filter((item) => item.status === "shortlist").length.toString(), trend: "shortlisted" }
    ],
    categoryMix: dashboard.projects.map((project) => ({
      category: project.category,
      score: project.score,
      demand: project.demandCount,
      rating: project.averageRating
    }))
  });
});

app.get("/api/ai-ops", (_request, response) => {
  response.json({
    provider: "Vertex AI Gemini",
    mode: aiEnabled ? "vertex" : "fallback",
    tasks: [
      "text: language detection, translation, civic category",
      "image: civic-issue validation and caption (Gemini vision)",
      "voice: speech transcription and category (Gemini multimodal)",
      "dedupe and theme clustering",
      "evidence-grounded MP summaries"
    ],
    guardrails: [
      "JSON-only structured response",
      "allowed civic category enum",
      "image validation flags non-civic uploads",
      "raw evidence and transcript retained",
      "human approval required for fund movement",
      "privacy alias mode before public display"
    ]
  });
});

app.get("/api/moderation", async (_request, response) => {
  const submissions = await getSubmissions();
  response.json({
    queue: submissions.slice(-8).reverse().map((submission) => ({
      id: submission.id,
      alias: submission.displayName,
      ward: submission.ward,
      category: submission.category,
      language: submission.detectedLanguage,
      risk: submission.isCivicIssue === false ? "non-civic-image" : submission.text.length < 20 ? "needs-more-detail" : "normal",
      status: "auto-screened"
    })),
    policies: ["duplicate storm detection", "PII redaction", "abuse filtering", "non-civic image rejection", "coordinated campaign review"]
  });
});

app.get("/api/integrations", (_request, response) => {
  response.json({
    enabled: ["Postgres", "Vertex AI Gemini (text/image/voice)", "Kubernetes", "Argo CD", "Helm"],
    planned: ["WhatsApp Cloud API", "BHASHINI", "Vertex Speech-to-Text Chirp", "Cloud Vision OCR", "BigQuery GIS", "data.gov.in", "NDAP"],
    local: {
      database: isDatabaseEnabled() ? "postgres" : "memory",
      ai: aiEnabled ? "vertex-ai" : "fallback",
      k8s: "kind supported",
      gitops: "argocd/application-local.yaml"
    }
  });
});

app.get("/api/audit", async (_request, response) => {
  const submissions = await getSubmissions();
  response.json({
    events: submissions.slice(-10).reverse().map((submission) => ({
      at: submission.createdAt,
      actor: submission.displayName,
      action: "submitted_problem",
      object: `${submission.category} / ${submission.ward}`,
      privacyMode: submission.privacyMode
    }))
  });
});

app.get("/api/priorities", async (request, response) => {
  const parsed = dashboardQuerySchema.safeParse(request.query);
  const submissions = await getSubmissions();
  response.json(buildDashboard(submissions, parsed.success ? parsed.data : {}));
});

// Dashboard / power-user submission (kept for backward compatibility).
app.post("/api/submissions", async (request, response) => {
  await handleIntake(request.body, response);
});

// Simple citizen app submission. Same engine, friendlier receipt.
app.post("/api/citizen/submit", async (request, response) => {
  await handleIntake(request.body, response, { friendly: true });
});

app.post("/api/projects/:projectId/ratings", async (request, response) => {
  const parsed = z.object({ rating: z.coerce.number().min(1).max(5) }).safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: "Invalid rating" });
    return;
  }
  response.status(201).json({ ok: true, rating: parsed.data.rating });
});

// ---------------------------------------------------------------------------
// WhatsApp (Meta Cloud API shape) — webhook verify + receive, plus a local
// simulator so the channel is demoable without a live WhatsApp number.
// ---------------------------------------------------------------------------

app.get("/api/whatsapp/webhook", (request, response) => {
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN ?? "loksetu-verify";
  if (request.query["hub.mode"] === "subscribe" && request.query["hub.verify_token"] === verifyToken) {
    response.status(200).send(String(request.query["hub.challenge"] ?? ""));
    return;
  }
  response.sendStatus(403);
});

app.post("/api/whatsapp/webhook", async (request, response) => {
  // Acknowledge fast (Meta requires <10s), then process.
  response.sendStatus(200);
  try {
    for (const message of extractWhatsAppMessages(request.body)) {
      await ingest(message);
      logger.info({ from: message.userId, channel: "whatsapp" }, "whatsapp message processed");
    }
  } catch (error) {
    logger.error({ error }, "whatsapp webhook failed");
  }
});

app.post("/api/whatsapp/simulate", async (request, response) => {
  const parsed = z
    .object({
      from: z.string().min(3).max(32).default("919999999999"),
      text: z.string().max(4000).optional(),
      media: z.string().optional(),
      lat: z.coerce.number().optional(),
      lng: z.coerce.number().optional()
    })
    .safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: "Invalid simulate payload" });
    return;
  }
  await handleIntake(
    {
      channel: "whatsapp",
      userId: `wa-${parsed.data.from}`,
      username: parsed.data.from,
      privacyMode: true,
      text: parsed.data.text,
      media: parsed.data.media,
      lat: parsed.data.lat,
      lng: parsed.data.lng
    },
    response,
    { friendly: true }
  );
});

initDatabase()
  .then(() => {
    app.listen(port, () => {
      logger.info({ port, database: isDatabaseEnabled() ? "postgres" : "memory", ai: aiEnabled ? "vertex" : "fallback" }, "api listening");
    });
  })
  .catch((error: unknown) => {
    logger.error({ error }, "database initialization failed");
    process.exit(1);
  });

// ---------------------------------------------------------------------------
// Intake engine
// ---------------------------------------------------------------------------

async function handleIntake(
  body: unknown,
  response: express.Response,
  options: { friendly?: boolean } = {}
) {
  const parsed = intakeSchema.safeParse(body);
  if (!parsed.success) {
    response.status(400).json({ error: "Invalid submission", details: parsed.error.flatten() });
    return;
  }

  const { submission, analysis } = await processIntake(parsed.data);
  await saveSubmission(submission);
  const submissions = await getSubmissions();
  logger.info({ submissionId: submission.id, channel: submission.channel, ward: submission.ward, ai: aiEnabled ? "vertex" : "fallback" }, "submission processed");

  response.status(201).json({
    submission,
    citizenScore: submission.citizenScore,
    message: receiptMessage(submission, analysis),
    dashboard: options.friendly ? undefined : buildDashboard(submissions)
  });
}

// Fire-and-store path for channels without an HTTP response (WhatsApp webhook).
async function ingest(body: unknown) {
  const parsed = intakeSchema.safeParse(body);
  if (!parsed.success) return;
  const { submission } = await processIntake(parsed.data);
  await saveSubmission(submission);
}

async function processIntake(input: Intake): Promise<{ submission: Submission; analysis: VertexTextAnalysis | VertexMediaAnalysis }> {
  const media = input.media ? parseDataUrl(input.media) : null;
  const location = await resolveLocation(input);

  let analysis: VertexTextAnalysis | VertexMediaAnalysis;
  let mediaType: Submission["mediaType"] = "none";
  let transcript: string | undefined;
  let imageSummary: string | undefined;
  let isCivicIssue: boolean | undefined;

  if (media?.kind === "image") {
    const result = await analyzeImageWithVertexAi(media.base64, media.mimeType, input.language);
    analysis = result;
    mediaType = "image";
    imageSummary = result.mediaSummary;
    isCivicIssue = result.isCivicIssue;
  } else if (media?.kind === "audio") {
    const result = await transcribeWithVertexAi(media.base64, media.mimeType, input.language);
    analysis = result;
    mediaType = "audio";
    transcript = result.mediaSummary;
    isCivicIssue = result.isCivicIssue;
  } else {
    analysis = await analyzeWithVertexAi(input.text ?? "", input.language);
  }

  const submission = normalizeSubmission(
    {
      userId: input.userId,
      username: input.username,
      privacyMode: input.privacyMode,
      state: location.state,
      district: location.district,
      ward: location.ward,
      channel: input.channel,
      language: input.language,
      urgency: input.urgency,
      rating: input.rating,
      text: input.text ?? "",
      mediaType,
      lat: input.lat,
      lng: input.lng,
      locationLabel: location.label,
      transcript,
      imageSummary,
      isCivicIssue
    },
    analysis
  );

  return { submission, analysis };
}

function receiptMessage(submission: Submission, analysis: VertexTextAnalysis | VertexMediaAnalysis): string {
  if ("isCivicIssue" in analysis && analysis.isCivicIssue === false) {
    return "We could not detect a civic issue in this upload. Please add a photo of the problem or a short description.";
  }
  return `Thank you. We logged a ${submission.category} issue in ${submission.locationLabel ?? submission.ward}, detected ${submission.detectedLanguage}, and routed it to your MP.`;
}

function parseDataUrl(media: string): { mimeType: string; base64: string; kind: "image" | "audio" | "other" } | null {
  const match = /^data:([^;]+);base64,(.+)$/s.exec(media.trim());
  if (!match) return null;
  const mimeType = match[1];
  const kind = mimeType.startsWith("image/") ? "image" : mimeType.startsWith("audio/") ? "audio" : "other";
  return { mimeType, base64: match[2], kind };
}

type WhatsAppIntake = {
  channel: "whatsapp";
  userId: string;
  username: string;
  privacyMode: boolean;
  text?: string;
  media?: string;
  lat?: number;
  lng?: number;
};

// Parse Meta WhatsApp Cloud API webhook payloads into intake records.
function extractWhatsAppMessages(body: unknown): WhatsAppIntake[] {
  const intakes: WhatsAppIntake[] = [];
  const payload = body as {
    entry?: Array<{ changes?: Array<{ value?: { messages?: Array<Record<string, unknown>> } }> }>;
  };
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const message of change.value?.messages ?? []) {
        const from = String(message.from ?? "unknown");
        const base = { channel: "whatsapp" as const, userId: `wa-${from}`, username: from, privacyMode: true };
        const text = (message.text as { body?: string } | undefined)?.body;
        const location = message.location as { latitude?: number; longitude?: number } | undefined;
        // Note: real image/audio arrive as media IDs to fetch via Graph API.
        // The fetched bytes should be passed as a data URL in `media`.
        intakes.push({
          ...base,
          text,
          lat: location?.latitude,
          lng: location?.longitude
        });
      }
    }
  }
  return intakes;
}

async function getSubmissions() {
  return isDatabaseEnabled() ? listSubmissions() : memorySubmissions;
}

async function saveSubmission(submission: Submission) {
  if (isDatabaseEnabled()) {
    await insertSubmission(submission);
    return;
  }
  memorySubmissions = [...memorySubmissions, submission];
}
