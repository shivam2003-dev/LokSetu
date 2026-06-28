# AI Pipeline — Vertex AI (Gemini) intelligence layer

LokSetu turns raw citizen input (photo / voice / text / WhatsApp) into a
normalized, categorized, location-routed civic submission. All AI runs on
**Google Vertex AI** through the `@google/genai` SDK. One model family —
**Gemini 2.x** — covers every modality, with deterministic offline fallbacks so
the platform stays demoable without cloud credentials.

Source: `services/api/src/vertexAi.ts`, `services/api/src/geo.ts`,
`services/api/src/index.ts` (`processIntake`).

---

## 1. Input channels → one intake schema

| Channel  | Citizen action            | Sent to API as                        |
| -------- | ------------------------- | ------------------------------------- |
| Photo    | Snap / upload an image    | `media` = `data:image/...;base64,...` |
| Voice    | Record a voice note       | `media` = `data:audio/...;base64,...` |
| Text     | Type the problem          | `text`                                |
| WhatsApp | Message the business line | webhook → text / location / media     |

Everything lands on the unified `intakeSchema` (`services/api/src/index.ts`).
`text` **or** `media` is required; `lat`/`lng` (or an explicit ward) drive
location resolution.

---

## 2. Per-modality processing

### Text → `analyzeWithVertexAi(text, language?)`
Gemini returns strict JSON `{ detectedLanguage, normalizedText, category,
confidence }`:
- **Language detection** of any Indian language.
- **Translation / normalization** to concise English (analysis language).
- **Civic category** constrained to the enum
  `Education | Roads | Health | Water | Civic Services`.

### Image → `analyzeImageWithVertexAi(base64, mimeType, language?)`
Gemini **vision** validates and describes the photo. Returns
`{ isCivicIssue, category, normalizedText, mediaSummary, detectedLanguage,
confidence }`:
- **Validation** — `isCivicIssue=false` for selfies, memes, blurry/unrelated
  images. Non-civic uploads are flagged in the moderation queue
  (`risk: "non-civic-image"`) and the citizen is asked to retry.
- **Caption → text** — `normalizedText` is a citizen-style problem statement
  generated *from the image*, so a photo alone is enough to file a report.

### Voice → `transcribeWithVertexAi(base64, mimeType, language?)`
Gemini multimodal transcribes the audio and returns
`{ transcript, normalizedText, category, mediaSummary, detectedLanguage,
confidence }`. The original-language transcript is retained as evidence; the
English `normalizedText` feeds ranking.

### Analysis / clustering → `pipeline.ts`
`buildDashboard()` clusters submissions by `state::district::ward::category`,
then scores demand, need (official data gap), urgency, and equity. Gemini-grade
summaries surface in the MP `ProjectBrief`.

---

## 3. Location resolution — `services/api/src/geo.ts`

The simple citizen app reads GPS via the browser `navigator.geolocation` API and
sends `lat`/`lng`. `resolveLocation()`:
1. Snaps coordinates to the nearest known ward (haversine) so the submission
   routes to the correct MP even before official boundary data is loaded.
2. If `GOOGLE_MAPS_API_KEY` is set, calls the **Google Geocoding API** for a
   human-readable address label on the citizen's receipt.

Production swaps the nearest-ward heuristic for **BigQuery GIS** / official ward
polygons.

---

## 4. Configuration (environment variables)

| Variable                                    | Purpose                                  | Default          |
| ------------------------------------------- | ---------------------------------------- | ---------------- |
| `VERTEX_AI_PROJECT_ID` / `GOOGLE_CLOUD_PROJECT` | Enables Vertex AI (else fallback mode)   | —                |
| `VERTEX_AI_LOCATION`                        | Vertex region                            | `us-central1`    |
| `VERTEX_AI_MODEL`                           | Gemini model id                          | `gemini-2.0-flash` |
| `VERTEX_AI_DISABLED`                        | Force offline fallback (`true`)          | —                |
| `GOOGLE_MAPS_API_KEY`                       | Reverse-geocode receipt labels           | —                |
| `GOOGLE_APPLICATION_CREDENTIALS`            | Service-account key for Vertex auth      | —                |

Auth uses Application Default Credentials (ADC). On GKE, bind a Workload
Identity service account with the **Vertex AI User** role.

---

## 5. Responsible-AI guardrails

- **JSON-only** structured output with a constrained category enum.
- **Image validation** rejects non-civic uploads before they reach an MP.
- **Raw evidence retained** — original text, transcript, image summary stored
  alongside the normalized English so every ranking is explainable.
- **Privacy aliases** applied before any public/MP display (`privacyMode`).
- **Human-in-the-loop** — AI ranks and summarizes; fund movement always needs
  human approval.
- **Graceful degradation** — every AI call falls back deterministically; the API
  never hard-fails on a model error.

---

## 6. Production upgrade path

| Now (Gemini multimodal)        | Production-grade alternative                              |
| ------------------------------ | -------------------------------------------------------- |
| Gemini vision for images       | **Cloud Vision API** — OCR, SafeSearch, label detection  |
| Gemini multimodal for voice    | **Vertex AI Speech-to-Text "Chirp 2"** — long/streaming  |
| Nearest-ward heuristic         | **BigQuery GIS** + official ward/constituency polygons   |
| `gemini-2.0-flash`             | `gemini-2.x-pro` for higher-accuracy summarization       |
| In-process intake              | **Pub/Sub + Dataflow** async pipeline at India scale     |

These are drop-in: the `vertexAi.ts` functions already return a stable shape, so
swapping the backing service does not touch the intake or ranking code.
