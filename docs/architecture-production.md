# Production Architecture

## Hybrid Rendering
- Planner generates linguistic segments with manual and non-manual markers.
- Render policy selects `avatar3d` when confidence and capability are sufficient.
- Render policy selects `human_video` when confidence is low or sign capability is missing.

## Core Components
- `api`: linguistic planning, render policy, feedback ingestion.
- `web`: unified playback timeline that can show avatar or video fallback.
- `data`: versioned lexicon, video index, evaluation sets.

## Release Gates
- Comprehension and sign quality thresholds are release blockers.
- Fallback visibility is mandatory for user trust.
- All fallback decisions are auditable by segment.
