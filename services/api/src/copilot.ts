import { buildDailyIntelligence, intelligenceSourceGroups } from "./intelligence.js";
import { queryRagService, ragServiceStatus } from "./ragClient.js";
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

export async function answerCopilot(query: CopilotQuery, projects: RankedProject[], submissions: Submission[]) {
  const started = Date.now();
  const question = query.question.trim();
  const selectedProject = query.projectId ? projects.find((project) => project.id === query.projectId) : pickProject(question, projects);
  const project = selectedProject;
  const daily = buildDailyIntelligence(projects, submissions);
  const agent = routeAgent(query.role, question);
  const intent = classifyIntent(question);
  const retrievalQuestion = buildRetrievalQuestion(question, intent, project, projects, submissions);
  const ragResponse = intent === "greeting"
    ? null
    : await queryRagService({
        question: retrievalQuestion
      });
  const ragUnavailable = !ragResponse && intent !== "greeting";
  const directAnswer = buildDirectAnswer(query.role, intent, question, project, daily, submissions, projects);
  const answer = intent === "greeting"
    ? buildAnswer(query.role, intent, question, project, daily)
    : ragResponse && ragResponse.retrieved.length > 0
      ? ragResponse.answer
      : directAnswer ?? "RAG service is not configured. No production retrieval was executed.";
  const retrievedContext = ragResponse?.retrieved.map((item) => ({
    id: item.id,
    title: item.title,
    sourceType: item.source,
    snippet: item.content.slice(0, 260),
    score: Number(item.confidence.toFixed(4))
  })) ?? [];
  const evidence = retrievedContext.slice(0, 5).map((item) => ({ type: item.sourceType, text: item.snippet }));
  const citations = ragResponse?.citations.map((item) =>
    citation("rag_chunk", item.chunkId, `${item.document}${item.page ? ` page ${item.page}` : ""}`, item.sourceUrl ?? item.source ?? item.documentId)
  ) ?? [];

  return {
    generatedAt: new Date().toISOString(),
    role: query.role,
    language: query.language ?? "English",
    agent,
    intent,
    answer,
    confidence: ragResponse?.retrieved.length ? Math.round((ragResponse.citations[0]?.confidence ?? 0) * 100) : directAnswer ? 72 : project ? Math.round(project.confidence * 100) : 0,
    evidence,
    citations: dedupeCitations(citations),
    retrieval: {
      mode: ragResponse?.retrievalMode ?? (ragUnavailable ? "not-configured" : "greeting"),
      embeddingStore: ragResponse ? "postgres-pgvector-hnsw" : "none",
      corpusDocuments: ragResponse?.index?.chunks ?? 0,
      retrieved: retrievedContext.length,
      latencyMs: ragResponse?.metrics.totalLatencyMs ?? Date.now() - started
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

export async function buildProductionRagStatus() {
  return ragServiceStatus();
}

function routeAgent(role: CopilotRole, question: string) {
  const lower = question.toLowerCase();
  if (role === "citizen") return copilotAgents.find((agent) => agent.id === "citizen-agent")!;
  if (lower.includes("budget") || lower.includes("fund") || lower.includes("cost")) return copilotAgents.find((agent) => agent.id === "budget-agent")!;
  if (lower.includes("map") || lower.includes("where") || lower.includes("village") || lower.includes("ward")) return copilotAgents.find((agent) => agent.id === "gis-agent")!;
  if (lower.includes("forecast") || lower.includes("predict") || lower.includes("what if")) return copilotAgents.find((agent) => agent.id === "forecast-agent")!;
  if (lower.includes("pdf") || lower.includes("dpr") || lower.includes("minutes") || lower.includes("document") || lower.includes("architecture") || lower.includes("technical") || lower.includes("rag")) return copilotAgents.find((agent) => agent.id === "document-agent")!;
  return copilotAgents.find((agent) => agent.id === "mp-copilot")!;
}

function classifyIntent(question: string) {
  const lower = question.toLowerCase();
  if (/^(hi|hello|hey|namaste|namaskar|hola)$/i.test(lower)) return "greeting";
  if (/(last|latest|recent|newest).*(submitted|submission|problem|complaint|issue)|submitted problem|recent problem/.test(lower)) return "latest_submission";
  if (/(architecture|technical|how.*built|how.*build|rag|retrieval|embedding|pgvector|vertex)/.test(lower)) return "technical_rag";
  if (lower.includes("why")) return "explain_priority";
  if (lower.includes("top") || lower.includes("rank")) return "ranked_priorities";
  if (lower.includes("budget") || lower.includes("fund")) return "funding_path";
  if (lower.includes("summary") || lower.includes("yesterday") || lower.includes("today")) return "briefing";
  if (lower.includes("what if") || lower.includes("predict")) return "simulation";
  if (lower.includes("status") || lower.includes("my complaint")) return "citizen_status";
  return "constituency_question";
}

function buildRetrievalQuestion(question: string, intent: string, project: RankedProject | undefined, projects: RankedProject[], submissions: Submission[]) {
  const latestSubmissions = [...submissions]
    .sort((a, b) => Date.parse(b.processedAt ?? b.createdAt) - Date.parse(a.processedAt ?? a.createdAt))
    .slice(0, 5)
    .map((submission, index) => `Recent submission ${index + 1}: ${submission.category} in ${submission.ward}, ${submission.district}. Text: ${submission.normalizedText || submission.text}. Processed: ${submission.processedAt ?? submission.createdAt}. Receipt: ${submission.rawIntakeId?.slice(0, 8) ?? "n/a"}.`)
    .join("\n");
  const topProjects = projects
    .slice(0, 5)
    .map((item, index) => `Rank ${index + 1}: ${item.title}; ${item.category}; ${item.ward}; evidence ${item.evidence.join(", ")}.`)
    .join("\n");
  const selectedProject = project ? `Selected project context: ${project.title}; ${project.category}; ${project.ward}; ${project.rationale}; evidence ${project.evidence.join(", ")}.` : "";

  if (intent === "latest_submission") {
    return [
      question,
      "Find the newest recent latest citizen submission problem complaint issue in the indexed LokSetu citizen signal documents.",
      latestSubmissions
    ].filter(Boolean).join("\n\n");
  }
  if (intent === "ranked_priorities" || intent === "briefing") {
    return [question, "Use ranked priorities, top issues, citizen feedback summary, current queue, and latest processed submissions.", topProjects, latestSubmissions].join("\n\n");
  }
  if (intent === "technical_rag") {
    return `${question}\n\nUse LokSetu RAG architecture, pgvector, Gemini embeddings, Vertex AI, ingestion worker, embedding worker, RAG API, Copilot adapter, GitOps, observability, and deployment details.`;
  }
  return [question, selectedProject].filter(Boolean).join("\n\n");
}

function buildDirectAnswer(_role: CopilotRole, intent: string, _question: string, project: RankedProject | undefined, daily: ReturnType<typeof buildDailyIntelligence>, submissions: Submission[], projects: RankedProject[]) {
  if (intent === "latest_submission") {
    const latest = [...submissions].sort((a, b) => Date.parse(b.processedAt ?? b.createdAt) - Date.parse(a.processedAt ?? a.createdAt))[0];
    if (!latest) return "No processed citizen submissions are available yet. If a report was just submitted, it may still be in the next batch queue.";
    return [
      "Latest processed submission:",
      `- Category: ${latest.category}`,
      `- Area: ${latest.ward}, ${latest.district}, ${latest.state}`,
      `- Text: ${latest.normalizedText || latest.text}`,
      `- Receipt: ${latest.rawIntakeId?.slice(0, 8) ?? latest.id.slice(0, 8)}`,
      `- Processed: ${latest.processedAt ?? latest.createdAt}`
    ].join("\n");
  }
  if (intent === "ranked_priorities" && projects.length) {
    return [
      "Top current priorities:",
      ...projects.slice(0, 5).map((item, index) => `${index + 1}. ${item.title} (${item.category}, ${item.ward}) - score ${item.score}; ${item.rationale}`)
    ].join("\n");
  }
  if (intent === "briefing") {
    return [
      "Current constituency briefing:",
      ...daily.digest.slice(0, 4).map((item) => `- ${item}`)
    ].join("\n");
  }
  if (project) return `${project.title} is currently ${project.status} with score ${project.score}. ${project.rationale}`;
  return null;
}

function pickProject(question: string, projects: RankedProject[]) {
  const lower = question.toLowerCase();
  return projects.find((project) =>
    [project.title, project.category, project.ward, project.district, project.state]
      .some((value) => lower.includes(value.toLowerCase()))
  );
}

function buildAnswer(_role: CopilotRole, intent: string, _question: string, _project: RankedProject | undefined, _daily: ReturnType<typeof buildDailyIntelligence>) {
  if (intent === "greeting") {
    return "Hi. Ask me about constituency priorities, ranked issues, supporting evidence, maps, budget paths, public meeting briefs, or what changed today. I will answer with retrieved LokSetu context and citations.";
  }

  return "No indexed documents match the query.";
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
      mode: "pgvector-hybrid",
      productionTarget: "Vertex AI RAG Engine or Vertex AI Vector Search with pgvector local runtime",
      citationsRequired: true
    },
    currentLimitations: [
      "Requires the standalone RAG service and indexed documents for factual answers.",
      "Does not expose private citizen data.",
      "Official budget and scheme eligibility still require department source connectors."
    ]
  };
}
