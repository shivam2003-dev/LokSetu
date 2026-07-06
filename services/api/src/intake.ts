import { z } from "zod";
import { buildAadhaarIdentity } from "./citizenIdentity.js";
import { resolveLocation } from "./geo.js";
import { normalizeSubmission } from "./pipeline.js";
import { AadhaarIdentity, RawIntakePayload, Submission } from "./types.js";
import {
  analyzeImageWithVertexAi,
  analyzeWithVertexAi,
  transcribeWithVertexAi,
  VertexMediaAnalysis,
  VertexTextAnalysis
} from "./vertexAi.js";

export const intakeSchema = z
  .object({
    channel: z.enum(["text", "voice", "photo", "video", "whatsapp"]),
    language: z.string().min(2).max(64).optional(),
    userId: z.string().min(2).max(96).default("guest"),
    username: z.string().min(1).max(64).default("citizen"),
    privacyMode: z.coerce.boolean().default(true),
    state: z.string().min(2).max(96).optional(),
    district: z.string().min(2).max(96).optional(),
    ward: z.string().min(2).max(96).optional(),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    urgency: z.coerce.number().min(1).max(5).default(3),
    rating: z.coerce.number().min(1).max(5).default(4),
    aadhaarNumber: z.string().optional(),
    text: z.string().max(4000).optional(),
    media: z.string().max(14_000_000).optional()
  })
  .refine((value) => Boolean(value.text?.trim()) || Boolean(value.media), {
    message: "Provide text or media"
  });

export type Intake = z.infer<typeof intakeSchema>;

export function toRawIntakePayload(input: Intake, identityOverride?: AadhaarIdentity): RawIntakePayload {
  const identity = identityOverride ?? buildAadhaarIdentity(input.aadhaarNumber);
  const defaultCitizen = input.userId === "guest" || input.username === "citizen";
  return {
    channel: input.channel,
    language: input.language,
    userId: identity && defaultCitizen ? `aadhaar-${identity.aadhaarHash.slice(0, 16)}` : input.userId,
    username: identity && defaultCitizen ? `Citizen ${identity.aadhaarMasked}` : input.username,
    privacyMode: input.privacyMode,
    state: input.state,
    district: input.district,
    ward: input.ward,
    lat: input.lat,
    lng: input.lng,
    urgency: input.urgency,
    rating: input.rating,
    aadhaarHash: identity?.aadhaarHash,
    aadhaarMasked: identity?.aadhaarMasked,
    aadhaarLast4: identity?.aadhaarLast4,
    aadhaarVerified: identity?.aadhaarVerified,
    identityMode: identity?.identityMode,
    text: input.text,
    media: input.media
  };
}

export async function processIntake(
  input: RawIntakePayload,
  meta: { rawIntakeId?: string; batchId?: string } = {}
): Promise<{ submission: Submission; analysis: VertexTextAnalysis | VertexMediaAnalysis }> {
  const media = input.media ? parseDataUrl(input.media) : null;
  const location = await resolveLocation(input);

  let analysis: VertexTextAnalysis | VertexMediaAnalysis;
  let mediaType: Submission["mediaType"] = "none";
  let transcript: string | undefined;
  let imageSummary: string | undefined;
  let isCivicIssue: boolean | undefined;

  if (media?.kind === "image") {
    const result = await analyzeImageWithVertexAi(media.base64, media.mimeType, input.language);
    analysis = result;
    mediaType = "image";
    imageSummary = result.mediaSummary;
    isCivicIssue = result.isCivicIssue;
  } else if (media?.kind === "audio") {
    const result = await transcribeWithVertexAi(media.base64, media.mimeType, input.language, input.text);
    analysis = result;
    mediaType = "audio";
    transcript = result.transcript ?? result.mediaSummary;
    isCivicIssue = result.isCivicIssue;
  } else if (media?.kind === "video") {
    analysis = await analyzeWithVertexAi(input.text || "Citizen uploaded a video showing a local civic development issue.", input.language);
    mediaType = "video";
    imageSummary = "Citizen uploaded video evidence for this civic issue.";
    isCivicIssue = true;
  } else {
    analysis = await analyzeWithVertexAi(input.text ?? "", input.language);
  }
  isCivicIssue = isCivicIssue ?? analysis.isCivicIssue;

  const now = new Date().toISOString();
  const submission = normalizeSubmission(
    {
      userId: input.userId,
      username: input.username,
      privacyMode: input.privacyMode,
      state: location.state,
      district: location.district,
      ward: location.ward,
      channel: input.channel,
      language: input.language,
      urgency: input.urgency,
      rating: input.rating,
      text: input.text ?? "",
      mediaType,
      lat: input.lat,
      lng: input.lng,
      locationLabel: location.label,
      aadhaarHash: input.aadhaarHash,
      aadhaarMasked: input.aadhaarMasked,
      aadhaarLast4: input.aadhaarLast4,
      aadhaarVerified: input.aadhaarVerified,
      identityMode: input.identityMode,
      transcript,
      imageSummary,
      isCivicIssue,
      noiseReason: analysis.noiseReason,
      aiProviderMode: analysis.providerMode,
      aiModel: analysis.model,
      aiFallbackUsed: analysis.fallbackUsed
    },
    analysis
  );

  return {
    submission: {
      ...submission,
      processingStatus: "processed",
      rawIntakeId: meta.rawIntakeId,
      batchId: meta.batchId,
      processedAt: now
    },
    analysis
  };
}

export function receiptMessage(submission: Submission, analysis: VertexTextAnalysis | VertexMediaAnalysis): string {
  if ("isCivicIssue" in analysis && analysis.isCivicIssue === false) {
    return "We could not detect a civic issue in this upload. Please add a photo of the problem or a short description.";
  }
  return `Thank you. We logged a ${submission.category} issue in ${submission.locationLabel ?? submission.ward}, detected ${submission.detectedLanguage}, and routed it to your MP.`;
}

export function extractWhatsAppMessages(body: unknown): RawIntakePayload[] {
  const intakes: RawIntakePayload[] = [];
  const payload = body as {
    entry?: Array<{ changes?: Array<{ value?: { messages?: Array<Record<string, unknown>> } }> }>;
  };
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const message of change.value?.messages ?? []) {
        const from = String(message.from ?? "unknown");
        const text = (message.text as { body?: string } | undefined)?.body;
        const location = message.location as { latitude?: number; longitude?: number } | undefined;
        intakes.push({
          channel: "whatsapp",
          userId: `wa-${from}`,
          username: from,
          privacyMode: true,
          text,
          lat: location?.latitude,
          lng: location?.longitude,
          urgency: 3,
          rating: 4
        });
      }
    }
  }
  return intakes;
}

function parseDataUrl(media: string): { mimeType: string; base64: string; kind: "image" | "audio" | "video" | "other" } | null {
  const trimmed = media.trim();
  if (!trimmed.startsWith("data:")) return null;
  const commaIndex = trimmed.indexOf(",");
  if (commaIndex === -1) return null;
  const metadata = trimmed.slice(5, commaIndex).split(";").filter(Boolean);
  const mimeType = metadata[0] || "application/octet-stream";
  if (!metadata.some((item) => item.toLowerCase() === "base64")) return null;
  const base64 = trimmed.slice(commaIndex + 1);
  const kind = mimeType.startsWith("image/") ? "image" : mimeType.startsWith("audio/") ? "audio" : mimeType.startsWith("video/") ? "video" : "other";
  return { mimeType, base64, kind };
}
