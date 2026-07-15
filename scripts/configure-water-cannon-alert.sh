#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
ALERT_EMAIL="${WATER_CANNON_ALERT_EMAIL:-${1:-shivam.sk2003@gmail.com}}"
SEND_TEST="${2:-}"
METRIC_TYPE="custom.googleapis.com/loksetu/water_cannon_deployment"
DISPLAY_NAME="LokSetu water cannon deployment email"

if [[ -z "${PROJECT_ID}" || "${PROJECT_ID}" == "(unset)" ]]; then
  echo "Set GCP_PROJECT_ID or configure a gcloud project first." >&2
  exit 1
fi
command -v gcloud >/dev/null
command -v curl >/dev/null
command -v jq >/dev/null

gcloud services enable monitoring.googleapis.com --project "${PROJECT_ID}" --quiet
ACCESS_TOKEN="$(gcloud auth print-access-token)"
AUTH_HEADER="Authorization: Bearer ${ACCESS_TOKEN}"
API="https://monitoring.googleapis.com/v3/projects/${PROJECT_ID}"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TMP_DIR}"' EXIT

descriptor_code="$(curl -sS -o "${TMP_DIR}/descriptor.json" -w '%{http_code}' \
  -H "${AUTH_HEADER}" \
  "${API}/metricDescriptors/${METRIC_TYPE}")"
if [[ "${descriptor_code}" == "404" ]]; then
  jq -n --arg type "${METRIC_TYPE}" '{
    type: $type,
    displayName: "LokSetu water cannon deployments",
    description: "High-pollution water-cannon deployment requests that require email notification.",
    metricKind: "GAUGE",
    valueType: "INT64",
    unit: "1",
    labels: [
      {key:"aqi", valueType:"STRING", description:"AQI at deployment time"},
      {key:"area", valueType:"STRING", description:"Deployment area"},
      {key:"state", valueType:"STRING", description:"State"},
      {key:"district", valueType:"STRING", description:"District"},
      {key:"constituency_id", valueType:"STRING", description:"Configured constituency"},
      {key:"actor", valueType:"STRING", description:"Dashboard user requesting deployment"}
    ]
  }' > "${TMP_DIR}/descriptor-create.json"
  curl -fsS -X POST -H "${AUTH_HEADER}" -H 'Content-Type: application/json' \
    "${API}/metricDescriptors" \
    --data-binary "@${TMP_DIR}/descriptor-create.json" > "${TMP_DIR}/descriptor.json"
elif [[ "${descriptor_code}" != "200" ]]; then
  cat "${TMP_DIR}/descriptor.json" >&2
  exit 1
fi

curl -fsS -H "${AUTH_HEADER}" "${API}/notificationChannels" > "${TMP_DIR}/channels.json"
CHANNEL_NAME="$(jq -r --arg email "${ALERT_EMAIL}" '.notificationChannels[]? | select(.type=="email" and .labels.email_address==$email) | .name' "${TMP_DIR}/channels.json" | head -1)"
if [[ -z "${CHANNEL_NAME}" ]]; then
  jq -n --arg email "${ALERT_EMAIL}" --arg display "${DISPLAY_NAME}" '{
    type:"email",
    displayName:$display,
    labels:{email_address:$email},
    enabled:true
  }' > "${TMP_DIR}/channel-create.json"
  curl -fsS -X POST -H "${AUTH_HEADER}" -H 'Content-Type: application/json' \
    "${API}/notificationChannels" \
    --data-binary "@${TMP_DIR}/channel-create.json" > "${TMP_DIR}/channel.json"
  CHANNEL_NAME="$(jq -r '.name' "${TMP_DIR}/channel.json")"
fi

curl -fsS -H "${AUTH_HEADER}" "${API}/alertPolicies" > "${TMP_DIR}/policies.json"
POLICY_NAME="$(jq -r --arg display "${DISPLAY_NAME}" '.alertPolicies[]? | select(.displayName==$display) | .name' "${TMP_DIR}/policies.json" | head -1)"
if [[ -z "${POLICY_NAME}" ]]; then
  jq -n --arg display "${DISPLAY_NAME}" --arg channel "${CHANNEL_NAME}" --arg metric "${METRIC_TYPE}" '{
    displayName:$display,
    documentation:{
      content:"LokSetu recorded a water-cannon deployment request because AQI crossed the severe-pollution threshold. Review the incident metric labels for AQI, area, district, constituency, and requesting user.",
      mimeType:"text/markdown"
    },
    combiner:"OR",
    enabled:true,
    notificationChannels:[$channel],
    alertStrategy:{notificationPrompts:["OPENED"], autoClose:"1800s"},
    conditions:[{
      displayName:"Water cannon deployment recorded",
      conditionThreshold:{
        filter:("metric.type=\""+$metric+"\" AND resource.type=\"global\""),
        comparison:"COMPARISON_GT",
        thresholdValue:0,
        duration:"0s",
        trigger:{count:1},
        aggregations:[{alignmentPeriod:"60s", perSeriesAligner:"ALIGN_MAX"}]
      }
    }]
  }' > "${TMP_DIR}/policy-create.json"
  curl -fsS -X POST -H "${AUTH_HEADER}" -H 'Content-Type: application/json' \
    "${API}/alertPolicies" \
    --data-binary "@${TMP_DIR}/policy-create.json" > "${TMP_DIR}/policy.json"
  POLICY_NAME="$(jq -r '.name' "${TMP_DIR}/policy.json")"
fi

echo "Project: ${PROJECT_ID}"
echo "Email channel: ${CHANNEL_NAME} (${ALERT_EMAIL})"
echo "Alert policy: ${POLICY_NAME}"
echo "Metric: ${METRIC_TYPE}"

if [[ "${SEND_TEST}" == "--test" ]]; then
  NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  jq -n --arg project "${PROJECT_ID}" --arg metric "${METRIC_TYPE}" --arg now "${NOW}" '{
    timeSeries:[{
      metric:{type:$metric, labels:{aqi:"318", area:"Delhi pilot", state:"Delhi", district:"Central Delhi", constituency_id:"mp-delhi-central", actor:"gcloud-configurator"}},
      resource:{type:"global", labels:{project_id:$project}},
      points:[{interval:{endTime:$now}, value:{int64Value:"1"}}]
    }]
  }' > "${TMP_DIR}/test-metric.json"
  curl -fsS -X POST -H "${AUTH_HEADER}" -H 'Content-Type: application/json' \
    "${API}/timeSeries" \
    --data-binary "@${TMP_DIR}/test-metric.json" >/dev/null
  echo "Test deployment metric sent at ${NOW}; Cloud Monitoring will open an incident and email ${ALERT_EMAIL}."
fi
