export type Channel = "text" | "voice" | "photo" | "video" | "whatsapp";
export type ProjectStatus = "review" | "shortlist" | "approved";
export type ProjectDeliveryStatus = "proposed" | "ongoing" | "delayed" | "completed";
export type UserRole = "citizen" | "mp" | "ward_staff" | "district_admin" | "state_admin";
export type DashboardPermission = "dashboard:view" | "issues:view" | "projects:update" | "users:manage";

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

export type AadhaarIdentityMode = "aadhaar_format_only";

export type AadhaarIdentity = {
  aadhaarHash: string;
  aadhaarMasked: string;
  aadhaarLast4: string;
  aadhaarVerified: false;
  identityMode: AadhaarIdentityMode;
};

export type RewardBand = "needs_detail" | "useful" | "strong" | "excellent";

export type AuthUser = {
  id: string;
  username: string;
  passwordHash: string;
  role: UserRole;
  displayName: string;
  permissions: DashboardPermission[];
  state?: string;
  district?: string;
  constituencyId?: string;
  createdAt: string;
};

export type AreaMapping = {
  id: string;
  state: string;
  district: string;
  ward: string;
  mpId: string;
  wardStaffUserIds: string[];
  updatedAt: string;
};

export type SourceSnapshot = {
  id: string;
  source: "census" | "education" | "roads" | "water" | "health" | "sanitation" | "power" | "digital";
  version: string;
  state: string;
  district: string;
  ward: string;
  capturedAt: string;
  rowCount: number;
  freshness: "fresh" | "stale" | "missing";
  metrics: Record<string, number | string>;
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
  aadhaarHash?: string;
  aadhaarMasked?: string;
  aadhaarLast4?: string;
  aadhaarVerified?: boolean;
  identityMode?: AadhaarIdentityMode;
  submissionQualityScore?: number;
  rewardPoints?: number;
  rewardBand?: RewardBand;
  rewardReasons?: string[];
  text: string;
  createdAt: string;
  // Multimodal + location enrichment
  mediaType?: "image" | "audio" | "video" | "none";
  lat?: number;
  lng?: number;
  locationLabel?: string;
  transcript?: string;
  imageSummary?: string;
  isCivicIssue?: boolean;
  noiseReason?: string;
  aiProviderMode?: "vertex" | "openai-compatible" | "fallback";
  aiModel?: string;
  aiFallbackUsed?: boolean;
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
  aadhaarHash?: string;
  aadhaarMasked?: string;
  aadhaarLast4?: string;
  aadhaarVerified?: boolean;
  identityMode?: AadhaarIdentityMode;
  text?: string;
  media?: string;
  discarded?: boolean;
  discardedAt?: string;
  discardedScore?: number;
  discardedQualityScore?: number;
  discardedReason?: string;
  discardedThreshold?: number;
};

export type RawIntakeRecord = {
  id: string;
  payload: RawIntakePayload;
  status: "pending" | "processing" | "processed" | "failed" | "discarded";
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
  discarded: number;
  failed: number;
  error?: string;
};

export type CivicDataset = {
  state: string;
  district: string;
  ward: string;
  lat?: number;
  lng?: number;
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
  lat?: number;
  lng?: number;
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
  deliveryStatus?: ProjectDeliveryStatus;
  averageCitizenScore?: number;
  averageSubmissionQuality?: number;
  rewardedCitizenCount?: number;
  sourceSnapshotIds?: string[];
  sourceFreshness?: "fresh" | "stale" | "missing";
};

export type DashboardFilters = {
  scope?: "local" | "global" | "mp";
  mpId?: string;
  state?: string;
  district?: string;
  ward?: string;
  q?: string;
};
