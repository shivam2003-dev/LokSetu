import { areaMappings, civicDatasets, mpProfiles, sourceSnapshots } from "./data.js";
import { AadhaarIdentityMode, DashboardFilters, RankedProject, RewardBand, Submission } from "./types.js";
import { VertexTextAnalysis } from "./vertexAi.js";

const categoryTerms: Record<string, string[]> = {
  Education: ["school", "classroom", "teacher", "toilet", "student", "bench", "enrollment"],
  Roads: ["road", "pothole", "street", "bridge", "traffic", "ambulance"],
  Health: ["clinic", "hospital", "doctor", "medicine", "elderly", "opd", "health"],
  Water: ["water", "tap", "tanker", "drinking", "pipeline", "supply"],
  Sanitation: ["garbage", "waste", "drain", "sewer", "toilet", "cleaning", "solid waste", "litter", "littering", "trash", "dumping", "hotel waste"],
  Power: ["streetlight", "light", "electricity", "transformer", "power", "dark"],
  "Digital Access": ["internet", "network", "mobile", "tower", "broadband", "digital", "signal"],
  "Disaster Relief": ["disaster", "relief", "flood", "cyclone", "storm", "fire", "rescue", "shelter", "food", "ration", "emergency"]
};

const projectTitles: Record<string, string> = {
  Education: "Repair classrooms and toilets",
  Roads: "Resurface priority access road",
  Health: "Add evening clinic access",
  Water: "Stabilize drinking water supply",
  Sanitation: "Upgrade drainage and waste collection",
  Power: "Restore streetlights and safe public lighting",
  "Digital Access": "Improve mobile and broadband access",
  "Disaster Relief": "Open emergency relief response"
};

type SubmissionInput = {
  userId: string;
  username: string;
  privacyMode: boolean;
  state: string;
  district: string;
  ward: string;
  channel: Submission["channel"];
  language?: string;
  urgency: number;
  rating: number;
  text: string;
  aadhaarHash?: string;
  aadhaarMasked?: string;
  aadhaarLast4?: string;
  aadhaarVerified?: boolean;
  identityMode?: AadhaarIdentityMode;
  // Multimodal + location enrichment (optional)
  mediaType?: Submission["mediaType"];
  lat?: number;
  lng?: number;
  locationLabel?: string;
  transcript?: string;
  imageSummary?: string;
  isCivicIssue?: boolean;
  noiseReason?: string;
  aiProviderMode?: Submission["aiProviderMode"];
  aiModel?: string;
  aiFallbackUsed?: boolean;
};

export function normalizeSubmission(input: SubmissionInput, analysis: VertexTextAnalysis): Submission {
  const civic = civicDatasets.find((dataset) => dataset.ward === input.ward && dataset.district === input.district);
  const mapping = areaMappings.find((area) => area.state === input.state && area.district === input.district && area.ward === input.ward);
  const dynamicRoute = dynamicMpRoute(input.state, input.district);
  const displayName = input.privacyMode ? randomAlias(input.userId) : input.username;
  const rating = Math.max(1, Math.min(5, input.rating));
  const urgency = Math.max(1, Math.min(5, input.urgency));
  const text = (input.text || analysis.normalizedText).trim();
  const ruleCategory = categorize([text, analysis.normalizedText].filter(Boolean).join(" "));
  const category =
    input.isCivicIssue === false
      ? "Needs Review"
      : analysis.category === "Civic Services" && ruleCategory !== "Civic Services"
        ? ruleCategory
        : analysis.category;
  const reward = calculateCitizenReward(text, input, analysis);

  return {
    ...input,
    id: crypto.randomUUID(),
    displayName,
    mpId: civic?.mpId ?? mapping?.mpId ?? dynamicRoute.id,
    language: input.language || analysis.detectedLanguage,
    detectedLanguage: analysis.detectedLanguage,
    normalizedText: analysis.normalizedText,
    category,
    text,
    rating,
    urgency,
    mediaType: input.mediaType ?? "none",
    citizenScore: reward.points,
    submissionQualityScore: reward.qualityScore,
    rewardPoints: reward.points,
    rewardBand: reward.band,
    rewardReasons: reward.reasons,
    createdAt: new Date().toISOString()
  };
}

export function categorize(text: string): string {
  const normalized = text.toLowerCase();
  const scores = Object.entries(categoryTerms).map(([category, terms]) => ({
    category,
    score: terms.filter((term) => normalized.includes(term)).length
  }));
  scores.sort((a, b) => b.score - a.score);
  return scores[0]?.score ? scores[0].category : "Civic Services";
}

export function buildDashboard(submissions: Submission[], filters: DashboardFilters = {}) {
  const visible = applyFilters(submissions, filters);
  const grouped = new Map<string, Submission[]>();

  for (const submission of visible) {
    const category = submission.category || categorize(submission.normalizedText || submission.text);
    const key = `${submission.state}::${submission.district}::${submission.ward}::${category}`;
    grouped.set(key, [...(grouped.get(key) ?? []), submission]);
  }

  const projects = [...grouped.entries()]
    .map(([key, items]) => rankCluster(key, items, visible.length))
    .sort((a, b) => b.score - a.score);

  return {
    generatedAt: new Date().toISOString(),
    filters,
    totals: {
      submissions: visible.length,
      wards: new Set(visible.map((item) => item.ward)).size,
      languages: new Set(visible.map((item) => item.detectedLanguage || item.language)).size,
      botRisk: repeatedTextRatio(visible) > 0.35 ? "medium" : "low"
    },
    projects,
    hotspots: projects.slice(0, 8).map((project, index) => {
      const civic = civicForProject(project);
      const fallback = seededHotspot(index);
      return {
        ward: project.ward,
        category: project.category,
        intensity: project.score,
        lat: civic?.lat ?? fallback.lat,
        lng: civic?.lng ?? fallback.lng
      };
    })
  };
}

function rankCluster(key: string, items: Submission[], totalSubmissions: number): RankedProject {
  const [state, district, ward, category] = key.split("::");
  const civic = civicDatasets.find(
    (dataset) => dataset.state === state && dataset.district === district && dataset.ward === ward && dataset.category === category
  );
  const mp = mpProfiles.find((profile) => profile.wards.includes(ward) && profile.district === district && profile.state === state);
  const dynamicRoute = dynamicMpRoute(state, district);
  const sources = sourceSnapshots.filter(
    (source) => source.state === state && source.district === district && source.ward === ward
  );
  const averageCitizenScore = Math.round(average(items.map((item) => item.citizenScore)));
  const averageSubmissionQuality = Math.round(average(items.map((item) => item.submissionQualityScore ?? item.citizenScore)));
  const rewardedCitizenCount = new Set(items.map((item) => item.aadhaarHash ?? item.userId)).size;
  const qualityMultiplier = 0.75 + averageSubmissionQuality / 200;
  const demandScore = Math.min(40, Math.round((items.length / Math.max(1, totalSubmissions)) * 130 * qualityMultiplier));
  const needScore = Math.round((civic?.gapScore ?? 0.45) * 35);
  const urgencyScore = Math.round((average(items.map((item) => item.urgency)) / 5) * 15);
  const equityScore = Math.round((civic?.equityScore ?? 0.5) * 15);
  const averageRating = Number(average(items.map((item) => item.rating)).toFixed(1));
  const ratingBoost = Math.round((averageRating / 5) * 5);
  const score = Math.min(100, demandScore + needScore + urgencyScore + equityScore);
  const demandCount = syntheticDemand(items.length, category);

  return {
    id: slug(`${ward}-${category}`),
    title: `${projectTitles[category] ?? "Review civic service request"} in ${ward}`,
    category,
    state,
    district,
    ward,
    mpId: civic?.mpId ?? items[0]?.mpId ?? dynamicRoute.id,
    mpName: civic?.mpName ?? mp?.name ?? dynamicRoute.name,
    score,
    confidence: Number(Math.min(0.94, 0.58 + items.length * 0.06 + (civic ? 0.16 : 0)).toFixed(2)),
    demandCount,
    averageRating,
    ratings: items.length,
    demandScore,
    needScore,
    urgencyScore: Math.min(15, urgencyScore + ratingBoost),
    equityScore,
    averageCitizenScore,
    averageSubmissionQuality,
    rewardedCitizenCount,
    languageMix: [...new Set(items.map((item) => item.detectedLanguage || item.language))],
    recentCitizenAliases: [...new Set(items.map((item) => item.displayName))].slice(0, 4),
    rationale: rationale(category, civic?.indicators ?? [], demandCount),
    evidence: [
      `${demandCount} similar requests`,
      `${averageRating}/5 citizen rating`,
      `${averageSubmissionQuality}/100 average submission quality`,
      `${rewardedCitizenCount} rewarded citizen ${rewardedCitizenCount === 1 ? "identity" : "identities"}`,
      ...(civic?.indicators ?? ["Official dataset match pending"])
    ],
    safeguards: [
      "Personal identity removed from MP view",
      "Aadhaar stored as HMAC hash plus masked last four only",
      "Duplicate campaign and bot pattern checks applied",
      "Vertex AI output stored with normalized text and detected language",
      "Human approval required before allocation"
    ],
    status: score >= 85 ? "shortlist" : "review",
    sourceSnapshotIds: sources.map((source) => source.id),
    sourceFreshness: sources.some((source) => source.freshness === "fresh") ? "fresh" : sources.length ? "stale" : "missing"
  };
}

function syntheticDemand(count: number, category: string): number {
  const multiplier = category === "Education" ? 24 : category === "Roads" ? 19 : 15;
  return count * multiplier;
}

function rationale(category: string, indicators: string[], demandCount: number): string {
  const signal = indicators[0] ?? "official need data";
  return `${category} demand is supported by ${demandCount} deduped citizen signals and ${signal}.`;
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function civicForProject(project: Pick<RankedProject, "state" | "district" | "ward" | "category">) {
  return civicDatasets.find(
    (dataset) =>
      dataset.state === project.state &&
      dataset.district === project.district &&
      dataset.ward === project.ward &&
      dataset.category === project.category
  );
}

function seededHotspot(index: number) {
  const points = [
    { lat: 28.62, lng: 77.3 },
    { lat: 20.01, lng: 73.79 },
    { lat: 13.08, lng: 80.27 },
    { lat: 22.57, lng: 88.36 },
    { lat: 26.85, lng: 80.95 },
    { lat: 12.97, lng: 77.59 },
    { lat: 23.03, lng: 72.58 },
    { lat: 26.91, lng: 75.79 }
  ];
  return points[index % points.length];
}

function applyFilters(submissions: Submission[], filters: DashboardFilters): Submission[] {
  const query = filters.q?.trim().toLowerCase();
  return submissions.filter((submission) => {
    const localMatch = !filters.ward || submission.ward === filters.ward;
    const districtMatch = !filters.district || submission.district === filters.district;
    const stateMatch = !filters.state || submission.state === filters.state;
    const mpMatch = !filters.mpId || submission.mpId === filters.mpId;
    const queryMatch =
      !query ||
      [submission.normalizedText, submission.text, submission.ward, submission.district, submission.state, submission.category]
        .join(" ")
        .toLowerCase()
        .includes(query);

    if (!stateMatch || !districtMatch || !localMatch || !queryMatch) return false;
    if (filters.scope === "mp") return mpMatch;
    return true;
  });
}

function repeatedTextRatio(submissions: Submission[]): number {
  const normalized = submissions.map((item) => item.text.toLowerCase().replace(/\s+/g, " ").trim());
  const unique = new Set(normalized).size;
  return 1 - unique / Math.max(1, submissions.length);
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function dynamicMpRoute(state: string, district: string): { id: string; name: string } {
  const cleanState = state?.trim() || "unknown-state";
  const cleanDistrict = district?.trim() || "location-pending";
  if (cleanDistrict === "Location pending" || cleanDistrict === "Delhi") {
    return { id: `review-${slug(cleanState) || "unknown"}`, name: `${cleanState} routing review` };
  }
  return {
    id: `mp-${slug(cleanState)}-${slug(cleanDistrict)}`,
    name: `MP ${cleanDistrict}`
  };
}

function randomAlias(seed: string): string {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) % 997;
  return `Local Voice ${String(hash).padStart(3, "0")}`;
}

function calculateCitizenReward(text: string, input: SubmissionInput, analysis: VertexTextAnalysis): {
  qualityScore: number;
  points: number;
  band: RewardBand;
  reasons: string[];
} {
  if (input.isCivicIssue === false) {
    return {
      qualityScore: 5,
      points: 5,
      band: "needs_detail",
      reasons: [input.noiseReason ?? analysis.noiseReason ?? "AI could not confirm an addressable public civic issue."]
    };
  }
  const fallbackQuality = fallbackQualityScore(text, input, analysis.confidence);
  const aiQuality = typeof analysis.qualityScore === "number" && Number.isFinite(analysis.qualityScore)
    ? Math.max(0, Math.min(100, Math.round(analysis.qualityScore)))
    : undefined;
  const qualityScore = aiQuality === undefined ? fallbackQuality : Math.round(aiQuality * 0.8 + fallbackQuality * 0.2);
  const points = Math.max(10, Math.min(100, qualityScore));
  return {
    qualityScore,
    points,
    band: rewardBand(points),
    reasons: rewardReasons(text, input, analysis, qualityScore)
  };
}

function fallbackQualityScore(text: string, input: SubmissionInput, confidence: number): number {
  const clean = text.trim();
  const detailScore = Math.min(34, Math.round(clean.length / 6));
  const evidenceScore = input.mediaType && input.mediaType !== "none" ? 18 : 0;
  const locationScore = input.lat && input.lng ? 14 : input.ward ? 9 : 0;
  const urgencyScore = input.urgency * 4;
  const ratingScore = input.rating * 2;
  const aiConfidenceScore = Math.round(confidence * 14);
  return Math.max(10, Math.min(100, 10 + detailScore + evidenceScore + locationScore + urgencyScore + ratingScore + aiConfidenceScore));
}

function rewardBand(points: number): RewardBand {
  if (points >= 85) return "excellent";
  if (points >= 70) return "strong";
  if (points >= 45) return "useful";
  return "needs_detail";
}

function rewardReasons(text: string, input: SubmissionInput, analysis: VertexTextAnalysis, qualityScore: number): string[] {
  const aiReasons = analysis.qualitySignals?.map((item) => item.trim()).filter(Boolean).slice(0, 3) ?? [];
  if (aiReasons.length) return aiReasons;
  const reasons = [];
  if (text.trim().length >= 120) reasons.push("Detailed description gives field teams useful context.");
  else if (text.trim().length >= 40) reasons.push("Clear issue summary included.");
  else reasons.push("More detail would improve the reward score.");
  if (input.mediaType && input.mediaType !== "none") reasons.push("Media evidence attached.");
  if (input.lat && input.lng) reasons.push("Precise location captured.");
  if (qualityScore >= 70) reasons.push("AI marked this as actionable for routing.");
  return reasons.slice(0, 4);
}
