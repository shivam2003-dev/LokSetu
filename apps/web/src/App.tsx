import {
  AlertTriangle,
  BarChart3,
  Camera,
  CheckCircle2,
  Globe2,
  Languages,
  MapPin,
  MessageSquareText,
  Mic,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Smartphone,
  Star,
  Upload
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

type Channel = "text" | "voice" | "photo" | "whatsapp";

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
  totals: {
    submissions: number;
    wards: number;
    languages: number;
    botRisk: "low" | "medium" | "high";
  };
  projects: RankedProject[];
  hotspots: Array<{ ward: string; category: string; intensity: number; lat: number; lng: number }>;
};

type Scope = "local" | "mp" | "global";

const fallback: DashboardResponse = {
  generatedAt: new Date().toISOString(),
  totals: { submissions: 162, wards: 8, languages: 6, botRisk: "low" },
  projects: [
    {
      id: "school-kalindi",
      title: "Repair classrooms and toilets at Kalindi Nagar school",
      category: "Education",
      state: "Delhi",
      district: "Central Delhi",
      ward: "Kalindi Nagar",
      mpId: "mp-delhi-central",
      mpName: "MP Central Delhi",
      score: 91,
      confidence: 0.88,
      demandCount: 48,
      averageRating: 4.8,
      ratings: 48,
      demandScore: 36,
      needScore: 31,
      urgencyScore: 14,
      equityScore: 10,
      languageMix: ["Hindi", "English"],
      recentCitizenAliases: ["Local Voice 482", "Local Voice 917"],
      rationale: "Repeated citizen reports match high enrolment pressure and low sanitation coverage.",
      evidence: ["48 similar requests", "1.7x classroom crowding", "Girls' attendance below ward average"],
      safeguards: ["No single identity shown", "Human engineer review required before tender"],
      status: "shortlist"
    },
    {
      id: "road-river",
      title: "Resurface river market access road",
      category: "Roads",
      state: "Delhi",
      district: "Central Delhi",
      ward: "River Market",
      mpId: "mp-delhi-central",
      mpName: "MP Central Delhi",
      score: 84,
      confidence: 0.82,
      demandCount: 37,
      averageRating: 4.6,
      ratings: 37,
      demandScore: 31,
      needScore: 28,
      urgencyScore: 15,
      equityScore: 10,
      languageMix: ["English", "Hindi"],
      recentCitizenAliases: ["market-worker"],
      rationale: "Pothole and ambulance-delay reports overlap with poor road-condition survey data.",
      evidence: ["37 similar requests", "2.8 km damaged segment", "Clinic route affected"],
      safeguards: ["Duplicate campaign risk checked", "PWD plan overlap check pending"],
      status: "review"
    },
    {
      id: "clinic-east",
      title: "Add evening clinic hours in East Colony",
      category: "Health",
      state: "Delhi",
      district: "East Delhi",
      ward: "East Colony",
      mpId: "mp-delhi-east",
      mpName: "MP East Delhi",
      score: 78,
      confidence: 0.76,
      demandCount: 29,
      averageRating: 4.2,
      ratings: 29,
      demandScore: 27,
      needScore: 25,
      urgencyScore: 13,
      equityScore: 13,
      languageMix: ["Bangla"],
      recentCitizenAliases: ["clinic-helper"],
      rationale: "Health access complaints align with distance-to-clinic and elderly population signals.",
      evidence: ["29 similar requests", "3.9 km median clinic distance", "High elderly share"],
      safeguards: ["Demographic weighting applied", "PHC capacity validation needed"],
      status: "review"
    }
  ],
  hotspots: [
    { ward: "Kalindi Nagar", category: "Education", intensity: 91, lat: 28.61, lng: 77.21 },
    { ward: "River Market", category: "Roads", intensity: 84, lat: 28.64, lng: 77.2 },
    { ward: "East Colony", category: "Health", intensity: 78, lat: 28.59, lng: 77.25 }
  ]
};

const channelOptions: Array<{ value: Channel; label: string; icon: typeof MessageSquareText }> = [
  { value: "text", label: "Text", icon: MessageSquareText },
  { value: "voice", label: "Voice", icon: Mic },
  { value: "photo", label: "Photo", icon: Camera },
  { value: "whatsapp", label: "WhatsApp", icon: Smartphone }
];

async function fetchDashboard(filters?: { scope: Scope; state: string; district: string; ward: string; mpId: string; q: string }): Promise<DashboardResponse> {
  const apiBase = import.meta.env.VITE_API_BASE_URL ?? "";
  const params = new URLSearchParams();
  if (filters) {
    params.set("scope", filters.scope);
    if (filters.scope === "local") {
      params.set("state", filters.state);
      params.set("district", filters.district);
      params.set("ward", filters.ward);
    }
    if (filters.scope === "mp") params.set("mpId", filters.mpId);
    if (filters.q.trim()) params.set("q", filters.q.trim());
  }
  const response = await fetch(`${apiBase}/api/priorities${params.size ? `?${params}` : ""}`);
  if (!response.ok) throw new Error("Dashboard API failed");
  return response.json();
}

export default function App() {
  const [data, setData] = useState<DashboardResponse>(fallback);
  const [activeProject, setActiveProject] = useState(fallback.projects[0].id);
  const [channel, setChannel] = useState<Channel>("text");
  const [scope, setScope] = useState<Scope>("local");
  const [state, setState] = useState("Delhi");
  const [district, setDistrict] = useState("Central Delhi");
  const [mpId, setMpId] = useState("mp-delhi-central");
  const [query, setQuery] = useState("");
  const [username, setUsername] = useState("citizen");
  const [privacyMode, setPrivacyMode] = useState(true);
  const [language, setLanguage] = useState("Hindi");
  const [ward, setWard] = useState("Kalindi Nagar");
  const [urgency, setUrgency] = useState(4);
  const [rating, setRating] = useState(5);
  const [citizenScore, setCitizenScore] = useState<number | null>(null);
  const [text, setText] = useState("School toilets are broken and classrooms flood after rain.");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("Live API pending");

  useEffect(() => {
    fetchDashboard({ scope, state, district, ward, mpId, q: query })
      .then((next) => {
        setData(next);
        setActiveProject(next.projects[0]?.id ?? "");
        setNotice("Live API connected");
      })
      .catch(() => setNotice("Demo data active"));
  }, []);

  const project = useMemo(
    () => data.projects.find((item) => item.id === activeProject) ?? data.projects[0] ?? fallback.projects[0],
    [activeProject, data.projects]
  );

  async function submitFeedback(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const apiBase = import.meta.env.VITE_API_BASE_URL ?? "";
      const response = await fetch(`${apiBase}/api/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, language, username, privacyMode, state, district, ward, urgency, rating, text })
      });
      if (!response.ok) throw new Error("Submission failed");
      const next = await response.json();
      setData(next.dashboard);
      setActiveProject(next.dashboard.projects[0]?.id ?? activeProject);
      setCitizenScore(next.citizenScore);
      setNotice(`Submission processed · score ${next.citizenScore}`);
    } catch {
      setNotice("API unavailable; local preview unchanged");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="shell">
      <aside className="sidebar" aria-label="People Priority navigation">
        <div className="brand">
          <div className="brand-mark">PP</div>
          <div>
            <h1>People Priority</h1>
            <p>Constituency development console</p>
          </div>
        </div>
        <nav>
          <a className="nav-item active" href="#priorities">
            <BarChart3 size={18} /> Priorities
          </a>
          <a className="nav-item" href="#intake">
            <Send size={18} /> Intake
          </a>
          <a className="nav-item" href="#hotspots">
            <MapPin size={18} /> Hotspots
          </a>
          <a className="nav-item" href="#safeguards">
            <ShieldCheck size={18} /> Safeguards
          </a>
        </nav>
        <div className="status-pill">
          <CheckCircle2 size={16} />
          <span>{notice}</span>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">{scope === "global" ? "India search" : scope === "mp" ? "MP constituency view" : "Local ward view"}</p>
            <h2>{scope === "global" ? "Explore public problems across India" : "Ranked development projects"}</h2>
          </div>
          <button className="icon-button" title="Refresh dashboard" onClick={() => fetchDashboard({ scope, state, district, ward, mpId, q: query }).then(setData)}>
            <RefreshCw size={18} />
          </button>
        </header>

        <section className="panel filters" aria-label="Location and search controls">
          <div className="segmented">
            <button className={scope === "local" ? "active" : ""} type="button" onClick={() => setScope("local")}>My ward</button>
            <button className={scope === "mp" ? "active" : ""} type="button" onClick={() => setScope("mp")}>My MP</button>
            <button className={scope === "global" ? "active" : ""} type="button" onClick={() => setScope("global")}>All India</button>
          </div>
          <label>
            MP
            <select value={mpId} onChange={(event) => setMpId(event.target.value)}>
              <option value="mp-delhi-central">MP Central Delhi</option>
              <option value="mp-delhi-east">MP East Delhi</option>
              <option value="mp-maharashtra-north">MP North Maharashtra</option>
            </select>
          </label>
          <label>
            Search
            <span className="search-box">
              <Search size={16} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="road, school, water, ward" />
            </span>
          </label>
          <button className="primary" type="button" onClick={() => fetchDashboard({ scope, state, district, ward, mpId, q: query }).then(setData)}>
            Apply
          </button>
        </section>

        <section className="metrics" aria-label="Platform metrics">
          <Metric label="Submissions" value={data.totals.submissions.toString()} detail="deduped citizen inputs" />
          <Metric label="Wards" value={data.totals.wards.toString()} detail="with geotagged evidence" />
          <Metric label="Languages" value={data.totals.languages.toString()} detail="normalized for analysis" />
          <Metric label="Bot risk" value={data.totals.botRisk} detail="current anomaly score" />
        </section>

        <section className="content-grid">
          <section className="panel priority-list" id="priorities">
            <div className="panel-title">
              <h3>Priority stack</h3>
              <span>{new Date(data.generatedAt).toLocaleString()}</span>
            </div>
            <div className="project-list">
              {data.projects.map((item) => (
                <button
                  className={`project-row ${item.id === project.id ? "selected" : ""}`}
                  key={item.id}
                  onClick={() => setActiveProject(item.id)}
                >
                  <span className="score">{item.score}</span>
                  <span>
                    <strong>{item.title}</strong>
                    <small>
                      {item.category} · {item.ward} · {item.demandCount} reports
                    </small>
                    <small>
                      {item.mpName} · {item.state} · {item.averageRating}/5
                    </small>
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="panel detail-panel">
            <div className="panel-title">
              <h3>{project.title}</h3>
              <span>{project.mpName} · {Math.round(project.confidence * 100)}% confidence</span>
            </div>
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
              <Evidence title="Controls" items={project.safeguards} />
            </div>
          </section>
        </section>

        <section className="content-grid lower">
          <form className="panel intake" id="intake" onSubmit={submitFeedback}>
            <div className="panel-title">
              <h3>Citizen intake</h3>
              <Languages size={18} />
            </div>
            <div className="channel-row">
              {channelOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    className={`channel ${channel === option.value ? "active" : ""}`}
                    key={option.value}
                    type="button"
                    title={`${option.label} channel`}
                    onClick={() => setChannel(option.value)}
                  >
                    <Icon size={18} />
                    <span>{option.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="form-grid">
              <label>
                Username
                <input value={username} onChange={(event) => setUsername(event.target.value)} />
              </label>
              <label>
                Language
                <select value={language} onChange={(event) => setLanguage(event.target.value)}>
                  <option>Auto detect</option>
                  <option>Hindi</option>
                  <option>Tamil</option>
                  <option>Bangla</option>
                  <option>Marathi</option>
                  <option>English</option>
                </select>
              </label>
              <label>
                State
                <select value={state} onChange={(event) => setState(event.target.value)}>
                  <option>Delhi</option>
                  <option>Maharashtra</option>
                </select>
              </label>
              <label>
                District
                <select value={district} onChange={(event) => setDistrict(event.target.value)}>
                  <option>Central Delhi</option>
                  <option>East Delhi</option>
                  <option>Nashik Rural</option>
                </select>
              </label>
              <label>
                Ward
                <select value={ward} onChange={(event) => setWard(event.target.value)}>
                  <option>Kalindi Nagar</option>
                  <option>River Market</option>
                  <option>East Colony</option>
                  <option>North Village</option>
                </select>
              </label>
            </div>
            <label>
              Suggestion
              <textarea value={text} onChange={(event) => setText(event.target.value)} rows={5} />
            </label>
            <label>
              Urgency: {urgency}
              <input min="1" max="5" type="range" value={urgency} onChange={(event) => setUrgency(Number(event.target.value))} />
            </label>
            <label>
              Problem rating: {rating}
              <input min="1" max="5" type="range" value={rating} onChange={(event) => setRating(Number(event.target.value))} />
            </label>
            <label className="check-row">
              <input type="checkbox" checked={privacyMode} onChange={(event) => setPrivacyMode(event.target.checked)} />
              Privacy mode
            </label>
            {citizenScore ? <div className="score-note">Your society contribution score: {citizenScore}</div> : null}
            <div className="submit-row">
              <label className="upload" title="Attach supporting media">
                <Upload size={17} />
                <span>Attach</span>
                <input type="file" />
              </label>
              <button className="primary" disabled={saving} type="submit">
                <Send size={17} />
                {saving ? "Processing" : "Submit"}
              </button>
            </div>
          </form>

          <section className="panel map-panel" id="hotspots">
            <div className="panel-title">
              <h3>Hotspots</h3>
              <Globe2 size={18} />
            </div>
            <div className="map-canvas" aria-label="Constituency hotspot map">
              {data.hotspots.map((spot, index) => (
                <button
                  className="hotspot"
                  key={`${spot.ward}-${spot.category}`}
                  style={{
                    left: `${18 + index * 26}%`,
                    top: `${28 + (index % 2) * 28}%`,
                    width: `${44 + spot.intensity / 3}px`,
                    height: `${44 + spot.intensity / 3}px`
                  }}
                  title={`${spot.ward}: ${spot.category}`}
                >
                  {spot.intensity}
                </button>
              ))}
            </div>
            <div className="risk-strip" id="safeguards">
              <AlertTriangle size={18} />
              <span>Human review required before project approval and fund allocation.</span>
            </div>
          </section>
        </section>
      </section>
    </main>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function ScoreBar({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div className="score-bar">
      <div>
        <span>{label}</span>
        <strong>
          {value}/{max}
        </strong>
      </div>
      <meter min="0" max={max} value={value} />
    </div>
  );
}

function Evidence({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="evidence">
      <h4>{title}</h4>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
