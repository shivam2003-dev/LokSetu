import {
  Bot,
  CheckCircle2,
  Database,
  DatabaseZap,
  Flag,
  Globe2,
  Home,
  Inbox,
  Languages,
  Lock,
  LockKeyhole,
  Map,
  MapPinned,
  MapPin,
  MessageSquareText,
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

type Page = "priorities" | "map" | "intake" | "copilot";

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

type Hotspot = DashboardResponse["hotspots"][number];
type MapLoadState = "idle" | "loading" | "ready" | "fallback";
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
const accessTokenKey = "loksetuAccessToken";
const envGoogleMapsApiKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? "").trim();
const envGoogleMapsMapId = (import.meta.env.VITE_GOOGLE_MAPS_MAP_ID ?? "").trim();
const configuredCitizenAppUrl = (import.meta.env.VITE_CITIZEN_APP_URL ?? "").trim();
const citizenAppUrl =
  configuredCitizenAppUrl ||
  (["localhost", "127.0.0.1"].includes(window.location.hostname)
    ? "http://localhost:5174"
    : `https://citizen.${window.location.host}`);

const navItems: Array<{ page: Page; label: string; hint: string; icon: typeof Home }> = [
  { page: "priorities", label: "Priority Desk", hint: "Ranked works - decide and approve", icon: Scale },
  { page: "map", label: "Demand Map", hint: "Where citizen demand clusters", icon: Map },
  { page: "intake", label: "Citizen Intake", hint: "Voice, text, photo, WhatsApp", icon: Inbox },
  { page: "copilot", label: "Evidence Copilot", hint: "Ask why, with citations", icon: MessageSquareText }
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

function pageFromHash(): Page {
  const raw = window.location.hash.replace("#", "") || "priorities";
  if (["home", "mp", "projects", "public", "analytics", "enterprise", "moderation", "admin", "integrations", "ai"].includes(raw)) return "priorities";
  if (["explore", "india"].includes(raw)) return "map";
  if (["simulation", "submit"].includes(raw)) return "intake";
  return navItems.some((item) => item.page === raw) ? (raw as Page) : "priorities";
}

async function getJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const response = await apiFetch(path);
    if (!response.ok) throw new Error(path);
    return response.json();
  } catch {
    return fallback;
  }
}

async function requestJson<T>(path: string): Promise<T> {
  const response = await apiFetch(path);
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
  const [copilotCapabilities, setCopilotCapabilities] = useState<CopilotCapabilitiesResponse | null>(null);
  const [ragStatus, setRagStatus] = useState<RagStatusResponse | null>(null);
  const [mapBoundaries, setMapBoundaries] = useState<MapBoundaryResponse>(fallbackMapBoundaries);
  const [mapClusters, setMapClusters] = useState<MapClusterResponse>(fallbackMapClusters);
  const [notice, setNotice] = useState("Connecting");
  const [activeProjectId, setActiveProjectId] = useState(fallbackProject.id);

  const filters = useMemo(() => ({ scope, state, district, ward, mpId, q: query }), [scope, state, district, ward, mpId, query]);
  const activeProject = dashboard.projects.find((project) => project.id === activeProjectId) ?? dashboard.projects[0] ?? fallbackProject;
  const effectiveCitizenAppUrl = clientConfig.citizenAppUrl?.trim() || citizenAppUrl;
  const showControlStrip = page === "priorities" || page === "map";

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
      const [nextConfig, nextContext, nextDashboard, nextRegions, nextCopilot, nextRagStatus, nextBoundaries, nextClusters] = await Promise.all([
        requestJson<ClientConfig>("/api/client-config"),
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
            <p>Citizen voice to ranked development works</p>
          </div>
        </div>
        <nav className="nav-scroll">
          <div className="nav-section">
            <span>Core workflow</span>
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button className={`nav-item rich ${page === item.page ? "active" : ""}`} key={item.page} onClick={() => setPage(item.page)}>
                  <Icon size={18} />
                  <span className="nav-copy">
                    <strong>{item.label}</strong>
                    <small>{item.hint}</small>
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
        <div className="sidebar-footer">
          <a className="citizen-link" href={effectiveCitizenAppUrl}>
            <Send size={16} />
            Open Apni Awaaz
          </a>
          <div className={`status-pill ${apiConnected ? "connected" : "disconnected"}`}>
            <CheckCircle2 size={16} />
            <span>{notice} - {clientConfig.dataMode}</span>
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
          <button className="logout-button" onClick={onLogout} type="button">Logout</button>
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

        {page === "priorities" ? <PriorityDeskPage dashboard={dashboard} activeProject={activeProject} setActiveProjectId={setActiveProjectId} refreshAll={refreshAll} setPage={setPage} /> : null}
        {page === "map" ? <ExplorePage dashboard={dashboard} regions={regions} maps={clientConfig.maps} boundaries={mapBoundaries} clusters={mapClusters} setActiveProjectId={setActiveProjectId} setPage={setPage} /> : null}
        {page === "intake" ? <SimulationPage refreshAll={refreshAll} /> : null}
        {page === "copilot" ? <CopilotPage capabilities={copilotCapabilities} ragStatus={ragStatus} projects={dashboard.projects} /> : null}
      </section>
    </main>
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

function LoginPage({ onLogin }: { onLogin: (token: string) => void }) {
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
        body: JSON.stringify({ password })
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
      <section className="login-panel">
        <div className="brand-lock">
          <span>LS</span>
          <LockKeyhole size={22} />
        </div>
        <p className="eyebrow">Access Required</p>
        <h1>LokSetu Login</h1>
        <p>Enter the deployment password before using AI, submission, map, or dashboard APIs.</p>
        <form onSubmit={login}>
          <label>
            Password
            <input autoFocus onChange={(event) => setPassword(event.target.value)} type="password" value={password} />
          </label>
          {error ? <div className="login-error">{error}</div> : null}
          <button className="primary" disabled={busy || !password.trim()} type="submit">
            {busy ? <RefreshCw className="spin" size={16} /> : <Lock size={16} />}
            Login
          </button>
        </form>
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
    setPage("priorities");
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
    if (cleanQuestion === question.trim()) setQuestion("");
    try {
      const response = await apiFetch("/api/copilot/query", {
        method: "POST",
        body: JSON.stringify({ role, language, question: cleanQuestion, projectId: projectId || undefined })
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
              <div className={`message-body ${message.answer ? "assistant-answer" : ""}`}>
                {message.answer ? <AnswerContent text={message.text} /> : <p>{message.text}</p>}
                {message.answer?.citations.length ? (
                  <div className="message-citations" aria-label="Answer citations">
                    {message.answer.citations.slice(0, 5).map((citation, index) => (
                      <span key={`${citation.id}-${index}`}>[{index + 1}] {citation.title}</span>
                    ))}
                  </div>
                ) : null}
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
      const response = await apiFetch("/api/simulation/submit", {
        method: "POST",
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
  return ({ priorities: "Core workflow", map: "Demand hotspots", intake: "Citizen voice", copilot: "Grounded answers" })[page];
}

function pageTitle(page: Page): string {
  return ({
    priorities: "Ranked development priorities",
    map: "Where demand is concentrated",
    intake: "Bring citizen submissions in",
    copilot: "Ask why a work ranks high"
  })[page];
}
