import cors from "cors";
import express from "express";
import helmet from "helmet";
import pino from "pino";
import { z } from "zod";
import { areaMappings, mpProfiles, seedSubmissions, seedUsers, sourceSnapshots } from "./data.js";
import { countRawIntakesByStatus, initDatabase, insertRawIntake, isDatabaseEnabled, listRecentBatchRuns, listSubmissions } from "./db.js";
import { extractWhatsAppMessages, intakeSchema, toRawIntakePayload } from "./intake.js";
import { buildDashboard } from "./pipeline.js";
import { DashboardFilters, ProjectStatus, RankedProject, UserProfile } from "./types.js";
import { aiRuntimeMode } from "./vertexAi.js";
import { fallbackRun, fetchGdeltSignals, fetchXSignals } from "./externalSignals.js";
import { buildDailyIntelligence, intelligenceSourceGroups, sourceCoverage } from "./intelligence.js";
import { answerCopilot, copilotKnowledgeSummary } from "./copilot.js";

const logger = pino({ name: "people-priority-api" });
const app = express();
const port = Number(process.env.PORT ?? 8080);
const aiMode = aiRuntimeMode();
let memorySubmissions = [...seedSubmissions];
const memoryRawQueue: Array<{ id: string; payload: unknown; createdAt: string }> = [];
const memoryAreaMappings = [...areaMappings];
const memoryAuditEvents: Array<{ at: string; actor: string; action: string; object: string; privacyMode: boolean }> = [];
const memoryProjectStatus = new Map<string, { status: ProjectStatus; updatedAt: string; actor: string }>();
const memoryProjectRatings = new Map<string, Array<{ rating: number; createdAt: string }>>();

const dashboardQuerySchema = z.object({
  scope: z.enum(["local", "global", "mp"]).optional(),
  mpId: z.string().optional(),
  state: z.string().optional(),
  district: z.string().optional(),
  ward: z.string().optional(),
  q: z.string().optional()
});

const publicProjectsQuerySchema = dashboardQuerySchema.extend({
  category: z.string().optional(),
  limit: z.coerce.number().min(1).max(50).default(20),
  offset: z.coerce.number().min(0).default(0)
});

const actorQuerySchema = z.object({
  actorId: z.string(),
  mpId: z.string().optional()
});

const mappingUpdateSchema = z.object({
  actorId: z.string(),
  ward: z.string(),
  mpId: z.string(),
  wardStaffUserIds: z.array(z.string()).default([])
});

const projectStatusSchema = z.object({
  actorId: z.string().default("mp-user-delhi-central"),
  status: z.enum(["review", "shortlist", "approved"])
});

const copilotQuerySchema = z.object({
  role: z.enum(["mp", "collector", "citizen", "analyst"]).default("mp"),
  question: z.string().trim().min(3).max(1_000),
  language: z.string().trim().min(2).max(40).optional(),
  projectId: z.string().trim().optional()
});

const simulationScenarios = [
  {
    id: "school-flooding",
    title: "School flooding and toilet repair",
    channel: "text",
    state: "Delhi",
    district: "Central Delhi",
    ward: "Kalindi Nagar",
    language: "Hindi",
    urgency: 5,
    rating: 5,
    text: "School classrooms flood after rain and toilets are unusable for girls."
  },
  {
    id: "drain-video",
    title: "Drain overflow video evidence",
    channel: "video",
    state: "Uttar Pradesh",
    district: "Lucknow",
    ward: "Aminabad Basti",
    language: "Hindi",
    urgency: 5,
    rating: 4,
    text: "Video shows drain water entering homes and garbage blocking the lane."
  },
  {
    id: "streetlight-voice",
    title: "Streetlight safety voice note",
    channel: "voice",
    state: "West Bengal",
    district: "Kolkata",
    ward: "Howrah Riverside",
    language: "Bangla",
    urgency: 5,
    rating: 5,
    text: "Streetlights fail near the riverside road and women feel unsafe after sunset."
  },
  {
    id: "water-photo",
    title: "Water pipeline photo",
    channel: "photo",
    state: "Gujarat",
    district: "Ahmedabad",
    ward: "Odhav Water Line",
    language: "Gujarati",
    urgency: 4,
    rating: 4,
    text: "Photo shows leaking water pipeline and low morning pressure near industrial lane."
  }
];

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

app.get("/api/client-config", (_request, response) => {
  const browserMapsKey =
    process.env.PUBLIC_GOOGLE_MAPS_API_KEY ??
    process.env.GOOGLE_MAPS_BROWSER_API_KEY ??
    process.env.VITE_GOOGLE_MAPS_API_KEY ??
    process.env.GOOGLE_MAPS_API_KEY ??
    "";
  response.json({
    dataMode: isDatabaseEnabled() ? "postgres" : "memory",
    maps: {
      enabled: Boolean(browserMapsKey),
      apiKey: browserMapsKey,
      mapId: process.env.GOOGLE_MAPS_MAP_ID ?? process.env.VITE_GOOGLE_MAPS_MAP_ID ?? "",
      source: browserMapsKey ? "runtime-api" : "not-configured"
    },
    citizenAppUrl: process.env.CITIZEN_APP_URL ?? "",
    generatedAt: new Date().toISOString()
  });
});

app.get("/api/context", (_request, response) => {
  const states = [...new Set(areaMappings.map((mapping) => mapping.state))].sort();
  const districtsByState = Object.fromEntries(
    states.map((state) => [
      state,
      [...new Set(areaMappings.filter((mapping) => mapping.state === state).map((mapping) => mapping.district))].sort()
    ])
  );
  const wardsByDistrict = Object.fromEntries(
    [...new Set(areaMappings.map((mapping) => `${mapping.state}::${mapping.district}`))]
      .sort()
      .map((key) => {
        const [state, district] = key.split("::");
        return [
          key,
          areaMappings
            .filter((mapping) => mapping.state === state && mapping.district === district)
            .map((mapping) => mapping.ward)
            .sort()
        ];
      })
  );
  response.json({
    mps: mpProfiles,
    users: seedUsers,
    states,
    districts: [...new Set(areaMappings.map((mapping) => mapping.district))].sort(),
    wards: [...new Set(areaMappings.map((mapping) => mapping.ward))].sort(),
    districtsByState,
    wardsByDistrict,
    areaMappings
  });
});

app.get("/api/users", (_request, response) => {
  response.json({
    users: seedUsers.map(publicUser),
    roles: ["citizen", "mp", "ward_staff", "district_admin", "state_admin"],
    areaMappings: memoryAreaMappings
  });
});

app.get("/api/session", (request, response) => {
  const user = getActor(String(request.query.userId ?? "u-kalindi-01"));
  if (!user) {
    response.status(404).json({ error: "Unknown user" });
    return;
  }
  response.json({
    user: publicUser(user),
    defaultScope: user.role === "mp" ? "mp" : user.role === "state_admin" ? "global" : "local",
    allowedScopes: user.role === "citizen" ? ["local", "global"] : ["local", "mp", "global"],
    area: user.location
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
  const dashboard = await buildDashboardWithOverrides({ scope: "global" });
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
    provider: aiMode === "openai-compatible" ? "OpenAI-compatible Gemini" : "Vertex AI Gemini",
    mode: aiMode,
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

app.get("/api/data-sources", (_request, response) => {
  const freshness = sourceSnapshots.reduce<Record<string, number>>((acc, source) => {
    acc[source.freshness] = (acc[source.freshness] ?? 0) + 1;
    return acc;
  }, {});
  response.json({
    snapshots: sourceSnapshots,
    freshness,
    servingTables: ["submissions", "raw_intake", "batch_runs", "source_snapshots"],
    bigQueryTables: ["loksetu.analytics.project_scores", "loksetu.raw.official_source_snapshots"],
    missingWarnings: sourceSnapshots.filter((source) => source.freshness !== "fresh").map((source) => `${source.source}:${source.ward}`)
  });
});

app.get("/api/intelligence/sources", (_request, response) => {
  response.json({
    generatedAt: new Date().toISOString(),
    groups: intelligenceSourceGroups,
    coverage: sourceCoverage(),
    governance: [
      "Use official APIs, partner APIs, public datasets, or authorized uploads only.",
      "Social and trend sources are weak signals and must be cross-checked before ranking impact.",
      "Personal identifiers are removed before analytics, public display, or MP summaries.",
      "Every recommendation must expose source category, freshness, and supporting evidence."
    ]
  });
});

app.get("/api/intelligence/daily", async (_request, response) => {
  const submissions = await getSubmissions();
  const dashboard = await buildDashboardWithOverrides({ scope: "global" });
  response.json(buildDailyIntelligence(dashboard.projects, submissions));
});

app.get("/api/copilot/capabilities", (_request, response) => {
  response.json(copilotKnowledgeSummary());
});

app.post("/api/copilot/query", async (request, response) => {
  const parsed = copilotQuerySchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: "Invalid copilot query", details: parsed.error.flatten() });
    return;
  }
  const submissions = await getSubmissions();
  const dashboard = await buildDashboardWithOverrides({ scope: "global" });
  response.json(answerCopilot(parsed.data, dashboard.projects, submissions));
});

app.get("/api/external-signals", async (request, response) => {
  const query = String(request.query.q ?? "school OR road OR water OR clinic India civic issue");
  const provider = String(request.query.provider ?? "all");
  const runs = [];
  try {
    if (provider === "all" || provider === "x") runs.push(await fetchXSignals(query));
  } catch {
    runs.push(fallbackRun("x", query));
  }
  try {
    if (provider === "all" || provider === "gdelt") runs.push(await fetchGdeltSignals(query));
  } catch {
    runs.push(fallbackRun("gdelt", query));
  }
  response.json({
    query,
    runs,
    totalAccepted: runs.reduce((sum, run) => sum + run.accepted, 0),
    note: "External signals enrich demand discovery and do not replace citizen submissions or official data."
  });
});

app.get("/api/public/projects", async (request, response) => {
  const parsed = publicProjectsQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    response.status(400).json({ error: "Invalid public project query", details: parsed.error.flatten() });
    return;
  }
  const { limit, offset, category, ...filters } = parsed.data;
  const dashboard = await buildDashboardWithOverrides(filters);
  const sorted = dashboard.projects
    .filter((project) => !category || project.category.toLowerCase() === category.toLowerCase())
    .sort((a, b) => b.score - a.score || b.demandCount - a.demandCount || a.title.localeCompare(b.title));
  response.json({
    generatedAt: dashboard.generatedAt,
    latestProcessedBatchAt: latestProcessedAt(await getSubmissions()),
    total: sorted.length,
    limit,
    offset,
    items: sorted.slice(offset, offset + limit).map((project) => publicProjectDto(project))
  });
});

app.get("/api/public/projects/:projectId", async (request, response) => {
  const dashboard = await buildDashboardWithOverrides({ scope: "global" });
  const project = dashboard.projects.find((item) => item.id === request.params.projectId);
  if (!project) {
    response.status(404).json({ error: "Project not found" });
    return;
  }
  response.json({
    generatedAt: dashboard.generatedAt,
    latestProcessedBatchAt: latestProcessedAt(await getSubmissions()),
    project: publicProjectDto(project, true)
  });
});

app.get("/api/mp/queue", async (request, response) => {
  const parsed = actorQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    response.status(400).json({ error: "Invalid MP queue query", details: parsed.error.flatten() });
    return;
  }
  const actor = getActor(parsed.data.actorId);
  if (!actor) {
    response.status(404).json({ error: "Unknown actor" });
    return;
  }
  const targetMpId = parsed.data.mpId ?? actor.mpId;
  if (!targetMpId || !canAccessMp(actor, targetMpId)) {
    response.status(403).json({ error: "Role is not allowed to access this MP queue" });
    return;
  }
  const dashboard = await buildDashboardWithOverrides({ scope: "mp", mpId: targetMpId });
  response.json({
    actor: publicUser(actor),
    mpId: targetMpId,
    projects: dashboard.projects.map((project) => ({
      ...project,
      recentCitizenAliases: project.recentCitizenAliases
    }))
  });
});

app.post("/api/admin/area-mappings", (request, response) => {
  const parsed = mappingUpdateSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: "Invalid area mapping update", details: parsed.error.flatten() });
    return;
  }
  const actor = getActor(parsed.data.actorId);
  if (!actor || !["district_admin", "state_admin"].includes(actor.role)) {
    response.status(403).json({ error: "Only district/state admins can update area mappings" });
    return;
  }
  const mapping = memoryAreaMappings.find((item) => item.ward === parsed.data.ward);
  if (!mapping) {
    response.status(404).json({ error: "Unknown ward mapping" });
    return;
  }
  mapping.mpId = parsed.data.mpId;
  mapping.wardStaffUserIds = parsed.data.wardStaffUserIds;
  mapping.updatedAt = new Date().toISOString();
  memoryAuditEvents.unshift({
    at: mapping.updatedAt,
    actor: actor.displayName,
    action: "updated_area_mapping",
    object: `${mapping.ward} -> ${mapping.mpId}`,
    privacyMode: false
  });
  response.json({ mapping });
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
    enabled: ["Postgres", "Batch data pipeline", `${aiMode} AI runtime`, "Kubernetes", "Argo CD", "Helm"],
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
    events: [
      ...memoryAuditEvents,
      ...submissions.slice(-10).reverse().map((submission) => ({
        at: submission.createdAt,
        actor: submission.displayName,
        action: "submitted_problem",
        object: `${submission.category} / ${submission.ward}`,
        privacyMode: submission.privacyMode
      }))
    ].slice(0, 20)
  });
});

app.get("/api/priorities", async (request, response) => {
  const parsed = dashboardQuerySchema.safeParse(request.query);
  const submissions = await getSubmissions();
  response.json(await buildDashboardWithOverrides(parsed.success ? parsed.data : {}));
});

// Dashboard / power-user submission (kept for backward compatibility).
app.post("/api/submissions", async (request, response) => {
  await handleIntake(request.body, response);
});

// Simple citizen app submission. Same engine, friendlier receipt.
app.post("/api/citizen/submit", async (request, response) => {
  await handleIntake(request.body, response, { friendly: true });
});

app.get("/api/simulation/scenarios", (_request, response) => {
  response.json({ scenarios: simulationScenarios });
});

app.post("/api/simulation/submit", async (request, response) => {
  await handleIntake(
    {
      userId: "simulator-user",
      username: "loksetu-simulator",
      privacyMode: true,
      ...request.body
    },
    response,
    { friendly: true }
  );
});

app.patch("/api/projects/:projectId/status", async (request, response) => {
  const parsed = projectStatusSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: "Invalid project status update", details: parsed.error.flatten() });
    return;
  }
  const actor = getActor(parsed.data.actorId);
  if (!actor || !["mp", "district_admin", "state_admin"].includes(actor.role)) {
    response.status(403).json({ error: "Role is not allowed to update project status" });
    return;
  }
  const dashboard = await buildDashboardWithOverrides({ scope: "global" });
  const project = dashboard.projects.find((item) => item.id === request.params.projectId);
  if (!project) {
    response.status(404).json({ error: "Project not found" });
    return;
  }
  if (actor.role === "mp" && actor.mpId !== project.mpId) {
    response.status(403).json({ error: "MP can update only their own project queue" });
    return;
  }

  const updatedAt = new Date().toISOString();
  memoryProjectStatus.set(project.id, { status: parsed.data.status, updatedAt, actor: actor.displayName });
  memoryAuditEvents.unshift({
    at: updatedAt,
    actor: actor.displayName,
    action: "updated_project_status",
    object: `${project.title} -> ${parsed.data.status}`,
    privacyMode: false
  });
  const updatedProject = { ...project, status: parsed.data.status };
  response.json({ project: updatedProject, updatedAt });
});

app.post("/api/projects/:projectId/ratings", async (request, response) => {
  const parsed = z.object({ rating: z.coerce.number().min(1).max(5) }).safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: "Invalid rating" });
    return;
  }
  const dashboard = await buildDashboardWithOverrides({ scope: "global" });
  const project = dashboard.projects.find((item) => item.id === request.params.projectId);
  if (!project) {
    response.status(404).json({ error: "Project not found" });
    return;
  }
  const ratings = memoryProjectRatings.get(project.id) ?? [];
  ratings.push({ rating: parsed.data.rating, createdAt: new Date().toISOString() });
  memoryProjectRatings.set(project.id, ratings);
  const allRatings = [project.averageRating, ...ratings.map((item) => item.rating)];
  const averageRating = Number((allRatings.reduce((sum, value) => sum + value, 0) / allRatings.length).toFixed(2));
  response.status(201).json({
    ok: true,
    projectId: project.id,
    rating: parsed.data.rating,
    ratings: project.ratings + ratings.length,
    averageRating,
    message: "Rating recorded for public transparency metrics."
  });
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
    dashboard: options.friendly ? undefined : applyProjectOverrides(buildDashboard(submissions))
  });
}

async function getSubmissions() {
  return isDatabaseEnabled() ? listSubmissions() : memorySubmissions;
}

async function buildDashboardWithOverrides(filters: DashboardFilters = {}) {
  return applyProjectOverrides(buildDashboard(await getSubmissions(), filters));
}

function applyProjectOverrides<T extends { projects: RankedProject[] }>(dashboard: T): T {
  return {
    ...dashboard,
    projects: dashboard.projects.map((project) => {
      const statusOverride = memoryProjectStatus.get(project.id);
      const ratings = memoryProjectRatings.get(project.id) ?? [];
      if (!statusOverride && ratings.length === 0) return project;
      const ratingValues = [project.averageRating, ...ratings.map((item) => item.rating)];
      const averageRating = ratings.length
        ? Number((ratingValues.reduce((sum, value) => sum + value, 0) / ratingValues.length).toFixed(2))
        : project.averageRating;
      return {
        ...project,
        status: statusOverride?.status ?? project.status,
        averageRating,
        ratings: project.ratings + ratings.length,
        evidence: statusOverride ? [`MP status updated to ${statusOverride.status} by ${statusOverride.actor}`, ...project.evidence] : project.evidence
      };
    })
  };
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

function getActor(userId: string): UserProfile | undefined {
  return seedUsers.find((user) => user.id === userId);
}

function publicUser(user: UserProfile) {
  return {
    id: user.id,
    role: user.role,
    displayName: user.displayName,
    privacyMode: user.privacyMode,
    mpId: user.mpId,
    location: user.location,
    contributionScore: user.contributionScore
  };
}

function canAccessMp(actor: UserProfile, targetMpId: string): boolean {
  if (actor.role === "state_admin" || actor.role === "district_admin") return true;
  if (actor.role === "mp") return actor.mpId === targetMpId;
  if (actor.role === "ward_staff") {
    return memoryAreaMappings.some((mapping) => mapping.mpId === targetMpId && mapping.wardStaffUserIds.includes(actor.id));
  }
  return false;
}

function publicProjectDto(project: RankedProject, includeDetail = false) {
  const sourceIds = project.sourceSnapshotIds ?? [];
  return {
    id: project.id,
    title: project.title,
    category: project.category,
    state: project.state,
    district: project.district,
    ward: project.ward,
    mpName: project.mpName,
    score: project.score,
    confidence: project.confidence,
    demandCount: project.demandCount,
    averageRating: project.averageRating,
    ratings: project.ratings,
    status: project.status,
    rationale: project.rationale,
    sourceSnapshotIds: sourceIds,
    sourceFreshness: project.sourceFreshness ?? "missing",
    evidence: includeDetail ? project.evidence : project.evidence.slice(0, 3),
    safeguards: includeDetail ? project.safeguards : undefined,
    scoreBreakdown: includeDetail
      ? {
          demand: project.demandScore,
          need: project.needScore,
          urgency: project.urgencyScore,
          equity: project.equityScore
        }
      : undefined,
    contributorsHidden: true
  };
}

function latestProcessedAt(submissions: Awaited<ReturnType<typeof getSubmissions>>) {
  return submissions
    .map((submission) => submission.processedAt ?? submission.createdAt)
    .sort()
    .at(-1);
}
