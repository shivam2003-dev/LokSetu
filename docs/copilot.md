# LokSetu AI Copilot

The Copilot is a grounded policy and constituency intelligence assistant. It answers from current ranked projects, daily intelligence, source coverage, and evidence snippets. It is not an unbounded chatbot.

## API

- `GET /api/copilot/capabilities`: supported roles, routed agents, source-family coverage, inputs, and current limitations.
- `POST /api/copilot/query`: returns an answer, routed agent, intent, confidence, evidence, citations, suggested actions, follow-up questions, and guardrails.

Example request:

```json
{
  "role": "mp",
  "language": "English",
  "question": "Why is the highest ranked project urgent?",
  "projectId": "kalindi-nagar-education"
}
```

## Agent Routes

- MP Copilot: strategic planning and public-meeting preparation.
- Budget Agent: funding path, budget risk, and expenditure reasoning.
- GIS Agent: ward, district, hotspot, and map-grounded reasoning.
- Document Agent: DPR, audit, survey, RTI, and meeting-minute analysis.
- Citizen Agent: privacy-safe public explanations.
- Forecast Agent: emerging risk and what-if planning.

## Guardrails

The Copilot exposes citations and never returns private citizen identity. Funding, eligibility, emergency advice, and official commitments require human confirmation.
