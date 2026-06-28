import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bot,
  Building2,
  CheckCircle2,
  Database,
  FileText,
  Flag,
  Globe2,
  Home,
  Languages,
  Lock,
  Map,
  MapPin,
  Megaphone,
  MessageSquareText,
  Mic,
  Network,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Smartphone,
  Star,
  Users
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

type Page =
  | "home"
  | "submit"
  | "explore"
  | "mp"
  | "projects"
  | "analytics"
  | "ai"
  | "moderation"
  | "admin"
  | "integrations"
  | "public";

type Channel = "text" | "voice" | "photo" | "whatsapp";
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

const apiBase = import.meta.env.VITE_API_BASE_URL ?? "";

const navItems: Array<{ page: Page; label: string; icon: typeof Home }> = [
  { page: "home", label: "Home", icon: Home },
  { page: "submit", label: "Citizen Submit", icon: Send },
  { page: "explore", label: "India Explorer", icon: Map },
  { page: "mp", label: "MP Center", icon: Building2 },
  { page: "projects", label: "Project Rooms", icon: FileText },
  { page: "analytics", label: "Analytics", icon: BarChart3 },
  { page: "ai", label: "AI Ops", icon: Bot },
  { page: "moderation", label: "Moderation", icon: ShieldCheck },
  { page: "admin", label: "Admin", icon: Users },
  { page: "integrations", label: "Integrations", icon: Network },
  { page: "public", label: "Public", icon: Megaphone }
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
  const [page, setPage] = useState<Page>("home");
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
  }, []);

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
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button className={`nav-item ${page === item.page ? "active" : ""}`} key={item.page} onClick={() => setPage(item.page)}>
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
        </nav>
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

        {page === "home" ? <HomePage dashboard={dashboard} regions={regions} setPage={setPage} /> : null}
        {page === "submit" ? <SubmitPage refresh={refreshAll} /> : null}
        {page === "explore" ? <ExplorePage dashboard={dashboard} regions={regions} setActiveProjectId={setActiveProjectId} setPage={setPage} /> : null}
        {page === "mp" ? <MpPage dashboard={dashboard} activeProject={activeProject} setActiveProjectId={setActiveProjectId} /> : null}
        {page === "projects" ? <ProjectPage project={activeProject} projects={dashboard.projects} setActiveProjectId={setActiveProjectId} /> : null}
        {page === "analytics" ? <AnalyticsPage dashboard={dashboard} analytics={analytics} /> : null}
        {page === "ai" ? <AiPage aiOps={aiOps} /> : null}
        {page === "moderation" ? <ModerationPage moderation={moderation} audit={audit} /> : null}
        {page === "admin" ? <AdminPage regions={regions} /> : null}
        {page === "integrations" ? <IntegrationsPage integrations={integrations} /> : null}
        {page === "public" ? <PublicPage dashboard={dashboard} /> : null}
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

function HomePage({ dashboard, regions, setPage }: { dashboard: DashboardResponse; regions: RegionResponse | null; setPage: (page: Page) => void }) {
  return (
    <>
      <section className="hero-band">
        <div>
          <p className="eyebrow">Citizen voice to funded project</p>
          <h3>Multilingual problem intake, MP-local prioritization, India-wide public discovery.</h3>
          <p>Built for voice, text, photo, WhatsApp, privacy aliases, ratings, hard-data scoring, and human review before action.</p>
          <div className="hero-actions">
            <button className="primary" onClick={() => setPage("submit")}><Send size={17} /> Submit problem</button>
            <button onClick={() => setPage("explore")}><Globe2 size={17} /> Explore India</button>
          </div>
        </div>
        <div className="india-card">
          <span>India readiness</span>
          <strong>{regions?.coverage.statesReady ?? 28}+{regions?.coverage.unionTerritoriesReady ?? 8}</strong>
          <small>states and UTs model-ready, target {regions?.coverage.lokSabhaConstituenciesTarget ?? 543} Lok Sabha constituencies</small>
        </div>
      </section>
      <MetricGrid dashboard={dashboard} />
      <section className="three-grid">
        <Feature title="For citizens" icon={Smartphone} points={["Default local area", "All-India search", "Privacy alias", "Contribution score"]} />
        <Feature title="For MPs" icon={Building2} points={["Ward queue", "Evidence packs", "Shortlist workflow", "Equity guardrails"]} />
        <Feature title="For admins" icon={ShieldCheck} points={["Moderation", "Language ops", "Data sources", "Audit trail"]} />
      </section>
    </>
  );
}

function SubmitPage({ refresh }: { refresh: () => void }) {
  const [channel, setChannel] = useState<Channel>("text");
  const [username, setUsername] = useState("citizen");
  const [privacyMode, setPrivacyMode] = useState(true);
  const [language, setLanguage] = useState("Auto detect");
  const [state, setState] = useState("Delhi");
  const [district, setDistrict] = useState("Central Delhi");
  const [ward, setWard] = useState("Kalindi Nagar");
  const [urgency, setUrgency] = useState(4);
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("School toilets are broken and classrooms flood after rain.");
  const [score, setScore] = useState<number | null>(null);
  const [result, setResult] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    const response = await fetch(`${apiBase}/api/submissions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel, username, privacyMode, language, state, district, ward, urgency, rating, text })
    });
    const payload = await response.json();
    setScore(payload.citizenScore);
    setResult(`${payload.submission.detectedLanguage} · ${payload.submission.category} · ${payload.submission.displayName}`);
    refresh();
  }

  return (
    <section className="two-grid">
      <form className="panel form-panel" onSubmit={submit}>
        <PanelTitle title="Citizen problem intake" icon={MessageSquareText} />
        <div className="channel-row">
          {[
            ["text", MessageSquareText],
            ["voice", Mic],
            ["photo", MapPin],
            ["whatsapp", Smartphone]
          ].map(([value, Icon]) => (
            <button className={`channel ${channel === value ? "active" : ""}`} key={value as string} type="button" onClick={() => setChannel(value as Channel)}>
              <Icon size={17} /> {value as string}
            </button>
          ))}
        </div>
        <div className="form-grid">
          <Input label="Username" value={username} setValue={setUsername} />
          <label className="check-row"><input checked={privacyMode} onChange={(event) => setPrivacyMode(event.target.checked)} type="checkbox" /> Privacy alias</label>
          <Select label="Language" value={language} setValue={setLanguage} options={["Auto detect", "Hindi", "Tamil", "Bangla", "Marathi", "English"]} />
          <Select label="State" value={state} setValue={setState} options={["Delhi", "Maharashtra", "Tamil Nadu", "West Bengal", "Uttar Pradesh"]} />
          <Select label="District" value={district} setValue={setDistrict} options={["Central Delhi", "East Delhi", "Nashik Rural", "Chennai", "Lucknow"]} />
          <Select label="Ward/Panchayat" value={ward} setValue={setWard} options={["Kalindi Nagar", "River Market", "East Colony", "North Village"]} />
        </div>
        <label>Problem<textarea value={text} onChange={(event) => setText(event.target.value)} /></label>
        <label>Urgency {urgency}<input min="1" max="5" type="range" value={urgency} onChange={(event) => setUrgency(Number(event.target.value))} /></label>
        <label>Citizen rating {rating}<input min="1" max="5" type="range" value={rating} onChange={(event) => setRating(Number(event.target.value))} /></label>
        <button className="primary" type="submit"><Send size={17} /> Submit and score</button>
      </form>
      <section className="panel">
        <PanelTitle title="AI processing receipt" icon={Bot} />
        <div className="receipt">
          <strong>{score ?? "--"}</strong>
          <span>society contribution score</span>
          <p>{result || "Submit once to see language, category, alias, and score."}</p>
        </div>
        <Feature title="Processing pipeline" icon={Languages} points={["Detect language", "Normalize text through Vertex AI", "Classify civic category", "Route to MP and ward", "Save in Postgres"]} />
      </section>
    </section>
  );
}

function ExplorePage({ dashboard, regions, setActiveProjectId, setPage }: { dashboard: DashboardResponse; regions: RegionResponse | null; setActiveProjectId: (id: string) => void; setPage: (page: Page) => void }) {
  return (
    <section className="two-grid wide-left">
      <section className="panel">
        <PanelTitle title="All-India issue atlas" icon={Globe2} />
        <div className="map-canvas india-map">
          {dashboard.projects.map((project, index) => (
            <button
              className="hotspot"
              key={project.id}
              style={{ left: `${18 + (index * 17) % 68}%`, top: `${24 + (index * 23) % 55}%`, width: `${48 + project.score / 3}px`, height: `${48 + project.score / 3}px` }}
              onClick={() => {
                setActiveProjectId(project.id);
                setPage("projects");
              }}
            >
              {project.score}
            </button>
          ))}
        </div>
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

function PublicPage({ dashboard }: { dashboard: DashboardResponse }) {
  return (
    <section className="panel">
      <PanelTitle title="Public transparency board" icon={Megaphone} />
      <div className="project-grid">
        {dashboard.projects.map((project) => (
          <article className="public-card" key={project.id}>
            <span>{project.category}</span>
            <h3>{project.title}</h3>
            <p>{project.rationale}</p>
            <small>{project.demandCount} reports · {project.averageRating}/5 rating · {project.status}</small>
          </article>
        ))}
      </div>
    </section>
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

function Input({ label, value, setValue }: { label: string; value: string; setValue: (value: string) => void }) {
  return <label>{label}<input value={value} onChange={(event) => setValue(event.target.value)} /></label>;
}

function Select({ label, value, setValue, options }: { label: string; value: string; setValue: (value: string) => void; options: string[] }) {
  return <label>{label}<select value={value} onChange={(event) => setValue(event.target.value)}>{options.map((option) => <option key={option}>{option}</option>)}</select></label>;
}

function pageLabel(page: Page): string {
  return ({ home: "Command home", submit: "Citizen channel", explore: "India problem search", mp: "MP workspace", projects: "Project evidence", analytics: "Demand intelligence", ai: "Vertex AI operations", moderation: "Trust and safety", admin: "Platform administration", integrations: "Cloud and data", public: "Public transparency" })[page];
}

function pageTitle(page: Page): string {
  return ({ home: "LokSetu operating system", submit: "Submit a local problem", explore: "Search problems across India", mp: "Localized MP command center", projects: "Evidence-backed project rooms", analytics: "Demand, equity, and urgency analytics", ai: "AI pipeline and model controls", moderation: "Privacy, abuse, and review queues", admin: "Users, regions, and rollout controls", integrations: "Production integration status", public: "Citizen-facing transparency" })[page];
}
