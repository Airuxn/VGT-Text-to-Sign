# Ingestion Query Expansion Strategy

## Modes
- `letters`: A-Z single-letter prefixes.
- `expanded` (default): letters + Dutch/VGT digraphs + high-frequency seed terms.

## Environment Controls
- `INGEST_QUERY="*"` enables query-set mode.
- `INGEST_QUERY_MODE=expanded|letters`
- `INGEST_MAX_QUERIES=<n>` caps total query count.
- `INGEST_QUERY_SET=comma,separated,overrides` uses explicit query list.

## Why this strategy
Single-prefix scraping under-covers lexical inventory. Expanded query sets increase recall and improve canonical/video coverage while still bounded for CI cost.


## Media Hygiene
- Ingestion now runs automatic media validation + pruning.
- Dead links are removed from `data/video-index/vgt-index.json` and appended to `data/video-index/vgt-quarantine.json` for reviewer follow-up.
- Validation report is written to `data/video-index/vgt-validation-report.json`.
