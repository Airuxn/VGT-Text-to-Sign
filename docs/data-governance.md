# Data Governance: VGT Dictionary Integration

## Source
Primary lexical source: https://woordenboek.vlaamsegebarentaal.be/search

## Permission and Usage
- Project owner confirms permission/license to use source data in this product pipeline.
- Imported records must preserve attribution and source provenance.
- Usage must respect source terms and rate-limit expectations.

## Allowed Fields
- gloss/token text
- variant labels (if available)
- media URL(s) and media metadata
- source page URL
- source identifier/hash
- extraction timestamp

## Forbidden/Restricted
- Do not fabricate source attribution.
- Do not promote unreviewed entries to production dataset.
- Do not overwrite raw snapshots in-place.

## Provenance Rules
Each canonical record must include:
- `source.url`
- `source.extractedAt`
- `source.snapshotFile`
- `source.recordHash`
- `review.status` (`candidate` or `production`)

## Promotion Policy
- New entries start as `candidate`.
- Promotion to `production` requires deaf-review approval.
- CI must fail if planner points to non-approved datasets.
