export type Channel = "text" | "voice" | "photo" | "whatsapp";
export type ProjectStatus = "review" | "shortlist" | "approved";
export type UserRole = "citizen" | "mp";

export type Location = {
  state: string;
  district: string;
  ward: string;
};

export type UserProfile = {
  id: string;
  role: UserRole;
  username: string;
  displayName: string;
  privacyMode: boolean;
  mpId?: string;
  location: Location;
  contributionScore: number;
};

export type Submission = {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  privacyMode: boolean;
  mpId: string;
  state: string;
  district: string;
  channel: Channel;
  language: string;
  detectedLanguage: string;
  normalizedText: string;
  category: string;
  ward: string;
  urgency: number;
  rating: number;
  citizenScore: number;
  text: string;
  createdAt: string;
  // Multimodal + location enrichment
  mediaType?: "image" | "audio" | "none";
  lat?: number;
  lng?: number;
  locationLabel?: string;
  transcript?: string;
  imageSummary?: string;
  isCivicIssue?: boolean;
  processingStatus?: "processed";
  rawIntakeId?: string;
  batchId?: string;
  processedAt?: string;
};

export type RawIntakePayload = {
  channel: Channel;
  language?: string;
  userId: string;
  username: string;
  privacyMode: boolean;
  state?: string;
  district?: string;
  ward?: string;
  lat?: number;
  lng?: number;
  urgency: number;
  rating: number;
  text?: string;
  media?: string;
};

export type RawIntakeRecord = {
  id: string;
  payload: RawIntakePayload;
  status: "pending" | "processing" | "processed" | "failed";
  attempts: number;
  error?: string;
  createdAt: string;
  processedAt?: string;
};

export type BatchRun = {
  id: string;
  startedAt: string;
  finishedAt?: string;
  status: "running" | "succeeded" | "failed";
  processed: number;
  failed: number;
  error?: string;
};

export type CivicDataset = {
  state: string;
  district: string;
  ward: string;
  mpId: string;
  mpName: string;
  category: string;
  gapScore: number;
  equityScore: number;
  indicators: string[];
};

export type RankedProject = {
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
  status: ProjectStatus;
};

export type DashboardFilters = {
  scope?: "local" | "global" | "mp";
  mpId?: string;
  state?: string;
  district?: string;
  ward?: string;
  q?: string;
};
