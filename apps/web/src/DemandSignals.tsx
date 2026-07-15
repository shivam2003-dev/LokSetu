import {
  ArrowRight,
  CheckCircle2,
  Database,
  FileText,
  Globe,
  Hash,
  Landmark,
  LineChart,
  Loader2,
  MapPin,
  MessagesSquare,
  Newspaper,
  RefreshCw,
  Search,
  Share2,
  TrendingDown,
  TrendingUp,
  Users,
  Youtube
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const accessTokenKey = "loksetuAccessToken";
const apiBase = import.meta.env.VITE_API_BASE_URL ?? "";

type TimeRange = "current" | "30d" | "1y" | "compare";
type RegionMode = "all" | "state" | "ut";
type DetailPanel = "sources" | "recommendations" | "trends" | null;

type RankedProject = {
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
  demandScore: number;
  needScore: number;
  urgencyScore: number;
  equityScore: number;
  evidence: string[];
  rationale: string;
  status: "review" | "shortlist" | "approved";
  sourceFreshness?: "fresh" | "stale" | "missing";
};

type DashboardResponse = {
  generatedAt: string;
  totals: { submissions: number; wards: number; languages: number; botRisk: "low" | "medium" | "high" };
  projects: RankedProject[];
};

type ContextResponse = {
  states: string[];
  districtsByState: Record<string, string[]>;
  wardsByDistrict: Record<string, string[]>;
};

type DataSourcesResponse = {
  snapshots: Array<{
    id: string;
    source: string;
    version: string;
    state: string;
    district: string;
    ward: string;
    capturedAt: string;
    rowCount: number;
    freshness: "fresh" | "stale" | "missing";
    metrics: Record<string, number | string>;
  }>;
  freshness: Record<string, number>;
  missingWarnings: string[];
};

type DailyIntelligenceResponse = {
  generatedAt: string;
  digest: string[];
  viralLocalTopics: Array<{ topic: string; mentions: number; trend: "rising" | "stable" }>;
  recommendations: Array<{ owner: string; action: string; reason: string; nextStep: string }>;
  forecast: Array<{ category: string; area: string; risk: string; driver: string }>;
  sourceCoverage: { totalSources: number; liveOrReady: number; byReadiness: Record<string, number> };
};

type ExternalSignalsResponse = {
  query: string;
  runs: Array<{ provider: string; mode: "live" | "fallback"; accepted: number; signals: Array<{ text: string; source: string; state?: string; district?: string; ward?: string; url?: string }> }>;
  totalAccepted: number;
  note: string;
};

type Region = { name: string; kind: "state" | "ut" };
type CategorySummary = {
  category: string;
  demand: number;
  projects: number;
  score: number;
  confidence: number;
  rating: number;
  evidence: string[];
  topProject: RankedProject;
};

const stateRegions: Region[] = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal"
].map((name) => ({ name, kind: "state" as const }));

const unionTerritoryRegions: Region[] = [
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry"
].map((name) => ({ name, kind: "ut" as const }));

const regionOptions: Region[] = [...stateRegions, ...unionTerritoryRegions];

const issueColors: Record<string, string> = {
  Roads: "#7c3aed",
  Water: "#2563eb",
  Health: "#16a34a",
  Healthcare: "#16a34a",
  Education: "#d97706",
  Sanitation: "#0d9488",
  Power: "#e11d48",
  "Digital Access": "#0891b2",
  "Civic Services": "#64748b"
};

const timeRanges: Array<{ key: TimeRange; label: string; description: string }> = [
  { key: "current", label: "Current Batch", description: "Processed citizen intake" },
  { key: "30d", label: "Last 30 Days", description: "Current API corpus" },
  { key: "1y", label: "Last 1 Year", description: "Historical connector pending" },
  { key: "compare", label: "Compare Sources", description: "Citizen vs official evidence" }
];

const sourcesStrip = [
  { label: "Citizen Intake", icon: MessagesSquare },
  { label: "News", icon: Newspaper },
  { label: "Social Media", icon: Share2 },
  { label: "Search Trends", icon: LineChart },
  { label: "Govt Portals", icon: Landmark },
  { label: "Official Data", icon: Database },
  { label: "Public Meetings", icon: Users },
  { label: "Documents", icon: FileText },
  { label: "YouTube", icon: Youtube }
];

const emptyDashboard: DashboardResponse = {
  generatedAt: new Date().toISOString(),
  totals: { submissions: 0, wards: 0, languages: 0, botRisk: "low" },
  projects: []
};

const emptyDaily: DailyIntelligenceResponse = {
  generatedAt: new Date().toISOString(),
  digest: [],
  viralLocalTopics: [],
  recommendations: [],
  forecast: [],
  sourceCoverage: { totalSources: 0, liveOrReady: 0, byReadiness: {} }
};

function authHeaders() {
  const token = localStorage.getItem(accessTokenKey) ?? "";
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

async function requestJson<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, { headers: authHeaders() });
  if (response.status === 401) {
    localStorage.removeItem(accessTokenKey);
    window.location.hash = "";
    window.location.reload();
    throw new Error("Session expired. Please log in again.");
  }
  if (!response.ok) throw new Error(path);
  return response.json() as Promise<T>;
}

function colorFor(category: string) {
  return issueColors[category] ?? "#64748b";
}

function formatCount(value: number) {
  return new Intl.NumberFormat("en-IN").format(value);
}

function pct(value: number) {
  return `${Math.round(value)}%`;
}

function selectedRegionName(mode: RegionMode, region: string) {
  if (mode === "all") return "All India and UTs";
  return region || (mode === "ut" ? "Union Territory" : "State");
}

function buildDashboardPath(mode: RegionMode, region: string) {
  if (mode === "all") return "/api/priorities?scope=global";
  const params = new URLSearchParams({ state: region });
  return `/api/priorities?${params}`;
}

function summarizeCategories(projects: RankedProject[]): CategorySummary[] {
  const groups = new Map<string, RankedProject[]>();
  for (const project of projects) {
    groups.set(project.category, [...(groups.get(project.category) ?? []), project]);
  }
  return [...groups.entries()]
    .map(([category, items]) => {
      const demand = items.reduce((sum, item) => sum + item.demandCount, 0);
      const score = average(items.map((item) => item.score));
      const confidence = average(items.map((item) => item.confidence * 100));
      const rating = average(items.map((item) => item.averageRating));
      const topProject = [...items].sort((a, b) => b.score - a.score || b.demandCount - a.demandCount)[0];
      return {
        category,
        demand,
        projects: items.length,
        score,
        confidence,
        rating,
        evidence: [...new Set(items.flatMap((item) => item.evidence))].slice(0, 4),
        topProject
      };
    })
    .sort((a, b) => b.demand - a.demand || b.score - a.score);
}

function buildSourceMix(dashboard: DashboardResponse, snapshots: DataSourcesResponse["snapshots"]) {
  const officialRows = snapshots.reduce((sum, item) => sum + item.rowCount, 0);
  const citizenRows = dashboard.totals.submissions;
  const total = Math.max(1, citizenRows + officialRows);
  const freshSnapshots = snapshots.filter((item) => item.freshness === "fresh").length;
  const staleOrMissingSnapshots = snapshots.filter((item) => item.freshness !== "fresh").length;
  return [
    { label: "Citizen submissions", value: citizenRows, share: Math.round((citizenRows / total) * 100), color: "#7c3aed" },
    { label: "Official source rows", value: officialRows, share: Math.round((officialRows / total) * 100), color: "#2563eb" },
    { label: "Fresh source snapshots", value: freshSnapshots, share: Math.round((freshSnapshots / Math.max(1, snapshots.length)) * 100), color: "#16a34a" },
    { label: "Stale/missing snapshots", value: staleOrMissingSnapshots, share: Math.round((staleOrMissingSnapshots / Math.max(1, snapshots.length)) * 100), color: "#d97706" }
  ];
}

function buildCompareRows(categories: CategorySummary[]) {
  return categories.slice(0, 6).map((entry) => ({
    issue: entry.category,
    demand: entry.demand,
    works: entry.projects,
    score: Math.round(entry.score),
    confidence: Math.round(entry.confidence),
    rating: entry.rating.toFixed(1)
  }));
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function TrendLine({ color, value }: { color: string; value: number }) {
  const points = useMemo(() => {
    const baseline = Math.max(8, Math.min(28, 32 - value / 4));
    return Array.from({ length: 12 }, (_, index) => {
      const x = (index / 11) * 96 + 2;
      const y = Math.max(4, Math.min(30, baseline - Math.sin(index * 1.2) * 2 - index * 0.45));
      return `${x},${y}`;
    }).join(" ");
  }, [value]);
  return (
    <svg aria-hidden="true" className="dsi-sparkline" viewBox="0 0 100 34">
      <polyline fill="none" points={points} stroke={color} strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

function ConfidenceRing({ value }: { value: number }) {
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  return (
    <svg className="dsi-ring" role="img" aria-label={`${value}% confidence`} viewBox="0 0 52 52">
      <circle cx="26" cy="26" fill="none" r={radius} stroke="#e4e8ef" strokeWidth="5" />
      <circle
        cx="26"
        cy="26"
        fill="none"
        r={radius}
        stroke="#16a34a"
        strokeDasharray={`${(value / 100) * circumference} ${circumference}`}
        strokeLinecap="round"
        strokeWidth="5"
        transform="rotate(-90 26 26)"
      />
      <text dominantBaseline="central" textAnchor="middle" x="26" y="27">{value}%</text>
    </svg>
  );
}

function SourceDonut({ mix }: { mix: ReturnType<typeof buildSourceMix> }) {
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <svg className="dsi-donut" role="img" aria-label="Share of demand evidence by source" viewBox="0 0 160 160">
      {mix.map((entry) => {
        const length = (entry.share / 100) * circumference;
        const segment = (
          <circle
            cx="80"
            cy="80"
            fill="none"
            key={entry.label}
            r={radius}
            stroke={entry.color}
            strokeDasharray={`${Math.max(0, length - 3)} ${circumference - length + 3}`}
            strokeDashoffset={-offset}
            strokeWidth="22"
            transform="rotate(-90 80 80)"
          />
        );
        offset += length;
        return segment;
      })}
    </svg>
  );
}

function EvidenceTimeline({ categories }: { categories: CategorySummary[] }) {
  const maxDemand = Math.max(1, ...categories.map((entry) => entry.demand));
  return (
    <div className="dsi-evidence-bars" aria-label="Current processed evidence by issue">
      {categories.slice(0, 6).map((entry) => (
        <div className="dsi-evidence-row" key={entry.category}>
          <span><i style={{ background: colorFor(entry.category) }} />{entry.category}</span>
          <strong>{formatCount(entry.demand)}</strong>
          <b><i style={{ width: `${Math.max(8, (entry.demand / maxDemand) * 100)}%`, background: colorFor(entry.category) }} /></b>
        </div>
      ))}
      {!categories.length ? <div className="dsi-empty">No processed demand signals for this selection.</div> : null}
    </div>
  );
}

function Heatmap({ projects, selectedId, setSelectedId }: { projects: RankedProject[]; selectedId: string; setSelectedId: (id: string) => void }) {
  const maxScore = Math.max(1, ...projects.map((project) => project.score));
  return (
    <div className="dsi-real-heatmap" role="group" aria-label="Real demand intensity by area">
      {projects.slice(0, 16).map((project) => {
        const intensity = project.score / maxScore;
        return (
          <button
            className={selectedId === project.id ? "selected" : ""}
            key={project.id}
            onClick={() => setSelectedId(project.id)}
            style={{ background: heatColor(intensity) }}
            type="button"
          >
            <strong>{project.ward}</strong>
            <span>{project.state}</span>
          </button>
        );
      })}
      {!projects.length ? <div className="dsi-empty">No area cells yet. Submit citizen reports or run batch processing for this region.</div> : null}
    </div>
  );
}

function heatColor(intensity: number) {
  if (intensity >= 0.85) return "#dc2626";
  if (intensity >= 0.65) return "#ea580c";
  if (intensity >= 0.5) return "#f59e0b";
  if (intensity >= 0.35) return "#d3c837";
  return "#8db54b";
}

export function DemandSignalsPage() {
  const [range, setRange] = useState<TimeRange>("current");
  const [regionMode, setRegionMode] = useState<RegionMode>("all");
  const [region, setRegion] = useState("Delhi");
  const [dashboard, setDashboard] = useState<DashboardResponse>(emptyDashboard);
  const [context, setContext] = useState<ContextResponse | null>(null);
  const [dataSources, setDataSources] = useState<DataSourcesResponse | null>(null);
  const [daily, setDaily] = useState<DailyIntelligenceResponse>(emptyDaily);
  const [external, setExternal] = useState<ExternalSignalsResponse | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [detail, setDetail] = useState<DetailPanel>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activeRegion = selectedRegionName(regionMode, region);
  const filteredSnapshots = useMemo(
    () => (dataSources?.snapshots ?? []).filter((source) => regionMode === "all" || source.state === region),
    [dataSources, regionMode, region]
  );
  const visibleRegions = regionOptions.filter((item) => item.kind === regionMode);
  const categories = useMemo(() => summarizeCategories(dashboard.projects), [dashboard.projects]);
  const topCategory = categories[0];
  const selectedProject = dashboard.projects.find((project) => project.id === selectedProjectId) ?? dashboard.projects[0];
  const sourceMix = useMemo(() => buildSourceMix(dashboard, filteredSnapshots), [dashboard, filteredSnapshots]);
  const compareRows = useMemo(() => buildCompareRows(categories), [categories]);
  const liveExternalRuns = external?.runs.filter((run) => run.mode === "live") ?? [];
  const externalFallbackRuns = external?.runs.filter((run) => run.mode === "fallback") ?? [];
  const regionRecommendations = dashboard.projects.slice(0, 5).map((project) => ({
    action: `Open ${project.category.toLowerCase()} review for ${project.ward}`,
    reason: `${formatCount(project.demandCount)} demand signals, ${Math.round(project.confidence * 100)}% confidence`,
    nextStep: project.status === "review" ? "shortlist for MP review" : project.status === "shortlist" ? "request district estimate" : "track delivery milestones",
    owner: project.mpName
  }));
  const regionForecast = dashboard.projects.slice(0, 4).map((project) => ({
    category: project.category,
    area: project.ward,
    risk: project.urgencyScore >= 13 ? "likely to escalate" : "monitor weekly",
    driver: project.evidence[0] ?? project.rationale
  }));
  const regionFindings = [
    `${activeRegion} has ${dashboard.projects.length} ranked works from ${dashboard.totals.submissions} processed citizen submissions.`,
    topCategory ? `${topCategory.category} leads with ${formatCount(topCategory.demand)} demand signals.` : "No processed issue category for this filter yet.",
    `${dashboard.totals.wards} wards and ${dashboard.totals.languages} languages represented in this selection.`,
    `${filteredSnapshots.filter((source) => source.freshness === "fresh").length} official snapshots are fresh; ${filteredSnapshots.filter((source) => source.freshness !== "fresh").length} source gaps need review.`
  ];
  const sourceInputs = [
    `${dashboard.totals.submissions} citizen submissions`,
    `${dashboard.totals.wards} wards`,
    `${filteredSnapshots.length} official snapshots`,
    `${filteredSnapshots.filter((source) => source.freshness === "fresh").length} fresh sources`,
    `${daily.sourceCoverage.liveOrReady}/${daily.sourceCoverage.totalSources} connectors ready`,
    `${liveExternalRuns.reduce((sum, run) => sum + run.accepted, 0)} live external signals`
  ];
  const confidence = Math.round(topCategory?.confidence ?? 0);
  const score = Math.round(topCategory?.score ?? 0);

  useEffect(() => {
    let cancelled = false;
    async function loadSignals() {
      setLoading(true);
      setError(null);
      try {
        const [nextContext, nextDashboard, nextDataSources, nextDaily] = await Promise.all([
          requestJson<ContextResponse>("/api/context"),
          requestJson<DashboardResponse>(buildDashboardPath(regionMode, region)),
          requestJson<DataSourcesResponse>("/api/data-sources"),
          requestJson<DailyIntelligenceResponse>("/api/intelligence/daily")
        ]);
        if (cancelled) return;
        setContext(nextContext);
        setDashboard(nextDashboard);
        setDataSources(nextDataSources);
        setDaily(nextDaily);
        setSelectedProjectId((current) => nextDashboard.projects.some((project) => project.id === current) ? current : nextDashboard.projects[0]?.id ?? "");
        const issueQuery = nextDashboard.projects[0]?.category ?? "civic issue";
        const externalQuery = encodeURIComponent(`${issueQuery} ${regionMode === "all" ? "India" : region}`);
        requestJson<ExternalSignalsResponse>(`/api/external-signals?q=${externalQuery}`)
          .then((nextExternal) => {
            if (!cancelled) setExternal(nextExternal);
          })
          .catch(() => {
            if (!cancelled) setExternal(null);
          });
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : "Demand signals API unavailable");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadSignals();
    return () => {
      cancelled = true;
    };
  }, [regionMode, region]);

  function updateRegionMode(nextMode: RegionMode) {
    setRegionMode(nextMode);
    if (nextMode !== "all") {
      const corpusRegion = context?.states.find((state) => regionOptions.some((item) => item.name === state && item.kind === nextMode));
      const first = corpusRegion ?? regionOptions.find((item) => item.kind === nextMode)?.name;
      if (first) setRegion(first);
    }
  }

  return (
    <section className="dsi-page">
      <header className="panel dsi-topbar">
        <div className="dsi-title">
          <span className="dsi-globe"><Globe size={20} /></span>
          <div>
            <h3>Demand Signals Intelligence</h3>
            <p>Real LokSetu queue built from processed citizen intake, official snapshots, and configured connectors.</p>
          </div>
        </div>
        <div className="dsi-sources">
          <div className="dsi-sources-head">
            <strong>Sources</strong>
            <button onClick={() => setDetail(detail === "sources" ? null : "sources")} type="button">View All</button>
          </div>
          <div className="dsi-source-chips">
            {sourcesStrip.map((source) => {
              const Icon = source.icon;
              return (
                <span key={source.label}>
                  <Icon size={14} />
                  {source.label}
                </span>
              );
            })}
          </div>
        </div>
      </header>

      <section className="panel dsi-filterbar" aria-label="State and union territory filters">
        <div className="segmented">
          <button className={regionMode === "all" ? "active" : ""} onClick={() => updateRegionMode("all")} type="button">All India + UT</button>
          <button className={regionMode === "state" ? "active" : ""} onClick={() => updateRegionMode("state")} type="button">States</button>
          <button className={regionMode === "ut" ? "active" : ""} onClick={() => updateRegionMode("ut")} type="button">Union Territories</button>
        </div>
        {regionMode !== "all" ? (
          <select aria-label={regionMode === "ut" ? "Union Territory" : "State"} onChange={(event) => setRegion(event.target.value)} value={region}>
            {visibleRegions.map((item) => (
              <option key={item.name} value={item.name}>{item.name}</option>
            ))}
          </select>
        ) : null}
        <div className="dsi-filter-status">
          <MapPin size={14} />
          <span>{activeRegion}</span>
          {loading ? <Loader2 className="spin" size={14} /> : <RefreshCw size={14} />}
        </div>
      </section>

      {error ? <div className="error-state">{error}</div> : null}

      {detail ? (
        <section className="panel dsi-detail-panel">
          <button aria-label="Close expanded signal panel" onClick={() => setDetail(null)} type="button">Close</button>
          {detail === "sources" ? (
            <>
              <h4>All Source Evidence</h4>
              <div className="dsi-source-table">
                {filteredSnapshots.map((source) => (
                  <article key={source.id}>
                    <strong>{source.source}</strong>
                    <span>{source.ward}, {source.district}, {source.state}</span>
                    <small>{source.rowCount} rows - {source.freshness} - {source.version}</small>
                  </article>
                ))}
              </div>
              {externalFallbackRuns.length ? <p className="dsi-source-warning">External web connectors returned fallback data. Live X/GDELT credentials or availability required before using them as real evidence.</p> : null}
            </>
          ) : null}
          {detail === "recommendations" ? (
            <>
              <h4>All Recommended Actions</h4>
              <div className="dsi-source-table">
                {regionRecommendations.map((entry) => (
                  <article key={`${entry.owner}-${entry.action}`}>
                    <strong>{entry.action}</strong>
                    <span>{entry.owner}</span>
                    <small>{entry.reason}. Next: {entry.nextStep}</small>
                  </article>
                ))}
              </div>
            </>
          ) : null}
          {detail === "trends" ? (
            <>
              <h4>All Real Trends</h4>
              <div className="dsi-source-table">
                {categories.map((entry) => (
                  <article key={entry.category}>
                    <strong>{entry.category}</strong>
                    <span>{formatCount(entry.demand)} demand signals across {entry.projects} ranked works</span>
                    <small>{entry.topProject.ward}, {entry.topProject.district}, {entry.topProject.state} leads this issue.</small>
                  </article>
                ))}
              </div>
            </>
          ) : null}
        </section>
      ) : null}

      <div className="dsi-insights-document" role="group" aria-label="Demand signals intelligence analysis">
      <div className="dsi-row dsi-row-1">
        <section className="panel dsi-time" aria-label="Evidence window">
          <h4>Evidence Window</h4>
          <div className="dsi-radio-list" role="radiogroup" aria-label="Evidence window">
            {timeRanges.map((entry) => (
              <label className={range === entry.key ? "active" : ""} key={entry.key}>
                <input checked={range === entry.key} name="dsi-range" onChange={() => setRange(entry.key)} type="radio" />
                {entry.label}
              </label>
            ))}
          </div>
          <span className="dsi-window">{timeRanges.find((item) => item.key === range)?.description}</span>
        </section>

        <section className="panel dsi-growth" aria-label="Current demand by category">
          <h4>Current Demand <em>({activeRegion})</em></h4>
          <div className="dsi-growth-grid">
            {categories.slice(0, 6).map((entry) => (
              <article className="dsi-growth-tile" key={entry.category} style={{ borderTopColor: colorFor(entry.category) }}>
                <span style={{ color: colorFor(entry.category) }}>{entry.category}</span>
                <strong style={{ color: colorFor(entry.category) }}>{formatCount(entry.demand)}</strong>
                <small><TrendingUp size={12} /> {entry.projects} ranked works</small>
                <TrendLine color={colorFor(entry.category)} value={entry.score} />
              </article>
            ))}
            {!categories.length ? <div className="dsi-empty">No processed categories for this selection.</div> : null}
          </div>
        </section>

        <section className="panel dsi-score" aria-label="Demand signal score">
          <h4>Demand Signal Score <em>({topCategory?.category ?? "No issue"})</em></h4>
          <div className="dsi-score-value">
            <strong>{score}<em>/100</em></strong>
            <mark>{score >= 80 ? "High" : score >= 50 ? "Medium" : "Needs Data"}</mark>
          </div>
          <span className="dsi-score-bar"><i style={{ width: `${score}%` }} /></span>
          <p>Built from live dashboard totals, official source snapshots, and connector status.</p>
          <div className="dsi-score-inputs">
            {sourceInputs.map((input) => <span key={input} title={input}>{input}</span>)}
          </div>
        </section>
      </div>

      <div className="dsi-row dsi-row-2" role="group" aria-label="Demand evidence, heatmap, and escalation analysis">
        <section className="panel dsi-timeline" aria-label="Current evidence by issue">
          <h4>Evidence Timeline <em>current API batch</em></h4>
          <div className="dsi-legend">
            {categories.slice(0, 6).map((entry) => (
              <span key={entry.category}><i style={{ background: colorFor(entry.category) }} />{entry.category}</span>
            ))}
          </div>
          <EvidenceTimeline categories={categories} />
        </section>

        <section className="panel dsi-heatmap" aria-label="Demand heatmap">
          <h4>Demand Heatmap <em>({activeRegion})</em></h4>
          <div className="dsi-heatmap-body">
            <Heatmap projects={dashboard.projects} selectedId={selectedProject?.id ?? ""} setSelectedId={setSelectedProjectId} />
            {selectedProject ? (
              <aside className="dsi-district-card">
                <strong>{selectedProject.ward}</strong>
                <div className="dsi-district-stat"><span><TrendingUp size={13} /> {selectedProject.category}</span><b>{selectedProject.score}/100</b></div>
                <div className="dsi-district-stat"><span>Demand</span><b>{formatCount(selectedProject.demandCount)}</b></div>
                <div className="dsi-district-stat"><span>Confidence</span><b>{pct(selectedProject.confidence * 100)}</b></div>
                <footer>
                  <span>{selectedProject.district}, {selectedProject.state}</span>
                  <b>{selectedProject.sourceFreshness ?? "missing"}</b>
                </footer>
              </aside>
            ) : null}
          </div>
          <div className="dsi-heat-legend">
            <span>Lower score</span>
            <i />
            <span>Higher score</span>
          </div>
        </section>

        <section className="panel dsi-forecast" aria-label="Escalation watch">
          <h4>Escalation Watch <em>from ranked queue</em></h4>
          <div className="dsi-forecast-list">
            {regionForecast.map((row) => (
              <div className="dsi-forecast-row" key={`${row.category}-${row.area}`}>
                <span className={`dsi-forecast-icon ${row.risk.includes("escalate") ? "up" : "mid"}`}><TrendingUp size={16} /></span>
                <span className="dsi-forecast-copy">
                  <strong>{row.category} - {row.area}</strong>
                  <small className={row.risk.includes("escalate") ? "up" : "mid"}>{row.risk}</small>
                </span>
              </div>
            ))}
          </div>
          <div className="dsi-confidence">
            <span>Average Confidence</span>
            <ConfidenceRing value={confidence} />
          </div>
        </section>
      </div>

      <div className="dsi-row dsi-row-3">
        <section className="panel dsi-source-mix" aria-label="Demand sources">
          <h4>Demand Sources <em>real corpus</em></h4>
          <div className="dsi-source-body">
            <SourceDonut mix={sourceMix} />
            <div className="dsi-source-legend">
              {sourceMix.map((entry) => (
                <span key={entry.label}>
                  <i style={{ background: entry.color }} />
                  {entry.label}
                  <b>{entry.share}%</b>
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="panel dsi-correlation" aria-label="Evidence correlation">
          <h4>Evidence Correlation <em>({topCategory?.category ?? "none"})</em></h4>
          {selectedProject ? (
            <div className="dsi-correlation-copy">
              <strong>{selectedProject.title}</strong>
              <p>{selectedProject.rationale}</p>
              <ul className="dsi-checklist">
                {selectedProject.evidence.slice(0, 4).map((item) => (
                  <li key={item}><CheckCircle2 size={15} /> {item}</li>
                ))}
              </ul>
            </div>
          ) : <div className="dsi-empty">No correlation available until this region has processed projects.</div>}
        </section>

        <section className="panel dsi-why" aria-label="Top issue explanation">
          <h4>Why {topCategory?.category ?? "No Issue"} Leads</h4>
          <ul className="dsi-checklist">
            {(topCategory?.evidence.length ? topCategory.evidence : ["No processed evidence for this filter yet."]).map((item) => (
              <li key={item}><CheckCircle2 size={15} /> {item}</li>
            ))}
          </ul>
          <div className="dsi-confidence">
            <span>Signal Confidence</span>
            <ConfidenceRing value={confidence} />
          </div>
        </section>
      </div>

      <div className="dsi-row dsi-row-4">
        <section className="panel dsi-compare" aria-label="Compare sources">
          <h4>Compare Issues</h4>
          <table>
            <thead>
              <tr>
                <th>Issue</th>
                <th>Demand</th>
                <th>Works</th>
                <th>Score</th>
                <th>Confidence</th>
                <th>Rating</th>
              </tr>
            </thead>
            <tbody>
              {compareRows.map((row) => (
                <tr key={row.issue}>
                  <td>{row.issue}</td>
                  <td>{formatCount(row.demand)}</td>
                  <td>{row.works}</td>
                  <td className="up"><TrendingUp size={12} /> {row.score}</td>
                  <td>{row.confidence}%</td>
                  <td>{row.rating}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!compareRows.length ? <small className="dsi-table-note">No rows for this filter.</small> : null}
        </section>

        <section className="panel dsi-findings" aria-label="Key findings">
          <h4>Key Findings</h4>
          <ul className="dsi-checklist">
            {regionFindings.map((item) => (
              <li key={item}><CheckCircle2 size={15} /> {item}</li>
            ))}
          </ul>
        </section>

        <section className="panel dsi-actions" aria-label="Top recommended actions">
          <h4>Top Recommended Actions</h4>
          <div className="dsi-action-list">
            {regionRecommendations.slice(0, 3).map((entry, index) => (
              <article className="dsi-action" key={`${entry.action}-${index}`}>
                <span className={`dsi-action-rank rank-${index + 1}`}>{index + 1}</span>
                <span className="dsi-action-copy">
                  <strong>{entry.action}</strong>
                  <small>{entry.reason}</small>
                </span>
                <mark className={index < 2 ? "high" : "medium"}>{index < 2 ? "High" : "Medium"}</mark>
              </article>
            ))}
          </div>
          <button className="dsi-link" onClick={() => setDetail(detail === "recommendations" ? null : "recommendations")} type="button">View All Recommendations <ArrowRight size={14} /></button>
        </section>

        <section className="panel dsi-trending" aria-label="Top trending topics">
          <h4>Top Trending Topics <em>(current corpus)</em></h4>
          <div className="dsi-trend-list">
            {categories.slice(0, 5).map((topic, index) => (
              <div className="dsi-trend-row" key={topic.category}>
                <span className="dsi-trend-rank"><Hash size={13} /> {index + 1}</span>
                <span className="dsi-trend-copy">
                  <strong>{topic.category}</strong>
                  <small>{formatCount(topic.demand)} demand signals</small>
                </span>
                <TrendLine color={colorFor(topic.category)} value={topic.score} />
              </div>
            ))}
            {!categories.length ? <div className="dsi-empty">No trending issues for this filter.</div> : null}
          </div>
          <button className="dsi-link" onClick={() => setDetail(detail === "trends" ? null : "trends")} type="button">View All Trends <ArrowRight size={14} /></button>
        </section>
      </div>
      </div>

      <footer className="dsi-footer">
        <span><Search size={13} /> Last updated: {new Date(dashboard.generatedAt).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
        <span className="fresh"><i /> {context?.states.length ?? 0} corpus regions; {regionOptions.length} state/UT filter options</span>
      </footer>
    </section>
  );
}
