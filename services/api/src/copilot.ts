import { buildDailyIntelligence, intelligenceSourceGroups } from "./intelligence.js";
import { fallbackRun, fetchGdeltSignals, fetchNewsSignals, fetchXSignals } from "./externalSignals.js";
import type { ExternalSignalRun } from "./externalSignals.js";
import { ingestRagDocuments, queryRagService, ragServiceStatus, reindexRagDocuments } from "./ragClient.js";
import { RankedProject, Submission } from "./types.js";

export type CopilotRole = "mp" | "collector" | "citizen" | "analyst";
export type CopilotMode = "online" | "submitted" | "all";

export type CopilotQuery = {
  role: CopilotRole;
  question: string;
  language?: string;
  projectId?: string;
  mode?: CopilotMode;
};

type OnlineSource = {
  id: string;
  provider: string;
  title: string;
  snippet: string;
  url?: string;
  publishedAt?: string;
  mode: ExternalSignalRun["mode"];
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
  const mode = query.mode ?? "all";
  const onlineRuns = intent !== "greeting" && (mode === "online" || mode === "all") ? await fetchOnlineRuns(question) : [];
  const liveOnlineRuns = onlineRuns.filter((run) => run.mode === "live");
  if (liveOnlineRuns.length) await indexOnlineRuns(question, liveOnlineRuns);
  const onlineSources = buildOnlineSources(liveOnlineRuns.length ? liveOnlineRuns : onlineRuns);
  const onlineContext = onlineSources
    .map((source, index) => `[${index + 1}] ${source.provider}: ${source.title}. ${source.snippet}${source.url ? ` ${source.url}` : ""}`)
    .slice(0, 8)
    .join("\n");
  const retrievalQuestion = buildRetrievalQuestion(question, intent, project, projects, submissions, mode, onlineContext);
  const metadata = mode === "online"
    ? { sourceType: "online_signal" }
    : mode === "submitted"
      ? { sourceType: "citizen_submission" }
      : undefined;
  const ragResponse = intent === "greeting"
    ? null
    : await queryRagService({
        question: retrievalQuestion,
        metadata
      });
  const ragUnavailable = !ragResponse && intent !== "greeting";
  const directAnswer = buildDirectAnswer(query.role, intent, question, project, daily, submissions, projects, mode, onlineContext, onlineSources);
  const ragHasAnswer = Boolean(ragResponse && ragResponse.retrieved.length > 0 && !isNoMatchAnswer(ragResponse.answer));
  const answer = intent === "greeting"
    ? buildAnswer(query.role, intent, question, project, daily)
    : mode === "online"
      ? directAnswer ?? buildNoOnlineAnswer()
    : ragHasAnswer && ragResponse
      ? ragResponse.answer
      : directAnswer ?? buildNoEvidenceAnswer(mode);
  const retrievedContext = ragResponse?.retrieved.map((item) => ({
    id: item.id,
    title: item.title,
    sourceType: item.source,
    snippet: item.content.slice(0, 260),
    score: Number(item.confidence.toFixed(4))
  })) ?? [];
  const evidence = ragHasAnswer && retrievedContext.length
    ? retrievedContext.slice(0, 5).map((item) => ({ type: item.sourceType, text: item.snippet }))
    : buildDirectEvidence(project, submissions, projects, mode, onlineContext, onlineSources, intent);
  const citations = ragResponse?.citations.map((item) =>
    citation("rag_chunk", item.chunkId, `${item.document}${item.page ? ` page ${item.page}` : ""}`, item.source ?? item.documentId, item.sourceUrl)
  ) ?? [];
  const onlineCitations = onlineSources
    .slice(0, 5)
    .map((source, index) => citation("online_signal", source.id, `${source.title} (${source.provider})`, `${source.snippet} [${index + 1}]`, source.url));

  return {
    generatedAt: new Date().toISOString(),
    role: query.role,
    mode,
    language: query.language ?? "English",
    agent,
    intent,
    answer,
    confidence: ragHasAnswer && ragResponse ? Math.round((ragResponse.citations[0]?.confidence ?? 0) * 100) : directAnswer && !isNoMatchAnswer(directAnswer) ? 72 : project ? Math.round(project.confidence * 100) : 0,
    evidence,
    citations: dedupeCitations(mode === "submitted" ? citations : [...onlineCitations, ...citations]),
    retrieval: {
      mode: ragResponse?.retrievalMode ?? (ragUnavailable ? "not-configured" : "greeting"),
      embeddingStore: ragResponse ? "postgres-pgvector-hnsw" : "none",
      orchestration: ragResponse?.orchestration,
      corpusDocuments: ragResponse?.index?.chunks ?? 0,
      retrieved: retrievedContext.length,
      latencyMs: ragResponse?.metrics.totalLatencyMs ?? Date.now() - started
    },
    retrievedContext,
    suggestedActions: suggestedActions(query.role, intent, project),
    followUpQuestions: followUps(query.role, project),
    guardrails: [
      `Retrieval mode: ${mode}. Online answers use public web/news connector results with visible references.`,
      "Grounded only in current LokSetu project, source, public online, and submitted issue data.",
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
  const firstLine = lower.split("\n")[0]?.trim() ?? lower;
  if (/^(hi|hello|hey|namaste|namaskar|hola)$/i.test(firstLine)) return "greeting";
  if (/(last|latest|recent|newest).*(submitted|submission|problem|complaint|issue)|submitted problem|recent problem/.test(lower)) return "latest_submission";
  if (/(architecture|technical|how.*built|how.*build|rag|retrieval|embedding|pgvector|vertex)/.test(lower)) return "technical_rag";
  if (/(compare|versus| vs ).*(road|roads).*(health|healthcare|clinic|phc)|(health|healthcare|clinic|phc).*(compare|versus| vs ).*(road|roads)/.test(lower)) return "compare_services";
  if (/(village|villages|ward|wards).*(lack|missing|without).*(phc|primary health|clinic)|(phc|primary health|clinic).*(lack|missing|without)/.test(lower)) return "phc_gap";
  if (/(delayed|delay|blocked|behind schedule|stalled|overdue).*(project|projects|work|works)|show delayed/.test(lower)) return "delayed_projects";
  if (/(citizen feedback|feedback summary|summarize citizen|summarise citizen|complaints summary)/.test(lower)) return "citizen_feedback";
  if (lower.includes("why")) return "explain_priority";
  if (lower.includes("top") || lower.includes("rank")) return "ranked_priorities";
  if (lower.includes("budget") || lower.includes("fund")) return "funding_path";
  if (lower.includes("summary") || lower.includes("yesterday") || lower.includes("today")) return "briefing";
  if (lower.includes("what if") || lower.includes("predict")) return "simulation";
  if (lower.includes("status") || lower.includes("my complaint")) return "citizen_status";
  return "constituency_question";
}

async function fetchOnlineRuns(question: string) {
  const query = `${primaryQuestion(question)} India civic issue`;
  const runs = [];
  try {
    runs.push(await fetchXSignals(query));
  } catch {
    runs.push(fallbackRun("x", query));
  }
  try {
    runs.push(await fetchGdeltSignals(query));
  } catch {
    runs.push(fallbackRun("gdelt", query));
  }
  try {
    runs.push(await fetchNewsSignals(query));
  } catch {
    runs.push(fallbackRun("news", query));
  }
  return runs.filter((run) => run.signals.length > 0);
}

function buildOnlineSources(runs: ExternalSignalRun[]): OnlineSource[] {
  const seen = new Set<string>();
  const sources = runs.flatMap((run) =>
    run.signals.map((signal) => {
      const title = cleanSourceText(signal.title ?? signal.text);
      const snippet = cleanSourceText(signal.text || signal.title || "Online signal");
      return {
        id: signal.id,
        provider: run.provider,
        title: title || `${run.provider} source`,
        snippet: snippet || title || `${run.provider} source`,
        url: signal.url,
        publishedAt: signal.publishedAt,
        mode: run.mode
      } satisfies OnlineSource;
    })
  );
  return sources
    .filter((source) => source.mode === "live" || source.url)
    .filter((source) => {
      const key = source.url ?? `${source.provider}:${source.title}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8);
}

async function indexOnlineRuns(question: string, runs: Awaited<ReturnType<typeof fetchOnlineRuns>>) {
  const liveSignals = runs.flatMap((run) => run.signals.map((signal) => ({ run, signal })));
  if (!liveSignals.length) return;
  try {
    await ingestRagDocuments({
      documents: liveSignals.slice(0, 30).map(({ run, signal }) => ({
        source: "json",
        title: signal.title ?? `${run.provider} signal ${signal.id}`,
        sourceUri: `janvaani://online/${run.provider}/${signal.id}`,
        sourceUrl: signal.url,
        mediaType: "application/json",
        content: [
          `Online signal provider: ${run.provider}`,
          `Query: ${question}`,
          `Title: ${signal.title ?? "n/a"}`,
          `Text: ${signal.text}`,
          `Location: ${[signal.ward, signal.district, signal.state].filter(Boolean).join(", ")}`,
          `Published: ${signal.publishedAt ?? "unknown"}`
        ].join("\n"),
        metadata: {
          connector: run.provider,
          sourceType: "online_signal",
          provider: run.provider,
          mode: "online",
          state: signal.state,
          district: signal.district,
          ward: signal.ward,
          query: question
        }
      }))
    });
    await reindexRagDocuments(100);
  } catch {
    // RAG service is optional in local development; direct online context still grounds fallback answers.
  }
}

function buildRetrievalQuestion(question: string, intent: string, project: RankedProject | undefined, projects: RankedProject[], submissions: Submission[], mode: CopilotMode, onlineContext: string) {
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
      `Retrieval mode: ${mode}`,
      "Find the newest recent latest citizen submission problem complaint issue in the indexed LokSetu citizen signal documents.",
      latestSubmissions
    ].filter(Boolean).join("\n\n");
  }
  if (intent === "ranked_priorities" || intent === "briefing") {
    return [question, `Retrieval mode: ${mode}`, "Use ranked priorities, top issues, citizen feedback summary, current queue, and latest processed submissions.", topProjects, latestSubmissions, onlineContext].filter(Boolean).join("\n\n");
  }
  if (intent === "technical_rag") {
    return `${question}\n\nUse LokSetu RAG architecture, pgvector, Gemini embeddings, Vertex AI, ingestion worker, embedding worker, RAG API, Copilot adapter, GitOps, observability, and deployment details.`;
  }
  return [question, `Retrieval mode: ${mode}`, selectedProject, mode !== "submitted" ? onlineContext : ""].filter(Boolean).join("\n\n");
}

function buildDirectAnswer(_role: CopilotRole, intent: string, _question: string, project: RankedProject | undefined, daily: ReturnType<typeof buildDailyIntelligence>, submissions: Submission[], projects: RankedProject[], mode: CopilotMode, onlineContext: string, onlineSources: OnlineSource[] = []) {
  if (mode === "online" && onlineSources.length) return buildOnlineAnswer(onlineSources);
  if (mode === "online") {
    return buildNoOnlineAnswer();
  }
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
  if (intent === "compare_services") return buildCategoryComparison(projects, ["Roads", "Health"]);
  if (intent === "phc_gap") return buildPhcGapAnswer(projects);
  if (intent === "delayed_projects") return buildDelayedProjectsAnswer(projects);
  if (intent === "citizen_feedback") return buildCitizenFeedbackAnswer(submissions);
  if (intent === "briefing") {
    return [
      "Current constituency briefing:",
      ...daily.digest.slice(0, 4).map((item) => `- ${item}`)
    ].join("\n");
  }
  if (project) return `${project.title} is currently ${project.status} with score ${project.score}. ${project.rationale}`;
  return null;
}

function buildOnlineAnswer(onlineSources: OnlineSource[]) {
  const topSources = onlineSources.slice(0, 3);
  const claims = topSources.map((source, index) => `${summarizeSource(source)} [${index + 1}]`);
  return limitWords([
    "Online sources indicate",
    claims.join(" "),
    "Use these as live signals and confirm against submitted issues and official records."
  ].join(" "), 100);
}

function buildNoOnlineAnswer() {
  return "No live online references were available for this query. Switch to Submitted Issues for local LokSetu records or retry Online when public connectors respond.";
}

function buildNoEvidenceAnswer(mode: CopilotMode) {
  if (mode === "submitted") return "No submitted issue or indexed RAG evidence matched this question. Try Online mode for live public sources, or ask a question tied to a known ward, project, or receipt.";
  return "No local RAG, submitted issue, or online evidence matched this question. I do not have enough grounded context to answer.";
}

function buildDirectEvidence(project: RankedProject | undefined, submissions: Submission[], projects: RankedProject[], mode: CopilotMode, onlineContext: string, onlineSources: OnlineSource[] = [], intent = "constituency_question") {
  const evidence: Array<{ type: string; text: string; url?: string }> = [];
  if (mode === "online") {
    evidence.push(...onlineSources.slice(0, 3).map((source, index) => ({
      type: "Online reference",
      text: `[${index + 1}] ${source.title}: ${source.snippet}`,
      url: source.url
    })));
    return evidence.slice(0, 6);
  }
  if (mode !== "submitted" && onlineContext && onlineSources.length) {
    evidence.push(...onlineContext.split("\n").slice(0, 3).map((item) => ({ type: "Online signal", text: item })));
  }
  if (project) {
    evidence.push(...project.evidence.slice(0, 4).map((item) => ({ type: "Project evidence", text: `${project.title}: ${item}` })));
    evidence.push({ type: "Ranked project", text: `${project.ward}, ${project.district}: score ${project.score}, confidence ${Math.round(project.confidence * 100)}%, demand ${project.demandCount}.` });
  }
  if (["ranked_priorities", "compare_services", "delayed_projects", "briefing"].includes(intent)) {
    evidence.push(...projects.slice(0, 3).map((item, index) => ({
      type: "Priority queue",
      text: `Rank ${index + 1}: ${item.title} in ${item.ward}; ${item.category}; score ${item.score}; ${item.rationale}`
    })));
  }
  if (["latest_submission", "citizen_feedback", "briefing"].includes(intent)) {
    evidence.push(...submissions.slice(-3).reverse().map((item) => ({
      type: "Citizen submission",
      text: `${item.category} in ${item.ward}, ${item.district}: ${item.normalizedText || item.text}`
    })));
  }
  return evidence.slice(0, 6);
}

function buildCategoryComparison(projects: RankedProject[], categories: string[]) {
  const stats = categories.map((category) => {
    const items = projects.filter((project) => normalizeCategory(project.category) === normalizeCategory(category));
    return {
      category,
      count: items.length,
      demand: items.reduce((sum, item) => sum + item.demandCount, 0),
      averageScore: items.length ? Math.round(items.reduce((sum, item) => sum + item.score, 0) / items.length) : 0,
      top: items.sort((a, b) => b.score - a.score)[0]
    };
  });
  if (stats.every((item) => item.count === 0)) return "No road or healthcare project evidence is available in the current LokSetu queue.";
  return [
    "Roads vs healthcare:",
    ...stats.map((item) => `${item.category}: ${item.count} projects, ${item.demand} citizen signals, average score ${item.averageScore}${item.top ? `; top issue is ${item.top.title} in ${item.top.ward}` : ""}.`)
  ].join("\n");
}

function buildPhcGapAnswer(projects: RankedProject[]) {
  const healthProjects = projects.filter((project) => ["health", "healthcare"].includes(normalizeCategory(project.category)) || /phc|clinic|health/i.test(`${project.title} ${project.rationale}`));
  const phcSpecific = healthProjects.filter((project) => /phc|primary health|clinic/i.test(`${project.title} ${project.rationale} ${project.evidence.join(" ")}`));
  if (!phcSpecific.length) return "No village-level PHC gap evidence is available in the current LokSetu RAG/submitted corpus. I found no grounded source that lists villages lacking PHCs.";
  return [
    "Current PHC/clinic access signals:",
    ...phcSpecific.slice(0, 5).map((project) => `- ${project.ward}, ${project.district}: ${project.title}; ${project.rationale}`)
  ].join("\n");
}

function buildDelayedProjectsAnswer(projects: RankedProject[]) {
  const delayed = projects.filter((project) => /delay|delayed|blocked|stalled|behind|risk|overdue/i.test(`${project.status} ${project.rationale} ${project.evidence.join(" ")}`));
  if (!delayed.length) return "No delayed project evidence is available in the current LokSetu project queue. I will not mark a project delayed without a matching status, milestone, or source record.";
  return [
    "Delayed or at-risk projects:",
    ...delayed.slice(0, 5).map((project) => `- ${project.title} in ${project.ward}: status ${project.status}; score ${project.score}; ${project.rationale}`)
  ].join("\n");
}

function buildCitizenFeedbackAnswer(submissions: Submission[]) {
  if (!submissions.length) return "No citizen feedback submissions are available in the current corpus.";
  const byCategory = submissions.reduce<Record<string, number>>((acc, submission) => {
    acc[submission.category] = (acc[submission.category] ?? 0) + 1;
    return acc;
  }, {});
  const topCategories = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const latest = [...submissions].sort((a, b) => Date.parse(b.processedAt ?? b.createdAt) - Date.parse(a.processedAt ?? a.createdAt)).slice(0, 3);
  return [
    "Citizen feedback summary:",
    `Top categories: ${topCategories.map(([category, count]) => `${category} (${count})`).join(", ")}.`,
    ...latest.map((submission) => `- ${submission.ward}, ${submission.district}: ${submission.normalizedText || submission.text}`)
  ].join("\n");
}

function primaryQuestion(question: string) {
  return question.split("\n")[0]?.trim() || question.trim();
}

function cleanSourceText(value: string) {
  return value
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function summarizeSource(source: OnlineSource) {
  const text = source.snippet || source.title;
  const sentence = text.split(/(?<=[.!?])\s+/)[0] ?? text;
  return limitWords(sentence.replace(/[.?!]+$/, ""), 22);
}

function limitWords(text: string, maxWords: number) {
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (words.length <= maxWords) return words.join(" ");
  return `${words.slice(0, maxWords).join(" ")}...`;
}

function pickProject(question: string, projects: RankedProject[]) {
  const lower = question.toLowerCase();
  return projects.find((project) =>
    [project.title, project.ward, project.district, project.state]
      .some((value) => lower.includes(value.toLowerCase()))
  );
}

function normalizeCategory(value: string) {
  const lower = value.toLowerCase();
  if (lower.includes("health")) return "health";
  if (lower.includes("road")) return "roads";
  return lower;
}

function isNoMatchAnswer(answer: string) {
  return /^(no indexed documents match|no submitted issue|no local rag|no live online references|no .* evidence)/i.test(answer.trim());
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

function citation(type: string, id: string, title: string, snippet: string, url?: string) {
  return { type, id, title, snippet, url };
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
      orchestration: {
        graph: "langgraph",
        tracing: "langsmith",
        context: "langchain-document"
      },
      citationsRequired: true
    },
    currentLimitations: [
      "Requires the standalone RAG service and indexed documents for factual answers.",
      "Does not expose private citizen data.",
      "Official budget and scheme eligibility still require department source connectors."
    ]
  };
}
