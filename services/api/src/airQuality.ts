import type { WaterCannonTarget } from "./waterCannonAlerts.js";

const DEFAULT_API_URL = "https://air-quality-api.open-meteo.com/v1/air-quality";
const FORECAST_HOURS = 12;
const CACHE_MS = 10 * 60_000;

type OpenMeteoAirQuality = {
  latitude: number;
  longitude: number;
  timezone: string;
  current: { time: string; us_aqi: number; pm2_5: number; pm10: number };
  hourly: { time: string[]; us_aqi: Array<number | null>; pm2_5: Array<number | null>; pm10: Array<number | null> };
};

export type AirQualitySummary = ReturnType<typeof summarizeAirQuality>;

let cached: { key: string; expiresAt: number; value: AirQualitySummary } | null = null;

export async function fetchAirQualityForecast(target: WaterCannonTarget, threshold: number): Promise<AirQualitySummary> {
  const key = `${target.latitude},${target.longitude},${threshold}`;
  if (cached?.key === key && cached.expiresAt > Date.now()) return cached.value;

  const url = new URL(process.env.AIR_QUALITY_API_URL ?? DEFAULT_API_URL);
  url.searchParams.set("latitude", String(target.latitude));
  url.searchParams.set("longitude", String(target.longitude));
  url.searchParams.set("current", "us_aqi,pm2_5,pm10");
  url.searchParams.set("hourly", "us_aqi,pm2_5,pm10");
  url.searchParams.set("forecast_hours", String(FORECAST_HOURS));
  url.searchParams.set("timezone", "Asia/Kolkata");

  const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error(`Open-Meteo air-quality request failed (${response.status})`);
  const payload = await response.json() as OpenMeteoAirQuality;
  const value = summarizeAirQuality(payload, target, threshold);
  cached = { key, value, expiresAt: Date.now() + CACHE_MS };
  return value;
}

export function summarizeAirQuality(payload: OpenMeteoAirQuality, target: WaterCannonTarget, threshold: number) {
  if (
    !payload.current
    || !Number.isFinite(payload.current.us_aqi)
    || !Number.isFinite(payload.current.pm2_5)
    || !Number.isFinite(payload.current.pm10)
    || !payload.hourly?.time?.length
  ) {
    throw new Error("Open-Meteo returned incomplete air-quality data");
  }

  const points = payload.hourly.time.flatMap((time, index) => {
    const aqi = payload.hourly.us_aqi[index];
    const pm25 = payload.hourly.pm2_5[index];
    const pm10 = payload.hourly.pm10[index];
    if (aqi === null || !Number.isFinite(aqi)) return [];
    return [{
      time,
      aqi: Math.round(aqi),
      pm25: pm25 === null || !Number.isFinite(pm25) ? null : Number(pm25.toFixed(1)),
      pm10: pm10 === null || !Number.isFinite(pm10) ? null : Number(pm10.toFixed(1))
    }];
  });
  if (!points.length) throw new Error("Open-Meteo returned no forecast points");

  const peak = points.reduce((highest, point) => point.aqi > highest.aqi ? point : highest, points[0]);
  const currentAqi = Math.round(payload.current.us_aqi);
  const decisionAqi = Math.max(currentAqi, peak.aqi);
  const firstAqi = points[0].aqi;
  const lastAqi = points.at(-1)?.aqi ?? firstAqi;
  const trend = lastAqi >= firstAqi + 10 ? "rising" : lastAqi <= firstAqi - 10 ? "falling" : "steady";

  return {
    source: {
      name: "Open-Meteo Air Quality API",
      model: "CAMS global atmospheric composition forecast",
      url: "https://open-meteo.com/en/docs/air-quality-api",
      attribution: "Open-Meteo and Copernicus Atmosphere Monitoring Service (CAMS)"
    },
    location: {
      state: target.state,
      district: target.district,
      constituencyName: target.constituencyName,
      ward: target.ward,
      deploymentSite: target.deploymentSite,
      latitude: target.latitude,
      longitude: target.longitude,
      providerGridLatitude: payload.latitude,
      providerGridLongitude: payload.longitude
    },
    current: {
      observedAt: payload.current.time,
      aqi: currentAqi,
      category: aqiCategory(currentAqi),
      pm25: Number(payload.current.pm2_5.toFixed(1)),
      pm10: Number(payload.current.pm10.toFixed(1)),
      unit: "µg/m³"
    },
    forecast: {
      hours: FORECAST_HOURS,
      peakAqi: peak.aqi,
      peakCategory: aqiCategory(peak.aqi),
      peakAt: peak.time,
      trend,
      points
    },
    decision: {
      threshold,
      decisionAqi,
      recommended: decisionAqi >= threshold,
      reason: decisionAqi >= threshold
        ? `Current or predicted AQI reaches ${decisionAqi}, above the deployment threshold of ${threshold}.`
        : `Current and predicted AQI remain below the deployment threshold of ${threshold}.`
    },
    generatedAt: new Date().toISOString(),
    disclaimer: "Forecast-model estimate at the provider grid, not an official CPCB monitoring-station observation. Confirm with the local control room before dispatch."
  };
}

export function aqiCategory(aqi: number): "Good" | "Moderate" | "Unhealthy for sensitive groups" | "Unhealthy" | "Very Unhealthy" | "Hazardous" {
  if (aqi <= 50) return "Good";
  if (aqi <= 100) return "Moderate";
  if (aqi <= 150) return "Unhealthy for sensitive groups";
  if (aqi <= 200) return "Unhealthy";
  if (aqi <= 300) return "Very Unhealthy";
  return "Hazardous";
}
