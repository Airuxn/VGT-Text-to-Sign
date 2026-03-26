# Product Requirements (v1)

## Problem
Users need a fast way to transform VGT-oriented text into understandable signed gesture playback.

## Users
- Learners
- Accessibility teams
- Internal demo stakeholders

## In Scope
- Text input -> timed gesture plan -> avatar playback
- Unknown token fallback visibility
- Basic feedback capture for misunderstood signs

## Out of Scope
- Full automatic linguistic translation
- 3D body realism and facial rigging

## Functional Requirements
1. Input text accepted in UI.
2. API returns gesture plan with timings and confidence.
3. Player supports play/pause/replay/step/speed.
4. Unknown words are marked and fingerspelled.

## Non-functional Requirements
- <2s average planning latency for short phrases.
- Deterministic output for identical input + dataset version.
- Error responses include actionable details.
