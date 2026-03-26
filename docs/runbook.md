# Runbook (Production Hybrid)

## Services
- `api`: linguistic planning and render policy decisions.
- `web`: unified playback surface for avatar and fallback video.

## Startup
- `docker compose up --build`
- API health: `GET /health`
- Video index: `GET /api/video-clips`

## Key Monitoring
- `planner_latency_p95_ms`
- `fallback_segment_ratio`
- `unknown_token_ratio`
- `feedback_events_count`

## Incident Handling
1. Validate API health and conversion endpoint.
2. Check fallback ratio spikes and recent lexicon changes.
3. Roll back last deploy if comprehension-impacting regression confirmed.
