import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('index contains controls and video player', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(html.includes('id="convert"'));
  assert.ok(html.includes('id="play"'));
  assert.ok(html.includes('id="signVideoA"'));
  assert.ok(html.includes('id="signVideoB"'));
  assert.ok(html.includes('id="videoFallback"'));
});
