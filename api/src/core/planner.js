import { normalizeText, tokenize } from './normalize.js';
import { chooseRenderMode } from './renderPolicy.js';

const PHRASE_MAP = new Map([
  ['dank je wel', 'dankjewel']
]);

function applyPhraseRules(text) {
  let out = text;
  for (const [phrase, token] of PHRASE_MAP.entries()) out = out.replaceAll(phrase, token);
  return out;
}

function makeFallback(token) {
  return {
    token,
    signId: 'FINGERSPELL',
    durationMs: Math.max(800, token.length * 150),
    confidence: 0.25,
    manual: {
      left: { pose: 'rest', handshape: 'B' },
      right: { pose: 'fingerspell', handshape: 'FS' }
    },
    nonManual: { mouth: 'spell', brows: 'neutral', head: 'neutral' },
    source: null,
    media: null
  };
}

function resolveVideoUrl(base, videoIndex, fallbackClip) {
  const fromLexicon = base.media?.primaryUrl || base.media?.urls?.[0];
  if (fromLexicon) return fromLexicon;
  const fromIndex = videoIndex.get(base.signId)?.url;
  if (fromIndex) return fromIndex;
  if (fallbackClip?.url) return fallbackClip.url;
  return null;
}

export function buildGesturePlan(input, lexicon, videoIndex) {
  const normalizedText = applyPhraseRules(normalizeText(input));
  const normalized = tokenize(normalizedText);

  let cursor = 0;
  const warnings = [];

  const segments = normalized.map((token) => {
    const found = lexicon.find(token);
    const base = found
      ? {
          token,
          signId: found.signId,
          durationMs: found.durationMs,
          confidence: found.confidence,
          manual: found.manual,
          nonManual: found.nonManual,
          source: found.source || null
        }
      : makeFallback(token);

    const renderMode = chooseRenderMode(base);
    const fallbackClip = renderMode === 'human_video'
      ? videoIndex.get(base.signId) || videoIndex.get('FINGERSPELL') || null
      : null;

    const videoUrl = resolveVideoUrl(base, videoIndex, fallbackClip);

    if (!found) warnings.push(`Unknown token: ${token}`);
    if (renderMode === 'human_video') warnings.push(`Video fallback for token: ${token}`);

    const segment = {
      token: base.token,
      signId: base.signId,
      startMs: cursor,
      durationMs: base.durationMs,
      confidence: base.confidence,
      renderMode,
      manual: base.manual,
      nonManual: base.nonManual,
      source: base.source,
      videoUrl,
      fallback: fallbackClip
        ? { clipId: fallbackClip.clipId, url: fallbackClip.url, reason: 'low_confidence_or_capability' }
        : null
    };

    cursor += base.durationMs;
    return segment;
  });

  return {
    input,
    normalized,
    segments,
    warnings,
    meta: {
      datasetVersion: lexicon.datasetVersion,
      datasetSource: lexicon.sourcePath,
      videoIndexSource: videoIndex.sourcePath,
      generatedAt: new Date().toISOString()
    }
  };
}
