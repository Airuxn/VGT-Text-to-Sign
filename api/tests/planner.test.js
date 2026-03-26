import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGesturePlan } from '../src/core/planner.js';

const lexicon = {
  datasetVersion: 'v2',
  find(token) {
    if (token === 'ik') {
      return {
        signId: 'SELF',
        durationMs: 600,
        confidence: 0.99,
        manual: { left: { pose: 'rest', handshape: 'B' }, right: { pose: 'self_point', handshape: '1' } },
        nonManual: { mouth: 'neutral', brows: 'neutral', head: 'neutral' }
      };
    }
    return null;
  }
};

const videoIndex = {
  get(signId) {
    if (signId === 'FINGERSPELL') return { clipId: 'clip_fs', url: '/assets/videos/fingerspell.mp4' };
    return null;
  }
};

test('buildGesturePlan maps known token with avatar mode', () => {
  const res = buildGesturePlan('ik', lexicon, videoIndex);
  assert.equal(res.segments.length, 1);
  assert.equal(res.segments[0].signId, 'SELF');
  assert.equal(res.segments[0].renderMode, 'avatar3d');
  assert.equal(res.segments[0].fallback, null);
});

test('buildGesturePlan falls back unknown token to human video mode', () => {
  const res = buildGesturePlan('onbekend', lexicon, videoIndex);
  assert.equal(res.segments[0].signId, 'FINGERSPELL');
  assert.equal(res.segments[0].renderMode, 'human_video');
  assert.equal(res.segments[0].fallback.clipId, 'clip_fs');
  assert.equal(res.warnings.length >= 1, true);
});
