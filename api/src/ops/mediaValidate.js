import path from 'node:path';
import { validateAndPruneIndex } from './mediaHealth.js';

const root = path.resolve(process.cwd(), '..');
const videoIndexFile = path.join(root, 'data/video-index/vgt-index.json');
const reportFile = path.join(root, 'data/video-index/vgt-validation-report.json');
const quarantineFile = path.join(root, 'data/video-index/vgt-quarantine.json');

async function run() {
  const limit = Number(process.env.MEDIA_VALIDATE_LIMIT || '60');
  const prune = process.env.MEDIA_PRUNE === '1';
  const report = await validateAndPruneIndex({
    videoIndexFile,
    reportFile,
    quarantineFile,
    limit,
    prune
  });
  console.log(JSON.stringify(report, null, 2));
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
