# API Contract (Production Hybrid)

## POST /api/convert
Request:
```json
{ "text": "ik help jou morgen" }
```

Response:
```json
{
  "input": "ik help jou morgen",
  "segments": [
    {
      "token": "help",
      "signId": "HELP",
      "startMs": 600,
      "durationMs": 700,
      "confidence": 0.94,
      "renderMode": "avatar3d",
      "manual": {
        "left": { "pose": "support_hand", "handshape": "B" },
        "right": { "pose": "thumb_up_move", "handshape": "A" }
      },
      "nonManual": { "mouth": "open", "brows": "raised", "head": "forward" },
      "fallback": null
    }
  ],
  "warnings": [],
  "meta": { "datasetVersion": "v2", "generatedAt": "ISO-8601" }
}
```

## GET /api/video-clips
Returns available human video clips and metadata.
