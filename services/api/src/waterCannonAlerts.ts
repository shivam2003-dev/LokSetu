const METRIC_TYPE = "custom.googleapis.com/loksetu/water_cannon_deployment_action";
const DEFAULT_AQI_THRESHOLD = 301;

export type WaterCannonAlert = {
  aqi: number;
  actor: string;
  target: WaterCannonTarget;
};

export type WaterCannonTarget = {
  state: string;
  district: string;
  constituencyId: string;
  constituencyName: string;
  ward: string;
  deploymentSite: string;
  latitude: number;
  longitude: number;
  responseWindow: string;
};

export type WaterCannonAlertDelivery = {
  delivery: "gcp_monitoring" | "disabled";
  metricType: string;
  recordedAt: string;
};

export function waterCannonAqiThreshold(): number {
  const configured = Number(process.env.WATER_CANNON_AQI_THRESHOLD ?? DEFAULT_AQI_THRESHOLD);
  return Number.isFinite(configured) ? Math.max(0, Math.round(configured)) : DEFAULT_AQI_THRESHOLD;
}

export function waterCannonAlertsEnabled(): boolean {
  return process.env.WATER_CANNON_ALERTS_ENABLED === "true";
}

export function waterCannonTarget(): WaterCannonTarget {
  return {
    state: process.env.WATER_CANNON_ALERT_STATE ?? "Delhi",
    district: process.env.WATER_CANNON_ALERT_DISTRICT ?? "Central Delhi",
    constituencyId: process.env.WATER_CANNON_ALERT_CONSTITUENCY_ID ?? "mp-delhi-central",
    constituencyName: process.env.WATER_CANNON_ALERT_CONSTITUENCY_NAME ?? "Central Delhi",
    ward: process.env.WATER_CANNON_ALERT_WARD ?? "Kalindi Nagar",
    deploymentSite: process.env.WATER_CANNON_ALERT_DEPLOYMENT_SITE ?? "Kalindi Nagar pollution hotspot",
    latitude: configuredCoordinate("WATER_CANNON_ALERT_LATITUDE", 28.618),
    longitude: configuredCoordinate("WATER_CANNON_ALERT_LONGITUDE", 77.245),
    responseWindow: process.env.WATER_CANNON_ALERT_RESPONSE_WINDOW ?? "30 minutes"
  };
}

export async function recordWaterCannonDeployment(alert: WaterCannonAlert): Promise<WaterCannonAlertDelivery> {
  const recordedAt = new Date().toISOString();
  if (!waterCannonAlertsEnabled()) {
    return { delivery: "disabled", metricType: METRIC_TYPE, recordedAt };
  }

  const projectId = process.env.GOOGLE_CLOUD_PROJECT ?? process.env.VERTEX_AI_PROJECT_ID;
  if (!projectId) throw new Error("GOOGLE_CLOUD_PROJECT is required for water-cannon alerts");

  const accessToken = await workloadIdentityAccessToken();
  const severity = alert.aqi >= 401 ? "Severe" : "Very Poor";
  const endpoint = `https://monitoring.googleapis.com/v3/projects/${encodeURIComponent(projectId)}/timeSeries`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      timeSeries: [{
        metric: {
          type: METRIC_TYPE,
          labels: {
            aqi: String(alert.aqi),
            severity,
            state: metricLabel(alert.target.state),
            district: metricLabel(alert.target.district),
            constituency_id: metricLabel(alert.target.constituencyId),
            constituency_name: metricLabel(alert.target.constituencyName),
            ward: metricLabel(alert.target.ward),
            deployment_site: metricLabel(alert.target.deploymentSite),
            latitude: String(alert.target.latitude),
            longitude: String(alert.target.longitude),
            response_window: metricLabel(alert.target.responseWindow),
            actor: metricLabel(alert.actor)
          }
        },
        resource: {
          type: "global",
          labels: { project_id: projectId }
        },
        points: [{
          interval: { endTime: recordedAt },
          value: { int64Value: "1" }
        }]
      }]
    }),
    signal: AbortSignal.timeout(8_000)
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`Cloud Monitoring metric write failed (${response.status}): ${detail}`);
  }
  return { delivery: "gcp_monitoring", metricType: METRIC_TYPE, recordedAt };
}

async function workloadIdentityAccessToken(): Promise<string> {
  const metadataUrl = process.env.GCE_METADATA_TOKEN_URL ??
    "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token";
  const response = await fetch(metadataUrl, {
    headers: { "Metadata-Flavor": "Google" },
    signal: AbortSignal.timeout(5_000)
  });
  if (!response.ok) throw new Error(`GCP workload identity token request failed (${response.status})`);
  const payload = await response.json() as { access_token?: string };
  if (!payload.access_token) throw new Error("GCP workload identity returned no access token");
  return payload.access_token;
}

function metricLabel(value: string): string {
  return value.trim().replace(/[\r\n\t]+/g, " ").slice(0, 100) || "unknown";
}

function configuredCoordinate(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}
