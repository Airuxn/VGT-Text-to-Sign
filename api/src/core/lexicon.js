import fs from 'node:fs';
import path from 'node:path';

const DATASET_VERSION = 'vgt-hybrid-v1';

function readEntries(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function toIndex(entries) {
  const tokenMap = new Map();
  const synonymMap = new Map();
  for (const entry of entries) {
    if (!entry?.token) continue;
    tokenMap.set(String(entry.token).toLowerCase(), entry);
    for (const syn of entry.synonyms || []) synonymMap.set(String(syn).toLowerCase(), entry);
  }
  return { tokenMap, synonymMap };
}

export function createLexiconIndex() {
  const approvedPath = path.resolve(process.cwd(), '../data/lexicon/vgt-approved.json');
  const canonicalPath = path.resolve(process.cwd(), '../data/lexicon/vgt-canonical.json');
  const fallbackPath = path.resolve(process.cwd(), '../data/lexicon/v2.json');

  const approved = toIndex(readEntries(approvedPath));
  const canonical = toIndex(readEntries(canonicalPath));
  const fallback = toIndex(readEntries(fallbackPath));

  return {
    datasetVersion: DATASET_VERSION,
    sourcePath: `${approvedPath};${canonicalPath};${fallbackPath}`,
    find(token) {
      const key = String(token || '').toLowerCase();
      return (
        approved.tokenMap.get(key) || approved.synonymMap.get(key) ||
        canonical.tokenMap.get(key) || canonical.synonymMap.get(key) ||
        fallback.tokenMap.get(key) || fallback.synonymMap.get(key) ||
        null
      );
    }
  };
}
