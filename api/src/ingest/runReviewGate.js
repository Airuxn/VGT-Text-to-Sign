import path from 'node:path';
import { applyReviewDecisions } from './reviewPromote.js';

const root = path.resolve(process.cwd(), '..');

const result = applyReviewDecisions({
  canonicalFile: path.join(root, 'data/lexicon/vgt-canonical.json'),
  decisionsFile: path.join(root, 'data/review/decisions.json'),
  outApprovedFile: path.join(root, 'data/lexicon/vgt-approved.json')
});

console.log(JSON.stringify({ ok: true, ...result }, null, 2));
