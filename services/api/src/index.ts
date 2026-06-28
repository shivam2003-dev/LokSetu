import cors from "cors";
import express from "express";
import helmet from "helmet";
import pino from "pino";
import { z } from "zod";
import { mpProfiles, seedSubmissions, seedUsers } from "./data.js";
import { initDatabase, insertSubmission, isDatabaseEnabled, listSubmissions } from "./db.js";
import { buildDashboard, normalizeSubmission } from "./pipeline.js";
import { analyzeWithVertexAi } from "./vertexAi.js";

const logger = pino({ name: "people-priority-api" });
const app = express();
const port = Number(process.env.PORT ?? 8080);
let memorySubmissions = [...seedSubmissions];

const submissionSchema = z.object({
  channel: z.enum(["text", "voice", "photo", "whatsapp"]),
  language: z.string().min(2).max(64).optional(),
  userId: z.string().min(2).max(96).default("guest"),
  username: z.string().min(2).max(64).default("citizen"),
  privacyMode: z.coerce.boolean().default(false),
  state: z.string().min(2).max(96).default("Delhi"),
  district: z.string().min(2).max(96).default("Central Delhi"),
  ward: z.string().min(2).max(96),
  urgency: z.coerce.number().min(1).max(5),
  rating: z.coerce.number().min(1).max(5).default(3),
  text: z.string().min(8).max(4000)
});

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
app.use(express.json({ limit: "1mb" }));

app.get("/healthz", (_request, response) => {
  response.json({
    ok: true,
    service: "people-priority-api",
    database: isDatabaseEnabled() ? "postgres" : "memory",
    ai: process.env.VERTEX_AI_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT ? "vertex-ai" : "fallback"
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

app.get("/api/priorities", async (request, response) => {
  const parsed = dashboardQuerySchema.safeParse(request.query);
  const submissions = await getSubmissions();
  response.json(buildDashboard(submissions, parsed.success ? parsed.data : {}));
});

app.post("/api/submissions", async (request, response) => {
  const parsed = submissionSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: "Invalid submission", details: parsed.error.flatten() });
    return;
  }

  const analysis = await analyzeWithVertexAi(parsed.data.text, parsed.data.language);
  const submission = normalizeSubmission(parsed.data, analysis);
  await saveSubmission(submission);
  const submissions = await getSubmissions();
  logger.info({ submissionId: submission.id, ward: submission.ward, ai: "vertex-ai" }, "submission processed");

  response.status(201).json({
    submission,
    citizenScore: submission.citizenScore,
    dashboard: buildDashboard(submissions)
  });
});

app.post("/api/projects/:projectId/ratings", async (request, response) => {
  const parsed = z.object({ rating: z.coerce.number().min(1).max(5) }).safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: "Invalid rating" });
    return;
  }
  response.status(201).json({ ok: true, rating: parsed.data.rating });
});

initDatabase()
  .then(() => {
    app.listen(port, () => {
      logger.info({ port, database: isDatabaseEnabled() ? "postgres" : "memory" }, "api listening");
    });
  })
  .catch((error: unknown) => {
    logger.error({ error }, "database initialization failed");
    process.exit(1);
  });

async function getSubmissions() {
  return isDatabaseEnabled() ? listSubmissions() : memorySubmissions;
}

async function saveSubmission(submission: (typeof memorySubmissions)[number]) {
  if (isDatabaseEnabled()) {
    await insertSubmission(submission);
    return;
  }
  memorySubmissions = [...memorySubmissions, submission];
}
