import path from 'node:path';
import fs from 'node:fs';
import { readJson, writeJson, sha1 } from './utils.js';

function toCanonicalEntry(raw, snapshotFile) {
  const mediaUrls = (raw.media || []).map((m) => m.url).filter(Boolean);
  const token = String(raw.token || '').toLowerCase();

  return {
    token,
    signId: raw.signRef || `VGT_${sha1(token).slice(0, 8).toUpperCase()}`,
    durationMs: 800,
    confidence: mediaUrls.length > 0 ? 0.8 : 0.65,
    manual: {
      left: { pose: 'rest', handshape: 'B' },
      right: { pose: 'fingerspell', handshape: 'FS' }
    },
    nonManual: { mouth: 'neutral', brows: 'neutral', head: 'neutral' },
    synonyms: (raw.translations || []).filter((x) => String(x).toLowerCase() !== token),
    source: {
      url: raw.sourceUrl,
      extractedAt: new Date().toISOString(),
      snapshotFile,
      recordHash: raw.sourceId,
      signNumericId: raw.signNumericId || null,
      regions: raw.regions || [],
      labels: raw.labels || [],
      hasEtymology: Boolean(raw.hasEtymology)
    },
    media: {
      urls: mediaUrls,
      primaryUrl: mediaUrls[0] || null
    },
    review: {
      status: 'candidate',
      reviewer: null,
      reviewedAt: null,
      notes: null
    }
  };
}

function bootstrapFromFallbackLexicon() {
  const v2Path = path.resolve(process.cwd(), '../data/lexicon/v2.json');
  if (!fs.existsSync(v2Path)) return [];
  const v2 = JSON.parse(fs.readFileSync(v2Path, 'utf8'));
  return v2.map((entry) => ({
    ...entry,
    source: {
      url: 'https://woordenboek.vlaamsegebarentaal.be/search',
      extractedAt: new Date().toISOString(),
      snapshotFile: 'bootstrap_v2',
      recordHash: sha1(`${entry.token}|bootstrap_v2`)
    },
    media: { urls: [], primaryUrl: null },
    review: {
      status: 'candidate',
      reviewer: null,
      reviewedAt: null,
      notes: 'bootstrap due to empty snapshot extraction'
    }
  }));
}

export function buildCanonicalFromSnapshots(snapshotFiles, outCanonicalFile, outVideoIndexFile) {
  const byToken = new Map();
  const videoByClip = new Map();

  for (const snapshotFile of snapshotFiles) {
    const snap = readJson(snapshotFile, { entries: [] });
    for (const raw of snap.entries || []) {
      const canonical = toCanonicalEntry(raw, path.basename(snapshotFile));
      if (!canonical.token) continue;
      if (!byToken.has(canonical.token)) byToken.set(canonical.token, canonical);

      const clipId = `candidate_${String(canonical.signId).toLowerCase().replace(/[^a-z0-9_\-]/g, '_')}`;
      if (!videoByClip.has(clipId)) {
        videoByClip.set(clipId, {
          signId: canonical.signId,
          clipId,
          url: canonical.media.primaryUrl,
          variant: 'candidate',
          sourceUrl: raw.sourceUrl,
          reviewStatus: 'candidate'
        });
      }
    }
  }

  if (byToken.size === 0) {
    for (const entry of bootstrapFromFallbackLexicon()) {
      byToken.set(entry.token, entry);
      const clipId = `candidate_${String(entry.signId).toLowerCase()}`;
      if (!videoByClip.has(clipId)) {
        videoByClip.set(clipId, {
          signId: entry.signId,
          clipId,
          url: null,
          variant: 'candidate',
          sourceUrl: entry.source.url,
          reviewStatus: 'candidate'
        });
      }
    }
  }

  const canonicalList = [...byToken.values()];
  const videoIndex = [...videoByClip.values()];
  writeJson(outCanonicalFile, canonicalList);
  writeJson(outVideoIndexFile, videoIndex);

  return {
    canonicalCount: canonicalList.length,
    videoCount: videoIndex.length,
    withMedia: canonicalList.filter((e) => e.media?.primaryUrl).length
  };
}
