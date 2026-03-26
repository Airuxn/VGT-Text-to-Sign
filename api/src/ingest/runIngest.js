import path from 'node:path';
import { fetchDictionarySnapshots } from './fetchDictionary.js';
import { buildCanonicalFromSnapshots } from './buildCanonical.js';
import { ensureDir, writeJson } from './utils.js';
import { validateAndPruneIndex } from '../ops/mediaHealth.js';

const root = path.resolve(process.cwd(), '..');
const rawDir = path.join(root, 'data/raw/vgt-dictionary');
const lexiconDir = path.join(root, 'data/lexicon');
const videoDir = path.join(root, 'data/video-index');

async function run() {
  ensureDir(rawDir);
  ensureDir(lexiconDir);
  ensureDir(videoDir);

  const pages = Number(process.env.INGEST_PAGES || '1');
  const query = process.env.INGEST_QUERY || 'a';
  const queryMode = process.env.INGEST_QUERY_MODE || 'expanded';
  const maxQueries = Number(process.env.INGEST_MAX_QUERIES || String(pages));

  const snapshots = await fetchDictionarySnapshots({ pages, query, outDir: rawDir });
  const stats = buildCanonicalFromSnapshots(
    snapshots,
    path.join(lexiconDir, 'vgt-canonical.json'),
    path.join(videoDir, 'vgt-index.json')
  );

  const mediaReport = await validateAndPruneIndex({
    videoIndexFile: path.join(videoDir, 'vgt-index.json'),
    reportFile: path.join(videoDir, 'vgt-validation-report.json'),
    quarantineFile: path.join(videoDir, 'vgt-quarantine.json'),
    limit: Number(process.env.MEDIA_PRUNE_LIMIT || '120'),
    prune: true
  });

  writeJson(path.join(rawDir, 'latest-run.json'), {
    ranAt: new Date().toISOString(),
    pages,
    query,
    queryMode,
    maxQueries,
    snapshots: snapshots.map((s) => path.basename(s)),
    stats,
    media: {
      checked: mediaReport.checked,
      valid: mediaReport.valid,
      validRate: mediaReport.validRate,
      prunedCount: mediaReport.prunedCount
    }
  });

  console.log(JSON.stringify({ ok: true, queryMode, maxQueries, ...stats, media: mediaReport }, null, 2));
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
