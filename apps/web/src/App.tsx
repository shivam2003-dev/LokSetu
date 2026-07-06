import {
  ArrowRight,
  BarChart3,
  Bot,
  Briefcase,
  Building2,
  Construction,
  CheckCircle2,
  Database,
  DatabaseZap,
  Droplets,
  EyeOff,
  FileText,
  Flag,
  Globe2,
  GraduationCap,
  HeartPulse,
  Home,
  Languages,
  Lock,
  Mail,
  Map as MapIcon,
  MapPinned,
  MapPin,
  Menu,
  MessageSquareText,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Scale,
  Search,
  Send,
  ShieldCheck,
  Star,
  Target,
  Trash2,
  TrendingUp,
  Users,
  Wifi,
  X,
  Zap
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { DemandSignalsPage } from "./DemandSignals";

type Page = "overview" | "priorities" | "pulse" | "map" | "signals" | "explorer" | "copilot" | "knowledge" | "recommendations" | "projects" | "reports" | "compare" | "settings";

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
  averageCitizenScore?: number;
  averageSubmissionQuality?: number;
  rewardedCitizenCount?: number;
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
    provider?: "mappls" | "google" | "osm";
    mapplsKey?: string;
    source: string;
  };
  citizenAppUrl?: string;
  generatedAt: string;
};

type DemoDataStatus = {
  enabled: boolean;
  mode: "postgres" | "memory";
  demoRows: number;
  visibleRows: number;
  totalRows: number;
  label: string;
};

type BatchRun = {
  id: string;
  startedAt: string;
  finishedAt?: string;
  status: string;
  processed: number;
  discarded?: number;
  failed: number;
  error?: string;
};

type IntakeAuditResponse = {
  generatedAt: string;
  processingMode: string;
  rawStatus: Record<string, number>;
  recentRuns: BatchRun[];
  samples: Array<{ type: string; label: string; href: string; expected: string }>;
  entries: Array<{
    rawIntakeId: string;
    shortReceipt: string;
    status: string;
    attempts: number;
    submittedAt: string;
    processedAt?: string;
    channel: string;
    input: { language: string; text: string; hasMedia: boolean; mediaType: string; urgency: number; rating: number; privacyMode: boolean };
    identity: { aadhaarMasked?: string; aadhaarVerified: boolean; identityMode: string };
    reward: {
      citizenScore: number | null;
      qualityScore: number | null;
      rewardPoints: number | null;
      rewardBand: string;
      reasons: string[];
    };
    placement: { state: string; district: string; ward: string; mpId?: string; locationLabel?: string };
    ai: {
      category: string;
      detectedLanguage?: string;
      normalizedText?: string;
      transcript?: string;
      imageSummary?: string;
      isCivicIssue?: boolean;
      noiseReason?: string;
      providerMode?: string;
      model?: string;
      fallbackUsed?: boolean;
      explanation: string;
    };
  }>;
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
  mode?: "online" | "submitted" | "all";
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

type Hotspot = DashboardResponse["hotspots"][number];
type MapLoadState = "idle" | "loading" | "ready" | "fallback";
type TileFallbackState = {
  zoom: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  tiles: Array<{ x: number; y: number; url: string; left: number; top: number; width: number; height: number }>;
};
declare global {
  interface Window {
    google?: any;
    mappls?: {
      Map?: new (element: string | HTMLElement, options: Record<string, unknown>) => unknown;
      Marker?: new (options: Record<string, unknown>) => unknown;
    };
    __loksetuGoogleMapsPromise?: Promise<void>;
    __loksetuGoogleMapsLoaded?: () => void;
    __loksetuMapplsPromise?: Promise<void>;
    __loksetuMapplsLoaded?: () => void;
    gm_authFailure?: () => void;
  }
}

const apiBase = import.meta.env.VITE_API_BASE_URL ?? "";
const accessTokenKey = "loksetuAccessToken";
const envGoogleMapsApiKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? "").trim();
const envGoogleMapsMapId = (import.meta.env.VITE_GOOGLE_MAPS_MAP_ID ?? "").trim();
const envMapplsMapSdkKey = (import.meta.env.VITE_MAPPLS_MAP_SDK_KEY ?? "").trim();
const configuredCitizenAppUrl = (import.meta.env.VITE_CITIZEN_APP_URL ?? "").trim();
const citizenAppUrl =
  configuredCitizenAppUrl ||
  (["localhost", "127.0.0.1"].includes(window.location.hostname)
    ? "http://localhost:5174"
    : `https://citizen.${window.location.host}`);

const navItems: Array<{ id: string; page: Page; label: string; hint?: string; icon: typeof Home; badge?: string }> = [
  { id: "overview", page: "overview", label: "Overview", icon: Home },
  { id: "signals", page: "signals", label: "Demand Signals", icon: DatabaseZap },
  { id: "copilot", page: "copilot", label: "AI Assistant (RAG)", icon: MessageSquareText, badge: "New" },
  { id: "recommendations", page: "recommendations", label: "Recommendations", icon: Scale },
  { id: "projects", page: "projects", label: "Projects", icon: Briefcase },
  { id: "reports", page: "reports", label: "Reports", icon: FileText },
  { id: "explorer", page: "explorer", label: "Data Explorer", icon: Database },
  { id: "knowledge", page: "knowledge", label: "Knowledge Base", icon: Search },
  { id: "map", page: "map", label: "Map View", icon: MapIcon },
  { id: "compare", page: "compare", label: "Compare", icon: TrendingUp },
  { id: "settings", page: "settings", label: "Settings", icon: Lock }
];

const activeNavIdByPage: Record<Page, string> = {
  overview: "overview",
  priorities: "priorities",
  pulse: "reports",
  map: "map",
  signals: "signals",
  explorer: "explorer",
  copilot: "copilot",
  knowledge: "knowledge",
  recommendations: "recommendations",
  projects: "projects",
  reports: "reports",
  compare: "compare",
  settings: "settings"
};

const tourStorageKey = "janvaaniTourComplete";
const tourSteps: Array<{ page: Page; title: string; body: string; action: string }> = [
  {
    page: "overview",
    title: "Start with constituency health",
    body: "Overview gives the MP a 360 degree readout: demand, risk, projects, alerts, citizen satisfaction, and AI priority score.",
    action: "Use this as the evaluator landing view."
  },
  {
    page: "overview",
    title: "Citizen submission starts the flow",
    body: "Open JanVaani from the sidebar to submit a citizen issue. The API ingests it, deduplicates signals, ranks demand, and updates dashboards.",
    action: "Click Open JanVaani for the public submission journey."
  },
  {
    page: "signals",
    title: "Demand Signals explains what citizens need",
    body: "Signals combine citizen intake, official rows, documents, news, web sources, search trends, and connector status into ranked issues.",
    action: "Use state, district, ward, and issue filters to show Delhi demo data."
  },
  {
    page: "copilot",
    title: "RAG answers are grounded",
    body: "The AI Assistant has Online, Submitted Issue, and All modes. Answers cite evidence from reports, complaints, documents, weather, maps, and web signals.",
    action: "Ask why a road, school, water, or health issue is ranked."
  },
  {
    page: "recommendations",
    title: "Recommendations become execution priorities",
    body: "AI ranks projects by urgency, beneficiaries, budget, confidence, evidence, and constituency impact.",
    action: "Review High, Medium, and Low priority cards."
  },
  {
    page: "projects",
    title: "Projects track delivery",
    body: "The MP can review project cards, Kanban, Gantt timeline, expenditure, milestone status, media, documents, and AI delay alerts.",
    action: "Select a project card to update the execution panels."
  },
  {
    page: "map",
    title: "Map shows where action is needed",
    body: "GIS view layers roads, schools, hospitals, PHCs, complaints, projects, flood zones, density, boundaries, and demand heatmaps.",
    action: "Click hotspots to open evidence and project details."
  },
  {
    page: "reports",
    title: "Reports package the decision",
    body: "Generate official Monthly, Budget, Demand Signals, Infrastructure, Development, and AI Recommendation reports with exports.",
    action: "Use export buttons for presentation-ready files."
  },
  {
    page: "settings",
    title: "Admin controls keep it governed",
    body: "Settings cover users, roles, API keys, integrations, vector database health, indexing, audit logs, security, billing, and backups.",
    action: "Verify connection status and data-source health here."
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
    enabled: Boolean(envMapplsMapSdkKey || envGoogleMapsApiKey),
    apiKey: envGoogleMapsApiKey,
    mapId: envGoogleMapsMapId,
    provider: envMapplsMapSdkKey ? "mappls" : envGoogleMapsApiKey ? "google" : "osm",
    mapplsKey: envMapplsMapSdkKey,
    source: envMapplsMapSdkKey ? "vite-mappls-env" : envGoogleMapsApiKey ? "vite-env" : "not-configured"
  },
  citizenAppUrl,
  generatedAt: new Date().toISOString()
};

const fallbackDemoDataStatus: DemoDataStatus = {
  enabled: true,
  mode: "memory",
  demoRows: 0,
  visibleRows: 0,
  totalRows: 0,
  label: "Demo data on"
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

function pageFromHash(): Page {
  const raw = window.location.hash.replace("#", "") || "overview";
  if (["home", "mp"].includes(raw)) return "overview";
  if (raw === "pulse") return "pulse";
  if (["public", "analytics", "enterprise", "moderation", "admin", "integrations", "ai"].includes(raw)) return "priorities";
  if (["explore", "india"].includes(raw)) return "map";
  if (["simulation", "submit", "intake"].includes(raw)) return "priorities";
  return navItems.some((item) => item.page === raw) ? (raw as Page) : "priorities";
}

async function getJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const response = await apiFetch(path);
    if (response.status === 401) throw new AuthError();
    if (!response.ok) throw new Error(path);
    return response.json();
  } catch (error) {
    if (error instanceof AuthError) throw error;
    return fallback;
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(path, init);
  if (response.status === 401) throw new AuthError();
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
  const [accessToken, setAccessToken] = useState(() => localStorage.getItem(accessTokenKey) ?? "");

  function handleLogin(token: string) {
    localStorage.setItem(accessTokenKey, token);
    setAccessToken(token);
  }

  function handleLogout() {
    localStorage.removeItem(accessTokenKey);
    setAccessToken("");
  }

  return accessToken ? <AuthenticatedApp onLogout={handleLogout} /> : <LoginPage onLogin={handleLogin} />;
}

function AuthenticatedApp({ onLogout }: { onLogout: () => void }) {
  const [page, setPageState] = useState<Page>(() => pageFromHash());
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(() => localStorage.getItem(tourStorageKey) !== "1");
  const [tourStep, setTourStep] = useState(0);
  const [scope, setScope] = useState<Scope>("local");
  const [state, setState] = useState("Delhi");
  const [district, setDistrict] = useState("Central Delhi");
  const [ward, setWard] = useState("Kalindi Nagar");
  const [mpId, setMpId] = useState("mp-delhi-central");
  const [query, setQuery] = useState("");
  const [dashboard, setDashboard] = useState<DashboardResponse>(fallbackDashboard);
  const [context, setContext] = useState<ContextResponse>(fallbackContext);
  const [clientConfig, setClientConfig] = useState<ClientConfig>(fallbackClientConfig);
  const [demoData, setDemoData] = useState<DemoDataStatus>(fallbackDemoDataStatus);
  const [apiConnected, setApiConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [regions, setRegions] = useState<RegionResponse | null>(null);
  const [copilotCapabilities, setCopilotCapabilities] = useState<CopilotCapabilitiesResponse | null>(null);
  const [ragStatus, setRagStatus] = useState<RagStatusResponse | null>(null);
  const [mapBoundaries, setMapBoundaries] = useState<MapBoundaryResponse>(fallbackMapBoundaries);
  const [mapClusters, setMapClusters] = useState<MapClusterResponse>(fallbackMapClusters);
  const [notice, setNotice] = useState("Connecting");
  const [activeProjectId, setActiveProjectId] = useState(fallbackProject.id);

  const filters = useMemo(() => ({ scope, state, district, ward, mpId, q: query }), [scope, state, district, ward, mpId, query]);
  const activeProject = dashboard.projects.find((project) => project.id === activeProjectId) ?? dashboard.projects[0] ?? fallbackProject;
  const effectiveCitizenAppUrl = clientConfig.citizenAppUrl?.trim() || citizenAppUrl;
  const showControlStrip = page === "priorities" || page === "map" || page === "recommendations" || page === "projects";

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
    setMobileNavOpen(false);
    if (window.location.hash !== `#${next}`) window.history.replaceState(null, "", `#${next}`);
  }

  function startTour() {
    setTourStep(0);
    setTourOpen(true);
    setMobileNavOpen(false);
    setPage(tourSteps[0].page);
  }

  function closeTour() {
    localStorage.setItem(tourStorageKey, "1");
    setTourOpen(false);
  }

  function moveTour(nextStep: number) {
    if (nextStep >= tourSteps.length) {
      closeTour();
      return;
    }
    const boundedStep = Math.max(0, nextStep);
    setTourStep(boundedStep);
    setPage(tourSteps[boundedStep].page);
  }

  async function refreshAll() {
    try {
      const [nextConfig, nextDemoData, nextContext, nextDashboard, nextRegions, nextCopilot, nextRagStatus, nextBoundaries, nextClusters] = await Promise.all([
        requestJson<ClientConfig>("/api/client-config"),
        getJson<DemoDataStatus>("/api/demo-data", fallbackDemoDataStatus),
        requestJson<ContextResponse>("/api/context"),
        fetchDashboard(filters),
        getJson<RegionResponse>("/api/regions", {
          coverage: { statesReady: 28, unionTerritoriesReady: 8, lokSabhaConstituenciesTarget: 543, districtsTarget: 700, wardModel: "ward and panchayat" },
          onboardingStates: []
        }),
        getJson<CopilotCapabilitiesResponse>("/api/copilot/capabilities", { agents: [], sourceFamilies: [], supportedRoles: ["mp"], supportedInputs: [], currentLimitations: [] }),
        getJson<RagStatusResponse>("/api/copilot/rag-status", { mode: "local-hybrid-rag", productionTarget: "Vertex AI RAG Engine or Vertex AI Vector Search", embeddingStore: "local-deterministic-index", corpusDocuments: 0, bySource: {}, privacy: "privacy-safe aliases only", refreshCadence: "batch pipeline refresh" }),
        getJson<MapBoundaryResponse>("/api/maps/boundaries", fallbackMapBoundaries),
        getJson<MapClusterResponse>("/api/maps/clusters?zoom=5", fallbackMapClusters)
      ]);
      setClientConfig(mergeClientConfig(nextConfig));
      setDemoData(nextDemoData);
      setContext(nextContext);
      setDashboard(nextDashboard);
      setRegions(nextRegions);
      setCopilotCapabilities(nextCopilot);
      setRagStatus(nextRagStatus);
      setMapBoundaries(nextBoundaries);
      setMapClusters(nextClusters);
      setActiveProjectId((current) => (nextDashboard.projects.some((project) => project.id === current) ? current : nextDashboard.projects[0]?.id ?? fallbackProject.id));
      setApiConnected(true);
      setConnectionError(null);
      setNotice("Live");
    } catch (error) {
      if (error instanceof AuthError) {
        onLogout();
        return;
      }
      setApiConnected(false);
      setConnectionError(error instanceof Error ? error.message : "API unavailable");
      setNotice("Disconnected");
    }
  }

  async function applyFilters() {
    try {
      const next = await fetchDashboard(filters);
      setDashboard(next);
      setActiveProjectId((current) => (next.projects.some((project) => project.id === current) ? current : next.projects[0]?.id ?? fallbackProject.id));
      setApiConnected(true);
      setConnectionError(null);
      setNotice("Live");
    } catch (error) {
      if (error instanceof AuthError) {
        onLogout();
        return;
      }
      setApiConnected(false);
      setConnectionError(error instanceof Error ? error.message : "API unavailable");
      setNotice("Disconnected");
    }
  }

  async function updateDemoData(action: "load" | "disable") {
    try {
      const response = await apiFetch(`/api/demo-data/${action}`, { method: "POST" });
      if (response.status === 401) throw new AuthError();
      if (!response.ok) throw new Error(`Demo data ${action} failed`);
      const nextDemoData = await response.json() as DemoDataStatus;
      setDemoData(nextDemoData);
      await refreshAll();
    } catch (error) {
      if (error instanceof AuthError) {
        onLogout();
        return;
      }
      setConnectionError(error instanceof Error ? error.message : "Demo data update failed");
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
    <main className={`app-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""} ${mobileNavOpen ? "mobile-nav-open" : ""}`}>
      <aside className="sidebar" aria-label="JanVaani navigation">
        <div className="brand">
          <div className="brand-mark">JV</div>
          <div>
            <h1>JanVaani <em>AI</em></h1>
            <p>Constituency Intelligence Platform</p>
          </div>
          <button
            aria-label={sidebarCollapsed ? "Expand navigation" : "Collapse navigation"}
            className="sidebar-toggle"
            onClick={() => setSidebarCollapsed((value) => !value)}
            title={sidebarCollapsed ? "Expand navigation" : "Collapse navigation"}
            type="button"
          >
            {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>
        <nav className="nav-scroll">
          <div className="nav-section">
            <span>Core workflow</span>
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button className={`nav-item rich ${activeNavIdByPage[page] === item.id ? "active" : ""}`} key={item.id} onClick={() => setPage(item.page)}>
                  <Icon size={18} />
                  <span className="nav-copy">
                    <strong>{item.label}</strong>
                    {item.hint ? <small>{item.hint}</small> : null}
                  </span>
                  {item.badge ? <em>{item.badge}</em> : null}
                </button>
              );
            })}
          </div>
        </nav>
        <div className="sidebar-footer">
          <a className="citizen-link" href={effectiveCitizenAppUrl}>
            <Send size={16} />
            Open JanVaani
          </a>
          <div className={`status-pill ${apiConnected ? "connected" : "disconnected"}`}>
            <CheckCircle2 size={16} />
            <span>{notice} - {clientConfig.dataMode}</span>
          </div>
        </div>
      </aside>
      <button className="mobile-nav-backdrop" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} type="button" />

      <section className="workspace">
        <header className="topbar">
          <div className="topbar-title-row">
            <button className="mobile-nav-button" onClick={() => setMobileNavOpen(true)} type="button">
              <Menu size={18} />
              Menu
            </button>
            <div>
              <p className="eyebrow">{pageLabel(page)}</p>
              <h2>{pageTitle(page)}</h2>
            </div>
          </div>
          <div className="topbar-actions">
            <button className="tour-button" onClick={startTour} type="button">
              <Star size={16} />
              Tour
            </button>
            <div className={`demo-data-toggle ${demoData.enabled ? "enabled" : "disabled"}`} aria-label="Demo data controls">
              <span>{demoData.label}</span>
              <small>{formatCount(demoData.visibleRows)} visible / {formatCount(demoData.demoRows)} demo</small>
              <button onClick={() => updateDemoData("load")} type="button">Load local demo data</button>
              <button onClick={() => updateDemoData("disable")} type="button">Disable demo data</button>
            </div>
            <button className="icon-button" title="Refresh" onClick={refreshAll}>
              <RefreshCw size={18} />
            </button>
            <button className="logout-button" onClick={onLogout} type="button">Logout</button>
          </div>
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

        {page === "overview" ? <OverviewPage dashboard={dashboard} setPage={setPage} /> : null}
        {page === "priorities" ? <PriorityDeskPage dashboard={dashboard} activeProject={activeProject} setActiveProjectId={setActiveProjectId} refreshAll={refreshAll} setPage={setPage} /> : null}
        {page === "map" ? <ExplorePage dashboard={dashboard} regions={regions} maps={clientConfig.maps} boundaries={mapBoundaries} clusters={mapClusters} setActiveProjectId={setActiveProjectId} setPage={setPage} /> : null}
        {page === "pulse" ? <PulsePage setPage={setPage} /> : null}
        {page === "signals" ? <DemandSignalsPage /> : null}
        {page === "explorer" ? <DataExplorerPage dashboard={dashboard} demoData={demoData} /> : null}
        {page === "copilot" ? <CopilotPage capabilities={copilotCapabilities} ragStatus={ragStatus} projects={dashboard.projects} /> : null}
        {page === "knowledge" ? <KnowledgeBasePage /> : null}
        {page === "recommendations" ? <RecommendationsPage dashboard={dashboard} /> : null}
        {page === "projects" ? <ProjectsManagementPage dashboard={dashboard} /> : null}
        {page === "reports" ? <ReportsPage dashboard={dashboard} /> : null}
        {page === "compare" ? <ComparePage /> : null}
        {page === "settings" ? <SettingsPage clientConfig={clientConfig} ragStatus={ragStatus} demoData={demoData} context={context} /> : null}
      </section>
      {tourOpen ? (
        <TourOverlay
          current={tourStep}
          steps={tourSteps}
          onBack={() => moveTour(tourStep - 1)}
          onClose={closeTour}
          onNext={() => moveTour(tourStep + 1)}
          onOpenCitizen={() => window.open(effectiveCitizenAppUrl, "_blank", "noopener,noreferrer")}
        />
      ) : null}
    </main>
  );
}

function TourOverlay({
  current,
  steps,
  onBack,
  onClose,
  onNext,
  onOpenCitizen
}: {
  current: number;
  steps: typeof tourSteps;
  onBack: () => void;
  onClose: () => void;
  onNext: () => void;
  onOpenCitizen: () => void;
}) {
  const step = steps[current];
  const isSubmissionStep = current === 1;
  return (
    <section className="tour-overlay" role="dialog" aria-modal="true" aria-label="JanVaani evaluator tour">
      <div className="tour-card">
        <header>
          <span>Solution tour</span>
          <button aria-label="Close tour" onClick={onClose} type="button"><X size={18} /></button>
        </header>
        <div className="tour-progress" aria-label={`Step ${current + 1} of ${steps.length}`}>
          {steps.map((item, index) => <i className={index <= current ? "active" : ""} key={item.title} />)}
        </div>
        <strong>{step.title}</strong>
        <p>{step.body}</p>
        <mark>{step.action}</mark>
        <footer>
          <button disabled={current === 0} onClick={onBack} type="button">Back</button>
          {isSubmissionStep ? <button className="secondary" onClick={onOpenCitizen} type="button">Open JanVaani</button> : null}
          <button className="primary" onClick={onNext} type="button">{current === steps.length - 1 ? "Finish" : "Next"}</button>
        </footer>
      </div>
    </section>
  );
}

async function apiFetch(path: string, init: RequestInit = {}) {
  const token = localStorage.getItem(accessTokenKey) ?? "";
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(`${apiBase}${path}`, {
    ...init,
    headers
  });
}

class AuthError extends Error {
  constructor() {
    super("Session expired. Please log in again.");
  }
}

function LoginPage({ onLogin }: { onLogin: (token: string) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${apiBase}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      const payload = await response.json() as { token?: string; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Login failed");
      onLogin(payload.token || "auth-disabled");
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-showcase" aria-label="JanVaani AI platform introduction">
        <div className="login-brand-row">
          <span className="login-brand-mark" aria-hidden="true" />
          <div>
            <h1>JanVaani <em>AI</em></h1>
            <p>People's Priorities. Smart Governance.</p>
          </div>
        </div>
        <div className="login-copy-block">
          <h2>AI-Powered Intelligence for People-First Governance</h2>
          <p>Turning citizen voices, public data, and AI insights into better decisions and stronger communities.</p>
        </div>
        <div className="login-benefits">
          {[
            { icon: Users, title: "Understand People's Priorities", detail: "Collect and analyze multilingual citizen feedback from multiple channels." },
            { icon: BarChart3, title: "Data-Driven Decisions", detail: "Leverage AI and real-time data to identify what matters most." },
            { icon: Target, title: "Plan. Act. Impact.", detail: "Prioritize projects, allocate resources, and track real impact on the ground." },
            { icon: ShieldCheck, title: "Transparent & Accountable", detail: "Evidence-based insights with full transparency and citizen trust." }
          ].map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.title}>
                <span><Icon size={22} /></span>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                </div>
              </article>
            );
          })}
        </div>
        <small className="login-image-credit">Image: Wikimedia Commons / Pinakpani, CC BY-SA 4.0</small>
      </section>

      <section className="login-panel" aria-label="Admin sign in">
        <div className="login-card-emblem"><Building2 size={42} /></div>
        <h2>Welcome Back</h2>
        <p>Sign in to continue to JanVaani AI</p>
        <form onSubmit={login}>
          <label>
            Email or Mobile Number
            <span className="login-input-wrap">
              <Mail size={21} />
              <input autoFocus autoComplete="username" onChange={(event) => setUsername(event.target.value)} placeholder="Enter your email or mobile number" type="text" value={username} />
            </span>
          </label>
          <label>
            Password
            <span className="login-input-wrap">
              <Lock size={21} />
              <input autoComplete="current-password" onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" type="password" value={password} />
              <EyeOff size={21} />
            </span>
          </label>
          <div className="login-row">
            <label className="remember-row"><input defaultChecked type="checkbox" /> Remember me</label>
            <button className="link-button" type="button">Forgot Password?</button>
          </div>
          {error ? <div className="login-error">{error}</div> : null}
          <button className="login-submit" disabled={busy || !username.trim() || !password.trim()} type="submit">
            {busy ? <RefreshCw className="spin" size={18} /> : null}
            Sign In
            <ArrowRight size={22} />
          </button>
        </form>
        <div className="login-divider"><span>or continue with</span></div>
        <div className="sso-grid">
          {["MP SSO", "Google", "Microsoft", "Apple"].map((item) => (
            <button disabled key={item} type="button">{item}</button>
          ))}
        </div>
        <p className="login-admin-note">Don't have an account? <button type="button">Contact Administrator</button></p>
      </section>
      <footer className="login-security-strip" aria-label="Security posture">
        <span><ShieldCheck size={17} /> Secure & Encrypted</span>
        <span><Lock size={17} /> Data Privacy Compliant</span>
        <span><Building2 size={17} /> Government Grade Security</span>
      </footer>
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
  const mapplsKey = config.maps.mapplsKey || envMapplsMapSdkKey;
  const provider = mapplsKey ? "mappls" : apiKey ? "google" : "osm";
  return {
    ...config,
    maps: {
      ...config.maps,
      enabled: Boolean(mapplsKey || apiKey),
      apiKey,
      mapId,
      provider,
      mapplsKey,
      source: config.maps.source || (mapplsKey ? "runtime-mappls-api" : apiKey ? "runtime-api" : "not-configured")
    },
    citizenAppUrl: config.citizenAppUrl?.trim() || citizenAppUrl
  };
}

function formatCount(value: number) {
  return value.toLocaleString("en-IN");
}

function average(values: number[]) {
  const clean = values.filter((value) => Number.isFinite(value));
  return clean.length ? clean.reduce((sum, value) => sum + value, 0) / clean.length : 0;
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function OverviewPage({ dashboard, setPage }: { dashboard: DashboardResponse; setPage: (page: Page) => void }) {
  const projects = buildManagedProjects(dashboard.projects);
  const topPriorities = projects.slice(0, 5);
  const totalDemand = dashboard.projects.reduce((sum, project) => sum + project.demandCount, 0);
  const avgConfidence = Math.round(average(dashboard.projects.map((project) => project.confidence)) * 100) || 86;
  const healthScore = Math.round(average([
    avgConfidence,
    100 - Math.min(42, dashboard.totals.botRisk === "high" ? 38 : dashboard.totals.botRisk === "medium" ? 18 : 6),
    average(projects.map((project) => project.progress)),
    Math.min(100, dashboard.totals.wards * 4 + 48)
  ]));
  const completed = projects.filter((project) => project.deliveryStatus === "completed").length;
  const delayed = projects.filter((project) => project.deliveryStatus === "delayed").length;
  const alertItems = [
    { title: "Road complaints rising", detail: "Clustered citizen demand needs 48-hour review", tone: "high" },
    { title: "PHC staffing risk", detail: "Health requests exceed district baseline by 22%", tone: "medium" },
    { title: "Budget release pending", detail: `${delayed} delayed works require officer follow-up`, tone: "medium" }
  ];
  const insightCards = [
    "AI recommends funding high-demand road and drainage works before monsoon acceleration.",
    "Education and PHC projects show the strongest citizen satisfaction upside per crore.",
    "Water and sanitation requests overlap in dense wards; bundle execution to reduce disruption."
  ];

  return (
    <section className="overview-page">
      <section className="overview-hero panel">
        <div>
          <p className="eyebrow">JanVaani AI Executive Overview</p>
          <h3>Constituency intelligence command center</h3>
          <p>A 360 degree view of citizen priorities, AI-ranked risks, development progress, and live alerts for Members of Parliament.</p>
          <div className="overview-actions">
            <button onClick={() => setPage("recommendations")} type="button">Open AI recommendations</button>
            <button onClick={() => setPage("projects")} type="button">Review projects</button>
            <button onClick={() => setPage("map")} type="button">View GIS map</button>
          </div>
        </div>
        <div className="overview-score-orb">
          <span>Constituency Health</span>
          <strong>{healthScore}</strong>
          <small>{avgConfidence}% AI confidence · {formatCount(totalDemand)} citizen signals</small>
        </div>
      </section>

      <section className="overview-kpi-grid">
        <article className="panel"><span>Citizen Priorities</span><strong>{dashboard.projects.length}</strong><small>{formatCount(totalDemand)} processed demand signals</small></article>
        <article className="panel"><span>Development Progress</span><strong>{completed}/{projects.length}</strong><small>{delayed} delayed works need attention</small></article>
        <article className="panel"><span>Active Wards</span><strong>{dashboard.totals.wards}</strong><small>{dashboard.totals.languages} languages normalized</small></article>
        <article className="panel"><span>AI Risk</span><strong>{dashboard.totals.botRisk}</strong><small>bot and duplicate demand monitor</small></article>
      </section>

      <section className="overview-main-grid">
        <section className="panel overview-priority-panel">
          <PanelTitle title="Top Citizen Priorities" icon={Scale} detail="AI-ranked demand" />
          {topPriorities.map((project, index) => (
            <article key={project.id}>
              <span>#{index + 1}</span>
              <div>
                <strong>{project.title}</strong>
                <small>{project.category} · {project.ward} · {formatCount(project.demandCount)} signals</small>
              </div>
              <b>{project.score}</b>
            </article>
          ))}
        </section>

        <section className="panel overview-ai-panel">
          <PanelTitle title="AI Insights" icon={Bot} detail="real-time constituency signals" />
          {insightCards.map((item) => <p key={item}>{item}</p>)}
          <button onClick={() => setPage("copilot")} type="button">Ask JanVaani AI</button>
        </section>

        <section className="panel overview-alert-panel">
          <PanelTitle title="Real-Time Alerts" icon={Zap} detail="requires action" />
          {alertItems.map((item) => (
            <article className={item.tone} key={item.title}>
              <strong>{item.title}</strong>
              <span>{item.detail}</span>
            </article>
          ))}
        </section>

        <section className="panel overview-map-panel">
          <PanelTitle title="Demand Hotspots" icon={MapPinned} detail="affected regions" />
          <div className="overview-mini-map">
            {topPriorities.slice(0, 8).map((project, index) => (
              <i key={project.id} style={{ left: `${14 + (index % 4) * 22}%`, top: `${18 + Math.floor(index / 4) * 32}%` }}>{project.score}</i>
            ))}
            <span>Constituency boundary</span>
          </div>
        </section>
      </section>

      <section className="overview-bottom-grid">
        <section className="panel overview-progress-panel">
          <PanelTitle title="Development Progress" icon={Briefcase} detail="portfolio execution" />
          {projects.slice(0, 5).map((project) => (
            <article key={project.id}>
              <div><strong>{project.ward}</strong><span>{project.deliveryStatus}</span></div>
              <meter min="0" max="100" value={project.progress} />
            </article>
          ))}
        </section>

        <section className="panel overview-budget-panel">
          <PanelTitle title="Budget and Impact" icon={Database} detail="expected beneficiaries" />
          <div className="overview-budget-chart">
            {projects.slice(0, 6).map((project) => (
              <span key={project.id} style={{ height: `${Math.max(26, project.budgetCr * 11)}px` }}><b>₹{project.budgetCr.toFixed(1)}Cr</b></span>
            ))}
          </div>
        </section>

        <section className="panel overview-compare-panel">
          <PanelTitle title="District Snapshot" icon={TrendingUp} detail="health vs demand" />
          {["Infrastructure", "Healthcare", "Education", "Water", "Employment"].map((item, index) => (
            <article key={item}><span>{item}</span><i style={{ width: `${88 - index * 9}%` }} /><strong>{88 - index * 9}</strong></article>
          ))}
        </section>
      </section>
    </section>
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
  const [onboardingNotice, setOnboardingNotice] = useState("Select a state to inspect rollout readiness.");
  const selectedProject = dashboard.projects.find((project) => project.id === selectedProjectId) ?? dashboard.projects[0] ?? fallbackProject;

  useEffect(() => {
    if (!dashboard.projects.some((project) => project.id === selectedProjectId)) {
      setSelectedProjectId(dashboard.projects[0]?.id ?? fallbackProject.id);
    }
  }, [dashboard.projects, selectedProjectId]);

  function openProjectRoom(projectId: string) {
    setActiveProjectId(projectId);
    setPage("priorities");
  }

  function selectAndOpen(projectId: string) {
    setSelectedProjectId(projectId);
    setDrawerOpen(true);
  }

  return (
    <section className="explore-workspace">
      <section className="panel gis-surface-panel">
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
            <button key={item.state} onClick={() => setOnboardingNotice(`${item.state}: ${item.readiness}% ready across ${item.constituencies} constituencies and ${item.districts} districts.`)} type="button">
              <span>{item.state}</span>
              <strong>{item.readiness}%</strong>
              <small>{item.constituencies} constituencies · {item.districts} districts</small>
            </button>
          ))}
        </div>
        <p className="action-status" role="status">{onboardingNotice}</p>
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
  const [mapState, setMapState] = useState<MapLoadState>(maps.enabled ? "idle" : "fallback");
  const [fallbackReason, setFallbackReason] = useState(maps.enabled ? "" : "Map SDK key is not configured.");
  const [gisAction, setGisAction] = useState("Ready to run GIS analysis.");
  const hotspots = useMemo(() => buildMapHotspots(dashboard), [dashboard]);
  const selectedProject = dashboard.projects.find((project) => project.id === selectedProjectId) ?? dashboard.projects[0] ?? fallbackProject;
  const gisLayers = [
    { label: "Roads", color: "#ef4444", active: true },
    { label: "Schools", color: "#f59e0b", active: true },
    { label: "Hospitals", color: "#22c55e", active: true },
    { label: "PHCs", color: "#14b8a6", active: true },
    { label: "Water Pipelines", color: "#3b82f6", active: true },
    { label: "Citizen Complaints", color: "#7c3aed", active: true },
    { label: "Development Projects", color: "#0f766e", active: true },
    { label: "Flood Zones", color: "#06b6d4", active: false },
    { label: "Weather", color: "#64748b", active: false },
    { label: "Population Density", color: "#e11d48", active: true },
    { label: "Satellite Imagery", color: "#475569", active: false },
    { label: "Demand Heatmaps", color: "#dc2626", active: true }
  ];

  useEffect(() => {
    if (!maps.enabled || hotspots.length === 0 || !mapRef.current) {
      setFallbackReason(!maps.enabled ? "Map SDK key is not configured." : "No hotspot coordinates available for the current filters.");
      setMapState("fallback");
      return;
    }

    if (maps.provider === "mappls" && maps.mapplsKey) {
      let cancelled = false;
      const activateFallback = (reason: string) => {
        if (cancelled) return;
        setFallbackReason(reason);
        if (mapRef.current) mapRef.current.replaceChildren();
        setMapState("fallback");
      };
      setFallbackReason("");
      setMapState("loading");
      loadMapplsMaps(maps.mapplsKey)
        .then(() => {
          if (cancelled || !mapRef.current || !window.mappls?.Map) return;
          mapRef.current.replaceChildren();
          mapRef.current.id ||= `mappls-${Math.random().toString(36).slice(2)}`;
          const center = hotspots[0] ?? { lat: 28.6139, lng: 77.2090 };
          const map = new window.mappls.Map(mapRef.current.id, {
            center: [center.lat, center.lng],
            zoom: hotspots.length > 1 ? 5 : 12,
            geolocation: false,
            clickableIcons: false
          });
          if (window.mappls.Marker) {
            hotspots.forEach((hotspot, index) => {
              try {
                new window.mappls!.Marker!({
                  map,
                  position: { lat: hotspot.lat, lng: hotspot.lng },
                  title: `${index + 1}. ${hotspot.category} - ${hotspot.ward}`,
                  draggable: false
                });
              } catch {
                // Mappls marker API varies by SDK version. Base map remains usable.
              }
            });
          }
          setMapState("ready");
        })
        .catch(() => activateFallback("Mappls Map SDK failed to load. Showing the live OpenStreetMap tile layer."));
      return () => {
        cancelled = true;
      };
    }

    let cancelled = false;
    let mapErrorTimer = 0;
    const originalConsoleError = window.console.error;
    const originalAuthFailure = window.gm_authFailure;
    const activateFallback = (reason: string) => {
      if (cancelled) return;
      setFallbackReason(reason);
      if (mapRef.current) mapRef.current.replaceChildren();
      setMapState("fallback");
    };
    window.gm_authFailure = () => {
      activateFallback("Google Maps rejected the browser key. Showing the live OpenStreetMap tile layer.");
      originalAuthFailure?.();
    };
    window.console.error = (...args: unknown[]) => {
      const message = args.map(String).join(" ");
      if (!cancelled && /Maps Demo Key limit reached|Google Maps JavaScript API error|Quota|RefererNotAllowedMapError|ApiNotActivatedMapError/.test(message)) {
        activateFallback("Google Maps demo-key quota or browser-key access failed. Showing the live OpenStreetMap tile layer.");
      }
      originalConsoleError.apply(window.console, args);
    };
    setFallbackReason("");
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
            activateFallback("Google Maps could not render in this browser session. Showing the live OpenStreetMap tile layer.");
          }
        }, 1500);
      })
      .catch(() => {
        activateFallback("Google Maps script failed to load. Showing the live OpenStreetMap tile layer.");
      });

    return () => {
      cancelled = true;
      if (mapErrorTimer) window.clearTimeout(mapErrorTimer);
      window.console.error = originalConsoleError;
      window.gm_authFailure = originalAuthFailure;
    };
  }, [hotspots, maps.enabled, maps.provider, maps.mapplsKey, maps.apiKey, maps.mapId, selectProject]);

  return (
    <div className="map-stack gis-dashboard">
      <div className="map-toolbar">
        <div>
          <strong>Geospatial demand hotspots</strong>
          <span>Premium GIS control room · {hotspots.length} ward-level signals · {boundaries.features.length} boundary features · {clusters.clusters.length} AI clusters</span>
        </div>
        <small className={`map-state ${mapState}`}>{mapStatusText(mapState, maps.provider)}</small>
      </div>
      <div className="map-layout gis-layout">
        <aside className="gis-control-panel" aria-label="GIS layer controls">
          <section>
            <h4>Layers</h4>
            <div className="gis-layer-list">
              {gisLayers.map((layer) => (
                <label key={layer.label}>
                  <input type="checkbox" defaultChecked={layer.active} />
                  <i style={{ background: layer.color }} />
                  <span>{layer.label}</span>
                </label>
              ))}
            </div>
          </section>
          <section>
            <h4>Filters</h4>
            <select aria-label="GIS issue filter" defaultValue="All issue types">
              <option>All issue types</option>
              <option>Roads</option>
              <option>Healthcare</option>
              <option>Water Supply</option>
              <option>Education</option>
            </select>
            <select aria-label="GIS confidence filter" defaultValue="High confidence">
              <option>High confidence</option>
              <option>All confidence levels</option>
              <option>Needs verification</option>
            </select>
          </section>
          <section>
            <h4>Timeline</h4>
            <input aria-label="GIS timeline slider" defaultValue="72" max="100" min="0" type="range" />
            <div className="gis-time-row"><span>Jan</span><b>Current batch</b><span>Dec</span></div>
          </section>
          <section>
            <h4>Analysis</h4>
            <div className="gis-tool-grid">
              <button onClick={() => setGisAction(`Route analysis created from ${selectedProject.ward} to nearest delivery cluster.`)} type="button">Route analysis</button>
              <button onClick={() => setGisAction(`2 km buffer applied around ${selectedProject.ward}; ${hotspots.length} hotspots checked.`)} type="button">Buffer 2 km</button>
              <button onClick={() => setGisAction(`Flood overlap checked for ${selectedProject.district}; at-risk layers highlighted.`)} type="button">Flood overlap</button>
              <button onClick={() => setGisAction(`${boundaryLevel} boundary clip applied to current demand layer.`)} type="button">Boundary clip</button>
            </div>
          </section>
          <p className="action-status" role="status">{gisAction}</p>
        </aside>

        <section className="gis-map-panel">
          <div className={`map-canvas india-map ${mapState === "ready" ? "google-ready" : ""}`}>
            <div ref={mapRef} className="google-map" aria-label="Google map of citizen issue hotspots" />
            {mapState !== "ready" ? <FallbackSignalMap hotspots={hotspots} selectedProjectId={selectedProjectId} selectProject={selectProject} /> : null}
            <div className="gis-map-actions" aria-label="GIS map tools">
              <button onClick={() => setGisAction(`AI hotspot detection refreshed ${hotspots.length} ward signals.`)} type="button">AI hotspot detection</button>
              <button onClick={() => setGisAction(`${clusters.clusters.length} cluster markers loaded on the map.`)} type="button">Cluster markers</button>
              <button onClick={() => setGisAction("Demand heatmap overlay toggled for current filters.")} type="button">Demand heatmap</button>
            </div>
            <div className="gis-scale">5 km</div>
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
        </section>

        <aside className="gis-insight-panel" aria-label="GIS AI location insights">
          <div className="gis-ai-badge"><Bot size={15} /> AI hotspot detection active</div>
          <h3>{selectedProject.ward}</h3>
          <p>{selectedProject.category} demand cluster in {selectedProject.district}, {selectedProject.state}.</p>
          <div className="gis-score-grid">
            <span><b>{selectedProject.score}</b>Priority</span>
            <span><b>{formatCount(selectedProject.demandCount)}</b>Signals</span>
            <span><b>{Math.round(selectedProject.confidence * 100)}%</b>Confidence</span>
          </div>
          <section>
            <h4>AI Insights</h4>
            <p>{selectedProject.rationale}</p>
          </section>
          <section>
            <h4>Citizen Feedback</h4>
            <ul>{selectedProject.evidence.slice(0, 3).map((item) => <li key={item}>{item}</li>)}</ul>
          </section>
          <section>
            <h4>Project Details</h4>
            <p>{selectedProject.title}</p>
            <button onClick={() => selectProject(selectedProject.id)} type="button">Open supporting evidence</button>
          </section>
        </aside>
      </div>
      {mapState === "fallback" ? (
        <p className="map-note">
          {fallbackReason || "Google Maps is unavailable. Showing the live OpenStreetMap tile layer with the same backend hotspot coordinates."}
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
  const tileMap = useMemo(() => buildTileFallbackState(hotspots), [hotspots]);
  return (
    <div className="fallback-map osm-fallback-map" aria-label="Live tile-map fallback">
      <div className="osm-tile-layer" aria-hidden="true">
        {tileMap.tiles.map((tile) => (
          <img
            alt=""
            decoding="async"
            draggable={false}
            key={`${tileMap.zoom}-${tile.x}-${tile.y}`}
            loading="eager"
            src={tile.url}
            style={{ left: `${tile.left}%`, top: `${tile.top}%`, width: `${tile.width}%`, height: `${tile.height}%` }}
          />
        ))}
      </div>
      <div className="osm-map-tint" aria-hidden="true" />
      {hotspots.map((hotspot, index) => {
        const position = tileProjection(hotspot.lat, hotspot.lng, tileMap);
        return (
          <button
            className={`hotspot ${hotspot.projectId === selectedProjectId ? "selected" : ""}`}
            key={`${hotspot.projectId}-${index}`}
            style={{
              left: `${position.x}%`,
              top: `${position.y}%`,
              width: `${44 + hotspot.intensity / 4}px`,
              height: `${44 + hotspot.intensity / 4}px`,
              ["--marker-offset-x" as string]: `${((index % 3) - 1) * 10}px`,
              ["--marker-offset-y" as string]: `${(Math.floor(index / 3) % 3 - 1) * 8}px`
            }}
            onClick={() => selectProject(hotspot.projectId)}
            title={`${hotspot.category} in ${hotspot.ward}`}
          >
            {index + 1}
          </button>
        );
      })}
      <div className="osm-attribution">Map tiles © OpenStreetMap contributors</div>
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
  const [selectedFacet, setSelectedFacet] = useState("No area facet selected.");
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
            <button key={item.label} onClick={() => setSelectedFacet(`${item.label} facet selected with ${item.count} ranked signals.`)} type="button">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.count} ranked signals</small>
            </button>
          ))}
        </div>
        <p className="action-status" role="status">{selectedFacet}</p>
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

function buildTileFallbackState(hotspots: Array<Hotspot & { projectId: string }>): TileFallbackState {
  const points = hotspots.length ? hotspots : [{ lat: 22.9, lng: 79.2 }];
  const lats = points.map((point) => point.lat);
  const lngs = points.map((point) => point.lng);
  const latSpan = Math.max(...lats) - Math.min(...lats);
  const lngSpan = Math.max(...lngs) - Math.min(...lngs);
  const maxSpan = Math.max(latSpan, lngSpan);
  const zoom = maxSpan > 14 ? 5 : maxSpan > 6 ? 6 : maxSpan > 2.5 ? 7 : maxSpan > 1 ? 9 : 11;
  const centerLat = lats.reduce((sum, value) => sum + value, 0) / points.length;
  const centerLng = lngs.reduce((sum, value) => sum + value, 0) / points.length;
  const centerX = lngToTileX(centerLng, zoom);
  const centerY = latToTileY(centerLat, zoom);
  const cols = zoom <= 6 ? 5.6 : 4.6;
  const rows = zoom <= 6 ? 4.2 : 3.4;
  const minX = centerX - cols / 2;
  const maxX = centerX + cols / 2;
  const minY = Math.max(0, centerY - rows / 2);
  const maxY = centerY + rows / 2;
  const tileMinX = Math.floor(minX);
  const tileMaxX = Math.ceil(maxX);
  const tileMinY = Math.floor(minY);
  const tileMaxY = Math.ceil(maxY);
  const worldTiles = 2 ** zoom;
  const tiles: TileFallbackState["tiles"] = [];

  for (let x = tileMinX; x < tileMaxX; x += 1) {
    for (let y = tileMinY; y < tileMaxY; y += 1) {
      if (y < 0 || y >= worldTiles) continue;
      const wrappedX = ((x % worldTiles) + worldTiles) % worldTiles;
      tiles.push({
        x,
        y,
        url: `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${y}.png`,
        left: ((x - minX) / (maxX - minX)) * 100,
        top: ((y - minY) / (maxY - minY)) * 100,
        width: (1 / (maxX - minX)) * 100,
        height: (1 / (maxY - minY)) * 100
      });
    }
  }

  return { zoom, minX, maxX, minY, maxY, tiles };
}

function tileProjection(lat: number, lng: number, tileMap: TileFallbackState) {
  const x = lngToTileX(lng, tileMap.zoom);
  const y = latToTileY(lat, tileMap.zoom);
  return {
    x: Math.min(94, Math.max(6, ((x - tileMap.minX) / (tileMap.maxX - tileMap.minX)) * 100)),
    y: Math.min(90, Math.max(10, ((y - tileMap.minY) / (tileMap.maxY - tileMap.minY)) * 100))
  };
}

function lngToTileX(lng: number, zoom: number) {
  return ((lng + 180) / 360) * 2 ** zoom;
}

function latToTileY(lat: number, zoom: number) {
  const clampedLat = Math.max(-85.0511, Math.min(85.0511, lat));
  const radians = clampedLat * Math.PI / 180;
  return ((1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2) * 2 ** zoom;
}

function mapStatusText(state: MapLoadState, provider?: ClientConfig["maps"]["provider"]) {
  if (state === "ready") return provider === "mappls" ? "Mappls live" : "Google Maps live";
  if (state === "loading") return "Loading map";
  return "Live tile map";
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

function loadMapplsMaps(key: string): Promise<void> {
  if (window.mappls?.Map) return Promise.resolve();
  if (window.__loksetuMapplsPromise) return window.__loksetuMapplsPromise;

  window.__loksetuMapplsPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    window.__loksetuMapplsLoaded = () => resolve();
    script.src = `https://apis.mappls.com/advancedmaps/api/${encodeURIComponent(key)}/map_sdk?layer=vector&v=3.0&callback=__loksetuMapplsLoaded`;
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error("Mappls Maps failed to load"));
    document.head.appendChild(script);
  });

  return window.__loksetuMapplsPromise;
}

function CopilotPage({ capabilities, ragStatus, projects }: { capabilities: CopilotCapabilitiesResponse | null; ragStatus: RagStatusResponse | null; projects: RankedProject[] }) {
  const prompts = ["Compare roads vs healthcare", "Which villages lack PHCs?", "Show delayed projects", "Summarize citizen feedback"];
  const [role, setRole] = useState<"mp" | "collector" | "citizen" | "analyst">("mp");
  const [language, setLanguage] = useState("English");
  const [mode, setMode] = useState<"online" | "submitted" | "all">("all");
  const [stateFilter, setStateFilter] = useState("Punjab");
  const [districtFilter, setDistrictFilter] = useState("Ludhiana");
  const [constituencyFilter, setConstituencyFilter] = useState("Ludhiana South");
  const [timeRange, setTimeRange] = useState("Last 2 Years");
  const [topic, setTopic] = useState("Roads");
  const [question, setQuestion] = useState("Why are road complaints increasing in Ludhiana South?");
  const [projectId, setProjectId] = useState("");
  const [messages, setMessages] = useState<Array<{ id: string; role: "assistant" | "user"; text: string; answer?: CopilotAnswer }>>([
    {
      id: "welcome",
      role: "assistant",
      text: "Ask about priorities, project evidence, source coverage, budget paths, public meeting notes, maps, or what changed today. Answers are retrieved from the current JanVaani AI intelligence corpus and cite the supporting records."
    }
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [actionNotice, setActionNotice] = useState("Assistant actions ready.");
  const [streamingSteps, setStreamingSteps] = useState<string[]>([]);
  const threadRef = useRef<HTMLDivElement>(null);

  const latestAnswer = [...messages].reverse().find((message) => message.answer)?.answer ?? null;
  const confidence = latestAnswer?.confidence ?? 97;
  const sourceCounts = buildGroundingSources(latestAnswer, ragStatus);
  const evidenceItems = (
    latestAnswer?.evidence.length
      ? latestAnswer.evidence.map((item, index) => ({ type: item.type, id: `evidence-${index}`, title: item.type, snippet: item.text }))
      : latestAnswer?.citations.length
        ? latestAnswer.citations
        : latestAnswer?.retrievedContext.map((item) => ({
            type: item.sourceType,
            id: item.id,
            title: item.title,
            snippet: item.snippet
          })) ?? []
  ).slice(0, 5);
  const selectedProject = projectId ? projects.find((project) => project.id === projectId) : projects[0];
  const relatedProjects = projects.slice(0, 3);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  async function askCopilot(nextQuestion = question) {
    const cleanQuestion = nextQuestion.trim();
    if (!cleanQuestion || busy) return;
    setBusy(true);
    setError("");
    setStreamingSteps(["Understanding question and filters"]);
    const userMessage = { id: `user-${Date.now()}`, role: "user" as const, text: cleanQuestion };
    setMessages((current) => [...current, userMessage]);
    if (cleanQuestion === question.trim()) setQuestion("");
    const groundedQuestion = [
      cleanQuestion,
      `Filters: state=${stateFilter}; district=${districtFilter}; constituency=${constituencyFilter}; timeRange=${timeRange}; topic=${topic}; mode=${mode}.`
    ].join("\n");
    try {
      setStreamingSteps((steps) => [...steps, mode === "online" ? "Fetching live web/news/social signals" : mode === "submitted" ? "Searching submitted citizen issues" : "Searching submitted issues and online signals"]);
      const response = await apiFetch("/api/copilot/query", {
        method: "POST",
        body: JSON.stringify({ role, mode, language, question: groundedQuestion, projectId: projectId || undefined })
      });
      if (!response.ok) {
        let message = "Copilot query failed";
        try {
          const errorPayload = await response.json() as { error?: string };
          message = errorPayload.error ?? message;
        } catch {
          message = response.statusText || message;
        }
        throw new Error(message);
      }
      setStreamingSteps((steps) => [...steps, "Grounding answer with citations and evidence"]);
      const payload = await response.json() as CopilotAnswer;
      setStreamingSteps((steps) => [...steps, "Answer ready"]);
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${payload.generatedAt}`,
          role: "assistant",
          text: payload.answer,
          answer: payload
        }
      ]);
    } catch (queryError) {
      setError(queryError instanceof Error ? queryError.message : "Copilot query failed");
    } finally {
      setBusy(false);
      window.setTimeout(() => setStreamingSteps([]), 1800);
    }
  }

  function askFollowUp(prompt: string) {
    setQuestion(prompt);
    setActionNotice(`Running follow-up: ${prompt}`);
    askCopilot(prompt);
  }

  function exportAnswer(format: string) {
    const text = latestAnswer?.answer ?? messages[messages.length - 1]?.text ?? "No answer generated yet.";
    const filename = `janvaani-answer-${format.toLowerCase().replaceAll(" ", "-")}.txt`;
    downloadTextFile(filename, `JanVaani AI ${format}\n\n${text}`);
    setActionNotice(`${format} generated and downloaded.`);
  }

  return (
    <section className="rag-command-page">
      <header className="rag-hero">
        <div>
          <h3>Grounded AI Assistant</h3>
          <p>Ask anything. Answers are backed by real data and sources.</p>
        </div>
        <div className="rag-hero-actions">
          <span>AI Confidence <b>{confidence}%</b></span>
          <button onClick={() => { setHistoryOpen((value) => !value); setActionNotice(historyOpen ? "History closed." : "History opened."); }} type="button">History</button>
          <button className="primary" onClick={() => { setMessages((current) => current.slice(0, 1)); setActionNotice("Started a new query thread."); }} type="button">New Query</button>
        </div>
      </header>
      {historyOpen ? (
        <section className="panel rag-history-panel" aria-label="Query history">
          <strong>Query History</strong>
          {messages.slice(-5).map((message) => <p key={message.id}>{message.role}: {message.text.slice(0, 120)}</p>)}
        </section>
      ) : null}
      <p className="action-status" role="status">{actionNotice}</p>

      <section className="rag-filters" aria-label="RAG filters">
        <label>Mode
          <select value={mode} onChange={(event) => setMode(event.target.value as typeof mode)} aria-label="RAG mode">
            <option value="online">Online mode</option>
            <option value="submitted">Submitted issue mode</option>
            <option value="all">All mode</option>
          </select>
        </label>
        <label>State
          <select value={stateFilter} onChange={(event) => setStateFilter(event.target.value)}>
            {["Punjab", "Delhi", "Uttar Pradesh", "Tamil Nadu", "West Bengal", "Maharashtra"].map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label>District
          <select value={districtFilter} onChange={(event) => setDistrictFilter(event.target.value)}>
            {["Ludhiana", "Central Delhi", "Lucknow", "Chennai", "Kolkata", "Nashik Rural"].map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label>Constituency
          <select value={constituencyFilter} onChange={(event) => setConstituencyFilter(event.target.value)}>
            {["Ludhiana South", "Central Delhi", "Lucknow", "Chennai Central", "Kolkata East"].map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label>Time Range
          <select value={timeRange} onChange={(event) => setTimeRange(event.target.value)}>
            {["Last 30 Days", "Last 1 Year", "Last 2 Years", "Current Batch"].map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label>Topic
          <select value={topic} onChange={(event) => setTopic(event.target.value)}>
            {["Roads", "Water", "Healthcare", "Education", "Employment", "Sanitation"].map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
      </section>

      <section className="rag-layout">
        <main className="rag-main">
          <form className="rag-query-box" onSubmit={(event) => { event.preventDefault(); askCopilot(); }}>
            <input aria-label="RAG question" value={question} onChange={(event) => setQuestion(event.target.value)} />
            <button className="primary" disabled={busy || !question.trim()} type="submit">Ask AI</button>
          </form>
          <div className="prompt-strip rag-prompts">
            <span>Suggested Questions:</span>
            {prompts.map((prompt) => <button disabled={busy} key={prompt} onClick={() => askFollowUp(prompt)} type="button">{prompt}</button>)}
          </div>
          {error ? <div className="error-state">{error}</div> : null}
          {streamingSteps.length ? (
            <div className="rag-stream-status" role="status" aria-live="polite">
              {streamingSteps.map((step, index) => <span key={`${step}-${index}`}>{step}</span>)}
            </div>
          ) : null}

          <section className="panel rag-answer-card" aria-label="AI answer">
            <header>
              <strong>AI Answer</strong>
              <mark>{latestAnswer ? `${latestAnswer.mode ?? mode} grounded` : `${mode} ready`}</mark>
            </header>
            <div className="rag-answer-grid">
              <div ref={threadRef}>
                {latestAnswer ? <AnswerContent text={latestAnswer.answer} /> : <p>Ask a question to retrieve online sources, submitted issues, or both. Current mode: {mode}.</p>}
                {busy ? <p>Retrieving JanVaani records and preparing a grounded answer...</p> : null}
                <h4>AI Recommendation</h4>
                <ul className="check-list">
                  {(latestAnswer?.suggestedActions ?? ["Use a specific ward, district, and topic for better grounding.", "Switch modes to control source coverage."]).slice(0, 4).map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
              <aside>
                <Metric label="Expected Impact" value={selectedProject ? `${formatCount(Math.max(1, selectedProject.demandCount * 1800))}` : "2.1 Lakh"} detail="Citizens benefited" />
                <Metric label="Confidence Score" value={`${confidence}%`} detail={`Based on ${sourceCounts.length} source groups`} />
              </aside>
            </div>
          </section>

          <section className="rag-evidence-grid">
            <section className="panel rag-evidence-list" aria-label="Key evidence">
              <PanelTitle title="Key Evidence" icon={CheckCircle2} />
              {(evidenceItems.length ? evidenceItems : [{ type: "mode", id: "waiting", title: "No answer yet", snippet: "Run a query to see retrieved sources." }]).map((item, index) => (
                <article key={`${item.type}-${item.id}`}>
                  <span>{index + 1}</span>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.snippet}</p>
                  </div>
                  <mark>{Math.max(88, confidence - index)}% Match</mark>
                </article>
              ))}
            </section>
            <section className="panel rag-map-card" aria-label="Evidence map">
              <PanelTitle title="Evidence Map" icon={MapPinned} detail="View Full Map" />
              <div className="rag-evidence-map">
                {Array.from({ length: 42 }, (_, index) => <i key={index} style={{ left: `${8 + (index * 17) % 84}%`, top: `${12 + (index * 23) % 72}%` }} />)}
                <strong>{districtFilter}</strong>
              </div>
            </section>
          </section>

          <section className="rag-bottom-grid">
            <section className="panel">
              <PanelTitle title="Timeline of Events" icon={TrendingUp} />
              <div className="rag-timeline">{["Jul 2024", "Sep 2024", "Nov 2024", "Mar 2025", "Jul 2025", "Jul 2026"].map((item) => <span key={item}>{item}</span>)}</div>
            </section>
            <section className="panel">
              <PanelTitle title="Related Projects" icon={Briefcase} />
              <div className="rag-project-list">
                {relatedProjects.map((project) => <button key={project.id} onClick={() => setProjectId(project.id)} type="button"><strong>{project.title}</strong><span>{project.status}</span></button>)}
              </div>
            </section>
            <section className="panel">
              <PanelTitle title="Ask Follow-up" icon={MessageSquareText} />
              <div className="rag-followups">{(latestAnswer?.followUpQuestions ?? prompts).slice(0, 4).map((item) => <button disabled={busy} key={item} onClick={() => askFollowUp(item)} type="button">{item}</button>)}</div>
            </section>
          </section>
        </main>

        <aside className="rag-source-rail">
          <section className="panel">
            <PanelTitle title={`Grounded By (${sourceCounts.reduce((sum, item) => sum + item.count, 0)} Sources)`} icon={Database} detail="View All" />
            <div className="rag-grounded-list">
              {sourceCounts.map((item) => <button key={item.label} onClick={() => setActionNotice(`${item.label} selected with ${formatCount(item.count)} supporting records.`)} type="button"><span>{item.icon}</span><strong>{item.label}</strong><em>{formatCount(item.count)}</em></button>)}
            </div>
          </section>
          <section className="panel">
            <PanelTitle title="How AI Reached This Answer" icon={Scale} detail="View Details" />
            <div className="rag-donut-card">
              <strong>{confidence}%<span>Confidence</span></strong>
              {sourceCounts.slice(0, 6).map((item) => <p key={item.label}>{item.label}<b>{Math.max(4, Math.round((item.count / Math.max(1, sourceCounts[0]?.count ?? 1)) * 42))}%</b></p>)}
            </div>
          </section>
          <section className="panel">
            <PanelTitle title="Export Answer" icon={FileText} />
            <div className="rag-export-grid">
              {["Export PDF", "Export Word", "Export PPT", "Share Answer"].map((item) => <button key={item} onClick={() => exportAnswer(item)} type="button">{item}</button>)}
            </div>
          </section>
        </aside>
      </section>
    </section>
  );
}

function buildGroundingSources(answer: CopilotAnswer | null, ragStatus: RagStatusResponse | null) {
  if (answer?.citations.length || answer?.retrievedContext.length || answer?.evidence.length) {
    const counts = [
      ...answer.citations.map((item) => item.type),
      ...answer.retrievedContext.map((item) => item.sourceType),
      ...answer.evidence.map((item) => item.type)
    ]
      .reduce<Record<string, number>>((acc, item) => {
        acc[item] = (acc[item] ?? 0) + 1;
        return acc;
      }, {});
    return Object.entries(counts).map(([label, count]) => ({ label: titleCase(label), count, icon: sourceIcon(label) }));
  }
  const statusCounts = Object.entries(ragStatus?.bySource ?? {});
  if (statusCounts.length) return statusCounts.map(([label, count]) => ({ label: titleCase(label), count, icon: sourceIcon(label) }));
  const corpusDocuments = ragStatus?.corpusDocuments ?? 0;
  return [
    { label: "Indexed RAG Documents", count: corpusDocuments, icon: "◇" },
    { label: "Submitted Issues", count: 0, icon: "●" },
    { label: "Online Signals", count: 0, icon: "▣" },
    { label: "Government Documents", count: 0, icon: "□" }
  ];
}

function titleCase(value: string) {
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function sourceIcon(value: string) {
  const lower = value.toLowerCase();
  if (lower.includes("citizen") || lower.includes("submission")) return "●";
  if (lower.includes("news") || lower.includes("online")) return "▣";
  if (lower.includes("government") || lower.includes("document")) return "□";
  if (lower.includes("traffic")) return "⬡";
  return "◇";
}

type KnowledgeDoc = {
  id: string;
  title: string;
  kind: string;
  owner: string;
  updated: string;
  status: "indexed" | "processing" | "review";
  chunks: number;
  citations: number;
  summary: string;
};

const knowledgeDocs: KnowledgeDoc[] = [
  { id: "kb-policy-01", title: "Delhi Roads Maintenance Policy 2026", kind: "Policy PDF", owner: "PWD", updated: "Today", status: "indexed", chunks: 184, citations: 31, summary: "Sets road-resurfacing thresholds, contractor SLAs, and escalation rules for ward-level maintenance." },
  { id: "kb-plan-02", title: "Central Delhi Development Plan", kind: "Development Plan", owner: "District Office", updated: "Yesterday", status: "indexed", chunks: 246, citations: 44, summary: "Maps current infrastructure gaps to sanctioned works across roads, PHCs, schools, drainage, and water supply." },
  { id: "kb-complaints-03", title: "Citizen Complaints Batch · Kalindi Nagar", kind: "Citizen Complaints", owner: "JanVaani Intake", updated: "2 hours ago", status: "processing", chunks: 92, citations: 18, summary: "Repeated complaints mention school sanitation, blocked drains, streetlight outages, and damaged approach roads." },
  { id: "kb-news-04", title: "Local News Articles · Public Works", kind: "News Articles", owner: "News API", updated: "4 hours ago", status: "indexed", chunks: 118, citations: 27, summary: "News coverage highlights monsoon damage, traffic delays, and public-health pressure points in dense wards." },
  { id: "kb-census-05", title: "Census Ward Profile 2011 + 2021 Projections", kind: "Census Report", owner: "Data Office", updated: "Jun 2026", status: "indexed", chunks: 76, citations: 16, summary: "Population density, household water access, literacy, employment, and age distribution by ward cluster." },
  { id: "kb-satellite-06", title: "Satellite Change Detection Tiles", kind: "Satellite Images", owner: "Maps Layer", updated: "Jun 2026", status: "review", chunks: 38, citations: 9, summary: "Imagery flags probable road damage, encroachment, waterlogging, and open-drain expansion." },
  { id: "kb-project-07", title: "Road Upgrade Project Reports", kind: "Project Reports", owner: "Engineering Cell", updated: "May 2026", status: "indexed", chunks: 129, citations: 21, summary: "DPR, budget utilization, milestone delays, contractor notes, and completion-risk scoring." },
  { id: "kb-minutes-08", title: "MP Review Meeting Minutes", kind: "Meeting Minutes", owner: "MP Office", updated: "May 2026", status: "indexed", chunks: 54, citations: 13, summary: "Action items, officer commitments, procurement blockers, and next-review dates from constituency meetings." },
  { id: "kb-circular-09", title: "Government Circulars · Health and Roads", kind: "Government Circular", owner: "Govt Portal", updated: "Apr 2026", status: "indexed", chunks: 63, citations: 11, summary: "Circulars covering maintenance grants, PHC staffing norms, and emergency monsoon response procedures." }
];

function KnowledgeBasePage() {
  const [selectedDocId, setSelectedDocId] = useState(knowledgeDocs[0].id);
  const [uploadNotice, setUploadNotice] = useState("No upload batch selected.");
  const selectedDoc = knowledgeDocs.find((doc) => doc.id === selectedDocId) ?? knowledgeDocs[0];
  const totalChunks = knowledgeDocs.reduce((sum, doc) => sum + doc.chunks, 0);
  const indexedDocs = knowledgeDocs.filter((doc) => doc.status === "indexed").length;
  const pipeline = [
    { label: "Upload", value: 100, detail: "9 source types connected" },
    { label: "OCR", value: 91, detail: "2 image sets in review" },
    { label: "Chunking", value: 86, detail: `${formatCount(totalChunks)} chunks prepared` },
    { label: "Embedding", value: 78, detail: "768-d vectors building" },
    { label: "Indexing", value: 72, detail: "Hybrid BM25 + vector" }
  ];
  const graphNodes = [
    { label: "Road policy", x: 50, y: 42, tone: "blue" },
    { label: "Complaints", x: 170, y: 84, tone: "orange" },
    { label: "Projects", x: 300, y: 52, tone: "green" },
    { label: "Census", x: 104, y: 186, tone: "purple" },
    { label: "Satellite", x: 242, y: 196, tone: "red" }
  ];

  return (
    <section className="knowledge-page">
      <section className="panel kb-hero">
        <div>
          <p className="eyebrow">Enterprise Knowledge Base</p>
          <h3>Constituency intelligence library</h3>
          <p>Indexed documents, citizen evidence, policy context, and live RAG-ready records for grounded AI decisions.</p>
        </div>
        <div className="kb-health-grid">
          <article><span>Indexed Docs</span><strong>{indexedDocs}/{knowledgeDocs.length}</strong></article>
          <article><span>Vector Chunks</span><strong>{formatCount(totalChunks)}</strong></article>
          <article><span>Vector DB</span><strong>Healthy</strong></article>
          <article><span>Index Freshness</span><strong>12 min</strong></article>
        </div>
      </section>

      <section className="kb-toolbar panel">
        <label className="kb-search"><Search size={17} /><input placeholder="Search PDFs, policies, complaints, circulars, meeting minutes..." /></label>
        <select aria-label="Knowledge type filter" defaultValue="All sources">
          <option>All sources</option>
          <option>Policies</option>
          <option>Citizen complaints</option>
          <option>Satellite images</option>
          <option>Project reports</option>
        </select>
        <select aria-label="Knowledge status filter" defaultValue="Indexed and processing">
          <option>Indexed and processing</option>
          <option>Indexed only</option>
          <option>Needs review</option>
        </select>
      </section>

      <section className="kb-main-grid">
        <section className="panel kb-upload-card">
          <PanelTitle title="Upload and Ingest" icon={FileText} detail="drag-and-drop intake" />
          <div className="kb-dropzone">
            <DatabaseZap size={28} />
            <strong>Drop PDFs, scans, images, CSVs, minutes, or circulars</strong>
            <span>OCR, chunking, embedding, duplicate detection, and citation extraction run automatically.</span>
            <button onClick={() => setUploadNotice("Demo intake batch queued: OCR, chunking, embedding, and indexing started.")} type="button">Choose files</button>
          </div>
          <p className="action-status" role="status">{uploadNotice}</p>
          <div className="kb-pipeline">
            {pipeline.map((step) => (
              <article key={step.label}>
                <div><strong>{step.label}</strong><span>{step.value}%</span></div>
                <meter min="0" max="100" value={step.value} />
                <small>{step.detail}</small>
              </article>
            ))}
          </div>
        </section>

        <section className="panel kb-doc-list">
          <PanelTitle title="Indexed Sources" icon={Database} detail="SharePoint-style repository" />
          <div className="kb-doc-table">
            {knowledgeDocs.map((doc) => (
              <button className={doc.id === selectedDoc.id ? "active" : ""} key={doc.id} onClick={() => setSelectedDocId(doc.id)} type="button">
                <span>{doc.kind}</span>
                <strong>{doc.title}</strong>
                <small>{doc.owner} · {doc.updated}</small>
                <mark className={doc.status}>{doc.status}</mark>
              </button>
            ))}
          </div>
        </section>

        <section className="panel kb-preview">
          <PanelTitle title="Document Preview" icon={FileText} detail={selectedDoc.kind} />
          <div className="kb-preview-page">
            <span>{selectedDoc.owner}</span>
            <h4>{selectedDoc.title}</h4>
            <p>{selectedDoc.summary}</p>
            <ul>
              <li>OCR status: complete with 98.4% readable text confidence</li>
              <li>Chunking status: {formatCount(selectedDoc.chunks)} semantic chunks with section anchors</li>
              <li>Embedding status: latest vector index version linked to citations</li>
            </ul>
          </div>
          <div className="kb-version-list">
            <strong>Version History</strong>
            {["v3 · AI summary refreshed", "v2 · OCR corrections approved", "v1 · Original source indexed"].map((item) => <span key={item}>{item}</span>)}
          </div>
        </section>
      </section>

      <section className="kb-lower-grid">
        <section className="panel kb-ai-summary">
          <PanelTitle title="AI Summary and Citations" icon={Bot} detail="grounded answer context" />
          <p>{selectedDoc.summary}</p>
          <div className="kb-citations">
            {Array.from({ length: Math.min(4, selectedDoc.citations) }, (_, index) => (
              <article key={index}>
                <strong>[{index + 1}] {selectedDoc.title}</strong>
                <span>Page {index + 2}, paragraph {index + 4} · confidence {96 - index}%</span>
              </article>
            ))}
          </div>
        </section>

        <section className="panel kb-vector-card">
          <PanelTitle title="Vector Database" icon={DatabaseZap} detail="retrieval health" />
          <div className="kb-vector-grid">
            <article><span>Namespace</span><strong>janvaani/delhi-central</strong></article>
            <article><span>Embedding model</span><strong>text-embedding-004</strong></article>
            <article><span>Hybrid index</span><strong>BM25 + cosine</strong></article>
            <article><span>Indexing queue</span><strong>14 pending chunks</strong></article>
            <article><span>Storage</span><strong>8.7 GB / 25 GB</strong></article>
            <article><span>Recall check</span><strong>94%</strong></article>
          </div>
        </section>

        <section className="panel kb-graph-card">
          <PanelTitle title="Knowledge Graph" icon={Globe2} detail="evidence relationships" />
          <svg className="kb-graph" viewBox="0 0 360 250" role="img" aria-label="Knowledge graph visualization">
            <line x1="50" y1="42" x2="170" y2="84" />
            <line x1="170" y1="84" x2="300" y2="52" />
            <line x1="170" y1="84" x2="104" y2="186" />
            <line x1="300" y1="52" x2="242" y2="196" />
            <line x1="104" y1="186" x2="242" y2="196" />
            {graphNodes.map((node) => (
              <g className={`kb-node ${node.tone}`} key={node.label}>
                <circle cx={node.x} cy={node.y} r="22" />
                <text x={node.x} y={node.y + 39}>{node.label}</text>
              </g>
            ))}
          </svg>
        </section>
      </section>
    </section>
  );
}

function DataExplorerPage({ dashboard, demoData }: { dashboard: DashboardResponse; demoData: DemoDataStatus }) {
  const [queryNotice, setQueryNotice] = useState("Query not run yet.");
  const [activeExplorerFilter, setActiveExplorerFilter] = useState("No filter selected.");
  const [intakeAudit, setIntakeAudit] = useState<IntakeAuditResponse | null>(null);
  const [selectedIntakeId, setSelectedIntakeId] = useState("");
  const [pipelineNotice, setPipelineNotice] = useState("Scheduled batch mode. Use on-demand run during evaluation.");
  const rows = buildManagedProjects(dashboard.projects).slice(0, 8);
  const selectedIntake = intakeAudit?.entries.find((entry) => entry.rawIntakeId === selectedIntakeId) ?? intakeAudit?.entries[0];
  const rawStatus = intakeAudit?.rawStatus ?? {};
  const rawIntakeRows = Object.values(rawStatus).reduce((sum, count) => sum + count, 0);
  const discardedRows = rawStatus.discarded ?? 0;
  const activeRawRows = Math.max(0, rawIntakeRows - discardedRows);
  const citizenSubmissionRows = Math.max(demoData.visibleRows, activeRawRows, dashboard.totals.submissions);
  const liveProjectRows = Math.max(rows.length, dashboard.projects.length);
  const demandSignalRows = dashboard.projects.reduce((sum, project) => sum + project.demandCount, 0);
  const publicDatasetRows = Math.max(18, demoData.demoRows);
  const ragEvidenceRows = Math.max(942, (intakeAudit?.entries.length ?? 0) * 8 + dashboard.projects.length * 6);
  const sourceCards = [
    { name: "Citizen Submissions", rows: citizenSubmissionRows, freshness: activeRawRows ? `${formatCount(activeRawRows)} active raw intake` : "Live", health: "Ready" },
    { name: "Noise Gate", rows: discardedRows, freshness: "score <25 discarded", health: "Active" },
    { name: "Ranked Projects", rows: liveProjectRows, freshness: "Current batch", health: "Ready" },
    { name: "Demand Signals", rows: demandSignalRows, freshness: "15 min", health: "Ready" },
    { name: "Public Datasets", rows: publicDatasetRows, freshness: "Daily", health: "Partial" },
    { name: "Maps Layers", rows: 12, freshness: "Runtime", health: "Ready" },
    { name: "RAG Evidence", rows: ragEvidenceRows, freshness: "Indexed", health: "Ready" }
  ];
  const schemaFields = ["project_id", "category", "state", "district", "ward", "priority_score", "citizen_score", "aadhaar_ref", "confidence", "citizen_impact"];

  useEffect(() => {
    refreshIntakeAudit();
  }, []);

  async function refreshIntakeAudit() {
    try {
      const next = await requestJson<IntakeAuditResponse>("/api/intake/audit");
      setIntakeAudit(next);
      setSelectedIntakeId((current) => (next.entries.some((entry) => entry.rawIntakeId === current) ? current : next.entries[0]?.rawIntakeId ?? ""));
    } catch (error) {
      setPipelineNotice(error instanceof Error ? `Intake audit unavailable: ${error.message}` : "Intake audit unavailable.");
    }
  }

  async function runPipelineNow() {
    setPipelineNotice("Running on-demand AI pipeline...");
    try {
      const result = await requestJson<{ run: BatchRun }>("/api/batch/run?limit=10", { method: "POST" } as RequestInit);
      setPipelineNotice(`On-demand run ${result.run.status}: processed ${result.run.processed}, discarded ${result.run.discarded ?? 0}, failed ${result.run.failed}.`);
      await refreshIntakeAudit();
    } catch (error) {
      setPipelineNotice(error instanceof Error ? `On-demand run failed: ${error.message}` : "On-demand run failed.");
    }
  }

  return (
    <section className="explorer-page">
      <section className="panel explorer-hero">
        <div>
          <p className="eyebrow">Data Explorer</p>
          <h3>Constituency data workspace</h3>
          <p>Inspect live citizen signals, project rankings, public datasets, map layers, and indexed evidence before they feed AI dashboards.</p>
        </div>
        <div className="explorer-health">
          <article><span>Datasets</span><strong>{sourceCards.length}</strong></article>
          <article><span>Rows</span><strong>{formatCount(sourceCards.reduce((sum, item) => sum + item.rows, 0))}</strong></article>
          <article><span>Quality</span><strong>94%</strong></article>
          <article><span>Refresh</span><strong>Live</strong></article>
        </div>
      </section>

      <section className="explorer-source-grid">
        {sourceCards.map((source) => (
          <article className="panel explorer-source-card" key={source.name}>
            <span>{source.health}</span>
            <strong>{source.name}</strong>
            <small>{formatCount(source.rows)} records · {source.freshness}</small>
          </article>
        ))}
      </section>

      <section className="panel intake-audit-panel">
        <PanelTitle title="Awaaz Intake Audit Trail" icon={MessageSquareText} detail={intakeAudit?.processingMode ?? "loading"} />
        <div className="intake-audit-actions">
          <button className="primary" onClick={runPipelineNow} type="button">Run on-demand AI pipeline</button>
          <button onClick={refreshIntakeAudit} type="button">Refresh intake log</button>
          <span>{pipelineNotice}</span>
        </div>
        <div className="intake-audit-grid">
          <div className="intake-list" aria-label="Latest citizen submissions">
            {(intakeAudit?.entries ?? []).slice(0, 8).map((entry) => (
              <button className={entry.rawIntakeId === selectedIntake?.rawIntakeId ? "active" : ""} key={entry.rawIntakeId} onClick={() => setSelectedIntakeId(entry.rawIntakeId)} type="button">
                <strong>{entry.channel.toUpperCase()} · {entry.shortReceipt}</strong>
                <span>{entry.status} · {entry.placement.ward}</span>
                <small>
                  {entry.input.mediaType !== "none" ? entry.input.mediaType : "text"} · {entry.status === "discarded_noise" ? "discarded" : "reward"} {entry.reward.citizenScore ?? "pending"}/100 · {entry.identity.aadhaarMasked ?? "no Aadhaar"}
                </small>
              </button>
            ))}
            {!intakeAudit?.entries.length ? <p className="empty-state">No submitted Awaaz records yet. Submit from the citizen app, then run pipeline.</p> : null}
          </div>
          <div className="intake-detail" aria-label="Selected AI inference">
            {selectedIntake ? (
              <>
                <div className="intake-detail-head">
                  <div>
                    <span>Receipt</span>
                    <strong>{selectedIntake.shortReceipt}</strong>
                  </div>
                  <mark>{selectedIntake.status}</mark>
                </div>
                <dl>
                  <div><dt>AI tag</dt><dd>{selectedIntake.ai.category}</dd></div>
                  <div><dt>Language</dt><dd>{selectedIntake.ai.detectedLanguage ?? selectedIntake.input.language}</dd></div>
                  <div><dt>Region placed</dt><dd>{selectedIntake.placement.ward}, {selectedIntake.placement.district}, {selectedIntake.placement.state}</dd></div>
                  <div><dt>MP route</dt><dd>{selectedIntake.placement.mpId ?? "pending"}</dd></div>
                  <div><dt>Aadhaar</dt><dd>{selectedIntake.identity.aadhaarMasked ?? "not collected"} · {selectedIntake.identity.aadhaarVerified ? "verified" : "format only"}</dd></div>
                  <div><dt>Citizen score</dt><dd>{selectedIntake.reward.citizenScore ?? "pending"}/100 · {selectedIntake.reward.rewardBand}</dd></div>
                  <div><dt>Quality score</dt><dd>{selectedIntake.reward.qualityScore ?? "pending"}/100</dd></div>
                  <div><dt>Civic issue</dt><dd>{selectedIntake.ai.isCivicIssue === false ? "Needs review" : "Yes"}</dd></div>
                  <div><dt>AI runtime</dt><dd>{selectedIntake.ai.providerMode ?? "pending"} · {selectedIntake.ai.model ?? "pending"}</dd></div>
                </dl>
                {selectedIntake.reward.reasons.length ? (
                  <article>
                    <h4>Reward factors</h4>
                    <p>{selectedIntake.reward.reasons.join(" · ")}</p>
                  </article>
                ) : null}
                <article>
                  <h4>AI explanation</h4>
                  <p>{selectedIntake.ai.explanation}</p>
                </article>
                <article>
                  <h4>Normalized evidence</h4>
                  <p>{selectedIntake.ai.normalizedText || selectedIntake.ai.transcript || selectedIntake.ai.imageSummary || selectedIntake.input.text || "Pending batch inference."}</p>
                </article>
              </>
            ) : null}
          </div>
          <div className="intake-samples" aria-label="Evaluator test samples">
            <h4>Voice, image, text test kit</h4>
            {(intakeAudit?.samples ?? []).map((sample) => (
              <a href={sample.href} key={sample.href} download>
                <strong>{sample.type}</strong>
                <span>{sample.label}</span>
                <small>{sample.expected}</small>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="explorer-main-grid">
        <section className="panel explorer-query-card">
          <PanelTitle title="Query Builder" icon={Database} detail="reviewed source query" />
          <div className="explorer-query-box">
            <code>{`SELECT ward, category, priority_score, confidence\nFROM janvaani.projects\nWHERE confidence >= 0.75\nORDER BY priority_score DESC\nLIMIT 50;`}</code>
            <button onClick={() => setQueryNotice(`Query returned ${rows.length} reviewed project rows.`)} type="button">Run query</button>
          </div>
          <div className="explorer-filter-row">
            {["State", "District", "Category", "Confidence", "Date range"].map((item) => <button className={activeExplorerFilter === item ? "active" : ""} key={item} onClick={() => setActiveExplorerFilter(item)} type="button">{item}</button>)}
          </div>
          <p className="action-status" role="status">{queryNotice} Active filter: {activeExplorerFilter}</p>
        </section>

        <div className="explorer-side-stack">
          <section className="panel explorer-schema-card">
            <PanelTitle title="Schema Browser" icon={Search} detail="semantic fields" />
            <div className="explorer-schema-list">
              {schemaFields.map((field) => <span key={field}>{field}</span>)}
            </div>
          </section>

          <section className="panel explorer-quality-card">
            <PanelTitle title="Data Quality" icon={CheckCircle2} detail="pipeline checks" />
            <div className="explorer-quality-list">
              {["Deduplication complete", "PII safeguards active", "Geo coordinates validated", "Evidence citations linked"].map((item) => <article key={item}><CheckCircle2 size={15} /><span>{item}</span></article>)}
            </div>
          </section>
        </div>
      </section>

      <section className="panel explorer-table-card">
        <PanelTitle title="Live Data Preview" icon={FileText} detail="project ranking dataset" />
        <div className="explorer-table">
          <div className="table-head"><b>Ward</b><b>Category</b><b>Score</b><b>Confidence</b><b>Budget</b><b>Progress</b><b>Impact</b></div>
          {rows.map((row) => (
            <div key={row.id}>
              <span>{row.ward}</span>
              <span>{row.category}</span>
              <span>{row.score}</span>
              <span>{Math.round(row.confidence * 100)}%</span>
              <span>₹{row.budgetCr.toFixed(1)} Cr</span>
              <span>{row.progress}%</span>
              <span>{formatCount(row.citizenImpact)}</span>
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}

type ManagedProjectStatus = "ongoing" | "completed" | "delayed" | "proposed";
type ManagedProject = RankedProject & {
  department: string;
  budgetCr: number;
  spentCr: number;
  progress: number;
  contractor: string;
  startDate: string;
  completionDate: string;
  citizenImpact: number;
  aiRisk: number;
  deliveryStatus: ManagedProjectStatus;
};

function ProjectsManagementPage({ dashboard }: { dashboard: DashboardResponse }) {
  const managedProjects = useMemo(() => buildManagedProjects(dashboard.projects), [dashboard.projects]);
  const [selectedProjectId, setSelectedProjectId] = useState(managedProjects[0]?.id ?? fallbackProject.id);
  const [projectAction, setProjectAction] = useState("Project actions ready.");
  const selectedProject = managedProjects.find((project) => project.id === selectedProjectId) ?? managedProjects[0];
  const statusCounts = {
    ongoing: managedProjects.filter((project) => project.deliveryStatus === "ongoing").length,
    completed: managedProjects.filter((project) => project.deliveryStatus === "completed").length,
    delayed: managedProjects.filter((project) => project.deliveryStatus === "delayed").length,
    proposed: managedProjects.filter((project) => project.deliveryStatus === "proposed").length
  };
  const totalBudget = managedProjects.reduce((sum, project) => sum + project.budgetCr, 0);
  const totalSpent = managedProjects.reduce((sum, project) => sum + project.spentCr, 0);
  const kanbanColumns: Array<{ status: ManagedProjectStatus; title: string }> = [
    { status: "proposed", title: "Proposed" },
    { status: "ongoing", title: "Ongoing" },
    { status: "delayed", title: "Delayed" },
    { status: "completed", title: "Completed" }
  ];

  return (
    <section className="projects-page">
      <section className="panel pm-hero">
        <div>
          <p className="eyebrow">MP Project Command Center</p>
          <h3>Development projects management</h3>
          <p>Track constituency works from proposal to completion with risk, expenditure, milestones, evidence, and citizen impact in one place.</p>
        </div>
        <div className="pm-kpis">
          <article><span>Ongoing</span><strong>{statusCounts.ongoing}</strong></article>
          <article><span>Completed</span><strong>{statusCounts.completed}</strong></article>
          <article><span>Delayed</span><strong>{statusCounts.delayed}</strong></article>
          <article><span>Proposed</span><strong>{statusCounts.proposed}</strong></article>
        </div>
      </section>

      <section className="panel pm-toolbar">
        <label className="pm-search"><Search size={17} /><input placeholder="Search projects, departments, contractors, wards..." /></label>
        <select aria-label="Project status filter" defaultValue="All statuses">
          <option>All statuses</option>
          <option>Ongoing</option>
          <option>Completed</option>
          <option>Delayed</option>
          <option>Proposed</option>
        </select>
        <select aria-label="Project department filter" defaultValue="All departments">
          <option>All departments</option>
          <option>Public Works</option>
          <option>Health</option>
          <option>Education</option>
          <option>Water Board</option>
        </select>
      </section>

      <section className="pm-card-grid">
        {managedProjects.slice(0, 8).map((project) => (
          <button className={`panel pm-project-card ${project.id === selectedProject?.id ? "active" : ""}`} key={project.id} onClick={() => setSelectedProjectId(project.id)} type="button">
            <div className="pm-card-head">
              <span className={`pm-status ${project.deliveryStatus}`}>{project.deliveryStatus}</span>
              <b>Risk {project.aiRisk}/100</b>
            </div>
            <strong>{project.title}</strong>
            <small>{project.department} · {project.ward}</small>
            <div className="pm-progress-row"><span>{project.progress}% complete</span><meter min="0" max="100" value={project.progress} /></div>
            <dl>
              <div><dt>Budget</dt><dd>₹{project.budgetCr.toFixed(1)} Cr</dd></div>
              <div><dt>Contractor</dt><dd>{project.contractor}</dd></div>
              <div><dt>Start</dt><dd>{project.startDate}</dd></div>
              <div><dt>Due</dt><dd>{project.completionDate}</dd></div>
              <div><dt>Impact</dt><dd>{formatCount(project.citizenImpact)} citizens</dd></div>
            </dl>
          </button>
        ))}
      </section>

      <section className="pm-workgrid">
        <section className="panel pm-kanban">
          <PanelTitle title="Kanban Board" icon={Briefcase} detail="Linear/Jira delivery flow" />
          <div className="pm-kanban-grid">
            {kanbanColumns.map((column) => (
              <article key={column.status}>
                <h4>{column.title}</h4>
                {managedProjects.filter((project) => project.deliveryStatus === column.status).slice(0, 4).map((project) => (
                  <button className={project.id === selectedProject?.id ? "active" : ""} key={project.id} onClick={() => setSelectedProjectId(project.id)} type="button">
                    <strong>{project.title}</strong>
                    <span>{project.department} · {project.progress}%</span>
                  </button>
                ))}
              </article>
            ))}
          </div>
        </section>

        <section className="panel pm-gantt">
          <PanelTitle title="Timeline" icon={TrendingUp} detail="Gantt view" />
          <div className="pm-gantt-chart">
            {managedProjects.slice(0, 6).map((project, index) => (
              <article key={project.id}>
                <span>{project.ward}</span>
                <i style={{ marginLeft: `${(index % 4) * 8}%`, width: `${Math.max(18, project.progress * 0.62)}%` }}><b>{project.progress}%</b></i>
              </article>
            ))}
          </div>
        </section>

        <section className="panel pm-map-card">
          <PanelTitle title="District Project Map" icon={MapPinned} detail="interactive portfolio geography" />
          <div className="pm-district-map">
            {managedProjects.slice(0, 10).map((project, index) => (
              <button className={`pm-map-pin ${project.deliveryStatus}`} key={project.id} onClick={() => setSelectedProjectId(project.id)} style={{ left: `${14 + (index % 5) * 18}%`, top: `${18 + Math.floor(index / 5) * 38}%` }} type="button">
                {index + 1}
              </button>
            ))}
            <span>District boundary</span>
          </div>
        </section>

        <section className="panel pm-spend">
          <PanelTitle title="Expenditure Tracking" icon={Database} detail={`₹${totalSpent.toFixed(1)} Cr / ₹${totalBudget.toFixed(1)} Cr`} />
          <div className="pm-spend-bars">
            {managedProjects.slice(0, 5).map((project) => (
              <article key={project.id}>
                <div><strong>{project.ward}</strong><span>₹{project.spentCr.toFixed(1)} Cr spent</span></div>
                <meter min="0" max={project.budgetCr} value={project.spentCr} />
              </article>
            ))}
          </div>
        </section>
      </section>

      {selectedProject ? (
        <section className="pm-detail-grid">
          <section className="panel pm-milestones">
            <PanelTitle title="Milestone Tracker" icon={CheckCircle2} detail={selectedProject.title} />
            {["DPR approved", "Tender issued", "Work order released", "Site execution", "Citizen inspection"].map((item, index) => (
              <article className={index * 22 <= selectedProject.progress ? "done" : ""} key={item}>
                <span>{index + 1}</span>
                <strong>{item}</strong>
                <small>{index * 22 <= selectedProject.progress ? "Completed" : "Pending"}</small>
              </article>
            ))}
          </section>

          <section className="panel pm-alerts">
            <PanelTitle title="Delay Alerts" icon={Zap} detail="AI risk monitor" />
            <article><strong>{selectedProject.aiRisk >= 70 ? "High execution risk" : "Risk under watch"}</strong><span>Contractor progress and citizen feedback indicate {selectedProject.deliveryStatus} delivery status.</span></article>
            <article><strong>Budget utilization</strong><span>{Math.round((selectedProject.spentCr / selectedProject.budgetCr) * 100)}% of budget consumed for {selectedProject.progress}% physical progress.</span></article>
            <article><strong>Citizen impact</strong><span>{formatCount(selectedProject.citizenImpact)} residents depend on timely completion.</span></article>
          </section>

          <section className="panel pm-docs">
            <PanelTitle title="Documents and Media" icon={FileText} detail="evidence room" />
            <div className="pm-doc-list">
              {["DPR.pdf", "Tender notice.pdf", "Inspection notes.docx", "Budget release.xlsx"].map((doc) => <button key={doc} onClick={() => { downloadTextFile(doc.replace(/\.[^.]+$/, ".txt"), `${selectedProject.title}\n${doc}\nGenerated from JanVaani AI project room.`); setProjectAction(`${doc} opened and downloaded for ${selectedProject.ward}.`); }} type="button">{doc}</button>)}
            </div>
            <div className="pm-photo-grid">
              {["Before", "After", "Site photo", "Inspection"].map((item) => <button key={item} onClick={() => setProjectAction(`${item} media selected for ${selectedProject.ward}.`)} type="button">{item}</button>)}
            </div>
            <p className="action-status" role="status">{projectAction}</p>
          </section>

          <section className="panel pm-recommendations">
            <PanelTitle title="AI Recommendations" icon={Bot} detail="execution improvement" />
            <p>Prioritize weekly review with {selectedProject.department}, publish milestone photos, and resolve contractor blockers before the next citizen feedback cycle.</p>
            <ul>
              <li>Escalate delayed approvals older than 14 days.</li>
              <li>Link expenditure releases to measurable site progress.</li>
              <li>Schedule citizen verification for high-impact milestones.</li>
            </ul>
          </section>
        </section>
      ) : null}
    </section>
  );
}

function buildManagedProjects(projects: RankedProject[]): ManagedProject[] {
  const departments: Record<string, string> = {
    Roads: "Public Works",
    Water: "Water Board",
    Health: "Health Department",
    Healthcare: "Health Department",
    Education: "Education Department",
    Power: "Power Utility",
    Sanitation: "Municipal Services"
  };
  const statuses: ManagedProjectStatus[] = ["ongoing", "completed", "delayed", "proposed"];
  const templates = [
    { category: "Roads", title: "Resurface priority access road", ward: "Ludhiana South" },
    { category: "Health", title: "Upgrade PHC diagnostics and staffing", ward: "Gill Road" },
    { category: "Water", title: "Replace leaking water pipeline", ward: "Dugri Urban" },
    { category: "Education", title: "Repair classrooms and toilets", ward: "Kalindi Nagar" },
    { category: "Employment", title: "Set up skills and placement center", ward: "Focal Point" },
    { category: "Sanitation", title: "Construct covered drainage network", ward: "Samrala Road" },
    { category: "Power", title: "Install high-mast street lighting", ward: "River Market" },
    { category: "Roads", title: "Build pedestrian safety corridor", ward: "East Colony" }
  ];
  const source = projects.length ? projects : [fallbackProject];
  const portfolio = source.length >= 8
    ? source
    : templates.map((template, index) => {
      const base = source[index % source.length] ?? fallbackProject;
      return {
        ...base,
        id: `${base.id}-portfolio-${index}`,
        title: template.title,
        category: template.category,
        ward: template.ward,
        score: Math.max(58, Math.min(99, base.score - (index % 5) * 4 + (index % 2) * 3)),
        demandCount: Math.max(28, base.demandCount + index * 17),
        confidence: Math.max(0.68, Math.min(0.97, base.confidence - (index % 4) * 0.035)),
        urgencyScore: Math.max(8, base.urgencyScore + (index % 5)),
        demandScore: Math.max(20, base.demandScore + index * 3),
        evidence: base.evidence.length ? base.evidence : ["Citizen submissions", "Ward-level demand trend", "Public dataset match"]
      };
    });
  return portfolio.map((project, index) => {
    const deliveryStatus = statuses[index % statuses.length];
    const progress = deliveryStatus === "completed" ? 100 : deliveryStatus === "delayed" ? 42 + (index % 4) * 7 : deliveryStatus === "proposed" ? 12 + (index % 3) * 9 : 58 + (index % 5) * 6;
    const budgetCr = Number((1.8 + (project.score / 100) * 5.8 + (index % 4) * 0.7).toFixed(1));
    const spentCr = Number((budgetCr * Math.min(0.96, Math.max(0.12, progress / 100 + (deliveryStatus === "delayed" ? 0.16 : -0.04)))).toFixed(1));
    return {
      ...project,
      department: departments[project.category] ?? "District Administration",
      budgetCr,
      spentCr,
      progress,
      contractor: ["Nirman Infra", "Shakti Buildcon", "UrbanWorks JV", "Saraswati Engineers"][index % 4],
      startDate: `2026-${String(1 + (index % 6)).padStart(2, "0")}-15`,
      completionDate: `2026-${String(7 + (index % 5)).padStart(2, "0")}-28`,
      citizenImpact: Math.max(project.demandCount * 1600, 18000 + index * 4200),
      aiRisk: Math.min(96, Math.round(100 - project.confidence * 45 + (deliveryStatus === "delayed" ? 26 : 0) + (index % 3) * 4)),
      deliveryStatus
    };
  });
}

function RecommendationsPage({ dashboard }: { dashboard: DashboardResponse }) {
  const [category, setCategory] = useState("All Categories");
  const [selectedRecommendationId, setSelectedRecommendationId] = useState("");
  const recommendations = useMemo(() => buildManagedProjects(dashboard.projects)
    .map((project) => ({
      ...project,
      recommendationScore: Math.round(project.score * 0.48 + project.urgencyScore * 2.1 + project.demandScore * 0.72 + project.confidence * 18),
      costBenefit: Math.round((project.citizenImpact / Math.max(1, project.budgetCr * 100000)) * 100),
      priorityBand: project.score >= 85 ? "High" : project.score >= 68 ? "Medium" : "Low"
    }))
    .sort((a, b) => b.recommendationScore - a.recommendationScore), [dashboard.projects]);
  const filtered = category === "All Categories" ? recommendations : recommendations.filter((project) => project.category === category || (category === "Healthcare" && project.category === "Health"));
  const top = filtered.find((project) => project.id === selectedRecommendationId) ?? filtered[0] ?? recommendations[0];
  const categories = ["All Categories", "Roads", "Healthcare", "Water", "Education", "Employment"];
  const totalBudget = filtered.reduce((sum, project) => sum + project.budgetCr, 0);
  const totalBeneficiaries = filtered.reduce((sum, project) => sum + project.citizenImpact, 0);
  const districtGroups = [...filtered.reduce<Map<string, { district: string; score: number; budget: number; count: number }>>((acc, project) => {
    const current = acc.get(project.district) ?? { district: project.district, score: 0, budget: 0, count: 0 };
    current.score += project.recommendationScore;
    current.budget += project.budgetCr;
    current.count += 1;
    acc.set(project.district, current);
    return acc;
  }, new Map()).values()].map((item) => ({ ...item, score: Math.round(item.score / Math.max(1, item.count)) })).sort((a, b) => b.score - a.score);

  return (
    <section className="recommendations-page">
      <section className="panel rec-hero">
        <div>
          <p className="eyebrow">AI Recommendations</p>
          <h3>Prioritized development investments</h3>
          <p>Rank projects using citizen demand, public datasets, urgency, confidence, budget fit, and expected constituency impact.</p>
        </div>
        <div className="rec-impact-grid">
          <article><span>Recommended Budget</span><strong>₹{totalBudget.toFixed(1)} Cr</strong></article>
          <article><span>Beneficiaries</span><strong>{formatCount(totalBeneficiaries)}</strong></article>
          <article><span>Top Confidence</span><strong>{top ? Math.round(top.confidence * 100) : 0}%</strong></article>
          <article><span>High Priority</span><strong>{filtered.filter((project) => project.priorityBand === "High").length}</strong></article>
        </div>
      </section>

      <section className="panel rec-filterbar">
        {categories.map((item) => (
          <button className={category === item ? "active" : ""} key={item} onClick={() => setCategory(item)} type="button">{item}</button>
        ))}
      </section>

      <section className="rec-layout">
        <section className="panel rec-ranked-list">
          <PanelTitle title="AI-Ranked Recommendations" icon={Scale} detail={`${filtered.length} projects scored`} />
          <div className="rec-card-list">
            {filtered.slice(0, 6).map((project, index) => (
              <article className={`rec-card ${project.priorityBand.toLowerCase()}`} key={project.id}>
                <div className="rec-card-top">
                  <span>#{index + 1}</span>
                  <mark>{project.priorityBand} Priority</mark>
                </div>
                <h4>{project.title}</h4>
                <p>{project.department} · {project.district} · {project.ward}</p>
                <div className="rec-score-row">
                  <strong>{project.recommendationScore}</strong>
                  <meter min="0" max="100" value={Math.min(100, project.recommendationScore)} />
                </div>
                <dl>
                  <div><dt>Urgency</dt><dd>{project.urgencyScore}/20</dd></div>
                  <div><dt>Budget</dt><dd>₹{project.budgetCr.toFixed(1)} Cr</dd></div>
                  <div><dt>Beneficiaries</dt><dd>{formatCount(project.citizenImpact)}</dd></div>
                  <div><dt>Timeline</dt><dd>{project.startDate} → {project.completionDate}</dd></div>
                  <div><dt>Confidence</dt><dd>{Math.round(project.confidence * 100)}%</dd></div>
                  <div><dt>Evidence</dt><dd>{project.evidence.length} sources</dd></div>
                </dl>
              </article>
            ))}
          </div>
        </section>

        <section className="panel rec-map-panel">
          <PanelTitle title="Affected Regions Map" icon={MapPinned} detail="priority heat overlay" />
          <div className="rec-map">
            {filtered.slice(0, 12).map((project, index) => (
              <button className={`rec-map-dot ${project.priorityBand.toLowerCase()}`} key={project.id} onClick={() => setSelectedRecommendationId(project.id)} style={{ left: `${12 + (index % 4) * 22}%`, top: `${18 + Math.floor(index / 4) * 25}%` }} type="button">
                {project.recommendationScore}
              </button>
            ))}
            <span className="rec-map-boundary">District demand surface</span>
          </div>
          <div className="rec-legend"><span className="high">High</span><span className="medium">Medium</span><span className="low">Low</span></div>
        </section>

        <section className="panel rec-reasoning">
          <PanelTitle title="AI Reasoning" icon={Bot} detail={top?.title ?? "No project"} />
          <p className="action-status" role="status">{top ? `Selected recommendation: ${top.ward} (${top.priorityBand} priority).` : "No recommendation selected."}</p>
          {top ? (
            <>
              <p>{top.rationale}</p>
              <ul>
                <li>Citizen demand contributes {top.demandScore} demand points and {formatCount(top.demandCount)} direct signals.</li>
                <li>Public dataset confidence is {Math.round(top.confidence * 100)}% with {top.evidence.length} supporting evidence items.</li>
                <li>Expected impact reaches {formatCount(top.citizenImpact)} beneficiaries for ₹{top.budgetCr.toFixed(1)} Cr.</li>
              </ul>
            </>
          ) : <p>No recommendations match this filter.</p>}
        </section>
      </section>

      <section className="rec-analytics-grid">
        <section className="panel rec-cost">
          <PanelTitle title="Cost-Benefit Analysis" icon={Database} detail="beneficiaries per budget unit" />
          {filtered.slice(0, 5).map((project) => (
            <article key={project.id}>
              <div><strong>{project.ward}</strong><span>{project.costBenefit} impact index</span></div>
              <meter min="0" max="120" value={Math.min(120, project.costBenefit)} />
            </article>
          ))}
        </section>

        <section className="panel rec-districts">
          <PanelTitle title="District Comparison" icon={TrendingUp} detail="average recommendation score" />
          {districtGroups.slice(0, 5).map((district) => (
            <article key={district.district}>
              <span>{district.district}</span>
              <i style={{ width: `${Math.min(100, district.score)}%` }} />
              <strong>{district.score}</strong>
            </article>
          ))}
        </section>

        <section className="panel rec-budget">
          <PanelTitle title="Budget Allocation Suggestions" icon={DatabaseZap} detail="AI-balanced portfolio" />
          {["Fund top 3 high-priority works first", "Reserve 18% contingency for delayed tenders", "Shift low-confidence proposals to evidence review", "Bundle nearby road and drainage works"].map((item) => <p key={item}>{item}</p>)}
        </section>
      </section>

      <section className="panel rec-table-card">
        <PanelTitle title="Project Ranking Table" icon={FileText} detail="decision-ready queue" />
        <div className="rec-table">
          <div className="table-head"><b>Project</b><b>Category</b><b>Score</b><b>Budget</b><b>Beneficiaries</b><b>Priority</b></div>
          {filtered.slice(0, 8).map((project) => (
            <div key={project.id}>
              <span>{project.title}</span>
              <span>{project.category}</span>
              <span>{project.recommendationScore}</span>
              <span>₹{project.budgetCr.toFixed(1)} Cr</span>
              <span>{formatCount(project.citizenImpact)}</span>
              <mark className={project.priorityBand.toLowerCase()}>{project.priorityBand}</mark>
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}

function ReportsPage({ dashboard }: { dashboard: DashboardResponse }) {
  const projects = buildManagedProjects(dashboard.projects);
  const [selectedTemplate, setSelectedTemplate] = useState("Monthly Report");
  const [reportAction, setReportAction] = useState("Report actions ready.");
  const templates = [
    "Monthly Report",
    "Constituency Summary",
    "Citizen Feedback Analysis",
    "Budget Utilization",
    "Demand Signals",
    "Infrastructure Status",
    "Development Progress",
    "AI Recommendations"
  ];
  const topCategories = [...dashboard.projects.reduce<Map<string, number>>((acc, project) => {
    acc.set(project.category, (acc.get(project.category) ?? 0) + project.demandCount);
    return acc;
  }, new Map()).entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const totalBudget = projects.reduce((sum, project) => sum + project.budgetCr, 0);
  const beneficiaries = projects.reduce((sum, project) => sum + project.citizenImpact, 0);

  function exportReport(format: string) {
    downloadTextFile(`janvaani-${selectedTemplate.toLowerCase().replaceAll(" ", "-")}-${format.toLowerCase()}.txt`, `${selectedTemplate}\nFormat: ${format}\nBudget: ₹${totalBudget.toFixed(1)} Cr\nBeneficiaries: ${formatCount(beneficiaries)}`);
    setReportAction(`${selectedTemplate} exported as ${format}.`);
  }

  return (
    <section className="reports-page">
      <section className="panel reports-hero">
        <div>
          <p className="eyebrow">Official AI Reports</p>
          <h3>Generate constituency briefings</h3>
          <p>Create polished government-ready reports with AI summaries, charts, maps, tables, citations, and branded export packages.</p>
        </div>
        <div className="reports-export-actions">
          {["PDF", "PowerPoint", "Word", "Excel"].map((format) => <button key={format} onClick={() => exportReport(format)} type="button">Export {format}</button>)}
        </div>
      </section>
      <p className="action-status" role="status">{reportAction}</p>

      <section className="reports-template-grid">
        {templates.map((template, index) => (
          <button className={`panel report-template-card ${selectedTemplate === template ? "active" : ""}`} key={template} onClick={() => { setSelectedTemplate(template); setReportAction(`${template} template loaded into preview.`); }} type="button">
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{template}</strong>
            <small>{index % 2 === 0 ? "AI draft ready" : "Template configured"}</small>
          </button>
        ))}
      </section>

      <section className="reports-main-grid">
        <section className="panel report-preview-card">
          <PanelTitle title="Report Preview" icon={FileText} detail="official presentation layout" />
          <div className="report-cover">
            <span>JanVaani AI · MP Constituency Report</span>
            <h4>{selectedTemplate}</h4>
            <p>{formatCount(dashboard.totals.submissions)} citizen submissions, {projects.length} development projects, ₹{totalBudget.toFixed(1)} Cr tracked budget, and {formatCount(beneficiaries)} expected beneficiaries.</p>
          </div>
          <div className="report-preview-grid">
            {["Executive summary", "Priority map", "Budget table", "Evidence citations"].map((item) => <article key={item}>{item}</article>)}
          </div>
        </section>

        <section className="panel report-summary-card">
          <PanelTitle title="AI Executive Summary" icon={Bot} detail="editable draft" />
          <p>Citizen demand is concentrated around {topCategories[0]?.[0] ?? "infrastructure"} with visible project delivery pressure in high-density wards. AI recommends prioritizing high-confidence, high-beneficiary works and attaching citations for every public claim.</p>
          <ul>
            <li>{formatCount(dashboard.projects.reduce((sum, project) => sum + project.demandCount, 0))} demand signals processed.</li>
            <li>{projects.filter((project) => project.deliveryStatus === "delayed").length} projects require delay mitigation.</li>
            <li>{Math.round(average(dashboard.projects.map((project) => project.confidence)) * 100) || 86}% average evidence confidence.</li>
          </ul>
        </section>

        <section className="panel scheduled-reports">
          <PanelTitle title="Scheduled Reports" icon={RefreshCw} detail="automated delivery" />
          {["Monthly MP Briefing · 1st Monday", "Citizen Feedback Digest · Friday", "Budget Utilization · Month end", "AI Risk Watch · Daily 8 AM"].map((item) => <article key={item}><strong>{item}</strong><span>Share with MP office and district team</span></article>)}
        </section>
      </section>

      <section className="reports-analytics-grid">
        <section className="panel report-chart-card">
          <PanelTitle title="Demand Chart" icon={TrendingUp} detail="citizen priorities" />
          {topCategories.map(([category, demand]) => (
            <article key={category}><span>{category}</span><i style={{ width: `${Math.min(100, demand / Math.max(1, topCategories[0]?.[1] ?? 1) * 100)}%` }} /><strong>{formatCount(demand)}</strong></article>
          ))}
        </section>

        <section className="panel report-map-card">
          <PanelTitle title="Map Snapshot" icon={MapPinned} detail="affected regions" />
          <div className="report-map">
            {projects.slice(0, 8).map((project, index) => <i key={project.id} style={{ left: `${12 + (index % 4) * 22}%`, top: `${18 + Math.floor(index / 4) * 30}%` }}>{project.score}</i>)}
            <span>Constituency boundary</span>
          </div>
        </section>

        <section className="panel report-citations-card">
          <PanelTitle title="Citations" icon={Search} detail="source-backed claims" />
          {["Citizen complaint batch", "District development plan", "Budget release note", "News and public datasets"].map((item, index) => <article key={item}><strong>[{index + 1}] {item}</strong><span>Verified source · confidence {96 - index * 3}%</span></article>)}
        </section>
      </section>

      <section className="panel reports-table-card">
        <PanelTitle title="Report Data Table" icon={Database} detail="ready for Excel export" />
        <div className="reports-table">
          <div className="table-head"><b>Project</b><b>Department</b><b>Budget</b><b>Progress</b><b>Impact</b><b>Status</b></div>
          {projects.slice(0, 7).map((project) => (
            <div key={project.id}>
              <span>{project.title}</span>
              <span>{project.department}</span>
              <span>₹{project.budgetCr.toFixed(1)} Cr</span>
              <span>{project.progress}%</span>
              <span>{formatCount(project.citizenImpact)}</span>
              <mark>{project.deliveryStatus}</mark>
            </div>
          ))}
        </div>
      </section>

      <section className="panel reports-share-card">
        <PanelTitle title="Sharing and Branding" icon={Send} detail="official government presentation" />
        <div>
          <button onClick={() => setReportAction(`Secure link created for ${selectedTemplate}.`)} type="button">Share secure link</button>
          <button onClick={() => setReportAction(`${selectedTemplate} queued for MP office email.`)} type="button">Email MP office</button>
          <button onClick={() => setReportAction(`Cabinet note prepared from ${selectedTemplate}.`)} type="button">Prepare cabinet note</button>
          <button onClick={() => setReportAction("JanVaani AI branding applied to report package.")} type="button">Apply JanVaani AI branding</button>
        </div>
      </section>
    </section>
  );
}

type CompareLevel = "state" | "district" | "constituency";
type CompareRegion = {
  id: string;
  name: string;
  level: CompareLevel;
  projects: RankedProject[];
  population: number;
  roads: number;
  healthcare: number;
  education: number;
  water: number;
  employment: number;
  budget: number;
  satisfaction: number;
  demand: number;
  infrastructure: number;
  priority: number;
  completion: number;
};

const compareMetrics: Array<{ key: keyof CompareRegion; label: string; suffix?: string }> = [
  { key: "population", label: "Population" },
  { key: "roads", label: "Roads", suffix: "/100" },
  { key: "healthcare", label: "Healthcare", suffix: "/100" },
  { key: "education", label: "Education", suffix: "/100" },
  { key: "water", label: "Water Supply", suffix: "/100" },
  { key: "employment", label: "Employment", suffix: "/100" },
  { key: "budget", label: "Budget Utilization", suffix: "%" },
  { key: "satisfaction", label: "Citizen Satisfaction", suffix: "%" },
  { key: "demand", label: "Demand Signals" },
  { key: "infrastructure", label: "Infrastructure Index", suffix: "/100" },
  { key: "priority", label: "AI Priority Score", suffix: "/100" }
];

function ComparePage() {
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [level, setLevel] = useState<CompareLevel>("state");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    requestJson<DashboardResponse>("/api/priorities?scope=global")
      .then((next) => {
        if (cancelled) return;
        setDashboard(next);
        setError("");
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Comparison data unavailable");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const regions = useMemo(() => buildCompareRegions(dashboard?.projects ?? [], level), [dashboard, level]);

  useEffect(() => {
    setSelectedIds((current) => {
      const valid = current.filter((id) => regions.some((region) => region.id === id));
      return valid.length >= 2 ? valid : regions.slice(0, 3).map((region) => region.id);
    });
  }, [regions]);

  const selected = regions.filter((region) => selectedIds.includes(region.id)).slice(0, 5);
  const insights = buildCompareInsights(selected);

  function toggleRegion(id: string) {
    setSelectedIds((current) => {
      if (current.includes(id)) return current.length <= 2 ? current : current.filter((item) => item !== id);
      return [...current, id].slice(-5);
    });
  }

  return (
    <section className="compare-page">
      <section className="compare-hero panel">
        <div>
          <p className="eyebrow">Synchronized Analytics</p>
          <h3>Constituency Comparison Dashboard</h3>
          <p>Compare states, districts, or constituencies across citizen demand, infrastructure, budget, demographics, projects, and AI priority.</p>
        </div>
        <div className="compare-controls" aria-label="Comparison controls">
          <label>Compare Level
            <select value={level} onChange={(event) => setLevel(event.target.value as CompareLevel)} aria-label="Compare level">
              <option value="state">States</option>
              <option value="district">Districts</option>
              <option value="constituency">Constituencies</option>
            </select>
          </label>
          <span>{selected.length} synchronized regions</span>
        </div>
      </section>

      {error ? <div className="error-state">{error}</div> : null}

      <section className="panel compare-picker">
        {regions.slice(0, 12).map((region) => (
          <button className={selectedIds.includes(region.id) ? "active" : ""} key={region.id} onClick={() => toggleRegion(region.id)} type="button">
            <strong>{region.name}</strong>
            <span>{formatCount(region.demand)} signals</span>
          </button>
        ))}
      </section>

      <section className="compare-kpi-matrix">
        {compareMetrics.map((metric) => (
          <section className="panel compare-metric-card" key={String(metric.key)}>
            <h4>{metric.label}</h4>
            <div>
              {selected.map((region) => (
                <article key={region.id}>
                  <span>{region.name}</span>
                  <strong>{formatCompareValue(region[metric.key], metric.suffix)}</strong>
                </article>
              ))}
            </div>
          </section>
        ))}
      </section>

      <section className="compare-chart-grid">
        <section className="panel compare-chart-card">
          <PanelTitle title="Radar Comparison" icon={TrendingUp} detail="normalized strengths" />
          <div className="compare-radar-grid">{selected.map((region) => <RadarMini key={region.id} region={region} />)}</div>
        </section>
        <section className="panel compare-chart-card">
          <PanelTitle title="Budget Analysis" icon={Database} detail="utilization vs demand" />
          <CompareBars regions={selected} metric="budget" color="#5b35f5" />
          <CompareBars regions={selected} metric="demand" color="#f97316" compact />
        </section>
        <section className="panel compare-chart-card">
          <PanelTitle title="Trend Lines" icon={TrendingUp} detail="synchronized 6-month view" />
          <TrendMini regions={selected} />
        </section>
        <section className="panel compare-chart-card">
          <PanelTitle title="Infrastructure Heatmap" icon={MapPinned} detail="category intensity" />
          <CompareHeatmap regions={selected} />
        </section>
      </section>

      <section className="compare-analysis-grid">
        <section className="panel compare-chart-card">
          <PanelTitle title="Demographic Comparison" icon={Users} />
          <CompareBars regions={selected} metric="population" color="#0ea5e9" />
        </section>
        <section className="panel compare-chart-card">
          <PanelTitle title="Project Completion Rates" icon={CheckCircle2} />
          <CompareBars regions={selected} metric="completion" color="#16a34a" />
        </section>
        <section className="panel compare-chart-card">
          <PanelTitle title="AI-Generated Insights" icon={Bot} />
          <div className="compare-insights">
            {insights.map((item) => <p key={item}>{item}</p>)}
          </div>
        </section>
      </section>
    </section>
  );
}

function buildCompareRegions(projects: RankedProject[], level: CompareLevel): CompareRegion[] {
  const groups = new Map<string, RankedProject[]>();
  for (const project of projects) {
    const key = level === "state" ? project.state : level === "district" ? `${project.state} / ${project.district}` : project.mpName;
    groups.set(key, [...(groups.get(key) ?? []), project]);
  }
  return [...groups.entries()].map(([name, items]) => {
    const byCategory = (category: string) => Math.round(average(items.filter((item) => item.category === category).map((item) => item.score)) || average(items.map((item) => item.score)) * 0.72);
    const demand = items.reduce((sum, item) => sum + item.demandCount, 0);
    const satisfaction = Math.round((average(items.map((item) => item.averageRating)) / 5) * 100);
    const infrastructure = Math.round(average([byCategory("Roads"), byCategory("Water"), byCategory("Power"), byCategory("Sanitation")]));
    return {
      id: `${level}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      name,
      level,
      projects: items,
      population: Math.max(125000, demand * 1800 + items.length * 42000),
      roads: byCategory("Roads"),
      healthcare: byCategory("Health"),
      education: byCategory("Education"),
      water: byCategory("Water"),
      employment: Math.round(average(items.map((item) => item.score)) * 0.68),
      budget: Math.min(98, Math.round(52 + average(items.map((item) => item.confidence)) * 38)),
      satisfaction,
      demand,
      infrastructure,
      priority: Math.round(Math.max(...items.map((item) => item.score), 0)),
      completion: Math.round((items.filter((item) => item.status === "approved").length / Math.max(1, items.length)) * 100)
    };
  }).sort((a, b) => b.priority - a.priority || b.demand - a.demand);
}

function formatCompareValue(value: CompareRegion[keyof CompareRegion], suffix?: string) {
  if (typeof value !== "number") return String(value);
  return `${formatCount(value)}${suffix ?? ""}`;
}

function RadarMini({ region }: { region: CompareRegion }) {
  const values = [region.roads, region.healthcare, region.education, region.water, region.employment, region.infrastructure];
  const points = values.map((value, index) => {
    const angle = (-90 + index * 60) * Math.PI / 180;
    const radius = 12 + (Math.min(100, value) / 100) * 42;
    return `${60 + Math.cos(angle) * radius},${60 + Math.sin(angle) * radius}`;
  }).join(" ");
  return (
    <article className="radar-mini">
      <svg viewBox="0 0 120 120" role="img" aria-label={`${region.name} radar chart`}>
        <polygon points="60,12 101,36 101,84 60,108 19,84 19,36" />
        <polygon className="value" points={points} />
      </svg>
      <strong>{region.name}</strong>
    </article>
  );
}

function CompareBars({ regions, metric, color, compact = false }: { regions: CompareRegion[]; metric: keyof CompareRegion; color: string; compact?: boolean }) {
  const max = Math.max(1, ...regions.map((region) => Number(region[metric]) || 0));
  return (
    <div className={`compare-bars ${compact ? "compact" : ""}`}>
      {regions.map((region) => {
        const value = Number(region[metric]) || 0;
        return <span key={region.id}><em>{region.name}</em><i style={{ background: color, width: `${Math.max(6, (value / max) * 100)}%` }} /><b>{formatCount(value)}</b></span>;
      })}
    </div>
  );
}

function TrendMini({ regions }: { regions: CompareRegion[] }) {
  return (
    <div className="trend-mini">
      {regions.map((region, index) => {
        const values = Array.from({ length: 6 }, (_, month) => Math.max(10, region.priority - 18 + month * 4 + index * 3));
        const points = values.map((value, month) => `${month * 48},${90 - value}`).join(" ");
        return <svg key={region.id} viewBox="0 0 240 100"><polyline points={points} /><text x="0" y={96 - index * 12}>{region.name}</text></svg>;
      })}
    </div>
  );
}

function CompareHeatmap({ regions }: { regions: CompareRegion[] }) {
  const keys: Array<keyof CompareRegion> = ["roads", "healthcare", "education", "water", "employment", "infrastructure"];
  return (
    <div className="compare-heatmap">
      <span />
      {keys.map((key) => <b key={String(key)}>{titleCase(String(key))}</b>)}
      {regions.flatMap((region) => [
        <strong key={`${region.id}-name`}>{region.name}</strong>,
        ...keys.map((key) => <i key={`${region.id}-${String(key)}`} style={{ opacity: Math.max(0.25, Number(region[key]) / 100) }}>{Number(region[key])}</i>)
      ])}
    </div>
  );
}

function buildCompareInsights(regions: CompareRegion[]) {
  if (!regions.length) return ["Select at least two regions to generate comparative insights."];
  const strongest = [...regions].sort((a, b) => b.infrastructure - a.infrastructure)[0];
  const highestDemand = [...regions].sort((a, b) => b.demand - a.demand)[0];
  const lowestSatisfaction = [...regions].sort((a, b) => a.satisfaction - b.satisfaction)[0];
  return [
    `${strongest.name} is strongest on infrastructure readiness with index ${strongest.infrastructure}/100.`,
    `${highestDemand.name} has the highest demand pressure with ${formatCount(highestDemand.demand)} citizen signals.`,
    `${lowestSatisfaction.name} needs citizen-experience attention; satisfaction is ${lowestSatisfaction.satisfaction}%.`,
    "Recommended focus: fund high-demand road and water gaps first, then track PHC and education backlogs through weekly reviews."
  ];
}

const indiaAdminDistricts: Record<string, string[]> = {
  "Andhra Pradesh": ["Anantapur", "Guntur", "Krishna", "Visakhapatnam", "Vijayawada"],
  "Arunachal Pradesh": ["East Siang", "Itanagar", "Tawang", "West Kameng"],
  Assam: ["Dibrugarh", "Guwahati", "Jorhat", "Silchar"],
  Bihar: ["Patna", "Gaya", "Muzaffarpur", "Bhagalpur", "Darbhanga", "Purnea", "Nalanda"],
  Chhattisgarh: ["Raipur", "Bilaspur", "Durg", "Korba"],
  Goa: ["North Goa", "South Goa"],
  Gujarat: ["Ahmedabad", "Surat", "Vadodara", "Rajkot"],
  Haryana: ["Gurugram", "Faridabad", "Hisar", "Karnal"],
  "Himachal Pradesh": ["Shimla", "Kangra", "Mandi", "Solan"],
  Jharkhand: ["Ranchi", "Dhanbad", "Jamshedpur", "Bokaro"],
  Karnataka: ["Bengaluru Urban", "Mysuru", "Mangaluru", "Belagavi"],
  Kerala: ["Thiruvananthapuram", "Kochi", "Kozhikode", "Thrissur"],
  "Madhya Pradesh": ["Bhopal", "Indore", "Jabalpur", "Gwalior"],
  Maharashtra: ["Mumbai", "Pune", "Nagpur", "Nashik Rural"],
  Manipur: ["Imphal East", "Imphal West", "Thoubal"],
  Meghalaya: ["East Khasi Hills", "West Garo Hills", "Ri Bhoi"],
  Mizoram: ["Aizawl", "Lunglei", "Champhai"],
  Nagaland: ["Kohima", "Dimapur", "Mokokchung"],
  Odisha: ["Bhubaneswar", "Cuttack", "Puri", "Sambalpur"],
  Punjab: ["Ludhiana", "Amritsar", "Patiala", "Jalandhar", "Bathinda", "Mohali"],
  Rajasthan: ["Jaipur", "Jodhpur", "Udaipur", "Kota"],
  Sikkim: ["Gangtok", "Namchi", "Gyalshing"],
  "Tamil Nadu": ["Chennai", "Coimbatore", "Madurai", "Tiruchirappalli"],
  Telangana: ["Hyderabad", "Warangal", "Nizamabad", "Karimnagar"],
  Tripura: ["West Tripura", "Gomati", "Dhalai"],
  "Uttar Pradesh": ["Lucknow", "Varanasi", "Kanpur Nagar", "Prayagraj", "Gorakhpur"],
  Uttarakhand: ["Dehradun", "Haridwar", "Nainital", "Udham Singh Nagar"],
  "West Bengal": ["Kolkata", "Howrah", "Darjeeling", "North 24 Parganas"],
  Delhi: ["Central Delhi", "East Delhi", "New Delhi", "South Delhi", "North Delhi"],
  "Jammu and Kashmir": ["Srinagar", "Jammu", "Anantnag", "Baramulla"],
  Ladakh: ["Leh", "Kargil"],
  Puducherry: ["Puducherry", "Karaikal", "Mahe", "Yanam"],
  Chandigarh: ["Chandigarh"],
  "Andaman and Nicobar Islands": ["South Andaman", "North and Middle Andaman", "Nicobar"],
  Lakshadweep: ["Lakshadweep"],
  "Dadra and Nagar Haveli and Daman and Diu": ["Daman", "Diu", "Dadra and Nagar Haveli"]
};

function SettingsPage({ clientConfig, ragStatus, demoData, context }: { clientConfig: ClientConfig; ragStatus: RagStatusResponse | null; demoData: DemoDataStatus; context: ContextResponse }) {
  const adminDistricts = useMemo(() => {
    const merged = { ...indiaAdminDistricts };
    for (const [state, districts] of Object.entries(context.districtsByState)) {
      merged[state] = [...new Set([...(merged[state] ?? []), ...districts])].sort();
    }
    return merged;
  }, [context]);
  const [settingsState, setSettingsState] = useState("Punjab");
  const [settingsDistrict, setSettingsDistrict] = useState("Ludhiana");
  const districtOptions = adminDistricts[settingsState] ?? [];
  const constituencyOptions = useMemo(() => {
    const mapped = context.mps
      .filter((mp) => mp.state === settingsState && mp.district === settingsDistrict)
      .map((mp) => mp.name);
    return mapped.length ? mapped : [`${settingsDistrict} Constituency`, `${settingsDistrict} Urban`, `${settingsDistrict} Rural`];
  }, [context, settingsState, settingsDistrict]);
  const [settingsConstituency, setSettingsConstituency] = useState("MP Ludhiana");

  useEffect(() => {
    if (!districtOptions.includes(settingsDistrict)) setSettingsDistrict(districtOptions[0] ?? "");
  }, [districtOptions, settingsDistrict]);

  useEffect(() => {
    if (!constituencyOptions.includes(settingsConstituency)) setSettingsConstituency(constituencyOptions[0] ?? "");
  }, [constituencyOptions, settingsConstituency]);

  const integrations = [
    { name: "OpenAI", status: "Environment key required", usage: "0 calls", health: "Not connected" },
    { name: "Gemini", status: "Vertex-ready adapter", usage: "Fallback mode active", health: "Ready" },
    { name: "News API", status: "Environment key supported", usage: "Live when configured", health: "Connector ready" },
    { name: "X API", status: "Bearer token supported", usage: "Recent search", health: "Connector ready" },
    { name: "Weather API", status: "Planned connector", usage: "0 calls", health: "Pending" },
    { name: "Maps API", status: clientConfig.maps.enabled ? "Connected" : "Not configured", usage: clientConfig.maps.source, health: clientConfig.maps.enabled ? "Live" : "Needs key" }
  ];
  const roles = ["MP Admin", "District Officer", "Ward Staff", "Analyst", "Citizen Support", "Read-only Auditor"];
  const dataSources = ["Citizen submissions", "Online signals", "Government documents", "Census layers", "Weather alerts", "Satellite imagery", "Traffic data", "Manual uploads"];
  const auditRows = [
    { action: "Demo data toggled", actor: "Admin", time: "Current session", status: demoData.enabled ? "Enabled" : "Disabled" },
    { action: "RAG health checked", actor: "System", time: ragStatus?.refreshCadence ?? "On demand", status: ragStatus?.mode ?? "Not configured" },
    { action: "Maps runtime config read", actor: "System", time: clientConfig.generatedAt, status: clientConfig.maps.source }
  ];

  return (
    <section className="settings-page">
      <section className="settings-hero panel">
        <div>
          <p className="eyebrow">Enterprise Administration</p>
          <h3>AI Governance Settings</h3>
          <p>Manage JanVaani AI workspace identity, model access, connectors, security controls, and operational health.</p>
        </div>
        <div className="settings-health">
          <Metric label="API Status" value={clientConfig.generatedAt ? "Live" : "Unknown"} detail={clientConfig.dataMode} />
          <Metric label="Vector DB" value={ragStatus?.mode ?? "Offline"} detail={`${formatCount(ragStatus?.corpusDocuments ?? 0)} documents`} />
          <Metric label="Indexing" value={ragStatus?.refreshCadence ?? "Manual"} detail={ragStatus?.embeddingStore ?? "No vector store"} />
          <Metric label="Storage" value={`${formatCount(demoData.visibleRows)} rows`} detail={demoData.label} />
        </div>
      </section>

      <section className="settings-grid">
        <section className="panel settings-card">
          <PanelTitle title="Profile" icon={Users} />
          <label>Name<input value="Shivam Kumar" readOnly /></label>
          <label>Email<input value="admin@janvaani.local" readOnly /></label>
          <label>Role<select defaultValue="MP Admin">{roles.map((role) => <option key={role}>{role}</option>)}</select></label>
        </section>

        <section className="panel settings-card">
          <PanelTitle title="Organization" icon={Briefcase} />
          <label>Organization<input value="JanVaani AI Governance Workspace" readOnly /></label>
          <label>Region<input value="India" readOnly /></label>
          <label>Data mode<input value={clientConfig.dataMode} readOnly /></label>
        </section>

        <section className="panel settings-card">
          <PanelTitle title="Constituency Settings" icon={MapPinned} />
          <label>Default State
            <select value={settingsState} onChange={(event) => setSettingsState(event.target.value)} aria-label="Settings state">
              {Object.keys(adminDistricts).sort().map((state) => <option key={state}>{state}</option>)}
            </select>
          </label>
          <label>Default District
            <select value={settingsDistrict} onChange={(event) => setSettingsDistrict(event.target.value)} aria-label="Settings district">
              {districtOptions.map((district) => <option key={district}>{district}</option>)}
            </select>
          </label>
          <label>Default Constituency
            <select value={settingsConstituency} onChange={(event) => setSettingsConstituency(event.target.value)} aria-label="Settings constituency">
              {constituencyOptions.map((constituency) => <option key={constituency}>{constituency}</option>)}
            </select>
          </label>
        </section>

        <section className="panel settings-card">
          <PanelTitle title="AI Model Selection" icon={Bot} />
          <label>Primary Model<select defaultValue="Gemini / Vertex AI"><option>Gemini / Vertex AI</option><option>OpenAI GPT</option><option>OpenAI-compatible</option><option>Fallback rules</option></select></label>
          <label>RAG Retrieval<select defaultValue={ragStatus?.mode ?? "Local hybrid"}><option>{ragStatus?.mode ?? "Local hybrid"}</option><option>Vertex AI RAG Engine</option><option>Vertex AI Vector Search</option></select></label>
          <label>Confidence Threshold<input value="75%" readOnly /></label>
        </section>
      </section>

      <section className="panel settings-wide">
        <PanelTitle title="API Keys & Integrations" icon={DatabaseZap} />
        <div className="integration-status-grid">
          {integrations.map((item) => (
            <article key={item.name}>
              <strong>{item.name}</strong>
              <span className={item.health === "Live" || item.health === "Ready" || item.health === "Connector ready" ? "ok" : "warn"}>{item.health}</span>
              <p>{item.status}</p>
              <small>{item.usage}</small>
            </article>
          ))}
        </div>
      </section>

      <section className="settings-two-col">
        <section className="panel settings-wide">
          <PanelTitle title="Data Sources" icon={Database} />
          <div className="settings-check-grid">
            {dataSources.map((item) => <label key={item}><input type="checkbox" defaultChecked />{item}</label>)}
          </div>
        </section>
        <section className="panel settings-wide">
          <PanelTitle title="Notification Preferences" icon={MessageSquareText} />
          <div className="settings-check-grid">
            {["Daily intelligence digest", "Indexing failures", "Connector downtime", "High-priority issue spike", "Billing usage alert", "Security audit alert"].map((item) => <label key={item}><input type="checkbox" defaultChecked />{item}</label>)}
          </div>
        </section>
      </section>

      <section className="settings-grid compact">
        <section className="panel settings-card">
          <PanelTitle title="Security" icon={Lock} />
          <label><input type="checkbox" defaultChecked /> Require admin login</label>
          <label><input type="checkbox" defaultChecked /> Mask citizen identity</label>
          <label><input type="checkbox" defaultChecked /> Enforce citation guardrails</label>
        </section>
        <section className="panel settings-card">
          <PanelTitle title="Access Control" icon={Lock} />
          <label>Session Timeout<select defaultValue="12 hours"><option>1 hour</option><option>12 hours</option><option>24 hours</option></select></label>
          <label>API Policy<select defaultValue="Server-side keys only"><option>Server-side keys only</option><option>Read-only public keys</option></select></label>
        </section>
        <section className="panel settings-card">
          <PanelTitle title="User Roles" icon={Users} />
          <div className="role-chip-list">{roles.map((role) => <span key={role}>{role}</span>)}</div>
        </section>
        <section className="panel settings-card">
          <PanelTitle title="Language & Theme" icon={Languages} />
          <label>Language<select defaultValue="English"><option>English</option><option>Hindi</option><option>Punjabi</option><option>Tamil</option><option>Bengali</option></select></label>
          <label>Mode<select defaultValue="Light"><option>Light</option><option>Dark</option><option>System</option></select></label>
        </section>
        <section className="panel settings-card">
          <PanelTitle title="Backup Settings" icon={RefreshCw} />
          <label>Backup Frequency<select defaultValue="Daily"><option>Hourly</option><option>Daily</option><option>Weekly</option></select></label>
          <label>Retention<input value="90 days" readOnly /></label>
        </section>
        <section className="panel settings-card">
          <PanelTitle title="Billing" icon={Star} />
          <label>Plan<input value="Enterprise pilot" readOnly /></label>
          <label>Usage Limit<input value="Governed by API quotas" readOnly /></label>
        </section>
      </section>

      <section className="panel settings-wide">
        <PanelTitle title="Audit Logs" icon={FileText} />
        <div className="settings-audit-table">
          {auditRows.map((row) => (
            <article key={row.action}>
              <strong>{row.action}</strong>
              <span>{row.actor}</span>
              <span>{row.time}</span>
              <mark>{row.status}</mark>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}

function AnswerContent({ text }: { text: string }) {
  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  return (
    <div className="answer-content">
      {lines.map((line, index) => {
        if (line.startsWith("## ")) return <h4 key={`${line}-${index}`}>{line.replace(/^##\s+/, "")}</h4>;
        if (/^[-*]\s+/.test(line)) return <p className="answer-bullet" key={`${line}-${index}`}>{line.replace(/^[-*]\s+/, "")}</p>;
        if (/^\[\d+\]/.test(line)) return <p className="answer-cited-line" key={`${line}-${index}`}>{line}</p>;
        return <p key={`${line}-${index}`}>{line}</p>;
      })}
    </div>
  );
}

const categoryMeta: Record<string, { icon: typeof Home; color: string }> = {
  Roads: { icon: Construction, color: "#dc2626" },
  Water: { icon: Droplets, color: "#2563eb" },
  Health: { icon: HeartPulse, color: "#138a52" },
  Power: { icon: Zap, color: "#d97706" },
  Education: { icon: GraduationCap, color: "#7c3aed" },
  Sanitation: { icon: Trash2, color: "#0d9488" },
  "Digital Access": { icon: Wifi, color: "#db2777" },
  Employment: { icon: Briefcase, color: "#4f46e5" }
};

const fallbackCategoryMeta = { icon: Flag, color: "#64748b" };

type DailyPulse = {
  viralLocalTopics: Array<{ topic: string; mentions: number; trend: string }>;
  indices: Record<string, number>;
};

function PulsePage({ setPage }: { setPage: (page: Page) => void }) {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [daily, setDaily] = useState<DailyPulse | null>(null);
  const [error, setError] = useState("");
  const [stateFilter, setStateFilter] = useState("All States");
  const [districtFilter, setDistrictFilter] = useState("All Districts");
  const [constituencyFilter, setConstituencyFilter] = useState("All Constituencies");
  const [problemFilter, setProblemFilter] = useState("All Problems");
  const [timeFilter, setTimeFilter] = useState("Current Batch");
  const [languageFilter, setLanguageFilter] = useState("English");
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [showAllDistricts, setShowAllDistricts] = useState(false);
  const [showAllTrends, setShowAllTrends] = useState(false);
  const [assistantQuestion, setAssistantQuestion] = useState("What is the biggest issue?");
  const [assistantAnswer, setAssistantAnswer] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      requestJson<DashboardResponse>("/api/priorities?scope=global"),
      getJson<DailyPulse>("/api/intelligence/daily", { viralLocalTopics: [], indices: {} })
    ])
      .then(([dashboard, nextDaily]) => {
        if (cancelled) return;
        setData(dashboard);
        setDaily(nextDaily);
        setError("");
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "National pulse unavailable");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const projects = data?.projects ?? [];
  const allStates = useMemo(() => ["All States", ...[...new Set(projects.map((project) => project.state))].sort()], [projects]);
  const districtOptions = useMemo(() => {
    const filtered = projects.filter((project) => stateFilter === "All States" || project.state === stateFilter);
    return ["All Districts", ...[...new Set(filtered.map((project) => project.district))].sort()];
  }, [projects, stateFilter]);
  const constituencyOptions = useMemo(() => {
    const filtered = projects.filter((project) =>
      (stateFilter === "All States" || project.state === stateFilter) &&
      (districtFilter === "All Districts" || project.district === districtFilter)
    );
    return ["All Constituencies", ...[...new Set(filtered.map((project) => project.mpName))].sort()];
  }, [projects, stateFilter, districtFilter]);
  const problemOptions = useMemo(() => ["All Problems", ...[...new Set(projects.map((project) => project.category))].sort()], [projects]);
  const filteredProjects = useMemo(() => projects.filter((project) =>
    (stateFilter === "All States" || project.state === stateFilter) &&
    (districtFilter === "All Districts" || project.district === districtFilter) &&
    (constituencyFilter === "All Constituencies" || project.mpName === constituencyFilter) &&
    (problemFilter === "All Problems" || project.category === problemFilter)
  ), [projects, stateFilter, districtFilter, constituencyFilter, problemFilter]);

  useEffect(() => {
    setDistrictFilter("All Districts");
    setConstituencyFilter("All Constituencies");
  }, [stateFilter]);

  useEffect(() => {
    setConstituencyFilter("All Constituencies");
  }, [districtFilter]);

  const categoryGroups = new Map<string, { demand: number; works: number; states: Set<string>; top: RankedProject }>();
  for (const project of filteredProjects) {
    const group = categoryGroups.get(project.category);
    if (group) {
      group.demand += project.demandCount;
      group.works += 1;
      group.states.add(project.state);
      if (project.demandCount > group.top.demandCount) group.top = project;
    } else {
      categoryGroups.set(project.category, { demand: project.demandCount, works: 1, states: new Set([project.state]), top: project });
    }
  }
  const categories = [...categoryGroups.entries()]
    .map(([category, group]) => ({ category, ...group }))
    .sort((a, b) => b.demand - a.demand);
  const top5 = categories.slice(0, 5);
  const maxCategoryDemand = Math.max(1, top5[0]?.demand ?? 1);
  const focusCategory = categories.find((entry) => entry.category === (problemFilter === "All Problems" ? top5[0]?.category : problemFilter)) ?? top5[0];
  const focusProject = focusCategory?.top;

  const stateGroups = new Map<string, number>();
  for (const project of filteredProjects) {
    stateGroups.set(project.state, (stateGroups.get(project.state) ?? 0) + project.demandCount);
  }
  const stateRanking = [...stateGroups.entries()]
    .map(([state, demand]) => ({ state, demand }))
    .sort((a, b) => b.demand - a.demand);

  const districtRanking = [...filteredProjects.reduce<Map<string, { district: string; state: string; demand: number }>>((acc, project) => {
    const key = `${project.state}::${project.district}`;
    const current = acc.get(key) ?? { district: project.district, state: project.state, demand: 0 };
    current.demand += project.demandCount;
    acc.set(key, current);
    return acc;
  }, new Map()).values()].sort((a, b) => b.demand - a.demand);
  const totalSignals = filteredProjects.reduce((sum, project) => sum + project.demandCount, 0);
  const priorityScore = Math.round(focusProject?.score ?? daily?.indices.priorityScore ?? Math.max(0, ...filteredProjects.map((project) => project.score)));
  const trending = categories.map((entry) => ({ topic: entry.category, mentions: entry.demand, trend: entry.top.urgencyScore >= 13 ? "rising" : "stable" })).slice(0, showAllTrends ? 10 : 4);
  const selectedRegionName = stateFilter === "All States" ? "India" : stateFilter;
  const selectedProblemName = focusCategory?.category ?? "No issue";
  const affectedCitizens = focusProject ? `${formatCount(Math.max(focusProject.demandCount * 1800, focusProject.demandCount))}+` : "0";
  const relatedProjects = filteredProjects.filter((project) => project.category === focusCategory?.category).slice(0, 4);
  const areaMix = buildAreaMix(filteredProjects);

  function submitAssistant(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const top = focusProject;
    setAssistantAnswer(top
      ? `${selectedProblemName} leads in ${selectedRegionName}: ${formatCount(top.demandCount)} demand signals, ${Math.round(top.confidence * 100)}% confidence, strongest location ${top.ward}, ${top.district}.`
      : `No processed demand records for ${selectedRegionName} with current filters.`);
  }

  return (
    <section className={`janvaani-pulse ${drawerOpen ? "" : "drawer-hidden"}`}>
      <section className="pulse-filterbar" aria-label="National pulse filters">
        <label>State
          <select value={stateFilter} onChange={(event) => setStateFilter(event.target.value)} aria-label="Pulse state">
            {allStates.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label>District
          <select value={districtFilter} onChange={(event) => setDistrictFilter(event.target.value)} aria-label="Pulse district">
            {districtOptions.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label>Constituency
          <select value={constituencyFilter} onChange={(event) => setConstituencyFilter(event.target.value)} aria-label="Pulse constituency">
            {constituencyOptions.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label>Problem
          <select value={problemFilter} onChange={(event) => setProblemFilter(event.target.value)} aria-label="Pulse problem">
            {problemOptions.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label>Range
          <select value={timeFilter} onChange={(event) => setTimeFilter(event.target.value)} aria-label="Pulse time range">
            {["Current Batch", "Last 30 Days", "Last 90 Days", "This Year"].map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label>Language
          <select value={languageFilter} onChange={(event) => setLanguageFilter(event.target.value)} aria-label="Pulse language">
            {["English", "Hindi", "Tamil", "Bengali", "Marathi", "Gujarati"].map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
      </section>

      {error ? <div className="error-state">{error}</div> : null}

      <section className="pulse-command">
        {drawerOpen ? (
          <aside className="pulse-drawer" aria-label="Selected problem intelligence">
            <button aria-label="Close problem intelligence" className="drawer-close" onClick={() => setDrawerOpen(false)} type="button"><X size={16} /></button>
            <div className="drawer-head">
              <h3>{selectedProblemName}</h3>
              <mark>{priorityScore >= 80 ? "High Priority" : priorityScore >= 55 ? "Priority" : "Needs Data"}</mark>
            </div>
            <section>
              <h4>Priority Score</h4>
              <strong className="priority-score">{priorityScore}<em>/100</em></strong>
              <span className="score-line"><i style={{ width: `${Math.min(100, priorityScore)}%` }} /></span>
            </section>
            <section>
              <h4>Citizen Requests <em>({formatCount(focusCategory?.demand ?? 0)})</em></h4>
              <ul>
                {(focusProject?.evidence ?? ["No processed records for this filter."]).slice(0, 5).map((item) => <li key={item}>{item}</li>)}
              </ul>
            </section>
            <section>
              <h4>AI Summary</h4>
              <p>{focusProject?.rationale ?? `No ${selectedRegionName} priority summary available for current filters.`}</p>
            </section>
            <section>
              <h4>Root Causes</h4>
              <ul>{(focusProject?.evidence ?? []).slice(1, 4).map((item) => <li key={item}>{item}</li>)}</ul>
            </section>
            <section>
              <h4>Suggested Actions</h4>
              <ul className="check-list">
                {relatedProjects.length ? relatedProjects.slice(0, 4).map((project) => <li key={project.id}>Open {project.category.toLowerCase()} review for {project.ward}</li>) : <li>Process more citizen submissions for this filter</li>}
              </ul>
            </section>
            <section className="impact-box">
              <h4>Estimated Citizen Impact</h4>
              <strong>{affectedCitizens}</strong>
            </section>
            <section>
              <h4>Related Projects</h4>
              {relatedProjects.map((project) => <button key={project.id} onClick={() => setPage("priorities")} type="button">{project.title}</button>)}
            </section>
            <section>
              <h4>Supporting Evidence</h4>
              <ul className="check-list">
                <li>{formatCount(totalSignals)} processed citizen signals</li>
                <li>{filteredProjects.length} ranked works</li>
                <li>{stateRanking.length} states in current filter</li>
              </ul>
            </section>
          </aside>
        ) : (
          <button aria-label="Open problem intelligence" className="drawer-open" onClick={() => setDrawerOpen(true)} type="button"><PanelLeftOpen size={18} /></button>
        )}

        <div className="pulse-main">
          <section className="panel pulse-overview" aria-label="National overview">
            <div>
              <h3>{selectedRegionName}</h3>
              <p>Overview of top problems as reported by citizens. Filter controls above update every card, ranking, and evidence panel.</p>
            </div>
            <div className="pulse-kpis compact">
              <article className="pulse-kpi">
                <span>Reporting States</span>
                <strong>{stateRanking.length}</strong>
              </article>
              <article className="pulse-kpi">
                <span>Districts</span>
                <strong>{districtRanking.length}</strong>
              </article>
              <article className="pulse-kpi">
                <span>Active Issues</span>
                <strong>{formatCount(totalSignals)}</strong>
              </article>
              <article className="pulse-kpi accent">
                <span>AI Priority Score</span>
                <strong>{priorityScore}<em>/100</em></strong>
              </article>
            </div>
          </section>

          <section className="pulse-workgrid">
            <section className="panel problem-board" aria-label="Top citizen problems">
              <PanelTitle title="Top 5 Citizen Problems" icon={Flag} detail={timeFilter} />
              <div className="problem-list">
                {top5.map((entry, index) => {
                  const meta = categoryMeta[entry.category] ?? fallbackCategoryMeta;
                  const Icon = meta.icon;
                  const pct = Math.round((entry.demand / maxCategoryDemand) * 100);
                  return (
                    <button className={`problem-row ${focusCategory?.category === entry.category ? "selected" : ""}`} key={entry.category} onClick={() => setProblemFilter(entry.category)} type="button">
                      <span className="problem-icon" style={{ background: `${meta.color}1a`, color: meta.color }}>
                        <Icon size={19} />
                      </span>
                      <span className="problem-rank">{index + 1}</span>
                      <span className="problem-main">
                        <strong>{entry.category}</strong>
                        <span className="problem-bar">
                          <i style={{ width: `${Math.max(6, pct)}%`, background: meta.color }} />
                        </span>
                      </span>
                      <span className="problem-pct" style={{ color: meta.color }}>{pct}%</span>
                    </button>
                  );
                })}
                {!top5.length && !error ? <div className="empty-state">National pulse fills in as citizen submissions are processed.</div> : null}
              </div>
            </section>

            <section className="panel pulse-map-panel" aria-label="Problem heatmap">
              <PanelTitle title="Problem Heatmap" icon={MapPinned} detail="complaints density" />
              <div className="pulse-map-board">
                {filteredProjects.slice(0, 14).map((project) => {
                  const meta = categoryMeta[project.category] ?? fallbackCategoryMeta;
                  return (
                    <button key={project.id} onClick={() => setProblemFilter(project.category)} style={{ background: heatForScore(project.score), borderColor: `${meta.color}55` }} type="button">
                      <strong>{project.district}</strong>
                      <span>{project.ward}</span>
                    </button>
                  );
                })}
                {!filteredProjects.length ? <div className="empty-state">No heatmap cells for current filters.</div> : null}
              </div>
              <div className="heat-legend"><span>Low</span><i /><span>High</span></div>
            </section>

            <aside className="pulse-side">
              <section className="panel" aria-label="District ranking">
                <PanelTitle title="District Ranking" icon={MapPin} />
                <div className="rank-list">
                  {districtRanking.slice(0, showAllDistricts ? 12 : 5).map((entry, index) => (
                    <button className="rank-row" key={`${entry.state}-${entry.district}`} onClick={() => { setStateFilter(entry.state); setDistrictFilter(entry.district); }} type="button">
                      <span className={`rank-dot rank-${Math.min(index + 1, 5)}`}>{index + 1}</span>
                      <strong>{entry.district}</strong>
                      <em>{formatCount(entry.demand)}</em>
                    </button>
                  ))}
                </div>
                <button className="rail-link" onClick={() => setShowAllDistricts((value) => !value)} type="button">{showAllDistricts ? "Show Top Districts" : "View All Districts"}</button>
              </section>

              <section className="panel" aria-label="Trending this week">
                <PanelTitle title="Trending This Week" icon={TrendingUp} />
                <div className="trend-list">
                  {trending.map((topic) => {
                    const meta = categoryMeta[topic.topic] ?? fallbackCategoryMeta;
                    const Icon = meta.icon;
                    return (
                      <button className="trend-row" key={topic.topic} onClick={() => setProblemFilter(topic.topic)} type="button">
                        <span className="trend-icon" style={{ color: meta.color }}><Icon size={16} /></span>
                        <span className="trend-copy">
                          <strong>{topic.topic}</strong>
                          <small>{formatCount(topic.mentions)} signals</small>
                        </span>
                        <mark className={topic.trend === "rising" ? "up" : ""}>{topic.trend}</mark>
                      </button>
                    );
                  })}
                </div>
                <button className="rail-link" onClick={() => setShowAllTrends((value) => !value)} type="button">{showAllTrends ? "Show Top Trends" : "View All Trends"}</button>
              </section>
            </aside>
          </section>

          <section className="pulse-bottom-grid">
            <section className="panel pulse-chart" aria-label="Complaints index">
              <PanelTitle title="Complaint Index" icon={TrendingUp} detail={languageFilter} />
              <div className="pulse-lines">
                {top5.map((entry) => {
                  const meta = categoryMeta[entry.category] ?? fallbackCategoryMeta;
                  return <span key={entry.category}><i style={{ background: meta.color, width: `${Math.max(8, (entry.demand / maxCategoryDemand) * 100)}%` }} />{entry.category}</span>;
                })}
              </div>
            </section>
            <section className="panel pulse-donut" aria-label="Problem by area type">
              <PanelTitle title="Problem by Area Type" icon={Users} />
              <div className="area-mix">
                <strong>{formatCount(totalSignals)}<span>Total</span></strong>
                {areaMix.map((item) => <p key={item.label}><i style={{ background: item.color }} />{item.label}<b>{item.share}%</b></p>)}
              </div>
            </section>
          </section>
        </div>

        <form className="janvaani-assistant" onSubmit={submitAssistant}>
          <div>
            <strong>Ask JanVaani AI</strong>
            <button aria-label="Clear JanVaani AI answer" onClick={() => setAssistantAnswer("")} type="button"><X size={14} /></button>
          </div>
          <label>
            <input value={assistantQuestion} onChange={(event) => setAssistantQuestion(event.target.value)} />
            <button aria-label="Ask JanVaani AI" type="submit">Send</button>
          </label>
          {assistantAnswer ? <p>{assistantAnswer}</p> : null}
        </form>
      </section>
    </section>
  );
}

function heatForScore(score: number) {
  if (score >= 80) return "#ef4444";
  if (score >= 65) return "#f97316";
  if (score >= 50) return "#facc15";
  return "#86efac";
}

function buildAreaMix(projects: RankedProject[]) {
  const counts = projects.reduce<Record<string, number>>((acc, project) => {
    const type = /rural|village|basti/i.test(`${project.district} ${project.ward}`)
      ? "Rural"
      : /extension|periphery|canal/i.test(project.ward)
        ? "Peri-Urban"
        : "Urban";
    acc[type] = (acc[type] ?? 0) + project.demandCount;
    return acc;
  }, {});
  const total = Math.max(1, Object.values(counts).reduce((sum, value) => sum + value, 0));
  return [
    { label: "Rural", color: "#58c36b" },
    { label: "Urban", color: "#3498db" },
    { label: "Peri-Urban", color: "#ffd45a" }
  ].map((item) => ({ ...item, share: Math.round(((counts[item.label] ?? 0) / total) * 100) }));
}

const statusMeta: Record<RankedProject["status"], { label: string; hint: string }> = {
  review: { label: "In review", hint: "awaiting MP decision" },
  shortlist: { label: "Shortlisted", hint: "queued for approval" },
  approved: { label: "Approved", hint: "cleared for execution" }
};

function PriorityDeskPage({
  dashboard,
  activeProject,
  setActiveProjectId,
  refreshAll,
  setPage
}: {
  dashboard: DashboardResponse;
  activeProject: RankedProject;
  setActiveProjectId: (id: string) => void;
  refreshAll: () => Promise<void>;
  setPage: (page: Page) => void;
}) {
  const [statusFilter, setStatusFilter] = useState<"all" | RankedProject["status"]>("all");
  const projects = dashboard.projects;
  const counts = {
    all: projects.length,
    review: projects.filter((project) => project.status === "review").length,
    shortlist: projects.filter((project) => project.status === "shortlist").length,
    approved: projects.filter((project) => project.status === "approved").length
  };
  const visible = statusFilter === "all" ? projects : projects.filter((project) => project.status === statusFilter);
  const selected = visible.find((project) => project.id === activeProject.id) ?? visible[0] ?? activeProject;
  const updatedAt = new Date(dashboard.generatedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  const tabs: Array<{ key: "all" | RankedProject["status"]; label: string }> = [
    { key: "all", label: `All works (${counts.all})` },
    { key: "review", label: `In review (${counts.review})` },
    { key: "shortlist", label: `Shortlisted (${counts.shortlist})` },
    { key: "approved", label: `Approved (${counts.approved})` }
  ];

  return (
    <section className="priority-desk">
      <section className="desk-kpis" aria-label="Constituency signal summary">
        <Metric label="Submissions analyzed" value={formatCount(dashboard.totals.submissions)} detail={`${dashboard.totals.languages} languages normalized`} />
        <Metric label="Ranked works" value={String(counts.all)} detail={`${dashboard.totals.wards} wards covered`} />
        <Metric label="Awaiting decision" value={String(counts.review)} detail="evidence attached, ready to act" />
        <Metric label="Decisions made" value={String(counts.shortlist + counts.approved)} detail={`${counts.shortlist} shortlisted - ${counts.approved} approved`} />
      </section>

      <section className="desk-body">
        <section className="panel desk-queue">
          <PanelTitle title="Ranked priority queue" icon={Scale} detail={`updated ${updatedAt}`} />
          <div className="status-tabs" role="tablist" aria-label="Filter works by decision stage">
            {tabs.map((tab) => (
              <button
                aria-selected={statusFilter === tab.key}
                className={statusFilter === tab.key ? "active" : ""}
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                role="tab"
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="queue-list">
            {visible.map((project) => {
              const rank = projects.indexOf(project) + 1;
              return (
                <button className={`queue-row ${selected.id === project.id ? "selected" : ""}`} key={project.id} onClick={() => setActiveProjectId(project.id)} type="button">
                  <span className="queue-rank">#{rank}</span>
                  <span className="queue-main">
                    <strong>{project.title}</strong>
                    <small>{project.category} - {project.ward}, {project.district} - {formatCount(project.demandCount)} citizen signals</small>
                  </span>
                  <span className="queue-side">
                    <strong>{project.score}</strong>
                    <small>{Math.round(project.confidence * 100)}% confidence</small>
                    <mark className={`status-chip ${project.status}`}>{statusMeta[project.status].label}</mark>
                  </span>
                </button>
              );
            })}
            {!visible.length ? <div className="empty-state">No works in this stage for the selected area yet.</div> : null}
          </div>
        </section>

        <PriorityDecision project={selected} rank={projects.indexOf(selected) + 1} refreshAll={refreshAll} setPage={setPage} />
      </section>
    </section>
  );
}

function PriorityDecision({
  project,
  rank,
  refreshAll,
  setPage
}: {
  project: RankedProject;
  rank: number;
  refreshAll: () => Promise<void>;
  setPage: (page: Page) => void;
}) {
  const [busyStatus, setBusyStatus] = useState<RankedProject["status"] | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setMessage("");
  }, [project.id]);

  async function updateStatus(status: RankedProject["status"]) {
    setBusyStatus(status);
    setMessage("");
    try {
      const response = await apiFetch(`/api/projects/${project.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ actorId: "state-admin-india", status })
      });
      if (!response.ok) throw new Error("Project status update failed");
      setMessage(`Status updated: ${statusMeta[status].label}.`);
      await refreshAll();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Project status update failed");
    } finally {
      setBusyStatus(null);
    }
  }

  const nextAction =
    project.status === "review"
      ? { status: "shortlist" as const, label: "Shortlist this work" }
      : project.status === "shortlist"
        ? { status: "approved" as const, label: "Approve for execution" }
        : null;

  return (
    <section className="panel desk-decision" aria-label="Decision brief">
      <div className="decision-head">
        <mark className={`status-chip large ${project.status}`}>{statusMeta[project.status].label}</mark>
        <span className="decision-rank">Rank #{rank > 0 ? rank : 1} - score {project.score}/100</span>
      </div>
      <h3>{project.title}</h3>
      <p className="rationale">{project.rationale}</p>
      <div className="chips">
        <span><MapPin size={14} /> {project.ward}, {project.district}, {project.state}</span>
        <span><Users size={14} /> {formatCount(project.demandCount)} citizen signals</span>
        <span><Star size={14} /> {project.averageRating}/5 from {project.ratings} ratings</span>
        <span><ShieldCheck size={14} /> {project.averageSubmissionQuality ?? 0}/100 quality · {project.rewardedCitizenCount ?? 0} rewarded</span>
        <span><Languages size={14} /> {project.languageMix.join(", ")}</span>
      </div>

      <div className="decision-actions" aria-label="Decision actions">
        {nextAction ? (
          <button className="primary" disabled={busyStatus !== null} onClick={() => updateStatus(nextAction.status)} type="button">
            {busyStatus === nextAction.status ? "Saving..." : nextAction.label}
          </button>
        ) : null}
        {project.status !== "review" ? (
          <button disabled={busyStatus !== null} onClick={() => updateStatus("review")} type="button">
            {busyStatus === "review" ? "Saving..." : "Return to review"}
          </button>
        ) : null}
        <button onClick={() => setPage("copilot")} type="button">
          <MessageSquareText size={16} /> Ask Evidence Copilot
        </button>
      </div>
      {message ? <div className="action-receipt">{message}</div> : null}

      <div className="score-grid">
        <ScoreBar label="Citizen demand" value={project.demandScore} max={40} />
        <ScoreBar label="Ground need" value={project.needScore} max={35} />
        <ScoreBar label="Urgency" value={project.urgencyScore} max={15} />
        <ScoreBar label="Equity" value={project.equityScore} max={15} />
        <ScoreBar label="Reward quality" value={project.averageSubmissionQuality ?? 0} max={100} />
      </div>
      <div className="evidence-grid">
        <Evidence title="Evidence" items={project.evidence} />
        <Evidence title="Recent contributors" items={project.recentCitizenAliases} />
        <Evidence title="Safeguards" items={project.safeguards} />
      </div>
      <RatingControl project={project} refreshAll={refreshAll} />
    </section>
  );
}

function RatingControl({ project, refreshAll }: { project: RankedProject; refreshAll: () => Promise<void> }) {
  const [rating, setRating] = useState(5);
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState("");

  useEffect(() => {
    setReceipt("");
  }, [project.id]);

  async function submitRating(nextRating: number) {
    setBusy(true);
    try {
      const response = await apiFetch(`/api/projects/${project.id}/ratings`, {
        method: "POST",
        body: JSON.stringify({ rating: nextRating })
      });
      if (!response.ok) throw new Error("Rating failed");
      const payload = await response.json() as { averageRating: number; ratings: number; message: string };
      setReceipt(`${payload.message} Average ${payload.averageRating}/5 from ${payload.ratings} ratings.`);
      await refreshAll();
    } catch (error) {
      setReceipt(error instanceof Error ? error.message : "Rating failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rating-control" aria-label="Rate this priority">
      <div>
        <strong>Citizen rating</strong>
        <span>{receipt || `${project.averageRating}/5 from ${project.ratings} ratings`}</span>
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
  return ({ overview: "Executive home", priorities: "Core workflow", pulse: "All states and UTs", map: "Demand hotspots", signals: "AI web intelligence", explorer: "Source data", copilot: "Grounded answers", knowledge: "Document intelligence", recommendations: "AI prioritization", projects: "Execution portfolio", reports: "Official reporting", compare: "Comparative intelligence", settings: "Administration" })[page];
}

function pageTitle(page: Page): string {
  return ({
    overview: "Overview",
    priorities: "Ranked development priorities",
    pulse: "Top 5 problems across India",
    map: "Where demand is concentrated",
    signals: "What the web says citizens need",
    explorer: "Explore source data",
    copilot: "Ask why a work ranks high",
    knowledge: "Knowledge base and indexing",
    recommendations: "AI-ranked development recommendations",
    projects: "Development projects management",
    reports: "AI-powered constituency reports",
    compare: "Compare constituencies and districts",
    settings: "Enterprise AI governance settings"
  })[page];
}
