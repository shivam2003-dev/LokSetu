import cors from "cors";
import express from "express";
import helmet from "helmet";
import { createHmac, timingSafeEqual } from "node:crypto";
import pino from "pino";
import { z } from "zod";
import { buildAadhaarIdentity } from "./citizenIdentity.js";
import { areaMappings, demoSubmissions, mpProfiles, seedUsers, sourceSnapshots } from "./data.js";
import {
  countRawIntakesByAadhaarHash,
  countRawIntakesByStatus,
  ensureAuthUser,
  findAuthUserByUsername,
  findRawIntakesByReceiptPrefix,
  initDatabase,
  insertRawIntake,
  insertSubmission,
  isDatabaseEnabled,
  listRecentBatchRuns,
  listRecentRawIntakes,
  listSubmissions,
  upsertAuthUser,
  verifyPassword
} from "./db.js";
import { runBatch } from "./batch.js";
import { extractWhatsAppMessages, intakeSchema, processIntake, toRawIntakePayload } from "./intake.js";
import { buildDiscardedIntakeDecision, isDiscardedPayload, MINIMUM_STORED_CITIZEN_SCORE } from "./noisePolicy.js";
import { buildDashboard } from "./pipeline.js";
import { AadhaarIdentity, DashboardFilters, ProjectStatus, RankedProject, UserProfile } from "./types.js";
import { aiRuntimeMode } from "./vertexAi.js";
import { indicRuntimeMode, translateUiStrings } from "./indicLanguage.js";
import { seedUiTranslations } from "./uiTranslations.js";
import { fallbackRun, fetchGdeltSignals, fetchNewsSignals, fetchXSignals } from "./externalSignals.js";
import { buildDailyIntelligence, intelligenceSourceGroups, sourceCoverage } from "./intelligence.js";
import { answerCopilot, buildProductionRagStatus, copilotKnowledgeSummary } from "./copilot.js";
import { buildEnterpriseSituation } from "./enterprise.js";
import { BoundaryLevel, buildBoundaryFeatures, buildHotspotClusters } from "./mapIntelligence.js";

const logger = pino({ name: "people-priority-api" });
const app = express();
const port = Number(process.env.PORT ?? 8080);
const aiMode = aiRuntimeMode();
const accessPassword = process.env.APP_ACCESS_PASSWORD ?? "";
const authSecret = process.env.APP_AUTH_SECRET || accessPassword || "loksetu-local-auth-secret";
const defaultAdminUsername = process.env.APP_ADMIN_USERNAME ?? "";
const defaultAdminPassword = process.env.APP_ADMIN_PASSWORD ?? "";
let memorySubmissions = [...demoSubmissions];
let demoDataEnabled = true;
const demoSubmissionIds = new Set(demoSubmissions.map((submission) => submission.id));
const memoryRawQueue: Array<{ id: string; payload: unknown; createdAt: string; processedAt?: string }> = [];
const memoryDiscardedIntakes: Array<{ id: string; payload: ReturnType<typeof toRawIntakePayload>; createdAt: string; processedAt: string; error: string }> = [];
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
  mode: z.enum(["online", "submitted", "all"]).default("all"),
  question: z.string().trim().min(1).max(1_000),
  language: z.string().trim().min(2).max(40).optional(),
  projectId: z.string().trim().optional()
});

const receiptIdSchema = z.string().trim().toLowerCase().regex(/^[a-f0-9-]{8,36}$/);
const loginSchema = z.object({
  username: z.string().trim().min(1).max(80).optional(),
  password: z.string().min(1)
});

const aadhaarSessionSchema = z.object({
  aadhaarNumber: z.string().trim().min(1).max(32)
});

const adminUserCreateSchema = z.object({
  actorId: z.string().default("admin-user-shivam"),
  username: z.string().trim().min(3).max(80),
  password: z.string().min(4).max(200),
  role: z.enum(["mp", "ward_staff", "district_admin", "state_admin"]).default("district_admin"),
  displayName: z.string().trim().min(2).max(120)
});

const mapBoundaryQuerySchema = z.object({
  level: z.enum(["state", "district", "constituency", "ward"]).optional()
});

const mapClusterQuerySchema = z.object({
  zoom: z.coerce.number().int().min(1).max(18).default(5)
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

const rewardMilestones = [
  {
    id: "ready",
    title: "Ready to earn",
    threshold: 0,
    description: "Start with one clear public-interest report."
  },
  {
    id: "civic-starter",
    title: "Civic Starter",
    threshold: 100,
    description: "You have earned your first full-report equivalent."
  },
  {
    id: "ward-watch",
    title: "Ward Watch",
    threshold: 250,
    description: "You are regularly helping surface local problems."
  },
  {
    id: "problem-solver",
    title: "Problem Solver",
    threshold: 500,
    description: "Your reports are building a useful evidence trail."
  },
  {
    id: "public-champion",
    title: "Public Champion",
    threshold: 1_000,
    description: "You are a high-value contributor for your area."
  },
  {
    id: "loksetu-guardian",
    title: "LokSetu Guardian",
    threshold: 2_000,
    description: "You have a long-running record of useful civic reporting."
  }
] as const;

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

app.post("/api/auth/login", async (request, response) => {
  if (!accessPassword) {
    response.json({ token: "", expiresAt: "", disabled: true });
    return;
  }
  const parsed = loginSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(401).json({ error: "Invalid username or password" });
    return;
  }
  const loginUsername = parsed.data.username?.trim();
  const authUser = loginUsername ? await findAuthUserByUsername(loginUsername) : null;
  const passwordMatchesUser = authUser ? verifyPassword(parsed.data.password, authUser.passwordHash) : false;
  const passwordOnlyFallback = !loginUsername && constantTimeEqual(parsed.data.password, accessPassword);
  if (!passwordMatchesUser && !passwordOnlyFallback) {
    response.status(401).json({ error: "Invalid password" });
    return;
  }
  const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
  response.json({
    token: signAccessToken(expiresAt, authUser?.username ?? "password-access"),
    expiresAt,
    user: authUser ? { id: authUser.id, username: authUser.username, role: authUser.role, displayName: authUser.displayName } : undefined
  });
});

app.post("/api/citizen/session", (request, response) => {
  const parsed = aadhaarSessionSchema.safeParse(request.body);
  const identity = parsed.success ? buildAadhaarIdentity(parsed.data.aadhaarNumber) : null;
  if (!parsed.success || !identity) {
    response.status(400).json({ error: "Enter a 12-digit Aadhaar number." });
    return;
  }
  const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
  response.json({
    token: signAccessToken(expiresAt, `citizen-${identity.aadhaarLast4}`, "citizen", identity),
    expiresAt,
    citizen: {
      aadhaarMasked: identity.aadhaarMasked,
      aadhaarVerified: identity.aadhaarVerified,
      identityMode: identity.identityMode
    }
  });
});

app.post("/api/citizen/rewards/lookup", async (request, response) => {
  const parsed = aadhaarSessionSchema.safeParse(request.body);
  const identity = parsed.success ? buildAadhaarIdentity(parsed.data.aadhaarNumber) : null;
  if (!parsed.success || !identity) {
    response.status(400).json({ error: "Enter a 12-digit Aadhaar number." });
    return;
  }
  response.json(await buildCitizenRewardSummary(identity));
});

// UI translation for the citizen app. Public (used on the login screen too).
// Translations are cached per language for the process lifetime so each
// language is translated by the AI provider at most once.
const uiTranslationSchema = z.object({
  language: z.string().trim().min(2).max(40),
  strings: z.array(z.string().min(1).max(2000)).min(1).max(200)
});
const uiTranslationCache = new Map<string, Record<string, string>>();

app.post("/api/citizen/ui-translations", async (request, response) => {
  const parsed = uiTranslationSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: "Provide a language and strings to translate." });
    return;
  }
  const { language, strings } = parsed.data;
  const cacheKey = language.toLowerCase();
  const cached = uiTranslationCache.get(cacheKey);
  if (cached) {
    response.json({ language, source: "cache", translations: cached });
    return;
  }
  // Hand-written seed dictionary works offline (no AI provider needed) and is
  // preferred where present; the AI fills any remaining strings.
  const seed = seedUiTranslations(language);
  let aiTranslations: Record<string, string> | null = null;
  try {
    const missing = strings.filter((item) => !seed?.[item]);
    aiTranslations = missing.length ? await translateUiStrings(missing, language) : null;
  } catch (error) {
    logger.warn({ error, language }, "ui translation failed");
  }
  const translations = { ...(aiTranslations ?? {}), ...(seed ?? {}) };
  if (!Object.keys(translations).length) {
    response.json({ language, source: "none", translations: {} });
    return;
  }
  uiTranslationCache.set(cacheKey, translations);
  response.json({ language, source: seed ? (aiTranslations ? "seed+ai" : "seed") : "ai", translations });
});

app.use("/api", (request, response, next) => {
  if (!accessPassword) {
    next();
    return;
  }
  const token = authTokenFromRequest(request);
  const parsedToken = token ? parseAccessToken(token) : null;
  if (!parsedToken) {
    response.status(401).json({ error: "Login required" });
    return;
  }
  if (parsedToken.kind === "citizen" && !isCitizenTokenRoute(request)) {
    response.status(403).json({ error: "Citizen token is limited to citizen submission, receipt, and reward routes" });
    return;
  }
  next();
});

app.get("/api/client-config", (_request, response) => {
  const mapplsMapSdkKey = process.env.PUBLIC_MAPPLS_MAP_SDK_KEY ?? process.env.MAPPLS_MAP_SDK_KEY ?? "";
  const browserMapsKey =
    process.env.PUBLIC_GOOGLE_MAPS_API_KEY ??
    process.env.GOOGLE_MAPS_BROWSER_API_KEY ??
    process.env.VITE_GOOGLE_MAPS_API_KEY ??
    process.env.GOOGLE_MAPS_API_KEY ??
    "";
  response.json({
    dataMode: isDatabaseEnabled() ? "postgres" : "memory",
    maps: {
      enabled: Boolean(mapplsMapSdkKey || browserMapsKey),
      apiKey: browserMapsKey,
      mapId: process.env.GOOGLE_MAPS_MAP_ID ?? process.env.VITE_GOOGLE_MAPS_MAP_ID ?? "",
      provider: mapplsMapSdkKey ? "mappls" : browserMapsKey ? "google" : "osm",
      mapplsKey: mapplsMapSdkKey,
      source: mapplsMapSdkKey ? "runtime-mappls-api" : browserMapsKey ? "runtime-api" : "not-configured"
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

app.get("/api/demo-data", async (_request, response) => {
  response.json(await demoDataStatus());
});

app.post("/api/demo-data/load", async (_request, response) => {
  demoDataEnabled = true;
  if (isDatabaseEnabled()) {
    for (const submission of demoSubmissions) await insertSubmission(submission);
  } else {
    const existing = new Set(memorySubmissions.map((submission) => submission.id));
    memorySubmissions = [
      ...memorySubmissions,
      ...demoSubmissions.filter((submission) => !existing.has(submission.id))
    ];
  }
  response.json(await demoDataStatus());
});

app.post("/api/demo-data/disable", async (_request, response) => {
  demoDataEnabled = false;
  response.json(await demoDataStatus());
});

app.get("/api/users", (_request, response) => {
  response.json({
    users: seedUsers.map(publicUser),
    roles: ["citizen", "mp", "ward_staff", "district_admin", "state_admin"],
    areaMappings: memoryAreaMappings
  });
});

app.post("/api/admin/users", async (request, response) => {
  const parsed = adminUserCreateSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const actor = getActor(parsed.data.actorId);
  if (!actor || !["district_admin", "state_admin"].includes(actor.role)) {
    response.status(403).json({ error: "Only district/state admins can create users" });
    return;
  }
  const user = await upsertAuthUser({
    username: parsed.data.username,
    password: parsed.data.password,
    role: parsed.data.role,
    displayName: parsed.data.displayName
  });
  response.status(201).json({
    user: user
      ? { id: user.id, username: user.username, role: user.role, displayName: user.displayName, createdAt: user.createdAt }
      : { username: parsed.data.username, role: parsed.data.role, displayName: parsed.data.displayName }
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
    indicLanguageMode: indicRuntimeMode(),
    tasks: [
      "text: Sarvam/Bhashini-ready language detection and translation, then Gemini civic category",
      "image: civic-issue validation and caption (Gemini vision)",
      "voice: Sarvam/Bhashini-ready transcription and translation, then Gemini classification",
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

app.get("/api/copilot/rag-status", async (_request, response) => {
  response.json(await buildProductionRagStatus());
});

app.post("/api/copilot/query", async (request, response) => {
  const parsed = copilotQuerySchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: "Invalid copilot query", details: parsed.error.flatten() });
    return;
  }
  const submissions = await getSubmissions();
  const dashboard = await buildDashboardWithOverrides({ scope: "global" });
  response.json(await answerCopilot(parsed.data, dashboard.projects, submissions));
});

app.get("/api/enterprise/situation-room", async (_request, response) => {
  const submissions = await getSubmissions();
  const dashboard = await buildDashboardWithOverrides({ scope: "global" });
  response.json(buildEnterpriseSituation(dashboard.projects, submissions));
});

app.get("/api/maps/boundaries", async (request, response) => {
  const parsed = mapBoundaryQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    response.status(400).json({ error: "Invalid boundary query", details: parsed.error.flatten() });
    return;
  }
  const dashboard = await buildDashboardWithOverrides({ scope: "global" });
  const features = buildBoundaryFeatures(dashboard.projects)
    .filter((feature) => !parsed.data.level || feature.level === parsed.data.level);
  const levels: BoundaryLevel[] = ["state", "district", "constituency", "ward"];
  const sourceStatus = features.some((feature) => feature.freshness === "procurement_required")
    ? "official_boundary_procurement_required"
    : "official_boundary_configured";
  response.json({
    generatedAt: dashboard.generatedAt,
    sourceStatus,
    levels,
    features,
    notes: [
      "Local boundary features are bbox-derived fixtures generated from ranked project coordinates.",
      "Production must replace these fixtures with official Survey of India/ISRO Bhuvan/ECI boundary layers or approved state GIS vector tiles.",
      "Every map response exposes source, version, freshness, and simplification metadata so MPs can see whether a layer is official or provisional."
    ]
  });
});

app.get("/api/maps/clusters", async (request, response) => {
  const parsed = mapClusterQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    response.status(400).json({ error: "Invalid cluster query", details: parsed.error.flatten() });
    return;
  }
  const dashboard = await buildDashboardWithOverrides({ scope: "global" });
  response.json({
    generatedAt: dashboard.generatedAt,
    zoom: parsed.data.zoom,
    source: "ranked_project_hotspots",
    clusters: buildHotspotClusters(dashboard.projects, parsed.data.zoom)
  });
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
  try {
    if (provider === "all" || provider === "news") runs.push(await fetchNewsSignals(query));
  } catch {
    runs.push(fallbackRun("news", query));
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
    rawIntake: isDatabaseEnabled() ? await countRawIntakesByStatus() : { pending: memoryRawQueue.length, discarded: memoryDiscardedIntakes.length },
    recentRuns: isDatabaseEnabled() ? await listRecentBatchRuns() : [],
    schedule: process.env.BATCH_SCHEDULE ?? "*/15 * * * *"
  });
});

app.post("/api/batch/run", async (request, response) => {
  const limit = Math.min(25, Math.max(1, Number(request.query.limit ?? 10)));
  if (isDatabaseEnabled()) {
    const run = await runBatch(limit);
    response.json({ mode: "on-demand", run });
    return;
  }

  const run = {
    id: crypto.randomUUID(),
    startedAt: new Date().toISOString(),
    status: "running" as const,
    processed: 0,
    discarded: 0,
    failed: 0
  };
  const records = memoryRawQueue.splice(0, limit);
  for (const record of records) {
    try {
      const { submission } = await processIntake(record.payload as ReturnType<typeof toRawIntakePayload>, { rawIntakeId: record.id, batchId: run.id });
      const discard = buildDiscardedIntakeDecision(record.payload as ReturnType<typeof toRawIntakePayload>, submission);
      if (discard) {
        memoryDiscardedIntakes.unshift({
          id: record.id,
          payload: discard.payload,
          createdAt: record.createdAt,
          processedAt: discard.payload.discardedAt ?? new Date().toISOString(),
          error: discard.reason
        });
        run.discarded += 1;
        continue;
      }
      memorySubmissions.push(submission);
      run.processed += 1;
    } catch (error) {
      run.failed += 1;
      memoryRawQueue.push({ ...record, payload: record.payload });
    }
  }
  const completedRun = {
    ...run,
    status: run.failed > 0 ? "failed" as const : "succeeded" as const,
    finishedAt: new Date().toISOString()
  };
  response.json({ mode: "on-demand", run: completedRun });
});

app.get("/api/intake/audit", async (_request, response) => {
  const submissions = await getSubmissions();
  const rawRecords = isDatabaseEnabled()
    ? await listRecentRawIntakes(30)
    : [
        ...memoryRawQueue.map((record) => ({
          id: record.id,
          payload: record.payload as ReturnType<typeof toRawIntakePayload>,
          status: "pending" as const,
          attempts: 0,
          createdAt: record.createdAt,
          processedAt: undefined
        })),
        ...memoryDiscardedIntakes.map((record) => ({
          id: record.id,
          payload: record.payload,
          status: "discarded" as const,
          attempts: 1,
          error: record.error,
          createdAt: record.createdAt,
          processedAt: record.processedAt
        }))
      ]
        .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
        .slice(0, 30);
  const byRawId = new Map(submissions.filter((submission) => submission.rawIntakeId).map((submission) => [submission.rawIntakeId, submission]));
  response.json({
    generatedAt: new Date().toISOString(),
    processingMode: "scheduled batch with on-demand evaluator run",
    rawStatus: isDatabaseEnabled() ? await countRawIntakesByStatus() : { pending: memoryRawQueue.length, discarded: memoryDiscardedIntakes.length },
    recentRuns: isDatabaseEnabled() ? await listRecentBatchRuns(5) : [],
    samples: [
      {
        type: "text",
        label: "School sanitation complaint",
        href: "/demo-assets/janvaani-text-complaint.txt",
        expected: "Education / Sanitation issue in Kalindi Nagar"
      },
      {
        type: "image",
        label: "Road damage photo prompt",
        href: "/demo-assets/janvaani-road-damage.svg",
        expected: "Roads issue with image-summary validation"
      },
      {
        type: "voice",
        label: "Short Hindi/English voice script",
        href: "/demo-assets/janvaani-voice-script.txt",
        expected: "Voice channel checks speech transcription and category routing"
      }
    ],
    entries: rawRecords.map((record) => {
      const submission = byRawId.get(record.id);
      const legacyFallback = Boolean(submission?.aiFallbackUsed);
      const payload = record.payload;
      const discarded = record.status === "discarded" || isDiscardedPayload(payload);
      return {
        rawIntakeId: record.id,
        shortReceipt: record.id.slice(0, 8),
        status: submission ? (legacyFallback ? "ai_retry_required" : "processed") : discarded ? "discarded_noise" : record.status,
        attempts: record.attempts,
        submittedAt: record.createdAt,
        processedAt: submission?.processedAt ?? record.processedAt,
        channel: payload.channel,
        input: {
          language: payload.language ?? "auto",
          text: payload.text?.slice(0, 500) ?? "",
          hasMedia: Boolean(payload.media),
          mediaType: payload.media?.startsWith("data:image/") ? "image" : payload.media?.startsWith("data:audio/") ? "audio" : payload.media?.startsWith("data:video/") ? "video" : "none",
          urgency: payload.urgency,
          rating: payload.rating,
          privacyMode: payload.privacyMode
        },
        identity: {
          aadhaarMasked: discarded ? undefined : submission?.aadhaarMasked ?? payload.aadhaarMasked,
          aadhaarVerified: discarded ? false : submission?.aadhaarVerified ?? payload.aadhaarVerified ?? false,
          identityMode: discarded ? "discarded_noise" : submission?.identityMode ?? payload.identityMode ?? "not_collected"
        },
        reward: submission
          ? {
              citizenScore: submission.citizenScore,
              qualityScore: submission.submissionQualityScore ?? submission.citizenScore,
              rewardPoints: submission.rewardPoints ?? submission.citizenScore,
              rewardBand: submission.rewardBand ?? "useful",
              reasons: submission.rewardReasons ?? []
            }
          : discarded
            ? {
                citizenScore: payload.discardedScore ?? null,
                qualityScore: payload.discardedQualityScore ?? payload.discardedScore ?? null,
                rewardPoints: 0,
                rewardBand: "discarded_noise",
                reasons: [payload.discardedReason ?? `Score below ${MINIMUM_STORED_CITIZEN_SCORE}/100; raw issue payload was discarded as noise.`]
              }
          : {
              citizenScore: null,
              qualityScore: null,
              rewardPoints: null,
              rewardBand: "pending_ai_score",
              reasons: ["AI quality and reward score will be available after batch processing."]
            },
        placement: {
          state: discarded ? "not_stored" : submission?.state ?? payload.state ?? "pending",
          district: discarded ? "not_stored" : submission?.district ?? payload.district ?? "pending",
          ward: discarded ? "discarded_noise" : submission?.ward ?? payload.ward ?? "pending",
          mpId: submission?.mpId,
          locationLabel: submission?.locationLabel
        },
        ai: submission
          ? legacyFallback
            ? {
                category: "AI retry required",
                detectedLanguage: submission.detectedLanguage,
                normalizedText: "Model inference pending. Previous deterministic placeholder suppressed.",
                transcript: submission.transcript,
                imageSummary: submission.imageSummary,
                isCivicIssue: false,
                noiseReason: "AI model retry required",
                providerMode: "vertex",
                model: "Gemini retry required",
                fallbackUsed: false,
                explanation: "This record was created before AI-only processing enforcement. Run the pipeline again after Vertex/Gemini succeeds; deterministic offline output is not used for ranking."
              }
            : {
              category: submission.category,
              detectedLanguage: submission.detectedLanguage,
              normalizedText: submission.normalizedText,
              transcript: submission.transcript,
              imageSummary: submission.imageSummary,
              isCivicIssue: submission.isCivicIssue ?? true,
              noiseReason: submission.noiseReason,
              providerMode: submission.aiProviderMode,
              model: submission.aiModel,
              fallbackUsed: submission.aiFallbackUsed,
              explanation: auditExplanation(submission)
            }
          : discarded
            ? {
                category: "discarded_noise",
                detectedLanguage: payload.language ?? "not_stored",
                normalizedText: "",
                isCivicIssue: false,
                noiseReason: payload.discardedReason,
                providerMode: "ai_noise_gate",
                model: "score-threshold",
                fallbackUsed: false,
                explanation: `AI score ${payload.discardedScore ?? 0}/100 was below ${payload.discardedThreshold ?? MINIMUM_STORED_CITIZEN_SCORE}/100. The record was discarded as noise and the raw text/media/Aadhaar hash were not retained.`
              }
          : {
              category: "pending_batch",
              detectedLanguage: "pending",
              explanation: "Raw intake is stored. Run on-demand pipeline to classify, transcribe/OCR media, route constituency, score, and index in RAG."
            }
      };
    })
  });
});

function auditExplanation(submission: Awaited<ReturnType<typeof getSubmissions>>[number]): string {
  const media =
    submission.mediaType && submission.mediaType !== "none"
      ? `${submission.channel} intake with ${submission.mediaType} evidence`
      : `${submission.channel} intake`;
  const area = [submission.ward, submission.district, submission.state].filter(Boolean).join(", ");
  const route = submission.mpId === "unassigned" ? "held for constituency review" : `routed to ${submission.mpId}`;
  const confidence = submission.aiFallbackUsed ? "AI retry required" : `${submission.aiProviderMode ?? "AI"} model`;
  if (submission.isCivicIssue === false) {
    return `${media} was held for review as non-addressable or noisy input. Reason: ${submission.noiseReason ?? "AI could not confirm a public civic issue"}. It was placed in ${area} from captured location but not treated as normal ranked demand.`;
  }
  return `${media} was tagged as ${submission.category}, placed in ${area}, ${route}, and scored ${submission.citizenScore}/100 from AI quality ${submission.submissionQualityScore ?? submission.citizenScore}/100, urgency ${submission.urgency}/5, citizen rating ${submission.rating}/5, language ${submission.detectedLanguage}, and ${confidence}.`;
}

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
  await handleIntake(request.body, response, {
    friendly: true,
    requireLocation: true,
    requireCitizenIdentity: true,
    citizenIdentity: citizenIdentityFromRequest(request)
  });
});

app.get("/api/citizen/receipts/:receiptId", async (request, response) => {
  const parsed = receiptIdSchema.safeParse(request.params.receiptId);
  if (!parsed.success) {
    response.status(400).json({ error: "Enter at least the 8-character receipt ID shown after submission." });
    return;
  }
  const status = await findReceiptStatus(parsed.data);
  if (status === "ambiguous") {
    response.status(409).json({ error: "Receipt prefix matched more than one submission. Enter the full receipt ID." });
    return;
  }
  if (!status) {
    response.status(404).json({ error: "Receipt not found. Check the ID and try again." });
    return;
  }
  response.json(status);
});

app.get("/api/citizen/rewards/me", async (request, response) => {
  const identity = citizenIdentityFromRequest(request);
  if (!identity) {
    response.status(401).json({ error: "Citizen Aadhaar session required" });
    return;
  }
  response.json(await buildCitizenRewardSummary(identity));
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
    if (!defaultAdminUsername || !defaultAdminPassword) return;
    return ensureAuthUser({
      id: `admin-user-${defaultAdminUsername.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      username: defaultAdminUsername,
      password: defaultAdminPassword,
      role: "state_admin",
      displayName: "Platform Admin"
    });
  })
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
  options: { friendly?: boolean; requireLocation?: boolean; requireCitizenIdentity?: boolean; citizenIdentity?: AadhaarIdentity } = {}
) {
  const parsed = intakeSchema.safeParse(body);
  if (!parsed.success) {
    response.status(400).json({ error: "Invalid submission", details: parsed.error.flatten() });
    return;
  }
  const citizenIdentity = options.citizenIdentity ?? buildAadhaarIdentity(parsed.data.aadhaarNumber);
  if (options.requireCitizenIdentity && !citizenIdentity) {
    response.status(400).json({ error: "Aadhaar required", message: "Enter a 12-digit Aadhaar number before submitting." });
    return;
  }
  if (options.requireLocation && (typeof parsed.data.lat !== "number" || typeof parsed.data.lng !== "number")) {
    response.status(400).json({ error: "Location required", message: "Allow browser location before submitting an issue." });
    return;
  }

  const raw = await enqueueRaw(toRawIntakePayload(parsed.data, citizenIdentity ?? undefined));
  const submissions = await getSubmissions();
  logger.info({ rawIntakeId: raw.id, channel: parsed.data.channel }, "submission queued for batch processing");

  response.status(202).json({
    rawIntakeId: raw.id,
    status: "pending_batch",
    message: "Submission received. It will be processed in the next scheduled batch run.",
    nextStep: "Batch worker will run OCR/speech/Vertex AI classification, AI quality scoring, reward points, clustering, and MP routing.",
    aadhaarMasked: raw.payload.aadhaarMasked,
    aadhaarVerified: raw.payload.aadhaarVerified ?? false,
    identityMode: raw.payload.identityMode,
    dashboard: options.friendly ? undefined : applyProjectOverrides(buildDashboard(submissions))
  });
}

async function getSubmissions() {
  const submissions = isDatabaseEnabled() ? await listSubmissions() : memorySubmissions;
  return demoDataEnabled ? submissions : submissions.filter((submission) => !demoSubmissionIds.has(submission.id));
}

async function demoDataStatus() {
  const allSubmissions = isDatabaseEnabled() ? await listSubmissions() : memorySubmissions;
  const demoRows = allSubmissions.filter((submission) => demoSubmissionIds.has(submission.id)).length;
  const visibleRows = demoDataEnabled ? allSubmissions.length : allSubmissions.length - demoRows;
  return {
    enabled: demoDataEnabled,
    mode: isDatabaseEnabled() ? "postgres" : "memory",
    demoRows,
    visibleRows,
    totalRows: allSubmissions.length,
    label: demoDataEnabled ? "Demo data on" : "Demo data off"
  };
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

async function findReceiptStatus(receiptId: string) {
  const prefix = receiptId.replace(/-/g, "").length === receiptId.length ? receiptId : receiptId;
  const submissions = await getSubmissions();
  const records = isDatabaseEnabled()
    ? await findRawIntakesByReceiptPrefix(prefix)
    : [
        ...memoryRawQueue
          .filter((item) => item.id.startsWith(prefix))
          .map((item) => ({
            id: item.id,
            payload: item.payload as ReturnType<typeof toRawIntakePayload>,
            status: "pending" as const,
            attempts: 0,
            createdAt: item.createdAt,
            processedAt: undefined
          })),
        ...memoryDiscardedIntakes
          .filter((item) => item.id.startsWith(prefix))
          .map((item) => ({
            id: item.id,
            payload: item.payload,
            status: "discarded" as const,
            attempts: 1,
            error: item.error,
            createdAt: item.createdAt,
            processedAt: item.processedAt
          }))
      ].slice(0, 2);
  if (records.length > 1) return "ambiguous";
  const record = records[0];
  if (!record) return null;
  const submission = submissions.find((item) => item.rawIntakeId === record.id);
  const payload = record.payload;
  const discarded = record.status === "discarded" || isDiscardedPayload(payload);
  if (!submission && discarded) {
    return {
      receiptId: record.id.slice(0, 8),
      status: "discarded_noise",
      nextStep: `This report scored below ${payload.discardedThreshold ?? MINIMUM_STORED_CITIZEN_SCORE}/100 and was discarded as noise. Submit again with exact place, public problem, people affected, urgency, and evidence.`,
      submittedAt: record.createdAt,
      processedAt: record.processedAt ?? payload.discardedAt,
      area: "Not stored after discard",
      category: "discarded_noise",
      citizenScore: payload.discardedScore,
      submissionQualityScore: payload.discardedQualityScore ?? payload.discardedScore,
      rewardPoints: 0,
      rewardBand: "discarded_noise",
      rewardReasons: [payload.discardedReason ?? "Score below the minimum storage threshold."],
      privacy: "Low-score noise was discarded. Raw text, media, location, and Aadhaar hash were not retained."
    };
  }
  return {
    receiptId: record.id.slice(0, 8),
    status: submission ? "processed" : record.status === "pending" ? "pending_batch" : record.status,
    nextStep: submission
      ? "Processed by the AI batch and routed to the constituency dashboard."
      : "Queued for the next scheduled AI batch.",
    submittedAt: record.createdAt,
    processedAt: submission?.processedAt ?? record.processedAt,
    area: submission?.locationLabel ?? ([payload.ward, payload.district, payload.state].filter(Boolean).join(", ") || "Area pending batch"),
    category: submission?.category,
    ward: submission?.ward ?? payload.ward,
    district: submission?.district ?? payload.district,
    state: submission?.state ?? payload.state,
    mpId: submission?.mpId,
    batchId: submission?.batchId,
    aadhaarMasked: submission?.aadhaarMasked ?? payload.aadhaarMasked,
    aadhaarVerified: submission?.aadhaarVerified ?? payload.aadhaarVerified ?? false,
    identityMode: submission?.identityMode ?? payload.identityMode,
    citizenScore: submission?.citizenScore,
    submissionQualityScore: submission?.submissionQualityScore,
    rewardPoints: submission?.rewardPoints,
    rewardBand: submission?.rewardBand,
    rewardReasons: submission?.rewardReasons,
    privacy: "Public-safe status only. Citizen identity and raw personal details are not shown."
  };
}

async function buildCitizenRewardSummary(identity: AadhaarIdentity) {
  const submissions = (await getSubmissions()).filter((submission) => submission.aadhaarHash === identity.aadhaarHash);
  const rewards = submissions.map(rewardPointsForSubmission);
  const qualityScores = submissions
    .map((submission) => numericScore(submission.submissionQualityScore ?? submission.citizenScore))
    .filter((score): score is number => typeof score === "number");
  const totalRewardPoints = rewards.reduce((sum, value) => sum + value, 0);
  const rawStatusCounts = await rawStatusCountsForAadhaarHash(identity.aadhaarHash, submissions);
  const milestone = rewardMilestoneFor(totalRewardPoints);
  const recentRewards = submissions
    .slice()
    .sort((left, right) => Date.parse(right.processedAt ?? right.createdAt) - Date.parse(left.processedAt ?? left.createdAt))
    .slice(0, 5)
    .map((submission) => ({
      receiptId: submission.rawIntakeId?.slice(0, 8) ?? submission.id.slice(0, 8),
      rewardPoints: rewardPointsForSubmission(submission),
      rewardBand: submission.rewardBand ?? rewardBandFromPoints(rewardPointsForSubmission(submission)),
      qualityScore: numericScore(submission.submissionQualityScore ?? submission.citizenScore) ?? 0,
      category: submission.category,
      area: submission.locationLabel ?? [submission.ward, submission.district, submission.state].filter(Boolean).join(", "),
      processedAt: submission.processedAt ?? submission.createdAt
    }));

  return {
    aadhaarMasked: identity.aadhaarMasked,
    aadhaarVerified: identity.aadhaarVerified,
    identityMode: identity.identityMode,
    totalRewardPoints,
    processedSubmissionCount: submissions.length,
    pendingSubmissionCount: (rawStatusCounts.pending ?? 0) + (rawStatusCounts.processing ?? 0),
    failedSubmissionCount: rawStatusCounts.failed ?? 0,
    averageQualityScore: qualityScores.length ? Math.round(qualityScores.reduce((sum, value) => sum + value, 0) / qualityScores.length) : 0,
    excellentReports: rewards.filter((points) => points >= 90).length,
    strongReports: rewards.filter((points) => points >= 75).length,
    latestRewardedAt: recentRewards[0]?.processedAt,
    currentMilestone: milestone.current,
    nextMilestone: milestone.next,
    pointsToNextMilestone: milestone.pointsToNext,
    milestoneProgressPercent: milestone.progressPercent,
    recentRewards,
    privacy: "Cumulative rewards are matched by salted Aadhaar hash. Raw Aadhaar numbers are not stored or returned."
  };
}

async function rawStatusCountsForAadhaarHash(
  aadhaarHash: string,
  submissions: Awaited<ReturnType<typeof getSubmissions>>
): Promise<Record<string, number>> {
  if (isDatabaseEnabled()) return countRawIntakesByAadhaarHash(aadhaarHash);
  const processedRawIds = new Set(submissions.map((submission) => submission.rawIntakeId).filter(Boolean));
  return memoryRawQueue.reduce<Record<string, number>>((counts, record) => {
    const payload = record.payload as ReturnType<typeof toRawIntakePayload>;
    if (payload.aadhaarHash !== aadhaarHash || processedRawIds.has(record.id)) return counts;
    counts.pending = (counts.pending ?? 0) + 1;
    return counts;
  }, {});
}

function rewardPointsForSubmission(submission: Awaited<ReturnType<typeof getSubmissions>>[number]) {
  return numericScore(submission.rewardPoints ?? submission.citizenScore) ?? 0;
}

function numericScore(value: unknown) {
  const score = Number(value);
  if (!Number.isFinite(score)) return undefined;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function rewardBandFromPoints(points: number) {
  if (points >= 90) return "excellent";
  if (points >= 75) return "strong";
  if (points >= 50) return "useful";
  return "needs_detail";
}

function rewardMilestoneFor(totalRewardPoints: number) {
  const current = rewardMilestones.reduce<(typeof rewardMilestones)[number]>(
    (best, milestone) => (totalRewardPoints >= milestone.threshold ? milestone : best),
    rewardMilestones[0]
  );
  const next = rewardMilestones.find((milestone) => milestone.threshold > totalRewardPoints);
  const pointsToNext = next ? Math.max(0, next.threshold - totalRewardPoints) : 0;
  const progressPercent = next
    ? Math.max(
        0,
        Math.min(100, Math.round(((totalRewardPoints - current.threshold) / (next.threshold - current.threshold)) * 100))
      )
    : 100;
  return { current, next, pointsToNext, progressPercent };
}

function getActor(userId: string): UserProfile | undefined {
  return seedUsers.find((user) => user.id === userId);
}

function publicUser(user: UserProfile) {
  return {
    id: user.id,
    role: user.role,
    username: user.username,
    displayName: user.displayName,
    privacyMode: user.privacyMode,
    mpId: user.mpId,
    location: user.location,
    contributionScore: user.contributionScore
  };
}

type AccessTokenPayload = {
  sub?: string;
  user?: string;
  kind?: "app" | "citizen";
  exp?: string;
  citizenIdentity?: AadhaarIdentity;
};

function signAccessToken(expiresAt: string, username = "password-access", kind: "app" | "citizen" = "app", citizenIdentity?: AadhaarIdentity) {
  const payload = Buffer.from(JSON.stringify({ sub: "loksetu-access", user: username, kind, exp: expiresAt, citizenIdentity })).toString("base64url");
  const signature = createHmac("sha256", authSecret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function verifyAccessToken(token: string) {
  return Boolean(parseAccessToken(token));
}

function parseAccessToken(token: string): AccessTokenPayload | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const validSignature = [authSecret, accessPassword]
    .filter(Boolean)
    .some((secret) => constantTimeEqual(signature, createHmac("sha256", secret).update(payload).digest("base64url")));
  if (!validSignature) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AccessTokenPayload;
    if (parsed.sub !== "loksetu-access" || !parsed.exp || Date.parse(parsed.exp) <= Date.now()) return null;
    if (parsed.kind !== "app" && parsed.kind !== "citizen") return null;
    return parsed;
  } catch {
    return null;
  }
}

function authTokenFromRequest(request: express.Request) {
  const header = request.header("authorization");
  if (header?.toLowerCase().startsWith("bearer ")) return header.slice(7).trim();
  return request.header("x-loksetu-access-token")?.trim();
}

function citizenIdentityFromRequest(request: express.Request): AadhaarIdentity | undefined {
  const token = authTokenFromRequest(request);
  return token ? parseAccessToken(token)?.citizenIdentity : undefined;
}

function isCitizenTokenRoute(request: express.Request): boolean {
  const path = request.originalUrl.split("?")[0];
  return (request.method === "POST" && path === "/api/citizen/submit") ||
    (request.method === "POST" && path === "/api/citizen/rewards/lookup") ||
    (request.method === "GET" && path === "/api/citizen/rewards/me") ||
    (request.method === "GET" && path.startsWith("/api/citizen/receipts/"));
}

function constantTimeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
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
    rewardSummary: {
      averageCitizenScore: project.averageCitizenScore ?? 0,
      averageSubmissionQuality: project.averageSubmissionQuality ?? 0,
      rewardedCitizenCount: project.rewardedCitizenCount ?? 0
    },
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
