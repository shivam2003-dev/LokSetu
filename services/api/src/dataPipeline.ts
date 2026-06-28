import { readFile } from "node:fs/promises";
import { z } from "zod";

const sourceSchema = z.enum(["census", "education", "roads", "water", "health", "sanitation", "power", "digital"]);

const fixtureSchema = z.object({
  source: sourceSchema,
  version: z.string().min(3),
  capturedAt: z.string().datetime(),
  rows: z.array(
    z.object({
      state: z.string().min(1),
      district: z.string().min(1),
      ward: z.string().min(1),
      metrics: z.record(z.string(), z.union([z.string(), z.number()]))
    })
  ).min(1)
});

export type IngestedSourceRow = {
  id: string;
  source: z.infer<typeof sourceSchema>;
  version: string;
  snapshotId: string;
  geographyId: string;
  capturedAt: string;
  state: string;
  district: string;
  ward: string;
  metrics: Record<string, string | number>;
};

export type IngestionResult = {
  snapshotId: string;
  source: string;
  version: string;
  rowCount: number;
  rows: IngestedSourceRow[];
  quality: {
    duplicateGeographies: string[];
    nullMetricRows: string[];
  };
};

export async function ingestOfficialDataFile(path: string): Promise<IngestionResult> {
  const raw = JSON.parse(await readFile(path, "utf8")) as unknown;
  const parsed = fixtureSchema.safeParse(raw);
  if (!parsed.success) {
    const message = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    throw new Error(`Official data validation failed for ${path}: ${message}`);
  }

  const fixture = parsed.data;
  const snapshotId = `${fixture.source}-${slug(fixture.version)}`;
  const seen = new Set<string>();
  const duplicateGeographies: string[] = [];
  const nullMetricRows: string[] = [];
  const rows = fixture.rows.map((row) => {
    const geographyId = geographyKey(row.state, row.district, row.ward);
    if (seen.has(geographyId)) duplicateGeographies.push(geographyId);
    seen.add(geographyId);
    if (Object.values(row.metrics).some((value) => value === "" || value === null)) nullMetricRows.push(geographyId);
    return {
      id: `${snapshotId}:${geographyId}`,
      source: fixture.source,
      version: fixture.version,
      snapshotId,
      geographyId,
      capturedAt: fixture.capturedAt,
      state: row.state,
      district: row.district,
      ward: row.ward,
      metrics: row.metrics
    };
  });

  if (duplicateGeographies.length) {
    throw new Error(`Official data validation failed for ${path}: duplicate geography ${duplicateGeographies.join(", ")}`);
  }
  if (nullMetricRows.length) {
    throw new Error(`Official data validation failed for ${path}: blank metric values in ${nullMetricRows.join(", ")}`);
  }

  return {
    snapshotId,
    source: fixture.source,
    version: fixture.version,
    rowCount: rows.length,
    rows,
    quality: { duplicateGeographies, nullMetricRows }
  };
}

export function mergeServingRows(previous: IngestedSourceRow[], next: IngestedSourceRow[]): IngestedSourceRow[] {
  const byId = new Map(previous.map((row) => [row.id, row]));
  for (const row of next) byId.set(row.id, row);
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function geographyKey(state: string, district: string, ward: string) {
  return [state, district, ward].map(slug).join("/");
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
