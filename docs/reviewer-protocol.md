# Deaf Reviewer Protocol

## Queue Workflow
1. Ingestion writes candidate records to `data/lexicon/vgt-canonical.json`.
2. Reviewer decisions are submitted to `data/review/decisions.json`.
3. Promotion script writes approved records to `data/lexicon/vgt-approved.json`.

## Required Fields in Decisions
- `token`
- `status` (`candidate` or `production`)
- `reviewer`
- `reviewedAt`
- `notes`

## Promotion Rules
- Only `production` entries are exported to approved dataset.
- Planner must prioritize `vgt-approved.json`.
- Candidate-only datasets are not release eligible.
