import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd(), '..');
const runFile = path.join(root, 'data/raw/vgt-dictionary/latest-run.json');
const canonicalFile = path.join(root, 'data/lexicon/vgt-canonical.json');

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const run = readJson(runFile, { stats: { canonicalCount: 0 } });
const canonical = readJson(canonicalFile, []);

const report = {
  generatedAt: new Date().toISOString(),
  latestRunCanonicalCount: run.stats?.canonicalCount || 0,
  canonicalFileCount: canonical.length,
  delta: canonical.length - (run.stats?.canonicalCount || 0)
};

console.log(JSON.stringify(report, null, 2));
