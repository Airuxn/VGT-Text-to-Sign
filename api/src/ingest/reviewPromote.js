import { readJson, writeJson } from './utils.js';

export function applyReviewDecisions({ canonicalFile, decisionsFile, outApprovedFile }) {
  const canonical = readJson(canonicalFile, []);
  const decisions = readJson(decisionsFile, []);
  const byToken = new Map(decisions.map((d) => [String(d.token || '').toLowerCase(), d]));

  const approved = [];
  const updated = canonical.map((entry) => {
    const token = String(entry.token || '').toLowerCase();
    const decision = byToken.get(token);
    if (!decision) return entry;

    const review = {
      status: decision.status,
      reviewer: decision.reviewer || 'unknown',
      reviewedAt: decision.reviewedAt || new Date().toISOString(),
      notes: decision.notes || null
    };

    const next = { ...entry, review };
    if (decision.status === 'production') approved.push(next);
    return next;
  });

  writeJson(canonicalFile, updated);
  writeJson(outApprovedFile, approved);
  return { updated: updated.length, approved: approved.length };
}
