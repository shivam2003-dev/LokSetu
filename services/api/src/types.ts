export type Channel = "text" | "voice" | "photo" | "whatsapp";
export type ProjectStatus = "review" | "shortlist" | "approved";

export type Submission = {
  id: string;
  channel: Channel;
  language: string;
  ward: string;
  urgency: number;
  text: string;
  createdAt: string;
};

export type CivicDataset = {
  ward: string;
  category: string;
  gapScore: number;
  equityScore: number;
  indicators: string[];
};

export type RankedProject = {
  id: string;
  title: string;
  category: string;
  ward: string;
  score: number;
  confidence: number;
  demandCount: number;
  demandScore: number;
  needScore: number;
  urgencyScore: number;
  equityScore: number;
  rationale: string;
  evidence: string[];
  safeguards: string[];
  status: ProjectStatus;
};
