# Constituency Intelligence Platform

LokSetu AI should operate as a constituency intelligence layer, not only a complaint inbox. The platform continuously batches signals from citizen channels, government records, maps, public discourse, sensors, sector systems, and documents, then produces explainable priorities for MP and district action.

## Source Families

- Citizen sources: mobile app, web portal, WhatsApp, SMS, IVR, voice notes, email, public meetings, Jan Sunwai, Gram Sabha minutes, surveys, QR feedback, and polls.
- Government data: Census, MPLADS, PM Gati Shakti, OGD, district dashboards, panchayat and municipal records, PWD, health, education, Jal Jeevan Mission, PMGSY, MGNREGA, budgets, tenders, RTI, and audit reports.
- Geospatial: Google Maps Platform, OpenStreetMap, ISRO Bhuvan, Google Earth Engine, flood/weather/pollution maps, land use, population density, terrain, water bodies, and forest cover.
- Public discourse: X, Facebook, Instagram, Threads, YouTube, Reddit, Koo, ShareChat, Telegram, LinkedIn, national/regional media, hyperlocal portals, PIB, district notes, and trends.
- Sector systems: grievance portals, utilities, transport, healthcare, education, agriculture, employment, MSME, GST, and job-posting indicators.

## Connector Rules

Use official APIs, partner APIs, public datasets, sensor streams, or authorized uploads. Do not rely on unauthorized scraping, private messages, or sources without a clear legal basis. Every connector must declare source owner, cadence, geography level, freshness, access mode, and governance notes.

## Daily Intelligence Products

The API exposes:

- `/api/intelligence/sources`: source registry, readiness, connector mode, and governance.
- `/api/intelligence/daily`: daily digest, emerging issues, viral topics, alerts, forecasts, recommendations, and constituency indices.

Outputs must remain explainable: each recommendation links back to ranked projects, demand counts, source freshness, and evidence snippets.

## Production Path

Start with batch ingestion. Land raw data in Cloud Storage or Postgres, normalize into BigQuery-ready tables, score and cluster in scheduled workers, and publish only privacy-safe aggregates to MP, admin, and public dashboards.
