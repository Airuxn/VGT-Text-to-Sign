import fs from 'node:fs';

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

async function checkUrl(url) {
  if (!url) return { ok: false, status: 'missing' };
  try {
    const res = await fetch(url, { method: 'HEAD' });
    const acceptable = [200, 301, 302, 303, 307, 308, 401, 403];
    if (acceptable.includes(res.status)) return { ok: true, status: res.status };
    return { ok: false, status: res.status };
  } catch {
    return { ok: false, status: 'error' };
  }
}

export async function validateAndPruneIndex({
  videoIndexFile,
  reportFile,
  quarantineFile,
  limit = 60,
  prune = false
}) {
  const items = readJson(videoIndexFile, []);
  let checked = 0;
  let valid = 0;

  const entries = [];
  const dead = [];
  const keepByClipId = new Set();

  const slice = items.slice(0, Math.max(0, limit));
  for (const item of slice) {
    const result = await checkUrl(item.url);
    checked += 1;
    if (result.ok) {
      valid += 1;
      keepByClipId.add(item.clipId);
    } else {
      dead.push({ ...item, status: result.status, checkedAt: new Date().toISOString() });
    }
    entries.push({ signId: item.signId, clipId: item.clipId, url: item.url, ...result });
  }

  // If pruning, keep all un-checked records plus valid checked records.
  let prunedCount = 0;
  if (prune) {
    const checkedClipIds = new Set(slice.map((x) => x.clipId));
    const next = items.filter((item) => {
      if (!checkedClipIds.has(item.clipId)) return true;
      return keepByClipId.has(item.clipId);
    });
    prunedCount = items.length - next.length;
    writeJson(videoIndexFile, next);

    const existingQuarantine = readJson(quarantineFile, []);
    writeJson(quarantineFile, [...existingQuarantine, ...dead]);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    checked,
    valid,
    validRate: checked ? valid / checked : 0,
    pruned: prune,
    prunedCount,
    entries
  };

  writeJson(reportFile, report);
  return report;
}
