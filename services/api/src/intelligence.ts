import { RankedProject, Submission } from "./types.js";

export type ConnectorMode =
  | "first_party"
  | "public_api"
  | "partner_api"
  | "licensed_api"
  | "document_ingest"
  | "sensor_stream"
  | "manual_upload";

export type SourceReadiness = "live" | "connector_ready" | "planned" | "restricted";

export type IntelligenceSource = {
  name: string;
  examples: string[];
  connectorMode: ConnectorMode;
  cadence: string;
  readiness: SourceReadiness;
  governance: string;
};

export type IntelligenceSourceGroup = {
  category: string;
  purpose: string;
  sources: IntelligenceSource[];
};

export const intelligenceSourceGroups: IntelligenceSourceGroup[] = [
  {
    category: "Citizen Sources",
    purpose: "Direct constituency demand from residents and public meetings.",
    sources: [
      source("Mobile App", ["Apni Awaaz app", "offline-first forms"], "first_party", "continuous", "live", "PII redaction and privacy aliases before analytics"),
      source("Web Portal", ["LokSetu citizen web", "QR feedback links"], "first_party", "continuous", "live", "rate limits and abuse filtering"),
      source("Messaging and IVR", ["WhatsApp", "SMS", "IVR calls", "voice notes"], "partner_api", "near-real-time batch", "connector_ready", "requires consent, telecom retention policy, and opt-out handling"),
      source("Public Meetings", ["Jan Sunwai", "Gram Sabha minutes", "speech transcripts", "surveys", "polls"], "document_ingest", "daily batch", "connector_ready", "meeting source, date, and speaker identity controls required"),
      source("Email Intake", ["MP office inbox", "district office mailbox"], "partner_api", "hourly batch", "planned", "mailbox access approval and PII minimization required")
    ]
  },
  {
    category: "Government Data",
    purpose: "Ground-truth demand against official need, budget, works, and service records.",
    sources: [
      source("Census and Demographics", ["Census", "population density", "household indicators"], "public_api", "monthly refresh", "connector_ready", "cite dataset version and geography level"),
      source("Development Projects", ["MPLADS", "PM Gati Shakti", "PMGSY roads", "MGNREGA", "Jal Jeevan Mission"], "public_api", "daily batch", "planned", "preserve scheme, sanction, expenditure, and work status lineage"),
      source("District and Local Records", ["district dashboards", "panchayat records", "municipal records", "PWD", "health", "education"], "manual_upload", "daily or weekly batch", "connector_ready", "department owner and upload attestation required"),
      source("Accountability Records", ["budget and expenditure", "tender portals", "RTI disclosures", "audit reports"], "document_ingest", "daily batch", "planned", "document OCR quality score and citation required"),
      source("Election and Boundary Data", ["Election Commission", "polling areas", "constituency boundaries"], "public_api", "quarterly refresh", "planned", "official boundary source and version required")
    ]
  },
  {
    category: "Maps and Geospatial",
    purpose: "Locate demand, detect infrastructure gaps, and understand physical constraints.",
    sources: [
      source("Google Maps Platform", ["Maps", "reviews", "traffic", "road closures", "geocoding"], "licensed_api", "continuous or daily batch", "connector_ready", "use restricted keys, quota controls, and API terms"),
      source("Open Geospatial", ["OpenStreetMap", "land use", "water bodies", "forest cover"], "public_api", "daily batch", "planned", "record tile or extract version"),
      source("Satellite and Earth Observation", ["ISRO Bhuvan", "Google Earth Engine", "satellite imagery", "crop health"], "partner_api", "weekly batch", "planned", "imagery license, model confidence, and date captured required"),
      source("Hazard and Environment Maps", ["flood maps", "weather maps", "pollution maps", "heat maps", "terrain", "elevation"], "public_api", "daily batch", "planned", "warn if source resolution is too coarse for ward decisions")
    ]
  },
  {
    category: "Social, News, and Trends",
    purpose: "Capture weak signals from public discourse without replacing verified citizen intake.",
    sources: [
      source("Social Media", ["X", "Facebook", "Instagram", "Threads", "YouTube comments", "Reddit", "Koo", "ShareChat", "Telegram", "LinkedIn"], "partner_api", "daily batch", "connector_ready", "API-permissioned collection only; no private messages or unauthorized scraping"),
      source("News and Media", ["national news", "regional papers", "hyperlocal portals", "TV transcripts", "community radio", "PIB", "district press notes"], "public_api", "daily batch", "connector_ready", "retain URL/title/date and distinguish report from verified incident"),
      source("Search and Trends", ["Google Trends", "YouTube Trends", "X trends", "seasonal and festival demand"], "public_api", "daily batch", "planned", "trend signal is directional and must be cross-checked with evidence")
    ]
  },
  {
    category: "Complaint Platforms",
    purpose: "Join existing grievance channels with LokSetu ranking.",
    sources: [
      source("Government Grievances", ["CPGRAMS", "state grievance portals", "municipal complaint apps", "Swachhata App"], "partner_api", "daily batch", "planned", "requires department integration and grievance privacy controls"),
      source("Utility and Safety Complaints", ["police portals", "electricity complaints", "water complaints", "consumer forums"], "partner_api", "daily batch", "planned", "aggregate public metrics; do not expose complainant identity")
    ]
  },
  {
    category: "Environmental and IoT",
    purpose: "Detect objective changes that citizens may not have reported yet.",
    sources: [
      source("Environmental Sensors", ["AQI", "water quality", "noise pollution", "smart city sensors"], "sensor_stream", "hourly batch", "planned", "calibration and sensor health metadata required"),
      source("Weather and Alerts", ["rainfall", "river levels", "flood alerts", "earthquake alerts", "fire alerts"], "public_api", "hourly batch", "connector_ready", "alert provenance and expiry time required")
    ]
  },
  {
    category: "Sector Intelligence",
    purpose: "Convert department and market indicators into development priorities.",
    sources: [
      source("Transportation", ["bus GPS", "metro data", "train delays", "accident reports", "road construction", "parking", "EV charging"], "partner_api", "daily batch", "planned", "transport authority agreement and location aggregation required"),
      source("Healthcare", ["hospital occupancy", "OPD load", "ambulance response", "outbreaks", "vaccination", "medicine shortages", "blood banks"], "partner_api", "daily batch", "planned", "health privacy and minimum aggregation thresholds required"),
      source("Education", ["attendance", "dropout rates", "teacher vacancies", "admissions", "exam performance", "scholarship demand"], "partner_api", "weekly batch", "connector_ready", "school-level privacy and child data safeguards required"),
      source("Agriculture", ["crop health", "market prices", "soil health", "pest alerts", "irrigation", "fertilizer", "MSP trends"], "public_api", "daily batch", "planned", "seasonality and mandi geography metadata required"),
      source("Economy", ["employment", "MSME registrations", "startup activity", "GST trends", "inflation", "local business growth", "job postings"], "public_api", "weekly batch", "planned", "use aggregated economic indicators only")
    ]
  },
  {
    category: "Documents and Sentiment",
    purpose: "Turn unstructured files and public mood into explainable signals.",
    sources: [
      source("Documents", ["PDFs", "Word files", "DPRs", "budget documents", "audit reports", "survey reports", "scanned documents", "images"], "document_ingest", "daily batch", "connector_ready", "OCR confidence, page citations, and document owner required"),
      source("Public Sentiment", ["satisfaction score", "topic sentiment", "emotion", "trust", "urgency", "community demand", "political neutrality"], "first_party", "daily batch", "connector_ready", "sentiment is advisory and never a sole ranking input")
    ]
  }
];

export function sourceCoverage() {
  const flat = intelligenceSourceGroups.flatMap((group) => group.sources.map((item) => ({ ...item, category: group.category })));
  const byReadiness = flat.reduce<Record<SourceReadiness, number>>((acc, item) => {
    acc[item.readiness] = (acc[item.readiness] ?? 0) + 1;
    return acc;
  }, { live: 0, connector_ready: 0, planned: 0, restricted: 0 });
  const byConnectorMode = flat.reduce<Record<string, number>>((acc, item) => {
    acc[item.connectorMode] = (acc[item.connectorMode] ?? 0) + 1;
    return acc;
  }, {});
  return {
    totalSources: flat.length,
    liveOrReady: flat.filter((item) => item.readiness === "live" || item.readiness === "connector_ready").length,
    restricted: flat.filter((item) => item.readiness === "restricted").length,
    byReadiness,
    byConnectorMode
  };
}

export function buildDailyIntelligence(projects: RankedProject[], submissions: Submission[]) {
  const topProjects = projects.slice(0, 10);
  const categories = [...new Set(topProjects.map((project) => project.category))];
  const privacyRate = Math.round((submissions.filter((item) => item.privacyMode).length / Math.max(1, submissions.length)) * 100);
  const averageScore = Math.round(average(topProjects.map((project) => project.score)));
  const averageConfidence = Math.round(average(topProjects.map((project) => project.confidence * 100)));
  const averageRating = Number(average(topProjects.map((project) => project.averageRating)).toFixed(1));
  const coverage = sourceCoverage();

  return {
    generatedAt: new Date().toISOString(),
    scope: "all-india-demo-constituencies",
    digest: [
      `${topProjects.length} ranked development priorities generated from citizen intake, source snapshots, and external signal connectors.`,
      `${categories.slice(0, 4).join(", ")} are the strongest issue categories in today's queue.`,
      `${coverage.liveOrReady}/${coverage.totalSources} intelligence source connectors are live or implementation-ready.`,
      `${privacyRate}% of direct citizen submissions use privacy mode aliases.`
    ],
    topEmergingIssues: topProjects.slice(0, 5).map((project, index) => ({
      rank: index + 1,
      title: project.title,
      category: project.category,
      area: `${project.ward}, ${project.district}, ${project.state}`,
      score: project.score,
      demand: project.demandCount,
      confidence: Math.round(project.confidence * 100),
      evidence: project.evidence.slice(0, 3)
    })),
    viralLocalTopics: categories.slice(0, 6).map((category) => {
      const categoryProjects = topProjects.filter((project) => project.category === category);
      return {
        topic: category,
        mentions: categoryProjects.reduce((sum, project) => sum + project.demandCount, 0),
        trend: categoryProjects.some((project) => project.urgencyScore >= 13) ? "rising" : "stable"
      };
    }),
    alerts: [
      alert("Budget risk", topProjects.some((project) => project.status === "approved") ? "medium" : "low", "Approved works need budget/expenditure join before public commitment."),
      alert("Fraud or spam risk", submissions.some((item) => item.text.length < 20) ? "medium" : "low", "Short or duplicated submissions are routed to moderation before ranking impact."),
      alert("Data gap", coverage.byReadiness.planned > coverage.liveOrReady ? "medium" : "low", "Some sector connectors still require department or API approvals.")
    ],
    indices: {
      priorityScore: averageScore,
      impactScore: Math.min(100, averageScore + Math.round(averageConfidence / 10)),
      citizenMoodIndex: Math.round((averageRating / 5) * 100),
      communityDemandIndex: Math.min(100, Math.round(average(topProjects.map((project) => project.demandCount)) * 2)),
      constituencyHealthScore: Math.max(0, 100 - topProjects.filter((project) => ["Health", "Water", "Sanitation"].includes(project.category)).length * 8),
      developmentOpportunityIndex: Math.min(100, averageScore + coverage.liveOrReady),
      politicalNeutralityScore: 92
    },
    recommendations: topProjects.slice(0, 5).map((project) => ({
      owner: project.mpName,
      action: `Open ${project.category.toLowerCase()} project room for ${project.ward}`,
      reason: `${project.demandCount} demand signals, ${Math.round(project.confidence * 100)}% confidence, source freshness ${project.sourceFreshness ?? "missing"}`,
      nextStep: project.status === "review" ? "shortlist for MP review" : project.status === "shortlist" ? "request district estimate" : "track delivery milestones"
    })),
    forecast: topProjects.slice(0, 4).map((project) => ({
      category: project.category,
      area: project.ward,
      risk: project.urgencyScore >= 13 ? "likely to escalate in 7 days" : "monitor weekly",
      driver: project.evidence[0] ?? "citizen demand cluster"
    })),
    sourceCoverage: coverage
  };
}

function source(
  name: string,
  examples: string[],
  connectorMode: ConnectorMode,
  cadence: string,
  readiness: SourceReadiness,
  governance: string
): IntelligenceSource {
  return { name, examples, connectorMode, cadence, readiness, governance };
}

function alert(name: string, severity: "low" | "medium" | "high", detail: string) {
  return { name, severity, detail };
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
