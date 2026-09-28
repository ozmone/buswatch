import test from 'node:test';
import assert from 'node:assert/strict';
import { createLiveLoader } from '../src/live-loader.mjs';

const now = 2000000000000;
const slot = Math.floor(now / 20000);
const snapshot = age => ({ feed: { header: { timestamp: now / 1000 - age }, entity: [] } });
const response = (body, status = 200) => ({ ok: status === 200, status, json: async () => body });

test('cached missing recent slots do not hide a fresh older slot', async () => {
  const load = createLiveLoader(async url => {
    if (url.includes(`/${slot - 4}.json`)) return response(snapshot(85));
    if (url.includes(`/${slot - 5}.json`)) return response(snapshot(105));
    return response(null, 404);
  }, () => now);
  assert.equal((await load()).header.timestamp, now / 1000 - 85);
});

test('a failed request does not discard another valid snapshot', async () => {
  const load = createLiveLoader(async url => {
    if (url.includes(`/${slot - 2}.json`)) return response(snapshot(40));
    throw Error('Network error');
  }, () => now);
  assert.equal((await load()).header.timestamp, now / 1000 - 40);
});

test('immutable commit fallback works and discovery is rate limited', async () => {
  let time = now, discoveries = 0;
  const sha = 'a'.repeat(40);
  const load = createLiveLoader(async url => {
    if (url.includes('api.github.com')) { discoveries++; return response({object:{sha}}); }
    if (url.includes(`/${sha}/latest.json`)) return response(snapshot(110));
    return response(null, 404);
  }, () => time);
  assert.equal((await load()).header.timestamp, now / 1000 - 110);
  time += 20000;
  await assert.rejects(load(), /No fresh/);
  assert.equal(discoveries, 1);
});

test('stale and future dated feeds are never returned as live', async () => {
  for (const age of [121, -61]) {
    const load = createLiveLoader(async () => response(snapshot(age)), () => now);
    await assert.rejects(load(), /No fresh/);
  }
});
