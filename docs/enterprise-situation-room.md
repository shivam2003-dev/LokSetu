# Enterprise Situation Room

The Enterprise Situation Room turns LokSetu into an observability-style governance command center inspired by operational platforms such as cloud monitoring, SIEM, and data observability systems.

## API

`GET /api/enterprise/situation-room` returns:

- Live monitoring metrics: citizen sentiment, constituency health, budget utilization, progress, infrastructure health, complaints, scheme adoption, and AI confidence.
- Incident management: incident type, severity, status, assignee, workflow, demand, and confidence.
- Anomaly detection: category-level demand deltas and severity.
- Health score: single constituency score with sector drivers.
- Root cause and event replay: explainable chain and historical timeline for the current top priority.
- Correlation engine: linked signals such as rainfall, water logging, road complaints, and traffic.
- Digital twin: constituency assets, active signals, and source coverage.
- GIS intelligence: layer readiness and feature counts.
- Smart alerts and predictive intelligence.
- Enterprise observability: system, data, AI, and business monitoring.

## Guardrail

This endpoint produces operational intelligence from current LokSetu state. Production deployment should replace placeholders such as budget utilization and department SLA with live department connectors before using them for official reporting.
