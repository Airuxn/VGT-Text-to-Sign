import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGesturePlan } from '../src/core/planner.js';

const lexicon = { datasetVersion: 'v2', find: () => null };
const videoIndex = { get: () => ({ clipId: 'clip_fs', url: '/assets/videos/fingerspell.mp4' }) };

test('response contract has required production keys', () => {
  const res = buildGesturePlan('test', lexicon, videoIndex);
  for (const key of ['input', 'normalized', 'segments', 'warnings', 'meta']) {
    assert.ok(Object.hasOwn(res, key));
  }
  assert.equal(Object.hasOwn(res.segments[0], 'manual'), true);
  assert.equal(Object.hasOwn(res.segments[0], 'nonManual'), true);
  assert.equal(Object.hasOwn(res.segments[0], 'renderMode'), true);
  assert.equal(Object.hasOwn(res.segments[0], 'videoUrl'), true);
});
