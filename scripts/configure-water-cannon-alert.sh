#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
ALERT_EMAIL="${WATER_CANNON_ALERT_EMAIL:-${1:-shivam.sk2003@gmail.com}}"
SEND_TEST="${2:-}"
METRIC_TYPE="custom.googleapis.com/loksetu/water_cannon_deployment_action"
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
MONITORING_ROOT="https://monitoring.googleapis.com/v3"
API="${MONITORING_ROOT}/projects/${PROJECT_ID}"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TMP_DIR}"' EXIT

descriptor_code="$(curl -sS -o "${TMP_DIR}/descriptor.json" -w '%{http_code}' \
  -H "${AUTH_HEADER}" \
  "${API}/metricDescriptors/${METRIC_TYPE}")"
if [[ "${descriptor_code}" == "404" ]]; then
  jq -n --arg type "${METRIC_TYPE}" '{
    type: $type,
    displayName: "LokSetu actionable Delhi water cannon deployments",
    description: "Constituency and site-specific high-pollution water-cannon deployment requests.",
    metricKind: "GAUGE",
    valueType: "INT64",
    unit: "1",
    labels: [
      {key:"aqi", valueType:"STRING", description:"AQI at deployment time"},
      {key:"severity", valueType:"STRING", description:"Indian AQI severity band"},
      {key:"state", valueType:"STRING", description:"State"},
      {key:"district", valueType:"STRING", description:"District"},
      {key:"constituency_id", valueType:"STRING", description:"Configured constituency ID"},
      {key:"constituency_name", valueType:"STRING", description:"Configured constituency name"},
      {key:"ward", valueType:"STRING", description:"Ward requiring deployment"},
      {key:"deployment_site", valueType:"STRING", description:"Specific deployment site"},
      {key:"latitude", valueType:"STRING", description:"Deployment latitude"},
      {key:"longitude", valueType:"STRING", description:"Deployment longitude"},
      {key:"response_window", valueType:"STRING", description:"Required dispatch response window"},
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
jq -n --arg display "${DISPLAY_NAME}" --arg channel "${CHANNEL_NAME}" --arg metric "${METRIC_TYPE}" --arg policy "${POLICY_NAME}" '{
    displayName:$display,
    documentation:{
      content:"## Immediate action: deploy water cannon\n\nLokSetu detected high pollution requiring a Delhi response.\n\n- **AQI:** ${metric.label.aqi} (${metric.label.severity})\n- **Constituency:** ${metric.label.constituency_name} (${metric.label.constituency_id})\n- **Ward:** ${metric.label.ward}\n- **Deployment site:** ${metric.label.deployment_site}\n- **District / state:** ${metric.label.district}, ${metric.label.state}\n- **Response window:** ${metric.label.response_window}\n- **Requested by:** ${metric.label.actor}\n- **Map:** https://www.google.com/maps?q=${metric.label.latitude},${metric.label.longitude}\n\nDispatch the water cannon, confirm arrival within the response window, and record completion in LokSetu.",
      mimeType:"text/markdown"
    },
    combiner:"OR",
    enabled:true,
    notificationChannels:[$channel],
    alertStrategy:{notificationPrompts:["OPENED"], autoClose:"1800s"},
    conditions:[{
      displayName:"Delhi water cannon deployment required",
      conditionThreshold:{
        filter:("metric.type=\""+$metric+"\" AND resource.type=\"global\""),
        comparison:"COMPARISON_GT",
        thresholdValue:0,
        duration:"0s",
        trigger:{count:1},
        aggregations:[{alignmentPeriod:"60s", perSeriesAligner:"ALIGN_MAX"}]
      }
    }]
  } | if $policy != "" then .name=$policy else . end' > "${TMP_DIR}/policy-create.json"
if [[ -z "${POLICY_NAME}" ]]; then
  curl -fsS -X POST -H "${AUTH_HEADER}" -H 'Content-Type: application/json' \
    "${API}/alertPolicies" \
    --data-binary "@${TMP_DIR}/policy-create.json" > "${TMP_DIR}/policy.json"
  POLICY_NAME="$(jq -r '.name' "${TMP_DIR}/policy.json")"
else
  policy_code="$(curl -sS -o "${TMP_DIR}/policy.json" -w '%{http_code}' -X PATCH -H "${AUTH_HEADER}" -H 'Content-Type: application/json' \
    "${MONITORING_ROOT}/${POLICY_NAME}?updateMask=displayName,documentation,combiner,enabled,notificationChannels,alertStrategy,conditions" \
    --data-binary "@${TMP_DIR}/policy-create.json")"
  if [[ "${policy_code}" != "200" ]]; then
    cat "${TMP_DIR}/policy.json" >&2
    exit 1
  fi
fi

echo "Project: ${PROJECT_ID}"
echo "Email channel: ${CHANNEL_NAME} (${ALERT_EMAIL})"
echo "Alert policy: ${POLICY_NAME}"
echo "Metric: ${METRIC_TYPE}"

if [[ "${SEND_TEST}" == "--test" ]]; then
  NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  jq -n --arg project "${PROJECT_ID}" --arg metric "${METRIC_TYPE}" --arg now "${NOW}" '{
    timeSeries:[{
      metric:{type:$metric, labels:{
        aqi:"318",
        severity:"Very Poor",
        state:"Delhi",
        district:"Central Delhi",
        constituency_id:"mp-delhi-central",
        constituency_name:"Central Delhi",
        ward:"Kalindi Nagar",
        deployment_site:"Kalindi Nagar pollution hotspot",
        latitude:"28.618",
        longitude:"77.245",
        response_window:"30 minutes",
        actor:"gcloud-configurator"
      }},
      resource:{type:"global", labels:{project_id:$project}},
      points:[{interval:{endTime:$now}, value:{int64Value:"1"}}]
    }]
  }' > "${TMP_DIR}/test-metric.json"
  curl -fsS -X POST -H "${AUTH_HEADER}" -H 'Content-Type: application/json' \
    "${API}/timeSeries" \
    --data-binary "@${TMP_DIR}/test-metric.json" >/dev/null
  echo "Test deployment metric sent at ${NOW}; Cloud Monitoring will open an incident and email ${ALERT_EMAIL}."
fi
