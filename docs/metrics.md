# KPI and Acceptance Metrics (Production)

## User Comprehension
- Sentence-level comprehension >= 85% across benchmark set.
- Critical misunderstanding rate <= 5%.

## Rendering Quality
- Non-manual marker coverage >= 90% for signs requiring face cues.
- Human reviewer score >= 4.2/5.

## Reliability and Performance
- API p95 <= 2500ms for <= 12-token input.
- Availability >= 99.9%.
- Fallback decision logged for 100% of segments.
