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
  Network,
  RefreshCw,
  Scale,
  Search,
  Send,
  ShieldCheck,
  Star,
  Users
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type Page =
  | "home"
  | "explore"
  | "mp"
  | "projects"
  | "analytics"
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

type AnalyticsResponse = {
  signals: Array<{ name: string; value: string; trend: string }>;
  categoryMix: Array<{ category: string; score: number; demand: number; rating: number }>;
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
const googleMapsApiKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? "").trim();
const googleMapsMapId = (import.meta.env.VITE_GOOGLE_MAPS_MAP_ID ?? "").trim();
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

async function fetchDashboard(filters: { scope: Scope; state: string; district: string; ward: string; mpId: string; q: string }) {
  const params = new URLSearchParams({ scope: filters.scope });
  if (filters.scope === "local") {
    params.set("state", filters.state);
    params.set("district", filters.district);
    params.set("ward", filters.ward);
  }
  if (filters.scope === "mp") params.set("mpId", filters.mpId);
  if (filters.q.trim()) params.set("q", filters.q.trim());
  return getJson<DashboardResponse>(`/api/priorities?${params}`, fallbackDashboard);
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
  const [regions, setRegions] = useState<RegionResponse | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [aiOps, setAiOps] = useState<AiOpsResponse | null>(null);
  const [moderation, setModeration] = useState<ModerationResponse | null>(null);
  const [integrations, setIntegrations] = useState<IntegrationsResponse | null>(null);
  const [audit, setAudit] = useState<AuditResponse | null>(null);
  const [notice, setNotice] = useState("Connecting");
  const [activeProjectId, setActiveProjectId] = useState(fallbackProject.id);

  const filters = useMemo(() => ({ scope, state, district, ward, mpId, q: query }), [scope, state, district, ward, mpId, query]);
  const activeProject = dashboard.projects.find((project) => project.id === activeProjectId) ?? dashboard.projects[0] ?? fallbackProject;

  useEffect(() => {
    refreshAll();
    const onHashChange = () => setPageState(pageFromHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

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
    const [nextDashboard, nextRegions, nextAnalytics, nextAiOps, nextModeration, nextIntegrations, nextAudit] = await Promise.all([
      fetchDashboard(filters),
      getJson<RegionResponse>("/api/regions", {
        coverage: { statesReady: 28, unionTerritoriesReady: 8, lokSabhaConstituenciesTarget: 543, districtsTarget: 700, wardModel: "ward and panchayat" },
        onboardingStates: []
      }),
      getJson<AnalyticsResponse>("/api/analytics", { signals: [], categoryMix: [] }),
      getJson<AiOpsResponse>("/api/ai-ops", { provider: "Vertex AI", mode: "fallback", tasks: [], guardrails: [] }),
      getJson<ModerationResponse>("/api/moderation", { queue: [], policies: [] }),
      getJson<IntegrationsResponse>("/api/integrations", { enabled: [], planned: [], local: {} }),
      getJson<AuditResponse>("/api/audit", { events: [] })
    ]);
    setDashboard(nextDashboard);
    setRegions(nextRegions);
    setAnalytics(nextAnalytics);
    setAiOps(nextAiOps);
    setModeration(nextModeration);
    setIntegrations(nextIntegrations);
    setAudit(nextAudit);
    setActiveProjectId(nextDashboard.projects[0]?.id ?? fallbackProject.id);
    setNotice("Live");
  }

  async function applyFilters() {
    const next = await fetchDashboard(filters);
    setDashboard(next);
    setActiveProjectId(next.projects[0]?.id ?? fallbackProject.id);
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
        <nav>
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
        <a className="citizen-link" href={citizenAppUrl}>
          <Send size={16} />
          Open Apni Awaaz
        </a>
        <div className="status-pill">
          <CheckCircle2 size={16} />
          <span>{notice} · Postgres · Vertex-ready</span>
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

        <ControlStrip
          scope={scope}
          setScope={setScope}
          state={state}
          setState={setState}
          district={district}
          setDistrict={setDistrict}
          ward={ward}
          setWard={setWard}
          mpId={mpId}
          setMpId={setMpId}
          query={query}
          setQuery={setQuery}
          apply={applyFilters}
        />

        {page === "home" ? <HomePage dashboard={dashboard} aiOps={aiOps} integrations={integrations} setPage={setPage} /> : null}
        {page === "explore" ? <ExplorePage dashboard={dashboard} regions={regions} setActiveProjectId={setActiveProjectId} setPage={setPage} /> : null}
        {page === "mp" ? <MpPage dashboard={dashboard} activeProject={activeProject} setActiveProjectId={setActiveProjectId} /> : null}
        {page === "projects" ? <ProjectPage project={activeProject} projects={dashboard.projects} setActiveProjectId={setActiveProjectId} /> : null}
        {page === "analytics" ? <AnalyticsPage dashboard={dashboard} analytics={analytics} /> : null}
        {page === "simulation" ? <SimulationPage refreshAll={refreshAll} /> : null}
        {page === "ai" ? <AiPage aiOps={aiOps} /> : null}
        {page === "moderation" ? <ModerationPage moderation={moderation} audit={audit} /> : null}
        {page === "admin" ? <AdminPage regions={regions} /> : null}
        {page === "integrations" ? <IntegrationsPage integrations={integrations} /> : null}
        {page === "public" ? <PublicPage filters={filters} /> : null}
      </section>
    </main>
  );
}

function ControlStrip(props: {
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
  return (
    <section className="control-strip" aria-label="India search and locality controls">
      <div className="segmented">
        <button className={props.scope === "local" ? "active" : ""} onClick={() => props.setScope("local")}>My area</button>
        <button className={props.scope === "mp" ? "active" : ""} onClick={() => props.setScope("mp")}>My MP</button>
        <button className={props.scope === "global" ? "active" : ""} onClick={() => props.setScope("global")}>All India</button>
      </div>
      <select value={props.state} onChange={(event) => props.setState(event.target.value)} aria-label="State">
        <option>Delhi</option>
        <option>Maharashtra</option>
        <option>Tamil Nadu</option>
        <option>West Bengal</option>
        <option>Uttar Pradesh</option>
      </select>
      <select value={props.district} onChange={(event) => props.setDistrict(event.target.value)} aria-label="District">
        <option>Central Delhi</option>
        <option>East Delhi</option>
        <option>Nashik Rural</option>
        <option>Chennai</option>
        <option>Lucknow</option>
      </select>
      <select value={props.ward} onChange={(event) => props.setWard(event.target.value)} aria-label="Ward">
        <option>Kalindi Nagar</option>
        <option>River Market</option>
        <option>East Colony</option>
        <option>North Village</option>
      </select>
      <select value={props.mpId} onChange={(event) => props.setMpId(event.target.value)} aria-label="MP">
        <option value="mp-delhi-central">MP Central Delhi</option>
        <option value="mp-delhi-east">MP East Delhi</option>
        <option value="mp-maharashtra-north">MP North Maharashtra</option>
      </select>
      <span className="search-box">
        <Search size={16} />
        <input value={props.query} onChange={(event) => props.setQuery(event.target.value)} placeholder="Search school, road, water, ward" />
      </span>
      <button className="primary" onClick={props.apply}>Apply</button>
    </section>
  );
}

function formatCount(value: number) {
  return value.toLocaleString("en-IN");
}

function HomePage({
  dashboard,
  aiOps,
  integrations,
  setPage
}: {
  dashboard: DashboardResponse;
  aiOps: AiOpsResponse | null;
  integrations: IntegrationsResponse | null;
  setPage: (page: Page) => void;
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

function ExplorePage({ dashboard, regions, setActiveProjectId, setPage }: { dashboard: DashboardResponse; regions: RegionResponse | null; setActiveProjectId: (id: string) => void; setPage: (page: Page) => void }) {
  return (
    <section className="two-grid wide-left">
      <section className="panel">
        <PanelTitle title="All-India issue atlas" icon={Globe2} />
        <IssueMap dashboard={dashboard} setActiveProjectId={setActiveProjectId} setPage={setPage} />
      </section>
      <section className="panel">
        <PanelTitle title="State onboarding" icon={Flag} />
        <div className="table-list">
          {(regions?.onboardingStates ?? []).map((item) => (
            <div className="table-row" key={item.state}>
              <span>{item.state}</span>
              <strong>{item.readiness}%</strong>
              <small>{item.constituencies} constituencies · {item.districts} districts</small>
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}

function IssueMap({ dashboard, setActiveProjectId, setPage }: { dashboard: DashboardResponse; setActiveProjectId: (id: string) => void; setPage: (page: Page) => void }) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const [mapState, setMapState] = useState<MapLoadState>(googleMapsApiKey ? "idle" : "fallback");
  const hotspots = useMemo(() => buildMapHotspots(dashboard), [dashboard]);

  useEffect(() => {
    if (!googleMapsApiKey || hotspots.length === 0 || !mapRef.current) {
      setMapState("fallback");
      return;
    }

    let cancelled = false;
    setMapState("loading");

    loadGoogleMaps(googleMapsApiKey)
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
          ...(googleMapsMapId ? { mapId: googleMapsMapId } : {}),
          styles: [
            { featureType: "poi", stylers: [{ visibility: "off" }] },
            { featureType: "transit", stylers: [{ visibility: "off" }] }
          ]
        });

        hotspots.forEach((hotspot, index) => addHotspotMarker(map, hotspot, index, Boolean(googleMapsMapId), () => openProject(hotspot.projectId)));

        if (hotspots.length > 1) map.fitBounds(bounds, 60);
        setMapState("ready");
      })
      .catch(() => {
        if (!cancelled) setMapState("fallback");
      });

    return () => {
      cancelled = true;
    };
  }, [hotspots, setActiveProjectId, setPage]);

  function openProject(projectId: string) {
    setActiveProjectId(projectId);
    setPage("projects");
  }

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
          {mapState !== "ready" ? <FallbackSignalMap hotspots={hotspots} openProject={openProject} /> : null}
        </div>
        <div className="hotspot-list" aria-label="Map hotspot details">
          {hotspots.map((hotspot, index) => (
            <button className="hotspot-row" key={`${hotspot.projectId}-${hotspot.lat}-${hotspot.lng}`} onClick={() => openProject(hotspot.projectId)}>
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
    </div>
  );
}

function FallbackSignalMap({ hotspots, openProject }: { hotspots: Array<Hotspot & { projectId: string }>; openProject: (projectId: string) => void }) {
  return (
    <div className="fallback-map" aria-label="Local fallback map">
      {hotspots.map((hotspot, index) => {
        const position = indiaProjection(hotspot.lat, hotspot.lng);
        return (
          <button
            className="hotspot"
            key={`${hotspot.projectId}-${index}`}
            style={{
              left: `${position.x}%`,
              top: `${position.y}%`,
              width: `${48 + hotspot.intensity / 3}px`,
              height: `${48 + hotspot.intensity / 3}px`
            }}
            onClick={() => openProject(hotspot.projectId)}
            title={`${hotspot.category} in ${hotspot.ward}`}
          >
            {index + 1}
          </button>
        );
      })}
    </div>
  );
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

function loadGoogleMaps(key: string): Promise<void> {
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
    if (googleMapsMapId) params.set("libraries", "marker");
    window.__loksetuGoogleMapsLoaded = () => resolve();
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error("Google Maps failed to load"));
    document.head.appendChild(script);
  });

  return window.__loksetuGoogleMapsPromise;
}

function MpPage({ dashboard, activeProject, setActiveProjectId }: { dashboard: DashboardResponse; activeProject: RankedProject; setActiveProjectId: (id: string) => void }) {
  return (
    <section className="two-grid">
      <section className="panel">
        <PanelTitle title="MP action queue" icon={Building2} />
        <ProjectList projects={dashboard.projects} activeId={activeProject.id} setActiveProjectId={setActiveProjectId} />
      </section>
      <ProjectBrief project={activeProject} />
    </section>
  );
}

function ProjectPage({ project, projects, setActiveProjectId }: { project: RankedProject; projects: RankedProject[]; setActiveProjectId: (id: string) => void }) {
  return (
    <section className="two-grid wide-right">
      <section className="panel">
        <PanelTitle title="Project rooms" icon={FileText} />
        <ProjectList projects={projects} activeId={project.id} setActiveProjectId={setActiveProjectId} />
      </section>
      <ProjectBrief project={project} full />
    </section>
  );
}

function AnalyticsPage({ dashboard, analytics }: { dashboard: DashboardResponse; analytics: AnalyticsResponse | null }) {
  return (
    <>
      <MetricGrid dashboard={dashboard} />
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
    </>
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

function AdminPage({ regions }: { regions: RegionResponse | null }) {
  return (
    <section className="three-grid">
      <Feature title="User and role model" icon={Users} points={["Citizen accounts", "MP accounts", "Ward staff", "State admin", "Privacy defaults"]} />
      <Feature title="India hierarchy" icon={MapPin} points={["State", "District", "Constituency", "Ward/Panchayat", regions?.coverage.wardModel ?? "local unit"]} />
      <Feature title="Operations" icon={Activity} points={["SLO dashboard", "Queue replay", "Data retention", "Incident audit", "Model versioning"]} />
    </section>
  );
}

function IntegrationsPage({ integrations }: { integrations: IntegrationsResponse | null }) {
  return (
    <section className="three-grid">
      <Feature title="Enabled now" icon={CheckCircle2} points={integrations?.enabled ?? []} />
      <Feature title="Production connectors" icon={Network} points={integrations?.planned ?? []} />
      <Feature title="Local runtime" icon={Database} points={Object.entries(integrations?.local ?? {}).map(([key, value]) => `${key}: ${value}`)} />
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

function ProjectBrief({ project, full }: { project: RankedProject; full?: boolean }) {
  return (
    <section className="panel">
      <PanelTitle title={project.title} icon={FileText} detail={`${project.mpName} · ${Math.round(project.confidence * 100)}% confidence`} />
      <p className="rationale">{project.rationale}</p>
      <div className="chips">
        <span><Star size={14} /> {project.averageRating}/5 from {project.ratings}</span>
        <span><Languages size={14} /> {project.languageMix.join(", ")}</span>
        <span><MapPin size={14} /> {project.district}, {project.state}</span>
      </div>
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
  return ({ home: "Command home", explore: "India problem search", mp: "MP workspace", projects: "Project evidence", analytics: "Demand intelligence", simulation: "Simulation workbench", ai: "Vertex AI operations", moderation: "Trust and safety", admin: "Platform administration", integrations: "Cloud and data", public: "Public transparency" })[page];
}

function pageTitle(page: Page): string {
  return ({ home: "LokSetu operating system", explore: "Search problems across India", mp: "Localized MP command center", projects: "Evidence-backed project rooms", analytics: "Demand, equity, and urgency analytics", simulation: "Generate realistic civic intake", ai: "AI pipeline and model controls", moderation: "Privacy, abuse, and review queues", admin: "Users, regions, and rollout controls", integrations: "Production integration status", public: "Citizen-facing transparency" })[page];
}
