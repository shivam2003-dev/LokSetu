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
  const started = Date.now();
  const question = query.question.trim();
  const selectedProject = query.projectId
    ? projects.find((project) => project.id === query.projectId)
    : pickProject(question, projects);
  const project = selectedProject ?? projects[0];
  const daily = buildDailyIntelligence(projects, submissions);
  const agent = routeAgent(query.role, question);
  const intent = classifyIntent(question);
  const corpus = buildRagCorpus(projects, submissions, daily);
  const retrievedContext = retrieveContext(question, corpus, query.projectId);
  const evidence = [
    ...retrievedContext.slice(0, 5).map((item) => ({ type: item.sourceType, text: item.snippet })),
    ...(project ? projectEvidence(project) : [])
  ].slice(0, 8);
  const citations = [
    ...retrievedContext.slice(0, 5).map((item) => citation(item.sourceType, item.id, item.title, item.snippet)),
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
    citations: dedupeCitations(citations),
    retrieval: {
      mode: "local-hybrid-rag",
      embeddingStore: process.env.VERTEX_AI_VECTOR_SEARCH_INDEX ? "vertex-ai-vector-search" : "local-deterministic-index",
      corpusDocuments: corpus.length,
      retrieved: retrievedContext.length,
      latencyMs: Date.now() - started
    },
    retrievedContext,
    suggestedActions: suggestedActions(query.role, intent, project),
    followUpQuestions: followUps(query.role, project),
    guardrails: [
      "Grounded only in current LokSetu project, source, and daily intelligence data.",
      "No personal citizen identity is exposed; privacy aliases are used.",
      "Funding, eligibility, and emergency guidance require official human confirmation."
    ]
  };
}

export function buildCopilotRagStatus(projects: RankedProject[], submissions: Submission[]) {
  const daily = buildDailyIntelligence(projects, submissions);
  const corpus = buildRagCorpus(projects, submissions, daily);
  const bySource = corpus.reduce<Record<string, number>>((acc, item) => {
    acc[item.sourceType] = (acc[item.sourceType] ?? 0) + 1;
    return acc;
  }, {});
  return {
    mode: "local-hybrid-rag",
    productionTarget: "Vertex AI RAG Engine or Vertex AI Vector Search",
    embeddingStore: process.env.VERTEX_AI_VECTOR_SEARCH_INDEX ? "vertex-ai-vector-search" : "local-deterministic-index",
    corpusDocuments: corpus.length,
    bySource,
    privacy: "citizen aliases and aggregate snippets only; usernames and direct identifiers are excluded",
    refreshCadence: "batch pipeline refresh"
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

type RagChunk = {
  id: string;
  title: string;
  sourceType: string;
  text: string;
  snippet: string;
  score: number;
};

function buildRagCorpus(projects: RankedProject[], submissions: Submission[], daily: ReturnType<typeof buildDailyIntelligence>): RagChunk[] {
  return [
    ...projects.flatMap((project) => [
      chunk(`project:${project.id}`, project.title, "ranked_project", `${project.title}. ${project.rationale}. ${project.evidence.join(". ")} ${project.ward} ${project.district} ${project.state} ${project.category}. Score ${project.score}. Confidence ${Math.round(project.confidence * 100)}%.`, project.evidence[0] ?? project.rationale),
      chunk(`score:${project.id}`, `${project.title} score breakdown`, "score_breakdown", `Demand ${project.demandScore}/40. Need ${project.needScore}/35. Urgency ${project.urgencyScore}/15. Equity ${project.equityScore}/15. Rating ${project.averageRating}/5.`, `score ${project.score}; demand ${project.demandScore}, need ${project.needScore}, urgency ${project.urgencyScore}, equity ${project.equityScore}`)
    ]),
    ...submissions.slice(-40).map((submission) =>
      chunk(
        `submission:${submission.id}`,
        `${submission.category} citizen signal in ${submission.ward}`,
        "citizen_signal",
        `${submission.displayName}: ${submission.normalizedText || submission.text}. ${submission.ward} ${submission.district} ${submission.state}. ${submission.detectedLanguage}. Rating ${submission.rating}.`,
        `${submission.displayName}: ${submission.category} signal in ${submission.ward}`
      )
    ),
    ...daily.digest.map((item, index) => chunk(`daily:${index}`, "Daily constituency digest", "daily_intelligence", item, item)),
    ...daily.recommendations.map((item, index) => chunk(`recommendation:${index}`, item.action, "action_recommendation", `${item.action}. ${item.reason}. ${item.owner}. ${item.nextStep}`, item.reason)),
    ...daily.forecast.map((item, index) => chunk(`forecast:${index}`, `${item.category} forecast for ${item.area}`, "forecast", `${item.category} in ${item.area}: ${item.risk}. Driver: ${item.driver}`, `${item.risk}; ${item.driver}`))
  ];
}

function retrieveContext(question: string, corpus: RagChunk[], projectId?: string) {
  const terms = tokenize(question);
  return corpus
    .map((item) => {
      const haystack = tokenize(`${item.title} ${item.text}`);
      const lexicalScore = terms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0);
      const projectBoost = projectId && item.id.endsWith(projectId) ? 4 : 0;
      return { ...item, score: lexicalScore + projectBoost };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, 8);
}

function chunk(id: string, title: string, sourceType: string, text: string, snippet: string): RagChunk {
  return { id, title, sourceType, text, snippet, score: 0 };
}

function tokenize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((term) => term.length > 2);
}

function dedupeCitations(items: ReturnType<typeof citation>[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.type}:${item.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function copilotKnowledgeSummary() {
  return {
    agents: copilotAgents,
    sourceFamilies: intelligenceSourceGroups.map((group) => ({ category: group.category, sourceCount: group.sources.length })),
    supportedRoles: ["mp", "collector", "citizen", "analyst"] satisfies CopilotRole[],
    supportedInputs: ["natural language question", "project id", "role", "language"],
    rag: {
      mode: "local-hybrid-rag",
      productionTarget: "Vertex AI RAG Engine or Vertex AI Vector Search",
      citationsRequired: true
    },
    currentLimitations: [
      "Uses local deterministic retrieval until production Vertex AI RAG or Vector Search is connected.",
      "Does not expose private citizen data.",
      "Official budget and scheme eligibility still require department source connectors."
    ]
  };
}
