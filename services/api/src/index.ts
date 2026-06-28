import cors from "cors";
import express from "express";
import helmet from "helmet";
import pino from "pino";
import { z } from "zod";
import { seedSubmissions } from "./data.js";
import { buildDashboard, normalizeSubmission } from "./pipeline.js";
import { Submission } from "./types.js";

const logger = pino({ name: "people-priority-api" });
const app = express();
const port = Number(process.env.PORT ?? 8080);
const submissions: Submission[] = [...seedSubmissions];

const submissionSchema = z.object({
  channel: z.enum(["text", "voice", "photo", "whatsapp"]),
  language: z.string().min(2).max(64),
  ward: z.string().min(2).max(96),
  urgency: z.coerce.number().min(1).max(5),
  text: z.string().min(8).max(4000)
});

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/healthz", (_request, response) => {
  response.json({ ok: true, service: "people-priority-api" });
});

app.get("/api/priorities", (_request, response) => {
  response.json(buildDashboard(submissions));
});

app.post("/api/submissions", (request, response) => {
  const parsed = submissionSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: "Invalid submission", details: parsed.error.flatten() });
    return;
  }

  const submission = normalizeSubmission(parsed.data);
  submissions.push(submission);
  logger.info({ submissionId: submission.id, ward: submission.ward }, "submission processed");

  response.status(201).json({
    submission,
    dashboard: buildDashboard(submissions)
  });
});

app.listen(port, () => {
  logger.info({ port }, "api listening");
});
