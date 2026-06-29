import {
  Activity,
  ArrowRight,
  BarChart3,
  Bot,
  Building2,
  CheckCircle2,
  Clock,
  Database,
  DatabaseZap,
  FileText,
  Flag,
  GitBranch,
  Globe2,
  Home,
  Inbox,
  Languages,
  Lock,
  LockKeyhole,
  Map,
  MapPinned,
  MapPin,
  Megaphone,
  MessageSquareText,
  Network,
  RefreshCw,
  Scale,
  Search,
  Send,
  ShieldCheck,
  Star,
  Users,
  X
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type Page =
  | "home"
  | "explore"
  | "mp"
  | "projects"
  | "analytics"
  | "enterprise"
  | "copilot"
  | "ai"
  | "moderation"
  | "admin"
  | "integrations"
  | "simulation"
  | "public";

type Scope = "local" | "mp" | "global";

type RankedProject = {
  id: string;
  title: string;
  category: string;
  state: string;
  district: string;
  ward: string;
  mpId: string;
  mpName: string;
  score: number;
  confidence: number;
  demandCount: number;
  averageRating: number;
  ratings: number;
  demandScore: number;
  needScore: number;
  urgencyScore: number;
  equityScore: number;
  languageMix: string[];
  recentCitizenAliases: string[];
  rationale: string;
  evidence: string[];
  safeguards: string[];
  status: "review" | "shortlist" | "approved";
};

type DashboardResponse = {
  generatedAt: string;
  totals: { submissions: number; wards: number; languages: number; botRisk: "low" | "medium" | "high" };
  projects: RankedProject[];
  hotspots: Array<{ ward: string; category: string; intensity: number; lat: number; lng: number }>;
};

type RegionResponse = {
  coverage: {
    statesReady: number;
    unionTerritoriesReady: number;
    lokSabhaConstituenciesTarget: number;
    districtsTarget: number;
    wardModel: string;
  };
  onboardingStates: Array<{ state: string; districts: number; constituencies: number; readiness: number }>;
};

type ContextResponse = {
  mps: Array<{ id: string; name: string; state: string; district: string; wards: string[] }>;
  states: string[];
  districts: string[];
  wards: string[];
  districtsByState: Record<string, string[]>;
  wardsByDistrict: Record<string, string[]>;
};

type ClientConfig = {
  dataMode: "postgres" | "memory";
  maps: {
    enabled: boolean;
    apiKey: string;
    mapId: string;
    source: string;
  };
  citizenAppUrl?: string;
  generatedAt: string;
};

type BoundaryLevel = "state" | "district" | "constituency" | "ward";
type BoundaryFeature = {
  id: string;
  level: BoundaryLevel;
  name: string;
  source: string;
  sourceUrl: string;
  version: string;
  freshness: "fresh" | "stale" | "procurement_required";
  simplification: {
    toleranceMeters: number;
    method: string;
  };
  bbox: [number, number, number, number];
  centroid: { lat: number; lng: number };
  projectIds: string[];
};
type MapBoundaryResponse = {
  generatedAt: string;
  sourceStatus: string;
  levels: BoundaryLevel[];
  features: BoundaryFeature[];
  notes: string[];
};
type HotspotCluster = {
  id: string;
  level: "cluster" | "single";
  centroid: { lat: number; lng: number };
  count: number;
  score: number;
  categories: string[];
  projectIds: string[];
  label: string;
};
type MapClusterResponse = {
  generatedAt: string;
  zoom: number;
  source: string;
  clusters: HotspotCluster[];
};

type AnalyticsResponse = {
  signals: Array<{ name: string; value: string; trend: string }>;
  categoryMix: Array<{ category: string; score: number; demand: number; rating: number }>;
};

type IntelligenceSourcesResponse = {
  groups: Array<{
    category: string;
    purpose: string;
    sources: Array<{ name: string; examples: string[]; connectorMode: string; cadence: string; readiness: string; governance: string }>;
  }>;
  coverage: {
    totalSources: number;
    liveOrReady: number;
    restricted: number;
    byReadiness: Record<string, number>;
    byConnectorMode: Record<string, number>;
  };
  governance: string[];
};

type DailyIntelligenceResponse = {
  digest: string[];
  topEmergingIssues: Array<{ rank: number; title: string; category: string; area: string; score: number; demand: number; confidence: number; evidence: string[] }>;
  viralLocalTopics: Array<{ topic: string; mentions: number; trend: string }>;
  alerts: Array<{ name: string; severity: "low" | "medium" | "high"; detail: string }>;
  indices: Record<string, number>;
  recommendations: Array<{ owner: string; action: string; reason: string; nextStep: string }>;
  forecast: Array<{ category: string; area: string; risk: string; driver: string }>;
  sourceCoverage: IntelligenceSourcesResponse["coverage"];
};

type CopilotCapabilitiesResponse = {
  agents: Array<{ id: string; label: string; purpose: string }>;
  sourceFamilies: Array<{ category: string; sourceCount: number }>;
  supportedRoles: Array<"mp" | "collector" | "citizen" | "analyst">;
  supportedInputs: string[];
  rag?: { mode: string; productionTarget: string; citationsRequired: boolean };
  currentLimitations: string[];
};

type CopilotAnswer = {
  generatedAt: string;
  role: string;
  language: string;
  agent: { id: string; label: string; purpose: string };
  intent: string;
  answer: string;
  confidence: number;
  evidence: Array<{ type: string; text: string }>;
  citations: Array<{ type: string; id: string; title: string; snippet: string }>;
  retrieval: { mode: string; embeddingStore: string; corpusDocuments: number; retrieved: number; latencyMs: number };
  retrievedContext: Array<{ id: string; title: string; sourceType: string; snippet: string; score: number }>;
  suggestedActions: string[];
  followUpQuestions: string[];
  guardrails: string[];
};

type RagStatusResponse = {
  mode: string;
  productionTarget: string;
  embeddingStore: string;
  corpusDocuments: number;
  bySource: Record<string, number>;
  privacy: string;
  refreshCadence: string;
};

type EnterpriseSituationResponse = {
  liveMonitoring: Array<{ name: string; value: number; detail: string }>;
  incidents: Array<{ id: string; type: string; title: string; area: string; severity: string; status: string; assignee: string; demand: number; confidence: number; workflow: string[] }>;
  anomalies: Array<{ name: string; severity: string; change: string; explanation: string }>;
  healthScore: { score: number; drivers: Array<{ name: string; value: number }> };
  rootCause: Array<{ step: string; detail: string }>;
  eventTimeline: Array<{ at: string; event: string; detail: string }>;
  correlations: Array<{ source: string; middle: string; target: string; strength: number }>;
  digitalTwin: { populationModel: string; assets: Array<{ name: string; activeSignals: number; status: string }>; sourceCoverage: { totalSources: number; liveOrReady: number } };
  gisIntelligence: Array<{ name: string; status: string; features: number }>;
  smartAlerts: Array<{ name: string; severity: string; detail: string }>;
  predictiveIntelligence: Array<{ name: string; probability: number; driver: string }>;
  observability: Record<string, Array<{ name: string; value: number; detail: string }>>;
};

type AiOpsResponse = { provider: string; mode: string; tasks: string[]; guardrails: string[] };
type ModerationResponse = { queue: Array<{ id: string; alias: string; ward: string; category: string; language: string; risk: string; status: string }>; policies: string[] };
type IntegrationsResponse = { enabled: string[]; planned: string[]; local: Record<string, string> };
type AuditResponse = { events: Array<{ at: string; actor: string; action: string; object: string; privacyMode: boolean }> };
type Hotspot = DashboardResponse["hotspots"][number];
type MapLoadState = "idle" | "loading" | "ready" | "fallback";
type PublicProject = {
  id: string;
  title: string;
  category: string;
  state: string;
  district: string;
  ward: string;
  mpName: string;
  score: number;
  confidence: number;
  demandCount: number;
  averageRating: number;
  ratings: number;
  status: RankedProject["status"];
  rationale: string;
  sourceSnapshotIds: string[];
  sourceFreshness: "fresh" | "stale" | "missing";
  evidence: string[];
  safeguards?: string[];
  scoreBreakdown?: { demand: number; need: number; urgency: number; equity: number };
  contributorsHidden: boolean;
};
type PublicProjectsResponse = {
  generatedAt: string;
  latestProcessedBatchAt?: string;
  total: number;
  limit: number;
  offset: number;
  items: PublicProject[];
};
type SimulationScenario = {
  id: string;
  title: string;
  channel: "text" | "voice" | "photo" | "video" | "whatsapp";
  state: string;
  district: string;
  ward: string;
  language: string;
  urgency: number;
  rating: number;
  text: string;
};

declare global {
  interface Window {
    google?: any;
    __loksetuGoogleMapsPromise?: Promise<void>;
    __loksetuGoogleMapsLoaded?: () => void;
  }
}

const apiBase = import.meta.env.VITE_API_BASE_URL ?? "";
const envGoogleMapsApiKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? "").trim();
const envGoogleMapsMapId = (import.meta.env.VITE_GOOGLE_MAPS_MAP_ID ?? "").trim();
const configuredCitizenAppUrl = (import.meta.env.VITE_CITIZEN_APP_URL ?? "").trim();
const citizenAppUrl =
  configuredCitizenAppUrl ||
  (["localhost", "127.0.0.1"].includes(window.location.hostname)
    ? "http://localhost:5174"
    : `https://citizen.${window.location.host}`);

const navSections: Array<{ title: string; items: Array<{ page: Page; label: string; icon: typeof Home }> }> = [
  {
    title: "Workspace",
    items: [
      { page: "home", label: "Home", icon: Home },
      { page: "explore", label: "India Explorer", icon: Map },
      { page: "mp", label: "MP Center", icon: Building2 },
      { page: "projects", label: "Project Rooms", icon: FileText },
      { page: "analytics", label: "Analytics", icon: BarChart3 },
      { page: "enterprise", label: "Situation Room", icon: Activity },
      { page: "copilot", label: "AI Copilot", icon: MessageSquareText },
      { page: "simulation", label: "Simulation", icon: DatabaseZap },
      { page: "public", label: "Public Board", icon: Megaphone }
    ]
  },
  {
    title: "Operations",
    items: [
      { page: "moderation", label: "Moderation", icon: ShieldCheck },
      { page: "ai", label: "AI Ops", icon: Bot },
      { page: "admin", label: "Admin", icon: Users },
      { page: "integrations", label: "Integrations", icon: Network }
    ]
  }
];

const fallbackProject: RankedProject = {
  id: "kalindi-nagar-education",
  title: "Repair classrooms and toilets in Kalindi Nagar",
  category: "Education",
  state: "Delhi",
  district: "Central Delhi",
  ward: "Kalindi Nagar",
  mpId: "mp-delhi-central",
  mpName: "MP Central Delhi",
  score: 95,
  confidence: 0.86,
  demandCount: 48,
  averageRating: 4.5,
  ratings: 2,
  demandScore: 37,
  needScore: 32,
  urgencyScore: 15,
  equityScore: 12,
  languageMix: ["English", "Hindi"],
  recentCitizenAliases: ["Local Voice 482", "Local Voice 917"],
  rationale: "Education demand is supported by repeated citizen signals and classroom crowding data.",
  evidence: ["48 similar requests", "4.5/5 citizen rating", "1.7x classroom crowding"],
  safeguards: ["Personal identity removed from MP view", "Human approval required before allocation"],
  status: "shortlist"
};

const fallbackDashboard: DashboardResponse = {
  generatedAt: new Date().toISOString(),
  totals: { submissions: 0, wards: 0, languages: 0, botRisk: "low" },
  projects: [fallbackProject],
  hotspots: []
};

const fallbackContext: ContextResponse = {
  mps: [{ id: fallbackProject.mpId, name: fallbackProject.mpName, state: fallbackProject.state, district: fallbackProject.district, wards: [fallbackProject.ward] }],
  states: [fallbackProject.state],
  districts: [fallbackProject.district],
  wards: [fallbackProject.ward],
  districtsByState: { [fallbackProject.state]: [fallbackProject.district] },
  wardsByDistrict: { [`${fallbackProject.state}::${fallbackProject.district}`]: [fallbackProject.ward] }
};

const fallbackClientConfig: ClientConfig = {
  dataMode: "memory",
  maps: {
    enabled: Boolean(envGoogleMapsApiKey),
    apiKey: envGoogleMapsApiKey,
    mapId: envGoogleMapsMapId,
    source: envGoogleMapsApiKey ? "vite-env" : "not-configured"
  },
  citizenAppUrl,
  generatedAt: new Date().toISOString()
};

const fallbackMapBoundaries: MapBoundaryResponse = {
  generatedAt: new Date().toISOString(),
  sourceStatus: "local_fallback",
  levels: ["state", "district", "constituency", "ward"],
  features: [],
  notes: []
};

const fallbackMapClusters: MapClusterResponse = {
  generatedAt: new Date().toISOString(),
  zoom: 5,
  source: "local_fallback",
  clusters: []
};

const problemCards: Array<{ icon: typeof Home; title: string; body: string }> = [
  {
    icon: GitBranch,
    title: "Feedback arrives in fragments",
    body: "Public meetings, letters, WhatsApp, social media, grievance portals - each a separate silo. No MP has a single consolidated view."
  },
  {
    icon: Scale,
    title: "No way to rank what to build",
    body: "Dozens of competing projects in every development plan. No data-backed method to compare school upgrades vs. roads vs. health centres against actual need."
  },
  {
    icon: Languages,
    title: "22 languages. All unprocessed.",
    body: "Citizens submit in Hindi, Tamil, Bengali, Kannada, Telugu - via voice notes, photos, and informal texts. None of it gets analyzed."
  },
  {
    icon: DatabaseZap,
    title: "Decisions disconnected from data",
    body: "No system connects citizen demand with census figures, infrastructure audits, development plans, and local datasets to produce evidence-based priorities."
  }
];

const pipelineSteps = [
  {
    number: "01",
    label: "Citizen Input",
    detail: ["Voice · Text · Photo", "WhatsApp · SMS", "Any Indian language"]
  },
  {
    number: "02",
    label: "AI Analysis",
    detail: ["Language detection", "Theme extraction", "Demand clustering"]
  },
  {
    number: "03",
    label: "Data Fusion",
    detail: ["Census records", "Infrastructure audits", "Development plans"]
  },
  {
    number: "04",
    label: "Priority Ranking",
    detail: ["Evidence-backed list", "Confidence scores", "Equity flags"],
    active: true
  },
  {
    number: "05",
    label: "MP Action",
    detail: ["Approve priorities", "Push to district", "Track delivery"]
  }
];

function pageFromHash(): Page {
  const raw = window.location.hash.replace("#", "") || "home";
  if (raw === "intake" || raw === "submit") return "home";
  const navItems = navSections.flatMap((section) => section.items);
  if (raw === "india") return "explore";
  return navItems.some((item) => item.page === raw) ? (raw as Page) : "home";
}

async function getJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const response = await fetch(`${apiBase}${path}`);
    if (!response.ok) throw new Error(path);
    return response.json();
  } catch {
    return fallback;
  }
}

async function requestJson<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBase}${path}`);
  if (!response.ok) throw new Error(path);
  return response.json();
}

async function fetchDashboard(filters: { scope: Scope; state: string; district: string; ward: string; mpId: string; q: string }) {
  const params = new URLSearchParams({ scope: filters.scope });
  if (filters.scope === "local") {
    params.set("state", filters.state);
    params.set("district", filters.district);
    params.set("ward", filters.ward);
  }
  if (filters.scope === "mp") params.set("mpId", filters.mpId);
  if (filters.q.trim()) params.set("q", filters.q.trim());
  return requestJson<DashboardResponse>(`/api/priorities?${params}`);
}

export default function App() {
  const [page, setPageState] = useState<Page>(() => pageFromHash());
  const [scope, setScope] = useState<Scope>("local");
  const [state, setState] = useState("Delhi");
  const [district, setDistrict] = useState("Central Delhi");
  const [ward, setWard] = useState("Kalindi Nagar");
  const [mpId, setMpId] = useState("mp-delhi-central");
  const [query, setQuery] = useState("");
  const [dashboard, setDashboard] = useState<DashboardResponse>(fallbackDashboard);
  const [context, setContext] = useState<ContextResponse>(fallbackContext);
  const [clientConfig, setClientConfig] = useState<ClientConfig>(fallbackClientConfig);
  const [apiConnected, setApiConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [regions, setRegions] = useState<RegionResponse | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [intelligenceSources, setIntelligenceSources] = useState<IntelligenceSourcesResponse | null>(null);
  const [dailyIntelligence, setDailyIntelligence] = useState<DailyIntelligenceResponse | null>(null);
  const [copilotCapabilities, setCopilotCapabilities] = useState<CopilotCapabilitiesResponse | null>(null);
  const [ragStatus, setRagStatus] = useState<RagStatusResponse | null>(null);
  const [enterprise, setEnterprise] = useState<EnterpriseSituationResponse | null>(null);
  const [aiOps, setAiOps] = useState<AiOpsResponse | null>(null);
  const [moderation, setModeration] = useState<ModerationResponse | null>(null);
  const [integrations, setIntegrations] = useState<IntegrationsResponse | null>(null);
  const [audit, setAudit] = useState<AuditResponse | null>(null);
  const [mapBoundaries, setMapBoundaries] = useState<MapBoundaryResponse>(fallbackMapBoundaries);
  const [mapClusters, setMapClusters] = useState<MapClusterResponse>(fallbackMapClusters);
  const [notice, setNotice] = useState("Connecting");
  const [activeProjectId, setActiveProjectId] = useState(fallbackProject.id);

  const filters = useMemo(() => ({ scope, state, district, ward, mpId, q: query }), [scope, state, district, ward, mpId, query]);
  const activeProject = dashboard.projects.find((project) => project.id === activeProjectId) ?? dashboard.projects[0] ?? fallbackProject;
  const effectiveCitizenAppUrl = clientConfig.citizenAppUrl?.trim() || citizenAppUrl;
  const showControlStrip = page !== "copilot";

  useEffect(() => {
    refreshAll();
    const onHashChange = () => setPageState(pageFromHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    reconcileSelection(context);
  }, [context]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      applyFilters();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [filters]);

  function setPage(next: Page) {
    setPageState(next);
    if (window.location.hash !== `#${next}`) window.history.replaceState(null, "", `#${next}`);
  }

  async function refreshAll() {
    try {
      const [nextConfig, nextContext, nextDashboard, nextRegions, nextAnalytics, nextSources, nextDaily, nextCopilot, nextRagStatus, nextEnterprise, nextAiOps, nextModeration, nextIntegrations, nextAudit, nextBoundaries, nextClusters] = await Promise.all([
      requestJson<ClientConfig>("/api/client-config"),
      requestJson<ContextResponse>("/api/context"),
      fetchDashboard(filters),
      getJson<RegionResponse>("/api/regions", {
        coverage: { statesReady: 28, unionTerritoriesReady: 8, lokSabhaConstituenciesTarget: 543, districtsTarget: 700, wardModel: "ward and panchayat" },
        onboardingStates: []
      }),
      getJson<AnalyticsResponse>("/api/analytics", { signals: [], categoryMix: [] }),
      getJson<IntelligenceSourcesResponse>("/api/intelligence/sources", { groups: [], coverage: { totalSources: 0, liveOrReady: 0, restricted: 0, byReadiness: {}, byConnectorMode: {} }, governance: [] }),
      getJson<DailyIntelligenceResponse>("/api/intelligence/daily", { digest: [], topEmergingIssues: [], viralLocalTopics: [], alerts: [], indices: {}, recommendations: [], forecast: [], sourceCoverage: { totalSources: 0, liveOrReady: 0, restricted: 0, byReadiness: {}, byConnectorMode: {} } }),
      getJson<CopilotCapabilitiesResponse>("/api/copilot/capabilities", { agents: [], sourceFamilies: [], supportedRoles: ["mp"], supportedInputs: [], currentLimitations: [] }),
      getJson<RagStatusResponse>("/api/copilot/rag-status", { mode: "local-hybrid-rag", productionTarget: "Vertex AI RAG Engine or Vertex AI Vector Search", embeddingStore: "local-deterministic-index", corpusDocuments: 0, bySource: {}, privacy: "privacy-safe aliases only", refreshCadence: "batch pipeline refresh" }),
      getJson<EnterpriseSituationResponse>("/api/enterprise/situation-room", { liveMonitoring: [], incidents: [], anomalies: [], healthScore: { score: 0, drivers: [] }, rootCause: [], eventTimeline: [], correlations: [], digitalTwin: { populationModel: "", assets: [], sourceCoverage: { totalSources: 0, liveOrReady: 0 } }, gisIntelligence: [], smartAlerts: [], predictiveIntelligence: [], observability: {} }),
      getJson<AiOpsResponse>("/api/ai-ops", { provider: "Vertex AI", mode: "fallback", tasks: [], guardrails: [] }),
      getJson<ModerationResponse>("/api/moderation", { queue: [], policies: [] }),
      getJson<IntegrationsResponse>("/api/integrations", { enabled: [], planned: [], local: {} }),
      getJson<AuditResponse>("/api/audit", { events: [] }),
      getJson<MapBoundaryResponse>("/api/maps/boundaries", fallbackMapBoundaries),
      getJson<MapClusterResponse>("/api/maps/clusters?zoom=5", fallbackMapClusters)
      ]);
      setClientConfig(mergeClientConfig(nextConfig));
      setContext(nextContext);
    setDashboard(nextDashboard);
    setRegions(nextRegions);
    setAnalytics(nextAnalytics);
    setIntelligenceSources(nextSources);
    setDailyIntelligence(nextDaily);
    setCopilotCapabilities(nextCopilot);
    setRagStatus(nextRagStatus);
    setEnterprise(nextEnterprise);
    setAiOps(nextAiOps);
    setModeration(nextModeration);
    setIntegrations(nextIntegrations);
    setAudit(nextAudit);
    setMapBoundaries(nextBoundaries);
    setMapClusters(nextClusters);
    setActiveProjectId(nextDashboard.projects[0]?.id ?? fallbackProject.id);
      setApiConnected(true);
      setConnectionError(null);
      setNotice("Live");
    } catch (error) {
      setApiConnected(false);
      setConnectionError(error instanceof Error ? error.message : "API unavailable");
      setNotice("Disconnected");
    }
  }

  async function applyFilters() {
    try {
      const next = await fetchDashboard(filters);
      setDashboard(next);
      setActiveProjectId(next.projects[0]?.id ?? fallbackProject.id);
      setApiConnected(true);
      setConnectionError(null);
      setNotice("Live");
    } catch (error) {
      setApiConnected(false);
      setConnectionError(error instanceof Error ? error.message : "API unavailable");
      setNotice("Disconnected");
    }
  }

  function reconcileSelection(nextContext: ContextResponse) {
    const nextState = nextContext.states.includes(state) ? state : nextContext.states[0] ?? state;
    const districts = nextContext.districtsByState[nextState] ?? [];
    const nextDistrict = districts.includes(district) ? district : districts[0] ?? district;
    const wards = nextContext.wardsByDistrict[`${nextState}::${nextDistrict}`] ?? [];
    const nextWard = wards.includes(ward) ? ward : wards[0] ?? ward;
    const matchingMp = nextContext.mps.find((mp) => mp.state === nextState && mp.district === nextDistrict && mp.wards.includes(nextWard)) ?? nextContext.mps[0];
    if (nextState !== state) setState(nextState);
    if (nextDistrict !== district) setDistrict(nextDistrict);
    if (nextWard !== ward) setWard(nextWard);
    if (matchingMp && !nextContext.mps.some((mp) => mp.id === mpId)) setMpId(matchingMp.id);
  }

  function updateState(value: string) {
    const districts = context.districtsByState[value] ?? [];
    const nextDistrict = districts[0] ?? district;
    const wards = context.wardsByDistrict[`${value}::${nextDistrict}`] ?? [];
    const nextWard = wards[0] ?? ward;
    const nextMp = context.mps.find((mp) => mp.state === value && mp.district === nextDistrict && mp.wards.includes(nextWard));
    setState(value);
    setDistrict(nextDistrict);
    setWard(nextWard);
    if (nextMp) setMpId(nextMp.id);
  }

  function updateDistrict(value: string) {
    const wards = context.wardsByDistrict[`${state}::${value}`] ?? [];
    const nextWard = wards[0] ?? ward;
    const nextMp = context.mps.find((mp) => mp.state === state && mp.district === value && mp.wards.includes(nextWard));
    setDistrict(value);
    setWard(nextWard);
    if (nextMp) setMpId(nextMp.id);
  }

  function updateWard(value: string) {
    const nextMp = context.mps.find((mp) => mp.state === state && mp.district === district && mp.wards.includes(value));
    setWard(value);
    if (nextMp) setMpId(nextMp.id);
  }

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="LokSetu navigation">
        <div className="brand">
          <div className="brand-mark">LS</div>
          <div>
            <h1>LokSetu</h1>
            <p>India-scale constituency intelligence</p>
          </div>
        </div>
        <nav className="nav-scroll">
          {navSections.map((section) => (
            <div className="nav-section" key={section.title}>
              <span>{section.title}</span>
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <button className={`nav-item ${page === item.page ? "active" : ""}`} key={item.page} onClick={() => setPage(item.page)}>
                    <Icon size={18} />
                    {item.label}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <a className="citizen-link" href={effectiveCitizenAppUrl}>
            <Send size={16} />
            Open Apni Awaaz
          </a>
          <div className={`status-pill ${apiConnected ? "connected" : "disconnected"}`}>
            <CheckCircle2 size={16} />
            <span>{notice} · {clientConfig.dataMode} · Vertex-ready</span>
          </div>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">{pageLabel(page)}</p>
            <h2>{pageTitle(page)}</h2>
          </div>
          <button className="icon-button" title="Refresh" onClick={refreshAll}>
            <RefreshCw size={18} />
          </button>
        </header>

        {showControlStrip ? (
          <ControlStrip
            context={context}
            scope={scope}
            setScope={setScope}
            state={state}
            setState={updateState}
            district={district}
            setDistrict={updateDistrict}
            ward={ward}
            setWard={updateWard}
            mpId={mpId}
            setMpId={setMpId}
            query={query}
            setQuery={setQuery}
            apply={applyFilters}
          />
        ) : null}

        {!apiConnected ? <ConnectionBanner error={connectionError} /> : null}

        {page === "home" ? <HomePage dashboard={dashboard} aiOps={aiOps} integrations={integrations} setPage={setPage} citizenAppUrl={effectiveCitizenAppUrl} /> : null}
        {page === "explore" ? <ExplorePage dashboard={dashboard} regions={regions} maps={clientConfig.maps} boundaries={mapBoundaries} clusters={mapClusters} setActiveProjectId={setActiveProjectId} setPage={setPage} /> : null}
        {page === "mp" ? <MpPage dashboard={dashboard} activeProject={activeProject} setActiveProjectId={setActiveProjectId} refreshAll={refreshAll} /> : null}
        {page === "projects" ? <ProjectPage project={activeProject} projects={dashboard.projects} setActiveProjectId={setActiveProjectId} refreshAll={refreshAll} /> : null}
        {page === "analytics" ? <AnalyticsPage dashboard={dashboard} analytics={analytics} sources={intelligenceSources} daily={dailyIntelligence} /> : null}
        {page === "enterprise" ? <EnterprisePage situation={enterprise} /> : null}
        {page === "copilot" ? <CopilotPage capabilities={copilotCapabilities} ragStatus={ragStatus} projects={dashboard.projects} /> : null}
        {page === "simulation" ? <SimulationPage refreshAll={refreshAll} /> : null}
        {page === "ai" ? <AiPage aiOps={aiOps} /> : null}
        {page === "moderation" ? <ModerationPage moderation={moderation} audit={audit} /> : null}
        {page === "admin" ? <AdminPage regions={regions} context={context} audit={audit} refreshAll={refreshAll} /> : null}
        {page === "integrations" ? <IntegrationsPage integrations={integrations} /> : null}
        {page === "public" ? <PublicPage filters={filters} /> : null}
      </section>
    </main>
  );
}

function ControlStrip(props: {
  context: ContextResponse;
  scope: Scope;
  setScope: (scope: Scope) => void;
  state: string;
  setState: (value: string) => void;
  district: string;
  setDistrict: (value: string) => void;
  ward: string;
  setWard: (value: string) => void;
  mpId: string;
  setMpId: (value: string) => void;
  query: string;
  setQuery: (value: string) => void;
  apply: () => void;
}) {
  const districtOptions = props.context.districtsByState[props.state] ?? props.context.districts;
  const wardOptions = props.context.wardsByDistrict[`${props.state}::${props.district}`] ?? props.context.wards;
  const mpOptions = props.context.mps.filter((mp) => props.scope === "global" || mp.state === props.state);

  return (
    <section className="control-strip" aria-label="India search and locality controls">
      <div className="segmented">
        <button className={props.scope === "local" ? "active" : ""} onClick={() => props.setScope("local")}>My area</button>
        <button className={props.scope === "mp" ? "active" : ""} onClick={() => props.setScope("mp")}>My MP</button>
        <button className={props.scope === "global" ? "active" : ""} onClick={() => props.setScope("global")}>All India</button>
      </div>
      <select value={props.state} onChange={(event) => props.setState(event.target.value)} aria-label="State">
        {props.context.states.map((item) => <option key={item}>{item}</option>)}
      </select>
      <select value={props.district} onChange={(event) => props.setDistrict(event.target.value)} aria-label="District">
        {districtOptions.map((item) => <option key={item}>{item}</option>)}
      </select>
      <select value={props.ward} onChange={(event) => props.setWard(event.target.value)} aria-label="Ward">
        {wardOptions.map((item) => <option key={item}>{item}</option>)}
      </select>
      <select value={props.mpId} onChange={(event) => props.setMpId(event.target.value)} aria-label="MP">
        {mpOptions.map((mp) => <option value={mp.id} key={mp.id}>{mp.name}</option>)}
      </select>
      <span className="search-box">
        <Search size={16} />
        <input value={props.query} onChange={(event) => props.setQuery(event.target.value)} placeholder="Search school, road, water, ward" />
      </span>
      <button className="primary" onClick={props.apply}>Apply</button>
    </section>
  );
}

function ConnectionBanner({ error }: { error: string | null }) {
  return (
    <section className="connection-banner" role="status">
      <strong>API connection required</strong>
      <span>
        Live priorities, Maps runtime config, and locality controls are not connected. Start the API or Kubernetes service; current data is a disconnected placeholder.
        {error ? ` Last error: ${error}` : ""}
      </span>
    </section>
  );
}

function mergeClientConfig(config: ClientConfig): ClientConfig {
  const apiKey = config.maps.apiKey || envGoogleMapsApiKey;
  const mapId = config.maps.mapId || envGoogleMapsMapId;
  return {
    ...config,
    maps: {
      ...config.maps,
      enabled: Boolean(apiKey),
      apiKey,
      mapId,
      source: config.maps.source || (apiKey ? "runtime-api" : "not-configured")
    },
    citizenAppUrl: config.citizenAppUrl?.trim() || citizenAppUrl
  };
}

function formatCount(value: number) {
  return value.toLocaleString("en-IN");
}

function HomePage({
  dashboard,
  aiOps,
  integrations,
  setPage,
  citizenAppUrl
}: {
  dashboard: DashboardResponse;
  aiOps: AiOpsResponse | null;
  integrations: IntegrationsResponse | null;
  setPage: (page: Page) => void;
  citizenAppUrl: string;
}) {
  const leadingProject = dashboard.projects[0] ?? fallbackProject;
  const liveMetrics = [
    { icon: Inbox, label: "Citizen submissions", value: formatCount(dashboard.totals.submissions), detail: "voice, text, photo and app intake" },
    { icon: MapPinned, label: "Local wards mapped", value: formatCount(dashboard.totals.wards), detail: `${dashboard.hotspots.length} active hotspot signals` },
    { icon: Languages, label: "Languages detected", value: `${dashboard.totals.languages}`, detail: "normalized before ranking" },
    { icon: ShieldCheck, label: "Bot risk", value: dashboard.totals.botRisk.toUpperCase(), detail: "privacy and abuse controls enabled" }
  ];

  return (
    <main className="home-page">
      <section className="home-hero" aria-label="LokSetu AI real-time dashboard">
        <div className="home-shell hero-grid">
          <div className="hero-copy">
            <span className="hero-eyebrow">Real-time constituency dashboard</span>
            <h1>
              LokSetu AI
              <span>live priority command center</span>
            </h1>
            <p className="hero-subhead">
              Connecting Every Citizen&apos;s Voice to Every Development Decision. The home screen shows live intake, ranked development priorities, AI processing status, and privacy controls for the selected constituency.
            </p>
            <div className="hero-stats" aria-label="Platform coverage">
              <strong>{formatCount(dashboard.totals.submissions)} Signals</strong>
              <span />
              <strong>{dashboard.totals.languages || 0} Languages</strong>
              <span />
              <strong>{dashboard.projects.length} Ranked Works</strong>
            </div>
            <div className="home-actions">
              <button className="home-primary" onClick={() => setPage("explore")} type="button">
                <ArrowRight size={18} /> Explore Live Atlas
              </button>
              <a className="home-secondary" href={citizenAppUrl}>
                <Send size={18} /> Open Apni Awaaz
              </a>
            </div>
            <div className="trust-row" aria-label="Trust signals">
              <span><LockKeyhole size={15} /> Privacy-first by design</span>
              <span><Scale size={15} /> Responsible AI controls built-in</span>
              <span><Bot size={15} /> {aiOps?.provider ?? "Vertex AI"} ready</span>
            </div>
          </div>

          <PriorityReportCard dashboard={dashboard} />
        </div>
      </section>

      <section className="home-section live-section" aria-label="Live operations snapshot">
        <div className="home-shell">
          <div className="live-metric-grid">
            {liveMetrics.map((metric) => {
              const Icon = metric.icon;
              return (
                <article className="live-metric-card" key={metric.label}>
                  <Icon size={20} />
                  <span>{metric.label}</span>
                  <strong>{metric.value}</strong>
                  <p>{metric.detail}</p>
                </article>
              );
            })}
          </div>
          <div className="ops-grid">
            <article className="ops-card">
              <PanelTitle title="Current priority signal" icon={Activity} />
              <h3>{leadingProject.title}</h3>
              <p>{leadingProject.rationale}</p>
              <div className="ops-evidence">
                {leadingProject.evidence.slice(0, 3).map((item) => <span key={item}>{item}</span>)}
              </div>
            </article>
            <article className="ops-card">
              <PanelTitle title="Processing status" icon={Database} />
              <div className="ops-row"><span>AI mode</span><strong>{aiOps?.mode ?? "fallback"}</strong></div>
              <div className="ops-row"><span>Enabled integrations</span><strong>{integrations?.enabled.length ?? 0}</strong></div>
              <div className="ops-row"><span>Batch queue</span><strong>5 min cadence</strong></div>
            </article>
          </div>
        </div>
      </section>

      <section className="home-section problem-section">
        <div className="home-shell">
          <div className="section-heading">
            <span>Evidence gaps monitored</span>
            <h2>Development decisions made without evidence</h2>
            <p>Thousands of citizen voices. Zero structured signal.</p>
          </div>
          <div className="problem-grid">
            {problemCards.map((card) => {
              const Icon = card.icon;
              return (
                <article className="problem-card" key={card.title}>
                  <Icon size={32} />
                  <h3>{card.title}</h3>
                  <p>{card.body}</p>
                </article>
              );
            })}
          </div>
          <div className="bridge-line">
            <span>LokSetu AI closes all four gaps through one operational workflow.</span>
          </div>
        </div>
      </section>

      <section className="home-section solution-section" id="solution">
        <div className="home-shell">
          <div className="section-heading">
            <span>Operating pipeline</span>
            <h2>From citizen voice to development priority</h2>
            <p>In any language. Across every channel. With evidence.</p>
          </div>
          <div className="pipeline">
            {pipelineSteps.map((step, index) => (
              <article className={`pipeline-step ${step.active ? "active" : ""}`} key={step.number}>
                <span>{step.number}</span>
                <h3>{step.label}</h3>
                <p>{step.detail.join("\n")}</p>
                {index < pipelineSteps.length - 1 ? <i aria-hidden="true" /> : null}
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function PriorityReportCard({ dashboard }: { dashboard: DashboardResponse }) {
  const projects = (dashboard.projects.length ? dashboard.projects : [fallbackProject]).slice(0, 3);
  const area = projects[0]?.ward ? `${projects[0].ward} Ward` : "Selected constituency";
  const updatedAt = new Date(dashboard.generatedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  return (
    <aside className="priority-card" aria-label="AI Priority Report">
      <header>
        <div>
          <span><MapPinned size={17} /> {area}</span>
          <strong>Live Priority Report</strong>
        </div>
        <small><i /> Live</small>
      </header>
      <div className="priority-list">
        {projects.map((project, index) => (
          <PriorityItem
            key={project.id}
            rank={`Rank #${index + 1}`}
            title={project.category}
            submissions={`${formatCount(project.demandCount)} citizen submissions`}
            confidence={`${Math.round(project.confidence * 100)}%`}
            priority={project.score >= 85 ? "HIGH" : "MEDIUM"}
            width={`${Math.max(34, Math.min(96, project.score))}%`}
            tone={index === 0 ? "saffron" : "teal"}
          />
        ))}
      </div>
      <footer>
        <span><Inbox size={15} /> {formatCount(dashboard.totals.submissions)} submissions analyzed</span>
        <span><Globe2 size={15} /> {dashboard.totals.languages} languages detected</span>
        <span><Clock size={15} /> Updated {updatedAt}</span>
      </footer>
    </aside>
  );
}

function PriorityItem({ rank, title, submissions, confidence, priority, width, tone }: { rank: string; title: string; submissions: string; confidence: string; priority: "HIGH" | "MEDIUM"; width: string; tone: "saffron" | "teal" }) {
  return (
    <article className="priority-item">
      <div>
        <span>{rank}</span>
        <strong>{title}</strong>
      </div>
      <div className={`priority-bar ${tone}`}>
        <i style={{ width }} />
      </div>
      <p>{submissions}</p>
      <div className="priority-meta">
        <span>Confidence: {confidence}</span>
        <mark className={priority === "HIGH" ? "high" : "medium"}>{priority} priority</mark>
      </div>
    </article>
  );
}

function ExplorePage({
  dashboard,
  regions,
  maps,
  boundaries,
  clusters,
  setActiveProjectId,
  setPage
}: {
  dashboard: DashboardResponse;
  regions: RegionResponse | null;
  maps: ClientConfig["maps"];
  boundaries: MapBoundaryResponse;
  clusters: MapClusterResponse;
  setActiveProjectId: (id: string) => void;
  setPage: (page: Page) => void;
}) {
  const [selectedProjectId, setSelectedProjectId] = useState(dashboard.projects[0]?.id ?? fallbackProject.id);
  const [boundaryLevel, setBoundaryLevel] = useState<BoundaryLevel>("ward");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const selectedProject = dashboard.projects.find((project) => project.id === selectedProjectId) ?? dashboard.projects[0] ?? fallbackProject;

  useEffect(() => {
    if (!dashboard.projects.some((project) => project.id === selectedProjectId)) {
      setSelectedProjectId(dashboard.projects[0]?.id ?? fallbackProject.id);
    }
  }, [dashboard.projects, selectedProjectId]);

  function openProjectRoom(projectId: string) {
    setActiveProjectId(projectId);
    setPage("projects");
  }

  function selectAndOpen(projectId: string) {
    setSelectedProjectId(projectId);
    setDrawerOpen(true);
  }

  return (
    <section className="explore-workspace">
      <section className="panel">
        <PanelTitle title="All-India issue atlas" icon={Globe2} />
        <IssueMap
          dashboard={dashboard}
          maps={maps}
          boundaries={boundaries}
          clusters={clusters}
          boundaryLevel={boundaryLevel}
          setBoundaryLevel={setBoundaryLevel}
          selectedProjectId={selectedProject.id}
          selectProject={selectAndOpen}
        />
      </section>
      <section className="panel state-onboarding-panel">
        <PanelTitle title="State onboarding" icon={Flag} detail="rollout readiness by state" />
        <div className="state-onboarding-list">
          {(regions?.onboardingStates ?? []).map((item) => (
            <button key={item.state} type="button">
              <span>{item.state}</span>
              <strong>{item.readiness}%</strong>
              <small>{item.constituencies} constituencies · {item.districts} districts</small>
            </button>
          ))}
        </div>
      </section>
      {drawerOpen ? (
        <div className="drawer-backdrop" role="presentation" onClick={() => setDrawerOpen(false)}>
          <aside className="issue-drawer" aria-label="Issue detail drawer" onClick={(event) => event.stopPropagation()}>
            <button className="drawer-close" type="button" onClick={() => setDrawerOpen(false)} aria-label="Close issue detail">
              <X size={18} />
            </button>
            <HotspotDrilldown project={selectedProject} relatedProjects={dashboard.projects} boundaries={boundaries} clusters={clusters} openProjectRoom={openProjectRoom} />
          </aside>
        </div>
      ) : null}
    </section>
  );
}

function IssueMap({
  dashboard,
  maps,
  boundaries,
  clusters,
  boundaryLevel,
  setBoundaryLevel,
  selectedProjectId,
  selectProject
}: {
  dashboard: DashboardResponse;
  maps: ClientConfig["maps"];
  boundaries: MapBoundaryResponse;
  clusters: MapClusterResponse;
  boundaryLevel: BoundaryLevel;
  setBoundaryLevel: (level: BoundaryLevel) => void;
  selectedProjectId: string;
  selectProject: (id: string) => void;
}) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const [mapState, setMapState] = useState<MapLoadState>(maps.apiKey ? "idle" : "fallback");
  const hotspots = useMemo(() => buildMapHotspots(dashboard), [dashboard]);

  useEffect(() => {
    if (!maps.apiKey || hotspots.length === 0 || !mapRef.current) {
      setMapState("fallback");
      return;
    }

    let cancelled = false;
    let mapErrorTimer = 0;
    const originalConsoleError = window.console.error;
    window.console.error = (...args: unknown[]) => {
      const message = args.map(String).join(" ");
      if (!cancelled && /Maps Demo Key limit reached|Google Maps JavaScript API error|Quota|RefererNotAllowedMapError|ApiNotActivatedMapError/.test(message)) {
        setMapState("fallback");
      }
      originalConsoleError.apply(window.console, args);
    };
    setMapState("loading");

    loadGoogleMaps(maps.apiKey, maps.mapId)
      .then(() => {
        if (cancelled || !mapRef.current || !window.google?.maps) return;

        const bounds = new window.google.maps.LatLngBounds();
        hotspots.forEach((hotspot) => bounds.extend({ lat: hotspot.lat, lng: hotspot.lng }));

        const map = new window.google.maps.Map(mapRef.current, {
          center: hotspots[0],
          zoom: hotspots.length > 1 ? 5 : 12,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          clickableIcons: false,
          gestureHandling: "cooperative",
          ...(maps.mapId ? { mapId: maps.mapId } : {}),
          styles: [
            { featureType: "poi", stylers: [{ visibility: "off" }] },
            { featureType: "transit", stylers: [{ visibility: "off" }] }
          ]
        });

        hotspots.forEach((hotspot, index) => addHotspotMarker(map, hotspot, index, Boolean(maps.mapId), () => selectProject(hotspot.projectId)));

        if (hotspots.length > 1) map.fitBounds(bounds, 60);
        setMapState("ready");
        mapErrorTimer = window.setTimeout(() => {
          if (!cancelled && mapRef.current?.querySelector(".gm-err-container, .gm-err-title, .gm-err-message")) {
            setMapState("fallback");
          }
        }, 1500);
      })
      .catch(() => {
        if (!cancelled) setMapState("fallback");
      });

    return () => {
      cancelled = true;
      if (mapErrorTimer) window.clearTimeout(mapErrorTimer);
      window.console.error = originalConsoleError;
    };
  }, [hotspots, maps.apiKey, maps.mapId, selectProject]);

  return (
    <div className="map-stack">
      <div className="map-toolbar">
        <div>
          <strong>Geospatial demand hotspots</strong>
          <span>{hotspots.length} ward-level signals from ranking pipeline</span>
        </div>
        <small className={`map-state ${mapState}`}>{mapStatusText(mapState)}</small>
      </div>
      <div className="map-layout">
        <div className={`map-canvas india-map ${mapState === "ready" ? "google-ready" : ""}`}>
          <div ref={mapRef} className="google-map" aria-label="Google map of citizen issue hotspots" />
          {mapState !== "ready" ? <FallbackSignalMap hotspots={hotspots} selectedProjectId={selectedProjectId} selectProject={selectProject} /> : null}
        </div>
        <div className="hotspot-list" aria-label="Map hotspot details">
          {hotspots.map((hotspot, index) => (
            <button className={`hotspot-row ${hotspot.projectId === selectedProjectId ? "selected" : ""}`} key={`${hotspot.projectId}-${hotspot.lat}-${hotspot.lng}`} onClick={() => selectProject(hotspot.projectId)}>
              <span>{index + 1}</span>
              <strong>{hotspot.category}</strong>
              <small>{hotspot.ward} · score {hotspot.intensity}</small>
            </button>
          ))}
        </div>
      </div>
      {mapState === "fallback" ? (
        <p className="map-note">
          Google Maps key not configured or unavailable. Showing the local geospatial fallback with the same backend hotspot coordinates.
        </p>
      ) : null}
      <MapIntelligencePanel
        boundaries={boundaries}
        clusters={clusters}
        boundaryLevel={boundaryLevel}
        setBoundaryLevel={setBoundaryLevel}
        selectedProjectId={selectedProjectId}
        selectProject={selectProject}
      />
    </div>
  );
}

function MapIntelligencePanel({
  boundaries,
  clusters,
  boundaryLevel,
  setBoundaryLevel,
  selectedProjectId,
  selectProject
}: {
  boundaries: MapBoundaryResponse;
  clusters: MapClusterResponse;
  boundaryLevel: BoundaryLevel;
  setBoundaryLevel: (level: BoundaryLevel) => void;
  selectedProjectId: string;
  selectProject: (id: string) => void;
}) {
  const activeFeatures = boundaries.features.filter((feature) => feature.level === boundaryLevel);
  const selectedFeature = boundaries.features.find((feature) => feature.projectIds.includes(selectedProjectId));
  return (
    <section className="map-intel-grid" aria-label="Boundary and cluster intelligence">
      <article className="map-intel-card">
        <div className="map-intel-head">
          <div>
            <strong>Boundary layers</strong>
            <span>{boundaries.sourceStatus.replaceAll("_", " ")}</span>
          </div>
          <small>{activeFeatures.length} {boundaryLevel} features</small>
        </div>
        <div className="layer-tabs" role="tablist" aria-label="Boundary level">
          {boundaries.levels.map((level) => (
            <button key={level} className={boundaryLevel === level ? "active" : ""} onClick={() => setBoundaryLevel(level)} type="button">
              {level}
            </button>
          ))}
        </div>
        <div className="boundary-list">
          {(activeFeatures.length ? activeFeatures : boundaries.features).slice(0, 4).map((feature) => (
            <button key={feature.id} className={feature.projectIds.includes(selectedProjectId) ? "selected" : ""} onClick={() => selectProject(feature.projectIds[0] ?? selectedProjectId)} type="button">
              <span>{feature.level}</span>
              <strong>{feature.name}</strong>
              <small>{feature.source} · {feature.version}</small>
              <em>{feature.freshness} · {feature.simplification.toleranceMeters}m simplification</em>
            </button>
          ))}
        </div>
        {selectedFeature ? (
          <p className="map-note">Selected issue intersects {selectedFeature.name}; source freshness is {selectedFeature.freshness}.</p>
        ) : null}
      </article>
      <article className="map-intel-card">
        <div className="map-intel-head">
          <div>
            <strong>Hotspot clusters</strong>
            <span>{clusters.source} · zoom {clusters.zoom}</span>
          </div>
          <small>{clusters.clusters.length} clusters</small>
        </div>
        <div className="cluster-list">
          {clusters.clusters.slice(0, 5).map((cluster) => (
            <button key={cluster.id} className={cluster.projectIds.includes(selectedProjectId) ? "selected" : ""} onClick={() => selectProject(cluster.projectIds[0] ?? selectedProjectId)} type="button">
              <span>{cluster.count} issues</span>
              <strong>{cluster.label}</strong>
              <small>{cluster.categories.join(", ")} · score {cluster.score}</small>
            </button>
          ))}
        </div>
      </article>
    </section>
  );
}

function FallbackSignalMap({ hotspots, selectedProjectId, selectProject }: { hotspots: Array<Hotspot & { projectId: string }>; selectedProjectId: string; selectProject: (projectId: string) => void }) {
  return (
    <div className="fallback-map" aria-label="Local fallback map">
      {hotspots.map((hotspot, index) => {
        const position = indiaProjection(hotspot.lat, hotspot.lng);
        return (
          <button
            className={`hotspot ${hotspot.projectId === selectedProjectId ? "selected" : ""}`}
            key={`${hotspot.projectId}-${index}`}
            style={{
              left: `${position.x}%`,
              top: `${position.y}%`,
              width: `${48 + hotspot.intensity / 3}px`,
              height: `${48 + hotspot.intensity / 3}px`
            }}
            onClick={() => selectProject(hotspot.projectId)}
            title={`${hotspot.category} in ${hotspot.ward}`}
          >
            {index + 1}
          </button>
        );
      })}
    </div>
  );
}

function HotspotDrilldown({
  project,
  relatedProjects,
  boundaries,
  clusters,
  openProjectRoom
}: {
  project: RankedProject;
  relatedProjects: RankedProject[];
  boundaries: MapBoundaryResponse;
  clusters: MapClusterResponse;
  openProjectRoom: (id: string) => void;
}) {
  const related = relatedProjects
    .filter((item) => item.id !== project.id && (item.category === project.category || item.ward === project.ward || item.district === project.district))
    .slice(0, 4);
  const areaBreakdown = [
    { label: "state", value: project.state, count: relatedProjects.filter((item) => item.state === project.state).length },
    { label: "district", value: project.district, count: relatedProjects.filter((item) => item.district === project.district).length },
    { label: "ward", value: project.ward, count: relatedProjects.filter((item) => item.ward === project.ward).length },
    { label: "mp", value: project.mpName, count: relatedProjects.filter((item) => item.mpId === project.mpId).length }
  ];
  const complaintStream = project.recentCitizenAliases.slice(0, 6).map((alias, index) => ({
    alias,
    area: index % 2 === 0 ? project.ward : project.district,
    message: `${project.category} issue reported in ${project.ward}`,
    signal: project.languageMix[index % Math.max(1, project.languageMix.length)] ?? "Local language"
  }));
  const intersectingBoundaries = boundaries.features
    .filter((feature) => feature.projectIds.includes(project.id))
    .sort((a, b) => boundaryOrder(a.level) - boundaryOrder(b.level));
  const intersectingCluster = clusters.clusters.find((cluster) => cluster.projectIds.includes(project.id));

  return (
    <aside className="panel observability-drilldown" aria-label="Selected issue drilldown">
      <header className="drilldown-header">
        <div>
          <span className="drilldown-kicker"><MapPinned size={15} /> Issue drilldown</span>
          <h3>{project.title}</h3>
        </div>
        <button className="primary" type="button" onClick={() => openProjectRoom(project.id)}>Open room</button>
      </header>

      <div className="drilldown-querybar" aria-label="Applied signal filters">
        <span>rank={Math.max(1, relatedProjects.findIndex((item) => item.id === project.id) + 1)}</span>
        <span>category={project.category}</span>
        <span>ward={project.ward}</span>
        <span>status={project.status}</span>
      </div>

      <section className="drilldown-summary" aria-label="Priority summary">
        <div><span>Score</span><strong>{project.score}</strong></div>
        <div><span>Reports</span><strong>{formatCount(project.demandCount)}</strong></div>
        <div><span>Confidence</span><strong>{Math.round(project.confidence * 100)}%</strong></div>
        <div><span>Rating</span><strong>{project.averageRating}/5</strong></div>
      </section>

      <section className="drilldown-section">
        <div className="drilldown-section-title">
          <strong>Area facets</strong>
          <span>map selection updates this pane</span>
        </div>
        <div className="area-facets" aria-label="Area drilldown">
          {areaBreakdown.map((item) => (
            <button key={item.label} type="button">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.count} ranked signals</small>
            </button>
          ))}
        </div>
      </section>

      <section className="drilldown-section">
        <div className="drilldown-section-title">
          <strong>Boundary provenance</strong>
          <span>source visible to operators</span>
        </div>
        <div className="boundary-provenance">
          {intersectingBoundaries.map((feature) => (
            <article key={feature.id}>
              <span>{feature.level}</span>
              <strong>{feature.name}</strong>
              <small>{feature.source}</small>
              <em>{feature.version} · {feature.freshness}</em>
            </article>
          ))}
        </div>
      </section>

      {intersectingCluster ? (
        <section className="drilldown-section">
          <div className="drilldown-section-title">
            <strong>Cluster context</strong>
            <span>{intersectingCluster.count} ranked issues nearby</span>
          </div>
          <div className="cluster-context">
            <strong>{intersectingCluster.label}</strong>
            <p>{intersectingCluster.categories.join(", ")} signals at score {intersectingCluster.score}; centroid {intersectingCluster.centroid.lat}, {intersectingCluster.centroid.lng}.</p>
          </div>
        </section>
      ) : null}

      <section className="drilldown-section">
        <div className="drilldown-section-title">
          <strong>Related complaints</strong>
          <span>privacy-safe aliases only</span>
        </div>
        <div className="complaint-stream">
          {complaintStream.map((item) => (
            <article className="complaint-row" key={`${project.id}-${item.alias}`}>
              <span className="stream-dot" />
              <div>
                <strong>{item.alias}</strong>
                <p>{item.message}</p>
                <small>{item.area} · {item.signal}</small>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="drilldown-section">
        <div className="drilldown-section-title">
          <strong>Evidence timeline</strong>
          <span>signals used by ranking pipeline</span>
        </div>
        <div className="evidence-timeline">
          {project.evidence.slice(0, 6).map((item, index) => (
            <article key={item}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <p>{item}</p>
            </article>
          ))}
        </div>
      </section>

      {related.length ? (
        <section className="drilldown-section">
          <div className="drilldown-section-title">
            <strong>Nearby ranked issues</strong>
            <span>same category, ward, or district</span>
          </div>
          <div className="related-issues">
            {related.map((item) => (
              <button key={item.id} onClick={() => openProjectRoom(item.id)} type="button">
                <span>{item.category}</span>
                <strong>{item.title}</strong>
                <small>{item.ward} · score {item.score}</small>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className="drilldown-rationale">
        <strong>Ranking rationale</strong>
        <p>{project.rationale}</p>
      </section>
    </aside>
  );
}

function boundaryOrder(level: BoundaryLevel) {
  return ["state", "district", "constituency", "ward"].indexOf(level);
}

function buildMapHotspots(dashboard: DashboardResponse): Array<Hotspot & { projectId: string }> {
  const projects = dashboard.projects.length ? dashboard.projects : [fallbackProject];
  return projects.slice(0, 8).map((project, index) => {
    const matchingHotspot = dashboard.hotspots.find((hotspot) => hotspot.ward === project.ward && hotspot.category === project.category) ?? dashboard.hotspots[index];
    return {
      ward: project.ward,
      category: project.category,
      intensity: project.score,
      lat: matchingHotspot?.lat ?? seededLatLng(index).lat,
      lng: matchingHotspot?.lng ?? seededLatLng(index).lng,
      projectId: project.id
    };
  });
}

function seededLatLng(index: number) {
  const seed = [
    { lat: 28.62, lng: 77.3 },
    { lat: 20.01, lng: 73.79 },
    { lat: 13.08, lng: 80.27 },
    { lat: 22.57, lng: 88.36 }
  ];
  return seed[index % seed.length];
}

function indiaProjection(lat: number, lng: number) {
  const minLat = 6.5;
  const maxLat = 35.6;
  const minLng = 68.0;
  const maxLng = 97.5;
  return {
    x: Math.min(92, Math.max(8, ((lng - minLng) / (maxLng - minLng)) * 100)),
    y: Math.min(88, Math.max(12, (1 - (lat - minLat) / (maxLat - minLat)) * 100))
  };
}

function mapStatusText(state: MapLoadState) {
  if (state === "ready") return "Google Maps live";
  if (state === "loading") return "Loading map";
  return "Local map fallback";
}

function addHotspotMarker(map: any, hotspot: Hotspot & { projectId: string }, index: number, useAdvancedMarker: boolean, onClick: () => void) {
  const position = { lat: hotspot.lat, lng: hotspot.lng };
  const title = `${hotspot.category} in ${hotspot.ward}`;
  const AdvancedMarkerElement = window.google?.maps?.marker?.AdvancedMarkerElement;

  if (useAdvancedMarker && AdvancedMarkerElement) {
    const content = document.createElement("button");
    content.className = "google-hotspot-marker";
    content.type = "button";
    content.textContent = String(index + 1);
    content.title = title;
    content.addEventListener("click", onClick);

    const marker = new AdvancedMarkerElement({
      map,
      position,
      title,
      content
    });
    marker.addEventListener("gmp-click", onClick);
    return;
  }

  const marker = new window.google.maps.Marker({
    map,
    position,
    title,
    label: String(index + 1),
    optimized: true
  });
  marker.addListener("click", onClick);
}

function loadGoogleMaps(key: string, mapId?: string): Promise<void> {
  if (window.google?.maps) return Promise.resolve();
  if (window.__loksetuGoogleMapsPromise) return window.__loksetuGoogleMapsPromise;

  window.__loksetuGoogleMapsPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const params = new URLSearchParams({
      key,
      v: "weekly",
      loading: "async",
      callback: "__loksetuGoogleMapsLoaded"
    });
    if (mapId) params.set("libraries", "marker");
    window.__loksetuGoogleMapsLoaded = () => resolve();
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error("Google Maps failed to load"));
    document.head.appendChild(script);
  });

  return window.__loksetuGoogleMapsPromise;
}

function MpPage({
  dashboard,
  activeProject,
  setActiveProjectId,
  refreshAll
}: {
  dashboard: DashboardResponse;
  activeProject: RankedProject;
  setActiveProjectId: (id: string) => void;
  refreshAll: () => Promise<void>;
}) {
  return (
    <section className="two-grid">
      <section className="panel">
        <PanelTitle title="MP action queue" icon={Building2} />
        <ProjectList projects={dashboard.projects} activeId={activeProject.id} setActiveProjectId={setActiveProjectId} />
      </section>
      <ProjectBrief project={activeProject} refreshAll={refreshAll} />
    </section>
  );
}

function ProjectPage({
  project,
  projects,
  setActiveProjectId,
  refreshAll
}: {
  project: RankedProject;
  projects: RankedProject[];
  setActiveProjectId: (id: string) => void;
  refreshAll: () => Promise<void>;
}) {
  return (
    <section className="two-grid wide-right">
      <section className="panel">
        <PanelTitle title="Project rooms" icon={FileText} />
        <ProjectList projects={projects} activeId={project.id} setActiveProjectId={setActiveProjectId} />
      </section>
      <ProjectBrief project={project} full refreshAll={refreshAll} />
    </section>
  );
}

function AnalyticsPage({
  dashboard,
  analytics,
  sources,
  daily
}: {
  dashboard: DashboardResponse;
  analytics: AnalyticsResponse | null;
  sources: IntelligenceSourcesResponse | null;
  daily: DailyIntelligenceResponse | null;
}) {
  const coverage = sources?.coverage ?? daily?.sourceCoverage;
  const indices = Object.entries(daily?.indices ?? {}).slice(0, 7);
  return (
    <>
      <MetricGrid dashboard={dashboard} />
      <section className="intelligence-hero panel">
        <div>
          <PanelTitle title="Constituency intelligence layer" icon={DatabaseZap} detail="continuous source registry and daily AI brief" />
          <p>
            LokSetu tracks direct citizen input, official datasets, maps, social/news/trend signals, complaints, IoT, sector data, documents, and AI-enriched indicators as one evidence graph.
          </p>
        </div>
        <div className="intelligence-kpis">
          <Metric label="Sources tracked" value={String(coverage?.totalSources ?? 0)} detail="catalogued connectors" />
          <Metric label="Live or ready" value={String(coverage?.liveOrReady ?? 0)} detail="usable source paths" />
          <Metric label="Priority score" value={String(daily?.indices.priorityScore ?? 0)} detail="today's ranked need" />
        </div>
      </section>
      <section className="two-grid">
        <section className="panel">
          <PanelTitle title="Signal board" icon={Activity} />
          <div className="three-grid compact">
            {(analytics?.signals ?? []).map((signal) => <Metric key={signal.name} label={signal.name} value={signal.value} detail={signal.trend} />)}
          </div>
        </section>
        <section className="panel">
          <PanelTitle title="Category mix" icon={BarChart3} />
          {(analytics?.categoryMix ?? []).map((item) => <ScoreBar key={`${item.category}-${item.score}`} label={`${item.category} · demand ${item.demand}`} value={item.score} max={100} />)}
        </section>
      </section>
      <section className="two-grid wide-right">
        <section className="panel">
          <PanelTitle title="Daily constituency digest" icon={FileText} detail="AI-enriched signals" />
          <div className="digest-list">
            {(daily?.digest ?? []).map((item) => <p key={item}>{item}</p>)}
          </div>
          <div className="index-grid">
            {indices.map(([key, value]) => <Metric key={key} label={key.replace(/[A-Z]/g, " $&")} value={String(value)} detail="0-100 normalized index" />)}
          </div>
        </section>
        <section className="panel">
          <PanelTitle title="Top emerging issues" icon={MapPinned} detail="ranked from fused evidence" />
          <div className="issue-intel-list">
            {(daily?.topEmergingIssues ?? []).map((issue) => (
              <article key={issue.rank}>
                <span>#{issue.rank} · {issue.category}</span>
                <strong>{issue.title}</strong>
                <small>{issue.area} · score {issue.score} · {issue.demand} signals · {issue.confidence}% confidence</small>
              </article>
            ))}
          </div>
        </section>
      </section>
      <section className="two-grid">
        <section className="panel">
          <PanelTitle title="Source coverage registry" icon={Network} detail={`${sources?.groups.length ?? 0} source families`} />
          <div className="source-registry">
            {(sources?.groups ?? []).map((group) => (
              <article key={group.category}>
                <div>
                  <strong>{group.category}</strong>
                  <span>{group.sources.length} connectors</span>
                </div>
                <p>{group.purpose}</p>
                <small>{group.sources.slice(0, 3).map((source) => `${source.name}: ${source.readiness}`).join(" · ")}</small>
              </article>
            ))}
          </div>
        </section>
        <section className="panel">
          <PanelTitle title="Alerts and action recommendations" icon={ShieldCheck} detail="evidence before action" />
          <div className="alert-list">
            {(daily?.alerts ?? []).map((alert) => (
              <article className={`alert-card ${alert.severity}`} key={alert.name}>
                <strong>{alert.name}</strong>
                <span>{alert.severity}</span>
                <p>{alert.detail}</p>
              </article>
            ))}
          </div>
          <div className="recommendation-list">
            {(daily?.recommendations ?? []).slice(0, 4).map((item) => (
              <article key={`${item.owner}-${item.action}`}>
                <strong>{item.action}</strong>
                <p>{item.reason}</p>
                <small>{item.owner} · {item.nextStep}</small>
              </article>
            ))}
          </div>
        </section>
      </section>
    </>
  );
}

function CopilotPage({ capabilities, ragStatus, projects }: { capabilities: CopilotCapabilitiesResponse | null; ragStatus: RagStatusResponse | null; projects: RankedProject[] }) {
  const prompts = [
    "What are the top 10 issues in my constituency this month?",
    "Why is the highest ranked project urgent? Show evidence.",
    "Which scheme or budget path can fund this?",
    "Summarize today's citizen feedback for a public meeting.",
    "What changed compared to yesterday?",
    "What should the district officer do next?"
  ];
  const [role, setRole] = useState<"mp" | "collector" | "citizen" | "analyst">("mp");
  const [language, setLanguage] = useState("English");
  const [question, setQuestion] = useState("");
  const [projectId, setProjectId] = useState("");
  const [messages, setMessages] = useState<Array<{ id: string; role: "assistant" | "user"; text: string; answer?: CopilotAnswer }>>([
    {
      id: "welcome",
      role: "assistant",
      text: "Ask about priorities, project evidence, source coverage, budget paths, public meeting notes, maps, or what changed today. Answers are retrieved from the current LokSetu intelligence corpus and cite the supporting records."
    }
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const latestAnswer = [...messages].reverse().find((message) => message.answer)?.answer ?? null;

  async function askCopilot(nextQuestion = question) {
    const cleanQuestion = nextQuestion.trim();
    if (!cleanQuestion || busy) return;
    setBusy(true);
    setError("");
    const userMessage = { id: `user-${Date.now()}`, role: "user" as const, text: cleanQuestion };
    setMessages((current) => [...current, userMessage]);
    try {
      const response = await fetch(`${apiBase}/api/copilot/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, language, question: cleanQuestion, projectId: projectId || undefined })
      });
      if (!response.ok) throw new Error("Copilot query failed");
      const payload = await response.json() as CopilotAnswer;
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${payload.generatedAt}`,
          role: "assistant",
          text: payload.answer,
          answer: payload
        }
      ]);
      setQuestion("");
    } catch (queryError) {
      setError(queryError instanceof Error ? queryError.message : "Copilot query failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="copilot-chat-page">
      <section className="panel copilot-chat-shell">
        <div className="copilot-chat-header">
          <div className="assistant-identity">
            <span><Bot size={20} /></span>
            <div>
              <h3>LokSetu AI</h3>
              <p>Grounded RAG assistant for constituency intelligence</p>
            </div>
          </div>
          <div className="rag-badge">
            <DatabaseZap size={16} />
            {ragStatus?.mode ?? capabilities?.rag?.mode ?? "local-hybrid-rag"}
          </div>
        </div>

        <div className="copilot-context">
          <label>Role
            <select value={role} onChange={(event) => setRole(event.target.value as typeof role)}>
              {(capabilities?.supportedRoles ?? ["mp", "collector", "citizen", "analyst"]).map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label>Language
            <select value={language} onChange={(event) => setLanguage(event.target.value)}>
              {["English", "Hindi", "Tamil", "Bengali", "Marathi", "Kannada", "Telugu", "Gujarati", "Malayalam", "Odia", "Punjabi", "Urdu"].map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label>Grounding
            <select value={projectId} onChange={(event) => setProjectId(event.target.value)}>
              <option value="">Search full intelligence corpus</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
            </select>
          </label>
        </div>

        <div className="chat-thread" aria-label="Copilot conversation">
          {messages.map((message) => (
            <article className={`chat-message ${message.role}`} key={message.id}>
              <div className="message-body">
                <p>{message.text}</p>
                {message.answer ? (
                  <div className="message-meta">
                    <span>{message.answer.agent.label}</span>
                    <span>{message.answer.confidence}% confidence</span>
                    <span>{message.answer.retrieval.retrieved} retrieved</span>
                    <span>{message.answer.retrieval.latencyMs}ms</span>
                  </div>
                ) : null}
              </div>
            </article>
          ))}
          {busy ? (
            <article className="chat-message assistant">
              <div className="message-body"><p>Retrieving LokSetu records and preparing a grounded answer...</p></div>
            </article>
          ) : null}
        </div>

        <div className="prompt-strip">
          {prompts.map((prompt) => (
            <button key={prompt} onClick={() => askCopilot(prompt)} type="button">{prompt}</button>
          ))}
        </div>

        <form className="chat-composer" onSubmit={(event) => { event.preventDefault(); askCopilot(); }}>
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask anything about priorities, schemes, evidence, maps, documents, public feedback, or next actions..."
            rows={3}
          />
          <button className="primary" disabled={busy || !question.trim()} type="submit">
            <Send size={16} />
            Send
          </button>
        </form>
        {error ? <div className="error-state">{error}</div> : null}
      </section>

      <aside className="panel rag-side-panel">
        <PanelTitle title="RAG status" icon={Database} detail={ragStatus?.embeddingStore ?? "local-deterministic-index"} />
        <div className="rag-status-grid">
          <Metric label="Corpus records" value={String(ragStatus?.corpusDocuments ?? 0)} detail={ragStatus?.refreshCadence ?? "batch refresh"} />
          <Metric label="Retrieved" value={String(latestAnswer?.retrieval.retrieved ?? 0)} detail={latestAnswer?.intent ?? "waiting"} />
        </div>
        <section className="copilot-section">
          <strong>Retrieved context</strong>
          <div className="retrieved-list">
            {(latestAnswer?.retrievedContext ?? []).map((item) => (
              <article key={item.id}>
                <span>{item.sourceType} · score {item.score}</span>
                <strong>{item.title}</strong>
                <p>{item.snippet}</p>
              </article>
            ))}
            {!latestAnswer ? <p className="side-muted">Ask a question to see retrieved chunks from projects, citizen signals, digest, forecasts, and recommendations.</p> : null}
          </div>
        </section>
        <section className="copilot-section">
          <strong>Citations</strong>
          <div className="citation-list">
            {(latestAnswer?.citations ?? []).map((item) => (
              <article key={`${item.type}-${item.id}`}>
                <span>{item.type}</span>
                <strong>{item.title}</strong>
                <p>{item.snippet}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="copilot-section">
          <strong>Source coverage</strong>
          <div className="source-family-list">
            {Object.entries(ragStatus?.bySource ?? {}).map(([source, count]) => <span key={source}>{source} · {count}</span>)}
          </div>
        </section>
        <section className="copilot-section">
          <strong>Guardrails</strong>
          <div className="guardrail-list">
            {(latestAnswer?.guardrails ?? capabilities?.currentLimitations ?? []).map((item) => <p key={item}>{item}</p>)}
            <p>{ragStatus?.privacy ?? "Personal citizen identifiers are not shown in answers."}</p>
          </div>
        </section>
      </aside>
    </section>
  );
}

function EnterprisePage({ situation }: { situation: EnterpriseSituationResponse | null }) {
  const monitoring = situation?.liveMonitoring ?? [];
  const observabilityEntries = Object.entries(situation?.observability ?? {});

  return (
    <section className="enterprise-page">
      <section className="panel enterprise-hero">
        <div>
          <PanelTitle title="AI Situation Room" icon={Activity} detail="enterprise governance observability" />
          <p>Live command center for incidents, anomalies, root cause, digital twin state, predictive risk, GIS layers, and platform observability.</p>
        </div>
        <div className="health-ring">
          <span>Health</span>
          <strong>{situation?.healthScore.score ?? 0}</strong>
          <small>constituency score</small>
        </div>
      </section>

      <section className="metrics enterprise-metrics">
        {monitoring.slice(0, 8).map((item) => <Metric key={item.name} label={item.name} value={String(item.value)} detail={item.detail} />)}
      </section>

      <section className="two-grid wide-left">
        <section className="panel">
          <PanelTitle title="AI incident management" icon={ShieldCheck} detail={`${situation?.incidents.length ?? 0} active incidents`} />
          <div className="incident-list">
            {(situation?.incidents ?? []).map((incident) => (
              <article key={incident.id}>
                <span className={`severity ${incident.severity}`}>{incident.severity}</span>
                <strong>{incident.title}</strong>
                <p>{incident.type} · {incident.area} · {incident.assignee}</p>
                <small>{incident.status} · {incident.demand} signals · {incident.confidence}% confidence</small>
                <div className="workflow-track">
                  {incident.workflow.map((step) => <span className={step === incident.status ? "active" : ""} key={step}>{step}</span>)}
                </div>
              </article>
            ))}
          </div>
        </section>
        <section className="panel">
          <PanelTitle title="AI anomaly detection" icon={Bot} detail="baseline deltas" />
          <div className="alert-list">
            {(situation?.anomalies ?? []).map((item) => (
              <article className={`alert-card ${item.severity}`} key={item.name}>
                <strong>{item.name}</strong>
                <span>{item.change}</span>
                <p>{item.explanation}</p>
              </article>
            ))}
          </div>
        </section>
      </section>

      <section className="two-grid">
        <section className="panel">
          <PanelTitle title="Root cause and event replay" icon={GitBranch} />
          <div className="root-cause-chain">
            {(situation?.rootCause ?? []).map((item) => <article key={item.step}><strong>{item.step}</strong><p>{item.detail}</p></article>)}
          </div>
          <div className="event-timeline-list">
            {(situation?.eventTimeline ?? []).map((item) => <article key={item.at}><span>{item.at}</span><strong>{item.event}</strong><p>{item.detail}</p></article>)}
          </div>
        </section>
        <section className="panel">
          <PanelTitle title="Correlation engine" icon={Network} />
          <div className="correlation-list">
            {(situation?.correlations ?? []).map((item) => (
              <article key={`${item.source}-${item.target}`}>
                <strong>{item.source}</strong>
                <span>{item.middle}</span>
                <strong>{item.target}</strong>
                <small>{Math.round(item.strength * 100)}% relationship strength</small>
              </article>
            ))}
          </div>
        </section>
      </section>

      <section className="two-grid wide-right">
        <section className="panel">
          <PanelTitle title="Constituency digital twin" icon={Database} detail={situation?.digitalTwin.populationModel} />
          <div className="twin-grid">
            {(situation?.digitalTwin.assets ?? []).map((asset) => <Metric key={asset.name} label={asset.name} value={String(asset.activeSignals)} detail={asset.status} />)}
          </div>
        </section>
        <section className="panel">
          <PanelTitle title="Live GIS intelligence" icon={MapPinned} />
          {(situation?.gisIntelligence ?? []).map((layer) => <ScoreBar key={layer.name} label={`${layer.name} · ${layer.status}`} value={Math.min(100, layer.features)} max={100} />)}
        </section>
      </section>

      <section className="two-grid">
        <section className="panel">
          <PanelTitle title="Smart alerts and predictive intelligence" icon={Flag} />
          <div className="alert-list">
            {(situation?.smartAlerts ?? []).map((alert) => <article className={`alert-card ${alert.severity}`} key={alert.name}><strong>{alert.name}</strong><span>{alert.severity}</span><p>{alert.detail}</p></article>)}
          </div>
          <div className="prediction-list">
            {(situation?.predictiveIntelligence ?? []).map((prediction) => <ScoreBar key={prediction.name} label={`${prediction.name} · ${prediction.driver}`} value={prediction.probability} max={100} />)}
          </div>
        </section>
        <section className="panel">
          <PanelTitle title="Enterprise observability" icon={BarChart3} />
          <div className="observability-grid">
            {observabilityEntries.map(([group, items]) => (
              <article key={group}>
                <strong>{group}</strong>
                {items.slice(0, 4).map((item) => <span key={item.name}>{item.name}: {item.value}</span>)}
              </article>
            ))}
          </div>
        </section>
      </section>
    </section>
  );
}

function AiPage({ aiOps }: { aiOps: AiOpsResponse | null }) {
  return (
    <section className="two-grid">
      <section className="panel">
        <PanelTitle title="Vertex AI operations" icon={Bot} />
        <div className="receipt small">
          <strong>{aiOps?.provider ?? "Vertex AI Gemini"}</strong>
          <span>mode: {aiOps?.mode ?? "fallback"}</span>
        </div>
        <Feature title="AI tasks" icon={Languages} points={aiOps?.tasks ?? []} />
      </section>
      <section className="panel">
        <PanelTitle title="Responsible AI guardrails" icon={ShieldCheck} />
        <Feature title="Controls" icon={Lock} points={aiOps?.guardrails ?? []} />
      </section>
    </section>
  );
}

function SimulationPage({ refreshAll }: { refreshAll: () => Promise<void> }) {
  const [scenarios, setScenarios] = useState<SimulationScenario[]>([]);
  const [channel, setChannel] = useState<SimulationScenario["channel"]>("text");
  const [stateName, setStateName] = useState("Delhi");
  const [districtName, setDistrictName] = useState("Central Delhi");
  const [wardName, setWardName] = useState("Kalindi Nagar");
  const [language, setLanguage] = useState("Hindi");
  const [urgency, setUrgency] = useState(5);
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("School classrooms flood after rain and toilets are unusable for girls.");
  const [media, setMedia] = useState("");
  const [receipt, setReceipt] = useState<{ rawIntakeId: string; status: string; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getJson<{ scenarios: SimulationScenario[] }>("/api/simulation/scenarios", { scenarios: [] }).then((payload) => {
      setScenarios(payload.scenarios);
    });
  }, []);

  function applyScenario(scenario: SimulationScenario) {
    setChannel(scenario.channel);
    setStateName(scenario.state);
    setDistrictName(scenario.district);
    setWardName(scenario.ward);
    setLanguage(scenario.language);
    setUrgency(scenario.urgency);
    setRating(scenario.rating);
    setText(scenario.text);
    setMedia(sampleMediaFor(scenario.channel));
    setReceipt(null);
  }

  async function submitSimulation() {
    setBusy(true);
    try {
      const response = await fetch(`${apiBase}/api/simulation/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          state: stateName,
          district: districtName,
          ward: wardName,
          language,
          urgency,
          rating,
          text,
          media: media || undefined
        })
      });
      if (!response.ok) throw new Error("Simulation submit failed");
      setReceipt(await response.json());
      await refreshAll();
    } finally {
      setBusy(false);
    }
  }

  async function readFile(file: File | undefined) {
    if (!file) return;
    const value = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    setMedia(value);
  }

  return (
    <section className="two-grid wide-right">
      <section className="panel">
        <PanelTitle title="Simulation workbench" icon={DatabaseZap} detail="Generate realistic multimodal civic intake" />
        <div className="scenario-grid">
          {scenarios.map((scenario) => (
            <button className="scenario-card" key={scenario.id} onClick={() => applyScenario(scenario)}>
              <strong>{scenario.title}</strong>
              <span>{scenario.channel} · {scenario.ward}</span>
            </button>
          ))}
        </div>
        <div className="form-grid">
          <label>Channel
            <select value={channel} onChange={(event) => { const next = event.target.value as SimulationScenario["channel"]; setChannel(next); setMedia(sampleMediaFor(next)); }}>
              <option value="text">Text</option>
              <option value="photo">Image/photo</option>
              <option value="voice">Voice/audio</option>
              <option value="video">Video</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
          </label>
          <label>Language<input value={language} onChange={(event) => setLanguage(event.target.value)} /></label>
          <label>State<input value={stateName} onChange={(event) => setStateName(event.target.value)} /></label>
          <label>District<input value={districtName} onChange={(event) => setDistrictName(event.target.value)} /></label>
          <label>Ward<input value={wardName} onChange={(event) => setWardName(event.target.value)} /></label>
          <label>Urgency<input type="number" min="1" max="5" value={urgency} onChange={(event) => setUrgency(Number(event.target.value))} /></label>
          <label>Rating<input type="number" min="1" max="5" value={rating} onChange={(event) => setRating(Number(event.target.value))} /></label>
        </div>
        <label>Problem text<textarea value={text} onChange={(event) => setText(event.target.value)} /></label>
        <label>Upload simulated media<input type="file" accept="image/*,audio/*,video/*" onChange={(event) => readFile(event.target.files?.[0])} /></label>
        <div className="simulator-actions">
          <button className="primary" disabled={busy} onClick={submitSimulation}>{busy ? "Submitting..." : "Submit simulation"}</button>
          <button onClick={() => setMedia(sampleMediaFor(channel))}>Use sample media</button>
        </div>
      </section>
      <section className="panel">
        <PanelTitle title="Simulation receipt" icon={Inbox} />
        {receipt ? (
          <div className="receipt small">
            <strong>{receipt.status}</strong>
            <span>{receipt.rawIntakeId}</span>
            <p>{receipt.message}</p>
          </div>
        ) : (
          <div className="empty-state">Choose a scenario or compose a problem, then submit it into the batch queue.</div>
        )}
        <Feature title="What this validates" icon={ShieldCheck} points={["Same intake path as citizen app", "Privacy mode defaults on", "Text, image, voice, and video payload support", "Batch queue receipt", "Dashboard refresh after submit"]} />
      </section>
    </section>
  );
}

function sampleMediaFor(channel: SimulationScenario["channel"]) {
  if (channel === "photo") return "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMTIwIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEyMCIgZmlsbD0iI2ZmZjFlNiIvPjx0ZXh0IHg9IjIwIiB5PSI2MCIgZmlsbD0iI2M0NDEwYyI+Q2l2aWMgaXNzdWUgcGhvdG88L3RleHQ+PC9zdmc+";
  if (channel === "voice") return "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=";
  if (channel === "video") return "data:video/webm;base64,GkXfo0AgQoaBAUL3gQFC8oEEQvOBCEKCQAR3ZWJtQoeBAkKFgQIYU4BnQI0VSalmQCgq17FAAw9CQE2AQAZ3aWRlbw==";
  return "";
}

function ModerationPage({ moderation, audit }: { moderation: ModerationResponse | null; audit: AuditResponse | null }) {
  return (
    <section className="two-grid">
      <section className="panel">
        <PanelTitle title="Moderation queue" icon={ShieldCheck} />
        <div className="table-list">
          {(moderation?.queue ?? []).map((item) => <div className="table-row" key={item.id}><span>{item.alias}</span><strong>{item.category}</strong><small>{item.ward} · {item.language} · {item.risk}</small></div>)}
        </div>
      </section>
      <section className="panel">
        <PanelTitle title="Audit trail" icon={Database} />
        <div className="table-list">
          {(audit?.events ?? []).map((event) => <div className="table-row" key={`${event.at}-${event.actor}`}><span>{event.actor}</span><strong>{event.action}</strong><small>{event.object} · {new Date(event.at).toLocaleString()}</small></div>)}
        </div>
      </section>
    </section>
  );
}

function AdminPage({
  regions,
  context,
  audit,
  refreshAll
}: {
  regions: RegionResponse | null;
  context: ContextResponse;
  audit: AuditResponse | null;
  refreshAll: () => Promise<void>;
}) {
  const allWards = useMemo(() => {
    const seen = new Set<string>();
    return Object.values(context.wardsByDistrict).flat().filter((item) => {
      if (seen.has(item)) return false;
      seen.add(item);
      return true;
    });
  }, [context.wardsByDistrict]);
  const [selectedWard, setSelectedWard] = useState(allWards[0] ?? "Kalindi Nagar");
  const [selectedMpId, setSelectedMpId] = useState(context.mps[0]?.id ?? "mp-delhi-central");
  const [receipt, setReceipt] = useState("");
  const [busy, setBusy] = useState(false);
  const latestAudit = audit?.events[0];

  useEffect(() => {
    if (allWards.length && !allWards.includes(selectedWard)) setSelectedWard(allWards[0]);
    if (context.mps.length && !context.mps.some((mp) => mp.id === selectedMpId)) setSelectedMpId(context.mps[0].id);
  }, [allWards, context.mps, selectedMpId, selectedWard]);

  async function updateMapping() {
    setBusy(true);
    setReceipt("");
    try {
      const response = await fetch(`${apiBase}/api/admin/area-mappings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actorId: "state-admin-india",
          ward: selectedWard,
          mpId: selectedMpId,
          wardStaffUserIds: []
        })
      });
      if (!response.ok) throw new Error("Area mapping update failed");
      const payload = await response.json() as { mapping: { ward: string; mpId: string; updatedAt: string } };
      const mpName = context.mps.find((mp) => mp.id === payload.mapping.mpId)?.name ?? payload.mapping.mpId;
      setReceipt(`${payload.mapping.ward} is now routed to ${mpName}.`);
      await refreshAll();
    } catch (error) {
      setReceipt(error instanceof Error ? error.message : "Area mapping update failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-grid">
      <section className="panel admin-console">
        <PanelTitle title="Area routing console" icon={Users} detail="API-backed ward to MP mapping" />
        <div className="form-grid two">
          <label>Ward or panchayat
            <select value={selectedWard} onChange={(event) => setSelectedWard(event.target.value)}>
              {allWards.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label>Responsible MP
            <select value={selectedMpId} onChange={(event) => setSelectedMpId(event.target.value)}>
              {context.mps.map((mp) => <option key={mp.id} value={mp.id}>{mp.name} · {mp.district}</option>)}
            </select>
          </label>
        </div>
        <div className="admin-actions">
          <button className="primary" disabled={busy} type="button" onClick={updateMapping}>{busy ? "Updating..." : "Update mapping"}</button>
          <span>{regions?.coverage.wardModel ?? "ward and panchayat"} model · {context.mps.length} MP accounts loaded</span>
        </div>
        {receipt ? <div className="action-receipt">{receipt}</div> : null}
      </section>

      <section className="panel">
        <PanelTitle title="India hierarchy coverage" icon={MapPin} />
        <div className="admin-stat-grid">
          <Metric label="States ready" value={String(regions?.coverage.statesReady ?? 0)} detail="state rollout records" />
          <Metric label="UTs ready" value={String(regions?.coverage.unionTerritoriesReady ?? 0)} detail="union territory records" />
          <Metric label="Lok Sabha target" value={formatCount(regions?.coverage.lokSabhaConstituenciesTarget ?? 543)} detail="constituency scale" />
          <Metric label="District target" value={formatCount(regions?.coverage.districtsTarget ?? 700)} detail="administrative districts" />
        </div>
      </section>

      <section className="panel">
        <PanelTitle title="Latest platform audit" icon={Activity} />
        {latestAudit ? (
          <div className="receipt small">
            <strong>{latestAudit.action}</strong>
            <span>{latestAudit.object}</span>
            <p>{latestAudit.actor} · {new Date(latestAudit.at).toLocaleString()}</p>
          </div>
        ) : <div className="empty-state">No audit events are available yet.</div>}
        <div className="table-list compact-list audit-preview">
          {(audit?.events ?? []).slice(0, 5).map((event) => (
            <div className="table-row" key={`${event.at}-${event.actor}-${event.object}`}>
              <span>{event.actor}</span>
              <strong>{event.action}</strong>
              <small>{event.object}</small>
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}

function IntegrationsPage({ integrations }: { integrations: IntegrationsResponse | null }) {
  const enabled = integrations?.enabled ?? [];
  const planned = integrations?.planned ?? [];
  const localEntries = Object.entries(integrations?.local ?? {});
  const connectorGroups = [
    { title: "Citizen channels", status: "ready", items: ["WhatsApp Cloud API", "SMS/IVR gateway", "Apni Awaaz web", "Public meetings import"] },
    { title: "AI processing", status: "configured", items: ["Vertex AI Gemini", "Speech-to-Text Chirp", "Cloud Vision OCR", "OpenAI-compatible fallback"] },
    { title: "Geospatial", status: "partial", items: ["Google Maps runtime key", "Boundary GeoJSON mount", "BigQuery GIS", "Hotspot clustering"] },
    { title: "Government data", status: "planned", items: ["data.gov.in", "NDAP", "MPLADS", "District dashboards"] }
  ];
  const readiness = [
    { label: "Runtime", value: enabled.includes("Kubernetes") ? "Kubernetes" : "Local", detail: enabled.join(" · ") || "waiting for API" },
    { label: "Database", value: localEntries.find(([key]) => key === "database")?.[1] ?? "unknown", detail: "Postgres locally, Cloud SQL in GCP production" },
    { label: "Processing", value: localEntries.find(([key]) => key === "processing")?.[1] ?? "batch", detail: "scheduled batch workers, not realtime-only" },
    { label: "GIS readiness", value: planned.includes("BigQuery GIS") ? "staged" : "pending", detail: "official boundary mount supported through Helm" }
  ];

  return (
    <section className="integrations-page">
      <section className="integration-overview">
        {readiness.map((item) => (
          <Metric key={item.label} label={item.label} value={item.value} detail={item.detail} />
        ))}
      </section>

      <section className="two-grid wide-left">
        <section className="panel">
          <PanelTitle title="Production connector matrix" icon={Network} detail="owned connectors and rollout state" />
          <div className="connector-grid">
            {connectorGroups.map((group) => (
              <article className={`connector-card ${group.status}`} key={group.title}>
                <div>
                  <strong>{group.title}</strong>
                  <span>{group.status}</span>
                </div>
                <ul>{group.items.map((item) => <li key={item}>{item}</li>)}</ul>
              </article>
            ))}
          </div>
        </section>

        <section className="panel">
          <PanelTitle title="Runtime contract" icon={Database} detail="what this local cluster is serving now" />
          <div className="runtime-list">
            {localEntries.map(([key, value]) => (
              <article key={key}>
                <span>{key}</span>
                <strong>{value}</strong>
              </article>
            ))}
            <article>
              <span>maps</span>
              <strong>runtime secret + fallback</strong>
            </article>
            <article>
              <span>boundaries</span>
              <strong>ConfigMap GeoJSON mount supported</strong>
            </article>
          </div>
        </section>
      </section>

      <section className="two-grid">
        <section className="panel">
          <PanelTitle title="Enabled now" icon={CheckCircle2} detail="active in this deployment" />
          <ul className="check-list">{enabled.map((point) => <li key={point}>{point}</li>)}</ul>
        </section>
        <section className="panel">
          <PanelTitle title="Next production connectors" icon={GitBranch} detail="requires credentials, data sharing, or cloud setup" />
          <ul className="check-list muted">{planned.map((point) => <li key={point}>{point}</li>)}</ul>
        </section>
      </section>
    </section>
  );
}

function PublicPage({ filters }: { filters: { scope: Scope; state: string; district: string; ward: string; mpId: string; q: string } }) {
  const [category, setCategory] = useState("");
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<PublicProjectsResponse | null>(null);
  const [selectedProject, setSelectedProject] = useState<PublicProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const limit = 8;

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ scope: filters.scope, limit: String(limit), offset: String(offset) });
    if (filters.scope === "local") {
      params.set("state", filters.state);
      params.set("district", filters.district);
      params.set("ward", filters.ward);
    }
    if (filters.scope === "mp") params.set("mpId", filters.mpId);
    if (filters.q.trim()) params.set("q", filters.q.trim());
    if (category) params.set("category", category);

    setLoading(true);
    setError("");
    fetch(`${apiBase}/api/public/projects?${params.toString()}`)
      .then((response) => {
        if (!response.ok) throw new Error("Public board API failed");
        return response.json() as Promise<PublicProjectsResponse>;
      })
      .then((next) => {
        if (cancelled) return;
        setData(next);
        setSelectedProject(next.items[0] ?? null);
      })
      .catch((apiError) => {
        if (!cancelled) setError(apiError instanceof Error ? apiError.message : "Public board API failed");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [filters, category, offset]);

  const categories = ["", "Education", "Roads", "Health", "Water", "Sanitation", "Power", "Digital Access"];

  return (
    <section className="panel">
      <PanelTitle title="Public transparency board" icon={Megaphone} />
      <div className="public-controls">
        <label>
          Category
          <select value={category} onChange={(event) => { setOffset(0); setCategory(event.target.value); }}>
            {categories.map((item) => <option key={item || "all"} value={item}>{item || "All categories"}</option>)}
          </select>
        </label>
        <div className="public-freshness">
          <strong>{data?.total ?? 0}</strong>
          <span>public-safe projects · latest batch {data?.latestProcessedBatchAt ? new Date(data.latestProcessedBatchAt).toLocaleString() : "pending"}</span>
        </div>
      </div>
      {loading ? <div className="empty-state">Loading public priorities...</div> : null}
      {error ? <div className="error-state">{error}</div> : null}
      {!loading && !error && data?.items.length === 0 ? <div className="empty-state">No public projects match the current filters.</div> : null}
      {!loading && !error && data?.items.length ? (
        <section className="two-grid wide-left">
          <div>
            <div className="project-grid">
              {data.items.map((project) => (
                <button className={`public-card ${selectedProject?.id === project.id ? "selected" : ""}`} key={project.id} onClick={() => setSelectedProject(project)}>
                  <span>{project.category}</span>
                  <h3>{project.title}</h3>
                  <p>{project.rationale}</p>
                  <small>{project.demandCount} reports · {project.averageRating}/5 rating · {project.status} · source {project.sourceFreshness}</small>
                </button>
              ))}
            </div>
            <div className="pagination-row">
              <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))}>Previous</button>
              <span>{offset + 1}-{Math.min(offset + limit, data.total)} of {data.total}</span>
              <button disabled={offset + limit >= data.total} onClick={() => setOffset(offset + limit)}>Next</button>
            </div>
          </div>
          {selectedProject ? <PublicProjectDetail project={selectedProject} /> : null}
        </section>
      ) : null}
    </section>
  );
}

function PublicProjectDetail({ project }: { project: PublicProject }) {
  return (
    <aside className="public-detail">
      <PanelTitle title="Public project detail" icon={FileText} detail={`${project.score} score · ${Math.round(project.confidence * 100)}% confidence`} />
      <h3>{project.title}</h3>
      <p>{project.rationale}</p>
      <PublicRatingControl project={project} />
      <div className="score-grid">
        <ScoreBar label="Demand" value={project.scoreBreakdown?.demand ?? 0} max={40} />
        <ScoreBar label="Need" value={project.scoreBreakdown?.need ?? 0} max={35} />
        <ScoreBar label="Urgency" value={project.scoreBreakdown?.urgency ?? 0} max={15} />
        <ScoreBar label="Equity" value={project.scoreBreakdown?.equity ?? 0} max={15} />
      </div>
      <Evidence title="Evidence" items={project.evidence} />
      <Evidence title="Safeguards" items={project.safeguards ?? ["Public view hides private contributor identity"]} />
      <Evidence title="Source snapshots" items={project.sourceSnapshotIds.length ? project.sourceSnapshotIds : ["Official source snapshot pending"]} />
    </aside>
  );
}

function PublicRatingControl({ project }: { project: PublicProject }) {
  const [rating, setRating] = useState(5);
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState(`${project.averageRating}/5 from ${project.ratings} public ratings`);

  useEffect(() => {
    setReceipt(`${project.averageRating}/5 from ${project.ratings} public ratings`);
  }, [project.averageRating, project.ratings, project.id]);

  async function submitRating(nextRating = rating) {
    setBusy(true);
    try {
      const response = await fetch(`${apiBase}/api/projects/${project.id}/ratings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: nextRating })
      });
      if (!response.ok) throw new Error("Rating failed");
      const payload = await response.json() as { averageRating: number; ratings: number; message: string };
      setReceipt(`${payload.message} Average ${payload.averageRating}/5 from ${payload.ratings} ratings.`);
    } catch (error) {
      setReceipt(error instanceof Error ? error.message : "Rating failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rating-control" aria-label="Rate public priority">
      <div>
        <strong>Public rating</strong>
        <span>{receipt}</span>
      </div>
      <div className="rating-buttons">
        {[1, 2, 3, 4, 5].map((value) => (
          <button className={rating === value ? "active" : ""} disabled={busy} key={value} onClick={() => { setRating(value); submitRating(value); }} type="button">
            {value}
          </button>
        ))}
      </div>
    </div>
  );
}

function MetricGrid({ dashboard }: { dashboard: DashboardResponse }) {
  return (
    <section className="metrics">
      <Metric label="Submissions" value={dashboard.totals.submissions.toString()} detail="filtered citizen inputs" />
      <Metric label="Local units" value={dashboard.totals.wards.toString()} detail="wards or panchayats" />
      <Metric label="Languages" value={dashboard.totals.languages.toString()} detail="detected by AI" />
      <Metric label="Bot risk" value={dashboard.totals.botRisk} detail="current anomaly status" />
    </section>
  );
}

function ProjectList({ projects, activeId, setActiveProjectId }: { projects: RankedProject[]; activeId: string; setActiveProjectId: (id: string) => void }) {
  return (
    <div className="project-list">
      {projects.map((project) => (
        <button className={`project-row ${project.id === activeId ? "selected" : ""}`} key={project.id} onClick={() => setActiveProjectId(project.id)}>
          <span className="score">{project.score}</span>
          <span><strong>{project.title}</strong><small>{project.mpName} · {project.district}, {project.state}</small><small>{project.demandCount} reports · {project.averageRating}/5 · {project.status}</small></span>
        </button>
      ))}
    </div>
  );
}

function ProjectBrief({ project, full, refreshAll }: { project: RankedProject; full?: boolean; refreshAll: () => Promise<void> }) {
  const [busyStatus, setBusyStatus] = useState<RankedProject["status"] | null>(null);
  const [message, setMessage] = useState("");

  async function updateStatus(status: RankedProject["status"]) {
    setBusyStatus(status);
    setMessage("");
    try {
      const response = await fetch(`${apiBase}/api/projects/${project.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actorId: "state-admin-india", status })
      });
      if (!response.ok) throw new Error("Project status update failed");
      setMessage(`Status updated to ${status}.`);
      await refreshAll();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Project status update failed");
    } finally {
      setBusyStatus(null);
    }
  }

  return (
    <section className="panel">
      <PanelTitle title={project.title} icon={FileText} detail={`${project.mpName} · ${Math.round(project.confidence * 100)}% confidence`} />
      <p className="rationale">{project.rationale}</p>
      <div className="chips">
        <span><Star size={14} /> {project.averageRating}/5 from {project.ratings}</span>
        <span><Languages size={14} /> {project.languageMix.join(", ")}</span>
        <span><MapPin size={14} /> {project.district}, {project.state}</span>
        <span><CheckCircle2 size={14} /> {project.status}</span>
      </div>
      <div className="action-row" aria-label="Project status actions">
        {(["review", "shortlist", "approved"] as const).map((status) => (
          <button
            className={project.status === status ? "active" : ""}
            disabled={busyStatus !== null || project.status === status}
            key={status}
            onClick={() => updateStatus(status)}
            type="button"
          >
            {busyStatus === status ? "Saving..." : status === "approved" ? "Approve" : status === "shortlist" ? "Shortlist" : "Return to review"}
          </button>
        ))}
      </div>
      {message ? <div className="action-receipt">{message}</div> : null}
      <div className="score-grid">
        <ScoreBar label="Demand" value={project.demandScore} max={40} />
        <ScoreBar label="Need" value={project.needScore} max={35} />
        <ScoreBar label="Urgency" value={project.urgencyScore} max={15} />
        <ScoreBar label="Equity" value={project.equityScore} max={15} />
      </div>
      <div className="evidence-grid">
        <Evidence title="Evidence" items={project.evidence} />
        <Evidence title="Visible contributors" items={project.recentCitizenAliases} />
        {full ? <Evidence title="Controls" items={project.safeguards} /> : null}
      </div>
    </section>
  );
}

function Feature({ title, icon: Icon, points }: { title: string; icon: typeof Home; points: string[] }) {
  return (
    <article className="panel feature">
      <PanelTitle title={title} icon={Icon} />
      <ul>{points.map((point) => <li key={point}>{point}</li>)}</ul>
    </article>
  );
}

function PanelTitle({ title, icon: Icon, detail }: { title: string; icon: typeof Home; detail?: string }) {
  return <div className="panel-title"><h3><Icon size={18} /> {title}</h3>{detail ? <span>{detail}</span> : null}</div>;
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <article className="metric-card"><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}

function ScoreBar({ label, value, max }: { label: string; value: number; max: number }) {
  return <div className="score-bar"><div><span>{label}</span><strong>{value}/{max}</strong></div><meter min="0" max={max} value={value} /></div>;
}

function Evidence({ title, items }: { title: string; items: string[] }) {
  return <div className="evidence"><h4>{title}</h4><ul>{items.map((item) => <li key={item}>{item}</li>)}</ul></div>;
}

function pageLabel(page: Page): string {
  return ({ home: "Command home", explore: "India problem search", mp: "MP workspace", projects: "Project evidence", analytics: "Demand intelligence", enterprise: "Enterprise situation room", copilot: "AI constituency copilot", simulation: "Simulation workbench", ai: "Vertex AI operations", moderation: "Trust and safety", admin: "Platform administration", integrations: "Cloud and data", public: "Public transparency" })[page];
}

function pageTitle(page: Page): string {
  return ({ home: "LokSetu operating system", explore: "Search problems across India", mp: "Localized MP command center", projects: "Evidence-backed project rooms", analytics: "Demand, equity, and urgency analytics", enterprise: "AI-powered governance command center", copilot: "Policy and constituency intelligence assistant", simulation: "Generate realistic civic intake", ai: "AI pipeline and model controls", moderation: "Privacy, abuse, and review queues", admin: "Users, regions, and rollout controls", integrations: "Production integration status", public: "Citizen-facing transparency" })[page];
}
