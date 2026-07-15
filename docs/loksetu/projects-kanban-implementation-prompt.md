# LokSetu Projects Kanban implementation prompt

Implement a production-ready Projects workflow for the Delhi-scoped LokSetu dashboard.

## Outcomes

- Make every project card draggable between Proposed, Ongoing, Delayed, and Completed columns.
- Persist delivery status through a permission-checked API and Postgres, with an in-memory fallback for local development.
- Use optimistic UI updates with rollback and a visible status message when a save fails.
- Provide a keyboard/touch alternative through a labelled status selector on every card; dragging must never be the only way to update a project.
- Keep the selected project, KPI counts, filters, cards, Kanban columns, timeline, and details synchronized after a status update.
- Add useful search, status, and department filters to the Project page.
- Preserve dashboard geography and `projects:update` permission enforcement.
- Do not invent a second review status: keep recommendation review status separate from project delivery status.

## Map and air-quality additions in the same release

- Prefer Google Maps when a browser key exists, render the dark Google roadmap style, and enforce strict India bounds.
- Retain issue-specific colors, emoji hotspot markers, issue tabs, cluster/heatmap modes, and the OpenStreetMap fallback.
- Show Delhi air-quality current conditions and a simple 12-hour forecast from Open-Meteo/CAMS, with attribution and a clear forecast-model disclaimer.
- Drive the Delhi water-cannon recommendation from the maximum of current and forecast AQI.

## Validation

- Run TypeScript checks, builds, Helm lint, and focused API checks.
- Verify in a real browser that drag-and-drop and the status selector both update the correct column and remain correct after refresh.
- Verify the Google map displays in dark mode with India-only panning and the existing issue overlays.
- Publish through a focused branch and PR, merge to `main`, monitor deployment, and smoke the live application.
