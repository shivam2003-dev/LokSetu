# AI Pipeline — Indic AI + Vertex AI intelligence layer

LokSetu turns raw citizen input (photo / voice / text / WhatsApp) into a
normalized, categorized, location-routed civic submission. The core classifier
runs on **Google Vertex AI Gemini** through the `@google/genai` SDK. Optional
Indic-language preprocessing can run before Gemini:

- **Sarvam AI** for Indian-language text language identification,
  translation, and Saaras speech-to-text / speech-translate.
- **Bhashini-compatible pipeline API** for ASR + translation where a government
  pipeline key is available.

Processing is AI-only: if configured models fail after retries, the raw intake is
marked failed for retry instead of being converted into a deterministic
placeholder.

Source: `services/api/src/indicLanguage.ts`, `services/api/src/vertexAi.ts`,
`services/api/src/geo.ts`,
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
When `SARVAM_API_KEY` or Bhashini config is available, LokSetu first normalizes
Indian-language text to concise English. Gemini then returns strict JSON
`{ detectedLanguage, normalizedText, category, confidence }`:
- **Language detection** by Sarvam/Bhashini where configured, otherwise Gemini.
- **Translation / normalization** to concise English.
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
Voice now uses a provider chain:

1. Sarvam Saaras speech-to-text / speech-translate if `SARVAM_API_KEY` exists.
2. Bhashini-compatible ASR + translation if `BHASHINI_*` env is configured.
3. Vertex Gemini multimodal if no Indic provider is configured or if the Indic
   provider fails.

The transcript is retained as evidence; English `normalizedText` feeds Gemini
classification and ranking.

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
| `VERTEX_AI_PROJECT_ID` / `GOOGLE_CLOUD_PROJECT` | Enables Vertex AI model inference        | —                |
| `VERTEX_AI_LOCATION`                        | Vertex region                            | `us-central1`    |
| `VERTEX_AI_MODEL`                           | Gemini model id                          | `gemini-2.0-flash` |
| `VERTEX_AI_FALLBACK_MODELS`                 | Comma-separated backup Gemini models     | built-in backups |
| `AI_RETRY_ATTEMPTS`                         | Attempts per configured model            | `2`              |
| `INDIC_LANGUAGE_PROVIDER_ORDER`             | Indic preprocessor order                 | `sarvam,bhashini` |
| `INDIC_AI_RETRY_ATTEMPTS`                   | Sarvam/Bhashini retry attempts           | `AI_RETRY_ATTEMPTS` |
| `SARVAM_API_KEY`                            | Sarvam Indic language API key            | —                |
| `SARVAM_API_BASE_URL`                       | Sarvam API base URL                      | `https://api.sarvam.ai` |
| `SARVAM_TRANSLATE_MODEL`                    | Sarvam translation model                 | `sarvam-translate:v1` |
| `SARVAM_SPEECH_MODEL`                       | Sarvam speech model                      | `saaras:v3`      |
| `BHASHINI_PIPELINE_COMPUTE_URL`             | Bhashini pipeline compute URL            | —                |
| `BHASHINI_AUTH_HEADER` / `BHASHINI_AUTH_VALUE` | Bhashini auth header/value             | —                |
| `BHASHINI_ASR_SERVICE_ID` / `BHASHINI_TRANSLATION_SERVICE_ID` | Optional Bhashini service IDs | — |
| `VERTEX_AI_DISABLED`                        | Disable Vertex route for tests           | —                |
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
- **AI-only processing** — model failures do not create fake processed records.
  The batch marks raw intake failed so operators can retry after Vertex/Gemini
  recovers or after a backup model is configured.

---

## 6. Production upgrade path

| Now (Gemini multimodal)        | Production-grade alternative                              |
| ------------------------------ | -------------------------------------------------------- |
| Gemini vision for images       | **Cloud Vision API** — OCR, SafeSearch, label detection  |
| Gemini multimodal for voice    | **Sarvam Saaras**, **Bhashini ASR**, or **Cloud Speech-to-Text Chirp** |
| Nearest-ward heuristic         | **BigQuery GIS** + official ward/constituency polygons   |
| `gemini-2.0-flash`             | `gemini-2.x-pro` for higher-accuracy summarization       |
| In-process intake              | **Pub/Sub + Dataflow** async pipeline at India scale     |

These are drop-in: the `vertexAi.ts` functions already return a stable shape, so
swapping the backing service does not touch the intake or ranking code.
