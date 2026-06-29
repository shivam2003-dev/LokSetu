# Maps, Boundaries, and Hotspot Clustering

LokSetu separates map rendering from geospatial intelligence so the platform can keep working when a browser map key is missing, quota-limited, or waiting for a production Map ID.

## Runtime Behavior

- `/api/client-config` exposes the browser Google Maps key and optional `GOOGLE_MAPS_MAP_ID`.
- The web app loads Google Maps only when a key exists.
- Advanced markers are used only when a production Map ID is configured and the marker library is available.
- If Maps fails, quota is exhausted, or no key exists, the Explorer falls back to the local signal map using the same backend coordinates and selected-project interactions.

Configure a production Map ID through Helm without committing the value:

```yaml
api:
  googleMaps:
    existingSecret: people-priority-google-maps
    secretKey: api-key
    mapIdExistingSecret: people-priority-google-maps-map-id
    mapIdSecretKey: map-id
```

## Boundary API

`GET /api/maps/boundaries` returns state, district, constituency, and ward features with:

- `source` and `sourceUrl`
- `version`
- `freshness`
- simplification metadata
- bounding box and centroid
- linked ranked project IDs

Current local boundaries are bbox-derived fixtures generated from ranked project coordinates. They are marked `official_boundary_procurement_required` and `freshness=procurement_required`.

## Official GeoJSON Ingestion

The API will load official boundaries from `BOUNDARY_GEOJSON_DIR` when the directory is mounted. Files may be `.geojson` or `.json` and must contain GeoJSON `Feature` or `FeatureCollection` documents.

Each feature should include these properties:

```json
{
  "level": "ward",
  "name": "Kalindi Nagar",
  "source": "Approved State GIS Portal",
  "sourceUrl": "https://example.gov.in/gis",
  "version": "2026-06",
  "freshness": "fresh",
  "toleranceMeters": 25,
  "simplificationMethod": "official vector tile simplification"
}
```

Enable the mount through Helm:

```yaml
api:
  boundaries:
    configMapName: loksetu-boundaries-delhi
    mountPath: /app/services/api/boundaries
```

Create the ConfigMap from approved files:

```bash
kubectl create configmap loksetu-boundaries-delhi \
  --from-file=delhi-wards.geojson \
  -n people-priority
```

## Production Boundary Sources

Production rollout must replace local fixtures with approved GeoJSON/vector-tile layers from official or state-authorized sources, such as:

- Survey of India / OMP for administrative layers
- ISRO Bhuvan or approved state GIS portals for ward/block layers
- Election Commission of India for constituency references

Do not commit raw licensed boundary datasets unless their license permits redistribution. Prefer a private object bucket or tile service and expose only source/version metadata in Git.

## Hotspot Clustering

`GET /api/maps/clusters?zoom=5` returns grid-clustered ranked projects with centroid, count, score, categories, and linked project IDs. The Explorer uses those clusters to drive right-side drilldowns and selected issue context.

## Test Checklist

- `npm run test:functional -- --project=api` validates boundary and cluster contracts.
- `npm run test:functional -- --project=web` validates Explorer layer tabs, cluster selection, fallback maps, and boundary provenance.
- `helm lint charts/people-priority -f charts/people-priority/values-local.yaml` validates local GitOps packaging.
