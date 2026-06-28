import cors from "cors";
import express from "express";
import helmet from "helmet";
import pino from "pino";
import { z } from "zod";
import { mpProfiles, seedSubmissions, seedUsers } from "./data.js";
import { countRawIntakesByStatus, initDatabase, insertRawIntake, isDatabaseEnabled, listRecentBatchRuns, listSubmissions } from "./db.js";
import { extractWhatsAppMessages, intakeSchema, toRawIntakePayload } from "./intake.js";
import { buildDashboard } from "./pipeline.js";

const logger = pino({ name: "people-priority-api" });
const app = express();
const port = Number(process.env.PORT ?? 8080);
const aiMode = process.env.VERTEX_AI_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT ? "vertex" : "fallback";
let memorySubmissions = [...seedSubmissions];
const memoryRawQueue: Array<{ id: string; payload: unknown; createdAt: string }> = [];

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
    processing: "batch"
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
    mode: process.env.VERTEX_AI_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT ? "vertex" : "fallback",
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
    enabled: ["Postgres", "Batch data pipeline", "Vertex AI Gemini (text/image/voice)", "Kubernetes", "Argo CD", "Helm"],
    planned: ["WhatsApp Cloud API", "BHASHINI", "Vertex Speech-to-Text Chirp", "Cloud Vision OCR", "BigQuery GIS", "data.gov.in", "NDAP"],
    local: {
      database: isDatabaseEnabled() ? "postgres" : "memory",
      processing: "scheduled batch",
      k8s: "kind supported",
      gitops: "argocd/application-local.yaml"
    }
  });
});

app.get("/api/batch/status", async (_request, response) => {
  response.json({
    mode: "batch",
    rawIntake: isDatabaseEnabled() ? await countRawIntakesByStatus() : { pending: memoryRawQueue.length },
    recentRuns: isDatabaseEnabled() ? await listRecentBatchRuns() : [],
    schedule: process.env.BATCH_SCHEDULE ?? "*/15 * * * *"
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
  response.sendStatus(200);
  try {
    for (const message of extractWhatsAppMessages(request.body)) {
      await enqueueRaw(message);
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
      logger.info({ port, database: isDatabaseEnabled() ? "postgres" : "memory", ai: aiMode }, "api listening");
    });
  })
  .catch((error: unknown) => {
    logger.error({ error }, "database initialization failed");
    process.exit(1);
  });

// ---------------------------------------------------------------------------
// Batch-first intake engine
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

  const raw = await enqueueRaw(toRawIntakePayload(parsed.data));
  const submissions = await getSubmissions();
  logger.info({ rawIntakeId: raw.id, channel: parsed.data.channel }, "submission queued for batch processing");

  response.status(202).json({
    rawIntakeId: raw.id,
    status: "pending_batch",
    message: "Submission received. It will be processed in the next scheduled batch run.",
    nextStep: "Batch worker will run OCR/speech/Vertex AI classification, scoring, clustering, and MP routing.",
    dashboard: options.friendly ? undefined : buildDashboard(submissions)
  });
}

async function getSubmissions() {
  return isDatabaseEnabled() ? listSubmissions() : memorySubmissions;
}

async function enqueueRaw(payload: ReturnType<typeof toRawIntakePayload>) {
  if (isDatabaseEnabled()) return insertRawIntake(payload);
  const raw = {
    id: crypto.randomUUID(),
    payload,
    status: "pending" as const,
    attempts: 0,
    createdAt: new Date().toISOString()
  };
  memoryRawQueue.push(raw);
  return raw;
}
