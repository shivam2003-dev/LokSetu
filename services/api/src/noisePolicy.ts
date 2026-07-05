import { RawIntakePayload, Submission } from "./types.js";

export const MINIMUM_STORED_CITIZEN_SCORE = 25;

export type DiscardedIntakeDecision = {
  score: number;
  qualityScore: number;
  reason: string;
  payload: RawIntakePayload;
};

export function buildDiscardedIntakeDecision(
  original: RawIntakePayload,
  submission: Submission,
  discardedAt = new Date().toISOString()
): DiscardedIntakeDecision | null {
  const score = normalizedScore(submission.rewardPoints ?? submission.citizenScore);
  const qualityScore = normalizedScore(submission.submissionQualityScore ?? submission.citizenScore);
  if (score >= MINIMUM_STORED_CITIZEN_SCORE) return null;

  const reason = `Discarded as noise because AI reward score ${score}/100 is below ${MINIMUM_STORED_CITIZEN_SCORE}/100.`;
  return {
    score,
    qualityScore,
    reason,
    payload: {
      channel: original.channel,
      language: original.language,
      userId: "discarded-noise",
      username: "discarded-noise",
      privacyMode: true,
      state: undefined,
      district: undefined,
      ward: undefined,
      urgency: 1,
      rating: 1,
      text: undefined,
      media: undefined,
      discarded: true,
      discardedAt,
      discardedScore: score,
      discardedQualityScore: qualityScore,
      discardedReason: reason,
      discardedThreshold: MINIMUM_STORED_CITIZEN_SCORE
    }
  };
}

export function isDiscardedPayload(payload: RawIntakePayload): boolean {
  return payload.discarded === true;
}

function normalizedScore(value: unknown) {
  const score = Number(value);
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}
