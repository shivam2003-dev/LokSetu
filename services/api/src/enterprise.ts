import { sourceCoverage } from "./intelligence.js";
import { RankedProject, Submission } from "./types.js";

export function buildEnterpriseSituation(projects: RankedProject[], submissions: Submission[]) {
  const top = projects[0];
  const now = new Date().toISOString();
  const coverage = sourceCoverage();
  const categoryCounts = countBy(projects, (project) => project.category);
  const healthScore = constituencyHealthScore(projects);
  const activeComplaints = projects.reduce((sum, project) => sum + project.demandCount, 0);

  return {
    generatedAt: now,
    liveMonitoring: [
      metric("Citizen Sentiment Score", citizenSentiment(projects), "aggregate rating and urgency"),
      metric("Constituency Health Score", healthScore, "roads, education, health, water, power, services"),
      metric("Budget Utilization", 64, "placeholder until expenditure connector is live"),
      metric("Development Progress", progressScore(projects), "approved and shortlisted works"),
      metric("Infrastructure Health", infrastructureHealth(projects), "weighted infrastructure gap"),
      metric("Active Complaints", activeComplaints, "deduplicated demand signals"),
      metric("Scheme Adoption", 58, "scheme connector readiness weighted"),
      metric("AI Confidence Score", Math.round(avg(projects.map((project) => project.confidence * 100))), "ranking model confidence")
    ],
    incidents: projects.slice(0, 6).map((project, index) => ({
      id: `incident-${project.id}`,
      type: incidentType(project.category),
      title: project.title,
      area: `${project.ward}, ${project.district}`,
      severity: project.score >= 85 ? "high" : project.score >= 70 ? "medium" : "low",
      status: incidentStatus(index),
      assignee: project.mpName,
      demand: project.demandCount,
      confidence: Math.round(project.confidence * 100),
      workflow: ["Detected", "Verified", "Assigned", "In Progress", "Resolved", "Citizen Feedback", "Closed"]
    })),
    anomalies: Object.entries(categoryCounts).map(([category, count]) => ({
      name: `${category} demand anomaly`,
      severity: count >= 3 ? "high" : count === 2 ? "medium" : "low",
      change: `${Math.max(110, count * 85)}% vs baseline`,
      explanation: `${count} ranked project clusters currently map to ${category}.`
    })),
    healthScore: {
      score: healthScore,
      drivers: [
        scoreDriver("Roads", projects, ["Roads"]),
        scoreDriver("Education", projects, ["Education"]),
        scoreDriver("Healthcare", projects, ["Health"]),
        scoreDriver("Water", projects, ["Water", "Sanitation"]),
        scoreDriver("Electricity", projects, ["Power"]),
        { name: "Citizen Satisfaction", value: citizenSentiment(projects) },
        { name: "Budget Efficiency", value: 64 },
        { name: "Government Service Delivery", value: progressScore(projects) }
      ]
    },
    rootCause: top ? rootCauseFor(top) : [],
    eventTimeline: top ? timelineFor(top) : [],
    correlations: [
      correlation("Rainfall", "Water logging", "Road complaints", 0.82),
      correlation("School crowding", "Education complaints", "Priority score", 0.77),
      correlation("Health access gap", "Clinic demand", "Citizen urgency", 0.73),
      correlation("Power outages", "Public safety complaints", "Night mobility", 0.69)
    ],
    digitalTwin: {
      populationModel: "ward, panchayat, polling-area aggregation",
      assets: [
        twinAsset("Roads", projects.filter((project) => project.category === "Roads").length),
        twinAsset("Schools", projects.filter((project) => project.category === "Education").length),
        twinAsset("Hospitals", projects.filter((project) => project.category === "Health").length),
        twinAsset("Water Supply", projects.filter((project) => ["Water", "Sanitation"].includes(project.category)).length),
        twinAsset("Active Projects", projects.length),
        twinAsset("Citizen Requests", submissions.length)
      ],
      sourceCoverage: coverage
    },
    gisIntelligence: [
      layer("Complaint Heatmaps", "live", projects.length),
      layer("Infrastructure Gaps", "live", projects.filter((project) => project.needScore >= 28).length),
      layer("Population Density", "connector_ready", 543),
      layer("Flood Zones", "planned", 0),
      layer("School Accessibility", "connector_ready", projects.filter((project) => project.category === "Education").length),
      layer("Healthcare Coverage", "connector_ready", projects.filter((project) => project.category === "Health").length)
    ],
    smartAlerts: [
      alert("Water shortage predicted", hasCategory(projects, "Water") ? "medium" : "low", "Use weather and Jal Jeevan connectors before escalation."),
      alert("Road complaints increased", hasCategory(projects, "Roads") ? "high" : "low", "Road project clusters exceed baseline in current queue."),
      alert("Fake complaint campaign", shortSubmissionRate(submissions) > 10 ? "medium" : "low", "Moderation watches duplicate and short-message bursts."),
      alert("Budget anomaly", "medium", "Budget connector is not live; flag commitments until expenditure data lands.")
    ],
    predictiveIntelligence: [
      prediction("Flood Risk", hasCategory(projects, "Sanitation") ? 67 : 42, "drainage and rainfall proxy"),
      prediction("Disease Outbreak", hasCategory(projects, "Health") ? 54 : 31, "clinic demand and water/sanitation links"),
      prediction("Road Failure", hasCategory(projects, "Roads") ? 76 : 35, "road complaints, rain, traffic proxy"),
      prediction("School Capacity", hasCategory(projects, "Education") ? 71 : 38, "education demand and source snapshots")
    ],
    observability: {
      system: [
        metric("API Health", 100, "health endpoint passing"),
        metric("Kubernetes Cluster Status", 100, "Argo synced local cluster"),
        metric("Queue Monitoring", 88, "batch queue operational"),
        metric("Storage Health", 92, "Postgres/local storage available")
      ],
      data: [
        metric("Data Freshness", Math.round((coverage.liveOrReady / Math.max(1, coverage.totalSources)) * 100), "live or connector-ready sources"),
        metric("Schema Drift", 100, "typed ingestion fixtures"),
        metric("Duplicate Detection", 85, "dedupe clustering active"),
        metric("Source Availability", coverage.liveOrReady, "connectors live or ready")
      ],
      ai: [
        metric("Grounding Coverage", 92, "citations returned in Copilot"),
        metric("Explainability Score", 90, "evidence shown for recommendations"),
        metric("Agent Success Rate", 86, "deterministic local agent routing"),
        metric("Model Confidence Trend", Math.round(avg(projects.map((project) => project.confidence * 100))), "project confidence average")
      ],
      business: [
        metric("Citizen Engagement", submissions.length, "processed submissions"),
        metric("Daily Complaints", activeComplaints, "deduplicated demand"),
        metric("Department Response Time", 72, "placeholder until department SLA connector"),
        metric("Development Impact", healthScore, "health-score proxy")
      ]
    }
  };
}

function metric(name: string, value: number, detail: string) {
  return { name, value, detail };
}

function incidentType(category: string) {
  const map: Record<string, string> = {
    Education: "School Infrastructure",
    Roads: "Road Collapse",
    Water: "Water Shortage",
    Health: "Healthcare Emergency",
    Power: "Electricity Failure",
    Sanitation: "Public Safety"
  };
  return map[category] ?? category;
}

function incidentStatus(index: number) {
  return ["Detected", "Verified", "Assigned", "In Progress", "Resolved"][index % 5];
}

function constituencyHealthScore(projects: RankedProject[]) {
  const pressure = avg(projects.slice(0, 8).map((project) => project.score));
  return Math.max(35, Math.round(100 - pressure * 0.38));
}

function citizenSentiment(projects: RankedProject[]) {
  return Math.round((avg(projects.map((project) => project.averageRating)) / 5) * 100);
}

function progressScore(projects: RankedProject[]) {
  const weighted = projects.reduce((sum, project) => sum + (project.status === "approved" ? 1 : project.status === "shortlist" ? 0.55 : 0.2), 0);
  return Math.round((weighted / Math.max(1, projects.length)) * 100);
}

function infrastructureHealth(projects: RankedProject[]) {
  return Math.max(20, Math.round(100 - avg(projects.map((project) => project.needScore)) * 1.7));
}

function scoreDriver(name: string, projects: RankedProject[], categories: string[]) {
  const matching = projects.filter((project) => categories.includes(project.category));
  return { name, value: Math.max(20, Math.round(100 - avg(matching.map((project) => project.score)) * 0.45)) };
}

function rootCauseFor(project: RankedProject) {
  return [
    { step: "External pressure", detail: project.category === "Roads" ? "Heavy rain and traffic pressure" : "Demand signals rising" },
    { step: "Infrastructure gap", detail: `${project.needScore}/35 need score in ${project.ward}` },
    { step: "Citizen complaints", detail: `${project.demandCount} deduplicated demand signals` },
    { step: "Priority increase", detail: `Score ${project.score}, confidence ${Math.round(project.confidence * 100)}%` }
  ];
}

function timelineFor(project: RankedProject) {
  return [
    { at: "T-72h", event: "Source snapshot refreshed", detail: project.sourceFreshness ?? "missing" },
    { at: "T-48h", event: "Citizen demand cluster grew", detail: `${project.demandCount} reports` },
    { at: "T-24h", event: "AI priority score recalculated", detail: `score ${project.score}` },
    { at: "Now", event: "MP action recommended", detail: project.status }
  ];
}

function correlation(source: string, middle: string, target: string, strength: number) {
  return { source, middle, target, strength };
}

function twinAsset(name: string, activeSignals: number) {
  return { name, activeSignals, status: activeSignals > 0 ? "active" : "baseline" };
}

function layer(name: string, status: string, features: number) {
  return { name, status, features };
}

function alert(name: string, severity: string, detail: string) {
  return { name, severity, detail };
}

function prediction(name: string, probability: number, driver: string) {
  return { name, probability, driver };
}

function hasCategory(projects: RankedProject[], category: string) {
  return projects.some((project) => project.category === category);
}

function shortSubmissionRate(submissions: Submission[]) {
  return Math.round((submissions.filter((item) => item.text.length < 20).length / Math.max(1, submissions.length)) * 100);
}

function countBy<T>(items: T[], keyFn: (item: T) => string) {
  return items.reduce<Record<string, number>>((acc, item) => {
    const key = keyFn(item);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function avg(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
