{{- define "people-priority.name" -}}
people-priority
{{- end -}}

{{- define "people-priority.labels" -}}
app.kubernetes.io/name: {{ include "people-priority.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version | replace "+" "_" }}
{{- end -}}
