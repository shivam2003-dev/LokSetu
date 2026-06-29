import pino from "pino";
import { Submission } from "./types.js";

const logger = pino({ name: "people-priority-rag-indexer" });

export async function indexSubmissionInRag(submission: Submission) {
  const baseUrl = process.env.RAG_API_URL?.replace(/\/$/, "");
  if (!baseUrl) return;

  const content = [
    `Citizen signal: ${submission.category} in ${submission.ward}`,
    `State: ${submission.state}`,
    `District: ${submission.district}`,
    `Ward: ${submission.ward}`,
    `MP: ${submission.mpId}`,
    `Channel: ${submission.channel}`,
    `Language: ${submission.detectedLanguage || submission.language}`,
    `Urgency: ${submission.urgency}`,
    `Rating: ${submission.rating}`,
    `Text: ${submission.normalizedText || submission.text}`,
    submission.transcript ? `Transcript: ${submission.transcript}` : "",
    submission.imageSummary ? `Image summary: ${submission.imageSummary}` : ""
  ].filter(Boolean).join("\n");

  try {
    const response = await fetch(`${baseUrl}/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        documents: [
          {
            source: "txt",
            title: `submission-${submission.id}.txt`,
            sourceUri: `loksetu://submission/${submission.id}`,
            sourceUrl: `loksetu://submission/${submission.id}`,
            content,
            metadata: {
              connector: "loksetu-api-batch",
              sourceType: "citizen_submission",
              submissionId: submission.id,
              state: submission.state,
              district: submission.district,
              ward: submission.ward,
              category: submission.category,
              mpId: submission.mpId,
              channel: submission.channel,
              privacyMode: submission.privacyMode,
              processedAt: submission.processedAt
            }
          }
        ]
      })
    });
    if (!response.ok) {
      logger.warn({ status: response.status, submissionId: submission.id }, "rag submission indexing failed");
    }
  } catch (error) {
    logger.warn({ error, submissionId: submission.id }, "rag submission indexing unavailable");
  }
}
