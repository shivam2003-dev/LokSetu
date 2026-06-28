import { buildDailyIntelligence, intelligenceSourceGroups } from "./intelligence.js";
import { RankedProject, Submission } from "./types.js";

export type CopilotRole = "mp" | "collector" | "citizen" | "analyst";

export type CopilotQuery = {
  role: CopilotRole;
  question: string;
  language?: string;
  projectId?: string;
};

export const copilotAgents = [
  {
    id: "mp-copilot",
    label: "MP Copilot",
    purpose: "Strategic priority planning, public meeting preparation, and project action recommendations."
  },
  {
    id: "budget-agent",
    label: "Budget Agent",
    purpose: "Funding route, budget risk, project delay, and expenditure reasoning."
  },
  {
    id: "gis-agent",
    label: "GIS Agent",
    purpose: "Ward, district, hotspot, accessibility, and map-grounded reasoning."
  },
  {
    id: "document-agent",
    label: "Document Agent",
    purpose: "DPR, audit, survey, RTI, and meeting-minute summarization."
  },
  {
    id: "citizen-agent",
    label: "Citizen Agent",
    purpose: "Privacy-safe public explanations, complaint status, and nearby project answers."
  },
  {
    id: "forecast-agent",
    label: "Forecast Agent",
    purpose: "Emerging risk, anomaly, and what-if planning."
  }
];

export function answerCopilot(query: CopilotQuery, projects: RankedProject[], submissions: Submission[]) {
  const question = query.question.trim();
  const selectedProject = query.projectId
    ? projects.find((project) => project.id === query.projectId)
    : pickProject(question, projects);
  const project = selectedProject ?? projects[0];
  const daily = buildDailyIntelligence(projects, submissions);
  const agent = routeAgent(query.role, question);
  const intent = classifyIntent(question);
  const evidence = project ? projectEvidence(project) : [];
  const citations = [
    ...(project ? [
      citation("ranked_project", project.id, project.title, project.evidence[0] ?? project.rationale),
      citation("score_breakdown", project.id, "Demand/need/urgency/equity score", `score ${project.score}, confidence ${Math.round(project.confidence * 100)}%`)
    ] : []),
    citation("daily_intelligence", "daily", "Daily constituency digest", daily.digest[0] ?? "No digest available"),
    citation("source_registry", "registry", "Constituency source registry", `${daily.sourceCoverage.liveOrReady}/${daily.sourceCoverage.totalSources} source connectors live or ready`)
  ];

  return {
    generatedAt: new Date().toISOString(),
    role: query.role,
    language: query.language ?? "English",
    agent,
    intent,
    answer: buildAnswer(query.role, intent, question, project, daily),
    confidence: project ? Math.round(project.confidence * 100) : 68,
    evidence,
    citations,
    suggestedActions: suggestedActions(query.role, intent, project),
    followUpQuestions: followUps(query.role, project),
    guardrails: [
      "Grounded only in current LokSetu project, source, and daily intelligence data.",
      "No personal citizen identity is exposed; privacy aliases are used.",
      "Funding, eligibility, and emergency guidance require official human confirmation."
    ]
  };
}

function routeAgent(role: CopilotRole, question: string) {
  const lower = question.toLowerCase();
  if (role === "citizen") return copilotAgents.find((agent) => agent.id === "citizen-agent")!;
  if (lower.includes("budget") || lower.includes("fund") || lower.includes("cost")) return copilotAgents.find((agent) => agent.id === "budget-agent")!;
  if (lower.includes("map") || lower.includes("where") || lower.includes("village") || lower.includes("ward")) return copilotAgents.find((agent) => agent.id === "gis-agent")!;
  if (lower.includes("forecast") || lower.includes("predict") || lower.includes("what if")) return copilotAgents.find((agent) => agent.id === "forecast-agent")!;
  if (lower.includes("pdf") || lower.includes("dpr") || lower.includes("minutes") || lower.includes("document")) return copilotAgents.find((agent) => agent.id === "document-agent")!;
  return copilotAgents.find((agent) => agent.id === "mp-copilot")!;
}

function classifyIntent(question: string) {
  const lower = question.toLowerCase();
  if (lower.includes("why")) return "explain_priority";
  if (lower.includes("top") || lower.includes("rank")) return "ranked_priorities";
  if (lower.includes("budget") || lower.includes("fund")) return "funding_path";
  if (lower.includes("summary") || lower.includes("yesterday") || lower.includes("today")) return "briefing";
  if (lower.includes("what if") || lower.includes("predict")) return "simulation";
  if (lower.includes("status") || lower.includes("my complaint")) return "citizen_status";
  return "constituency_question";
}

function pickProject(question: string, projects: RankedProject[]) {
  const lower = question.toLowerCase();
  return projects.find((project) =>
    [project.title, project.category, project.ward, project.district, project.state]
      .some((value) => lower.includes(value.toLowerCase()))
  );
}

function buildAnswer(role: CopilotRole, intent: string, question: string, project: RankedProject | undefined, daily: ReturnType<typeof buildDailyIntelligence>) {
  if (!project) {
    return `I could not find a matching project for "${question}". The daily digest currently has ${daily.topEmergingIssues.length} emerging issues and ${daily.sourceCoverage.liveOrReady} live or ready source connectors.`;
  }

  if (intent === "ranked_priorities") {
    const top = daily.topEmergingIssues.slice(0, 5).map((item) => `#${item.rank} ${item.title} (${item.area})`).join("; ");
    return `The current top priorities are: ${top}. The highest-ranked issue is ${daily.topEmergingIssues[0]?.title}, supported by demand, need, urgency, and source-freshness signals.`;
  }

  if (intent === "funding_path") {
    return `${project.title} should first be checked against MPLADS eligibility, district plan alignment, and department scheme fit. Current evidence shows ${project.demandCount} demand signals, score ${project.score}, and ${Math.round(project.confidence * 100)}% confidence. Ask the district team for a cost estimate before public commitment.`;
  }

  if (intent === "briefing") {
    return `Today’s brief: ${daily.digest.join(" ")} Recommended first action: ${daily.recommendations[0]?.action ?? `review ${project.title}`}.`;
  }

  if (intent === "simulation") {
    return `For a what-if scenario around ${project.category}, start with ${project.ward}. The forecast says ${daily.forecast.find((item) => item.category === project.category)?.risk ?? "monitor weekly"}. If funding or capacity increases, compare impact against demand score ${project.demandScore}/40 and need score ${project.needScore}/35.`;
  }

  if (intent === "citizen_status" || role === "citizen") {
    return `For public transparency, ${project.title} is currently ${project.status}. It has ${project.demandCount} matched reports and ${project.averageRating}/5 citizen rating. Personal submitter identities are hidden; only aggregate evidence is visible.`;
  }

  return `${project.title} is prioritized because LokSetu sees ${project.demandCount} related signals in ${project.ward}, a total priority score of ${project.score}, and ${Math.round(project.confidence * 100)}% confidence. Key evidence: ${project.evidence.slice(0, 3).join("; ")}.`;
}

function projectEvidence(project: RankedProject) {
  return [
    ...project.evidence.slice(0, 5).map((item) => ({ type: "project_evidence", text: item })),
    { type: "area", text: `${project.ward}, ${project.district}, ${project.state}` },
    { type: "source_freshness", text: project.sourceFreshness ?? "missing" },
    { type: "privacy", text: `${project.recentCitizenAliases.length} privacy-safe contributor aliases available` }
  ];
}

function suggestedActions(role: CopilotRole, intent: string, project: RankedProject | undefined) {
  if (!project) return ["Ask a more specific constituency, ward, category, or project question."];
  if (role === "citizen") return ["Track this project on the public board.", "Add more evidence if the problem is still active.", "Share the public project link with neighbours."];
  if (intent === "funding_path") return ["Request district cost estimate.", "Map eligible schemes.", "Check tender and budget history.", "Prepare MP office note."];
  return ["Open the project room.", "Review supporting evidence.", "Assign district officer follow-up.", "Publish privacy-safe status update."];
}

function followUps(role: CopilotRole, project: RankedProject | undefined) {
  const area = project?.ward ?? "this ward";
  if (role === "citizen") return [`What is the status of projects near ${area}?`, "Why was this issue ranked this way?", "How can I add evidence?"];
  return [`Why is ${area} high priority?`, "Which scheme can fund this?", "What changed since yesterday?", "Generate a district-officer briefing."];
}

function citation(type: string, id: string, title: string, snippet: string) {
  return { type, id, title, snippet };
}

export function copilotKnowledgeSummary() {
  return {
    agents: copilotAgents,
    sourceFamilies: intelligenceSourceGroups.map((group) => ({ category: group.category, sourceCount: group.sources.length })),
    supportedRoles: ["mp", "collector", "citizen", "analyst"] satisfies CopilotRole[],
    supportedInputs: ["natural language question", "project id", "role", "language"],
    currentLimitations: [
      "Uses deterministic grounded synthesis until production vector search is connected.",
      "Does not expose private citizen data.",
      "Official budget and scheme eligibility still require department source connectors."
    ]
  };
}
