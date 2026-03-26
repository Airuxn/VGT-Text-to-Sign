import fs from 'node:fs';
import path from 'node:path';

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function createVideoIndex() {
  const preferred = path.resolve(process.cwd(), '../data/video-index/vgt-index.json');
  const fallback = path.resolve(process.cwd(), '../data/video-index/v1.json');
  const file = fs.existsSync(preferred) ? preferred : fallback;

  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const bySign = new Map(raw.map((entry) => [entry.signId, entry]));

  const aliasDir = path.dirname(file);
  const aliasFile = path.join(aliasDir, 'sign-video-alias.json');
  const aliases = readJson(aliasFile);

  return {
    sourcePath: file,
    all() { return raw; },
    get(signId) {
      if (!signId) return null;
      const direct = bySign.get(signId);
      if (direct) return direct;
      const mapped = aliases[signId];
      if (mapped) return bySign.get(mapped) || null;
      return null;
    }
  };
}
